require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

console.log('Spectra server starting...');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const sql = neon(process.env.DATABASE_URL);
const DB_FILE = path.join(__dirname, 'data', 'db.json');

const SESSION_TTL =
  Number(process.env.SESSION_TTL_HOURS || 12) *
  60 *
  60 *
  1000;

app.use(helmet({ contentSecurityPolicy: false }));

app.use(express.json({ limit: '1mb' }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use(express.static(path.join(__dirname, 'public')));


// =====================================================
// DEFAULT DATABASE
// =====================================================

function emptyDB() {
  return {
    organizations: [],
    vehicles: [],
    users: [],
    organizationVehicles: [],
    requests: [],
    rules: [],
    adminJailRules: [],
    audit: [],
    sessions: []
  };
}


// =====================================================
// LOAD INITIAL DATA FROM db.json
// =====================================================

function loadLocalDB() {
  try {
    return JSON.parse(
      fs.readFileSync(DB_FILE, 'utf8')
    );
  } catch {
    return emptyDB();
  }
}


// =====================================================
// NEON DATABASE
// =====================================================

async function setupDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL
    )
  `;

  const result = await sql`
    SELECT data
    FROM app_state
    WHERE id = 1
    LIMIT 1
  `;

  if (result.length === 0) {
    console.log('No Neon data found. Importing db.json...');

    const initialDB = loadLocalDB();

    await sql`
      INSERT INTO app_state (id, data)
      VALUES (1, ${JSON.stringify(initialDB)}::jsonb)
    `;

    return initialDB;
  }

  return result[0].data;
}


// Die Datenbank wird einmal beim Start geladen.
let db = null;

const dbReady = setupDatabase()
  .then(async loadedDB => {
    db = loadedDB || emptyDB();

    if (!Array.isArray(db.organizations)) db.organizations = [];
    if (!Array.isArray(db.vehicles)) db.vehicles = [];
    if (!Array.isArray(db.users)) db.users = [];
    if (!Array.isArray(db.organizationVehicles)) {
      db.organizationVehicles = [];
    }
    if (!Array.isArray(db.requests)) db.requests = [];
    if (!Array.isArray(db.rules)) db.rules = [];
    if (!Array.isArray(db.adminJailRules)) {
      db.adminJailRules = [];
    }
    if (!Array.isArray(db.audit)) db.audit = [];
    if (!Array.isArray(db.sessions)) db.sessions = [];

    await seedUsers();

    console.log('Neon database ready.');

    return db;
  })
  .catch(error => {
    console.error('DATABASE STARTUP ERROR:', error);
    throw error;
  });


// Jede API-Anfrage wartet, bis Neon geladen wurde.
app.use(async (req, res, next) => {
  try {
    await dbReady;
    next();
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Datenbank konnte nicht geladen werden'
    });
  }
});


// =====================================================
// SAVE DATABASE TO NEON
// =====================================================

async function saveDB() {
  await sql`
    UPDATE app_state
    SET data = ${JSON.stringify(db)}::jsonb
    WHERE id = 1
  `;
}


// =====================================================
// USER HELPERS
// =====================================================

function cleanUser(u) {
  return u
    ? {
        id: u.id,
        username: u.username,
        role: u.role,
        organizationId: u.organizationId,
        active: u.active
      }
    : null;
}


// =====================================================
// AUDIT
// =====================================================

function audit(
  actor,
  action,
  details = ''
) {
  db.audit.unshift({
    id: randomUUID(),
    at: new Date().toISOString(),
    actor: actor?.username || 'SYSTEM',
    action,
    details
  });

  db.audit = db.audit.slice(0, 1000);
}


// =====================================================
// SEED USERS
// =====================================================

async function seedUsers() {
  const seeds = [];

  if (process.env.ADMIN_PASSWORD) {
    seeds.push({
      username: 'admin',
      role: 'ADMIN',
      organizationId: null,
      password: process.env.ADMIN_PASSWORD
    });
  }

  if (process.env.PROJEKTLEITUNG_PASSWORD) {
    seeds.push({
      username: 'projektleitung',
      role: 'PROJEKTLEITUNG',
      organizationId: null,
      password: process.env.PROJEKTLEITUNG_PASSWORD
    });
  }

  if (process.env.LEADER_PASSWORD) {
    seeds.push({
      username: 'leader',
      role: 'LEADER',
      organizationId:
        db.organizations.find(
          o => o.name === process.env.LEADER_ORG
        )?.id ||
        db.organizations[0]?.id ||
        null,
      password: process.env.LEADER_PASSWORD
    });
  }

  let changed = false;

  for (const seed of seeds) {
    const existing = db.users.find(
      u =>
        u.username.toLowerCase() ===
        seed.username.toLowerCase()
    );

    if (!existing) {
      db.users.push({
        id: randomUUID(),
        username: seed.username,
        role: seed.role,
        organizationId: seed.organizationId,
        active: true,
        passwordHash: bcrypt.hashSync(
          seed.password,
          12
        )
      });

      changed = true;
    }
  }

  if (changed) {
    await saveDB();
  }
}


// =====================================================
// AUTH
// =====================================================

function auth(req, res, next) {
  const token = (req.headers.authorization || '')
    .replace(/^Bearer\s+/i, '');

  const session = db.sessions.find(
    s =>
      s.token === token &&
      new Date(s.expiresAt) > new Date()
  );

  if (!session) {
    return res.status(401).json({
      error: 'Nicht angemeldet'
    });
  }

  const user = db.users.find(
    u =>
      u.id === session.userId &&
      u.active
  );

  if (!user) {
    return res.status(401).json({
      error: 'Benutzer nicht verfügbar'
    });
  }

  req.user = user;
  req.token = token;

  next();
}


// =====================================================
// ROLES
// =====================================================

function roles(...allowed) {
  return (req, res, next) => {
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Keine Berechtigung'
      });
    }

    next();
  };
}


function ownOrg(req, organizationId) {
  return (
    req.user.role !== 'LEADER' ||
    req.user.organizationId === organizationId
  );
}


function vehicleName(id) {
  return (
    db.vehicles.find(v => v.id === id)?.name ||
    'Unbekannt'
  );
}


function orgName(id) {
  return (
    db.organizations.find(o => o.id === id)?.name ||
    'Unbekannt'
  );
}


// =====================================================
// LOGIN
// =====================================================

app.post('/api/login', async (req, res) => {
  const {
    username,
    password
  } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      error:
        'Benutzername und Passwort erforderlich'
    });
  }

  const user = db.users.find(
    u =>
      u.username.toLowerCase() ===
        String(username).toLowerCase() &&
      u.active
  );

  if (
    !user ||
    !(await bcrypt.compare(
      password,
      user.passwordHash
    ))
  ) {
    return res.status(401).json({
      error: 'Ungültige Zugangsdaten'
    });
  }

  const token =
    randomUUID() +
    randomUUID().replaceAll('-', '');

  db.sessions.push({
    token,
    userId: user.id,
    createdAt:
      new Date().toISOString(),
    expiresAt:
      new Date(
        Date.now() + SESSION_TTL
      ).toISOString()
  });

  db.sessions = db.sessions.filter(
    s =>
      new Date(s.expiresAt) > new Date()
  );

  audit(db.user, 'LOGIN');

  await saveDB();

  res.json({
    token,
    user: cleanUser(user)
  });
});


// =====================================================
// LOGOUT
// =====================================================

app.post(
  '/api/logout',
  auth,
  async (req, res) => {
    db.sessions =
      db.sessions.filter(
        s => s.token !== req.token
      );

    audit(
      req.user,
      'LOGOUT'
    );

    await saveDB();

    res.json({
      ok: true
    });
  }
);


// =====================================================
// CURRENT USER
// =====================================================

app.get(
  '/api/me',
  auth,
  (req, res) => {
    res.json({
      user: cleanUser(req.user)
    });
  }
);


// =====================================================
// DASHBOARD
// =====================================================

app.get(
  '/api/dashboard',
  auth,
  (req, res) => {
    const visibleRequests =
      req.user.role === 'LEADER'
        ? db.requests.filter(
            r =>
              r.organizationId ===
              req.user.organizationId
          )
        : db.requests;

    const fleet =
      req.user.role === 'LEADER'
        ? db.organizationVehicles.filter(
            x =>
              x.organizationId ===
              req.user.organizationId
          )
        : db.organizationVehicles;

    res.json({
      stats: {
        requests:
          visibleRequests.length,

        pending:
          visibleRequests.filter(
            r =>
              [
                'BEANTRAGT',
                'IN_PRUEFUNG'
              ].includes(r.status)
          ).length,

        approved:
          visibleRequests.filter(
            r =>
              r.status ===
              'GENEHMIGT'
          ).length,

        fleet:
          fleet.length
      },

      recent:
        visibleRequests.slice(0, 8)
    });
  }
);


// =====================================================
// ORGANIZATIONS
// =====================================================

app.get(
  '/api/organizations',
  auth,
  (req, res) => {
    res.json(db.organizations);
  }
);


// =====================================================
// VEHICLES
// =====================================================

app.get(
  '/api/vehicles',
  auth,
  (req, res) => {
    res.json(db.vehicles);
  }
);


// =====================================================
// FLEET
// =====================================================

app.get(
  '/api/fleet',
  auth,
  (req, res) => {
    const rows =
      db.organizationVehicles
        .filter(
          x =>
            req.user.role !== 'LEADER' ||
            x.organizationId ===
              req.user.organizationId
        )
        .map(x => ({
          ...x,

          vehicle:
            db.vehicles.find(
              v =>
                v.id ===
                x.vehicleId
            ),

          organization:
            db.organizations.find(
              o =>
                o.id ===
                x.organizationId
            )
        }));

    res.json(rows);
  }
);


// =====================================================
// REQUESTS
// =====================================================

app.get(
  '/api/requests',
  auth,
  (req, res) => {
    let rows =
      db.requests.filter(
        r =>
          req.user.role !== 'LEADER' ||
          r.organizationId ===
            req.user.organizationId
      );

    rows = rows.map(r => ({
      ...r,
      vehicleName:
        vehicleName(r.vehicleId),
      organizationName:
        orgName(r.organizationId)
    }));

    res.json(rows);
  }
);


// =====================================================
// CREATE REQUEST
// =====================================================

app.post(
  '/api/requests',
  auth,
  roles(
    'LEADER',
    'ADMIN',
    'PROJEKTLEITUNG'
  ),
  async (req, res) => {
    const {
      applicant,
      organizationId,
      vehicleId,
      date,
      imageUrl,
      comment
    } = req.body || {};

    if (
      !applicant ||
      !organizationId ||
      !vehicleId
    ) {
      return res.status(400).json({
        error:
          'Antragsteller, Organisation und Fahrzeug sind erforderlich'
      });
    }

    if (
      !ownOrg(
        req,
        organizationId
      )
    ) {
      return res.status(403).json({
        error:
          'Nur die eigene Organisation darf beantragt werden'
      });
    }

    if (
      !db.organizations.some(
        o =>
          o.id === organizationId
      ) ||
      !db.vehicles.some(
        v =>
          v.id === vehicleId
      )
    ) {
      return res.status(400).json({
        error:
          'Ungültige Organisation oder Fahrzeug'
      });
    }

    if (
      db.organizationVehicles.some(
        x =>
          x.organizationId ===
            organizationId &&
          x.vehicleId ===
            vehicleId
      )
    ) {
      return res.status(409).json({
        error:
          'Dieses Fahrzeug ist bereits in der Flotte'
      });
    }

    if (
      db.requests.some(
        r =>
          r.organizationId ===
            organizationId &&
          r.vehicleId ===
            vehicleId &&
          r.status !==
            'ABGELEHNT'
      )
    ) {
      return res.status(409).json({
        error:
          'Für dieses Fahrzeug existiert bereits ein offener Antrag'
      });
    }

    const request = {
      id: randomUUID(),
      applicant,
      organizationId,
      vehicleId,
      date:
        date ||
        new Date()
          .toISOString()
          .slice(0, 10),
      status: 'BEANTRAGT',
      imageUrl:
        imageUrl || '',
      reviewerId: null,
      reviewer: null,
      comment:
        comment || '',
      createdAt:
        new Date().toISOString()
    };

    db.requests.unshift(request);

    audit(
      req.user,
      'REQUEST_CREATED',
      `${orgName(
        organizationId
      )} / ${vehicleName(
        vehicleId
      )}`
    );

    await saveDB();

    res.status(201).json(request);
  }
);


// =====================================================
// UPDATE REQUEST
// =====================================================

app.patch(
  '/api/requests/:id',
  auth,
  roles(
    'ADMIN',
    'PROJEKTLEITUNG'
  ),
  async (req, res) => {
    const request =
      db.requests.find(
        x =>
          x.id ===
          req.params.id
      );

    if (!request) {
      return res.status(404).json({
        error:
          'Antrag nicht gefunden'
      });
    }

    const {
      status,
      comment
    } = req.body || {};

    const allowed = [
      'BEANTRAGT',
      'IN_PRUEFUNG',
      'GENEHMIGT',
      'ABGELEHNT'
    ];

    if (
      status &&
      !allowed.includes(status)
    ) {
      return res.status(400).json({
        error:
          'Ungültiger Status'
      });
    }

    if (
      status ===
        'GENEHMIGT' &&
      !db.organizationVehicles.some(
        x =>
          x.organizationId ===
            request.organizationId &&
          x.vehicleId ===
            request.vehicleId
      )
    ) {
      db.organizationVehicles.push({
        id: randomUUID(),
        organizationId:
          request.organizationId,
        vehicleId:
          request.vehicleId,
        requestId:
          request.id,
        addedAt:
          new Date().toISOString()
      });
    }

    if (status) {
      request.status =
        status;
    }

    if (
      comment !== undefined
    ) {
      request.comment =
        comment;
    }

    request.reviewerId =
      req.user.id;

    request.reviewer =
      req.user.username;

    request.reviewedAt =
      new Date().toISOString();

    audit(
      req.user,
      'REQUEST_UPDATED',
      `${request.id} -> ${request.status}`
    );

    await saveDB();

    res.json(request);
  }
);


// =====================================================
// DELETE REQUEST
// =====================================================

app.delete(
  '/api/requests/:id',
  auth,
  roles(
    'ADMIN',
    'PROJEKTLEITUNG'
  ),
  async (req, res) => {
    const index =
      db.requests.findIndex(
        x =>
          x.id ===
          req.params.id
      );

    if (index < 0) {
      return res.status(404).json({
        error:
          'Antrag nicht gefunden'
      });
    }

    const [request] =
      db.requests.splice(
        index,
        1
      );

    audit(
      req.user,
      'REQUEST_DELETED',
      `${request.applicant} / ${vehicleName(
        request.vehicleId
      )}`
    );

    await saveDB();

    res.json({
      ok: true
    });
  }
);


// =====================================================
// RULES
// =====================================================

app.get(
  '/api/rules',
  auth,
  (req, res) => {
    res.json(db.rules);
  }
);

app.put(
  '/api/rules',
  auth,
  roles(
    'ADMIN',
    'PROJEKTLEITUNG'
  ),
  async (req, res) => {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({
        error:
          'Array erwartet'
      });
    }

    db.rules =
      req.body;

    audit(
      req.user,
      'RULES_UPDATED'
    );

    await saveDB();

    res.json(db.rules);
  }
);


// =====================================================
// ADMIN JAIL
// =====================================================

app.get(
  '/api/admin-jail',
  auth,
  (req, res) => {
    res.json(
      db.adminJailRules
    );
  }
);

app.put(
  '/api/admin-jail',
  auth,
  roles(
    'ADMIN',
    'PROJEKTLEITUNG'
  ),
  async (req, res) => {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({
        error:
          'Array erwartet'
      });
    }

    db.adminJailRules =
      req.body;

    audit(
      req.user,
      'ADMIN_JAIL_UPDATED'
    );

    await saveDB();

    res.json(
      db.adminJailRules
    );
  }
);


// =====================================================
// USERS
// =====================================================

app.get(
  '/api/users',
  auth,
  roles(
    'ADMIN',
    'PROJEKTLEITUNG'
  ),
  (req, res) => {
    res.json(
      db.users.map(
        cleanUser
      )
    );
  }
);


// =====================================================
// CREATE USER
// =====================================================

app.post(
  '/api/users',
  auth,
  roles(
    'PROJEKTLEITUNG'
  ),
  async (req, res) => {
    const {
      username,
      password,
      role,
      organizationId
    } = req.body || {};

    if (
      !username ||
      !password ||
      ![
        'ADMIN',
        'LEADER',
        'PROJEKTLEITUNG'
      ].includes(role)
    ) {
      return res.status(400).json({
        error:
          'Ungültige Benutzerdaten'
      });
    }

    if (
      db.users.some(
        u =>
          u.username.toLowerCase() ===
          username.toLowerCase()
      )
    ) {
      return res.status(409).json({
        error:
          'Benutzer existiert bereits'
      });
    }

    const user = {
      id: randomUUID(),
      username,
      role,
      organizationId:
        role === 'LEADER'
          ? organizationId
          : null,
      active: true,
      passwordHash:
        await bcrypt.hash(
          password,
          12
        )
    };

    db.users.push(user);

    audit(
      req.user,
      'USER_CREATED',
      username
    );

    await saveDB();

    res.status(201).json(
      cleanUser(user)
    );
  }
);


// =====================================================
// UPDATE USER
// =====================================================

app.patch(
  '/api/users/:id',
  auth,
  roles(
    'PROJEKTLEITUNG'
  ),
  async (req, res) => {
    const user =
      db.users.find(
        x =>
          x.id ===
          req.params.id
      );

    if (!user) {
      return res.status(404).json({
        error:
          'Benutzer nicht gefunden'
      });
    }

    const {
      role,
      organizationId,
      active,
      password
    } = req.body || {};

    if (role) {
      user.role =
        role;
    }

    if (
      organizationId !==
      undefined
    ) {
      user.organizationId =
        organizationId;
    }

    if (
      active !==
      undefined
    ) {
      user.active =
        !!active;
    }

    if (password) {
      user.passwordHash =
        await bcrypt.hash(
          password,
          12
        );
    }

    audit(
      req.user,
      'USER_UPDATED',
      user.username
    );

    await saveDB();

    res.json(
      cleanUser(user)
    );
  }
);


// =====================================================
// AUDIT
// =====================================================

app.get(
  '/api/audit',
  auth,
  roles(
    'ADMIN',
    'PROJEKTLEITUNG'
  ),
  (req, res) => {
    res.json(db.audit);
  }
);


// =====================================================
// CREATE VEHICLE
// =====================================================

app.post(
  '/api/vehicles',
  auth,
  roles(
    'ADMIN',
    'PROJEKTLEITUNG'
  ),
  async (req, res) => {
    const {
      name,
      category,
      image
    } = req.body || {};

    if (!name) {
      return res.status(400).json({
        error:
          'Name erforderlich'
      });
    }

    const vehicle = {
      id: randomUUID(),
      name,
      category:
        category ||
        'Sonstiges',
      image:
        image || ''
    };

    db.vehicles.push(
      vehicle
    );

    audit(
      req.user,
      'VEHICLE_CREATED',
      name
    );

    await saveDB();

    res.status(201).json(
      vehicle
    );
  }
);


// =====================================================
// DELETE VEHICLE
// =====================================================

app.delete(
  '/api/vehicles/:id',
  auth,
  roles(
    'ADMIN',
    'PROJEKTLEITUNG'
  ),
  async (req, res) => {
    if (
      db.organizationVehicles.some(
        x =>
          x.vehicleId ===
          req.params.id
      ) ||
      db.requests.some(
        x =>
          x.vehicleId ===
            req.params.id &&
          x.status !==
            'ABGELEHNT'
      )
    ) {
      return res.status(409).json({
        error:
          'Fahrzeug wird noch verwendet'
      });
    }

    const index =
      db.vehicles.findIndex(
        x =>
          x.id ===
          req.params.id
      );

    if (index < 0) {
      return res.status(404).json({
        error:
          'Fahrzeug nicht gefunden'
      });
    }

    const [vehicle] =
      db.vehicles.splice(
        index,
        1
      );

    audit(
      req.user,
      'VEHICLE_DELETED',
      vehicle.name
    );

    await saveDB();

    res.json({
      ok: true
    });
  }
);


// =====================================================
// RESET DEMO
// =====================================================

app.post(
  '/api/reset-demo',
  auth,
  roles(
    'PROJEKTLEITUNG'
  ),
  async (req, res) => {
    db.requests = [];
    db.organizationVehicles = [];
    db.audit = [];

    await saveDB();

    res.json({
      ok: true
    });
  }
);


// =====================================================
// FRONTEND
// =====================================================

app.get(
  '*',
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        'public',
        'index.html'
      )
    );
  }
);


// =====================================================
// VERCEL
// =====================================================

module.exports = app;

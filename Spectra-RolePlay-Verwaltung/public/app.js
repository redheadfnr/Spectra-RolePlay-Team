const state = {
  token: localStorage.getItem('spectra_token'),
  user: null,
  organizations: [],
  vehicles: [],
  page: 'dashboard'
};

const $ = s => document.querySelector(s);

const esc = s =>
  String(s ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));

async function api(url, opts = {}) {
  opts.headers = {
    ...(opts.headers || {}),
    ...(state.token ? { Authorization: 'Bearer ' + state.token } : {})
  };

  if (opts.body && typeof opts.body !== 'string') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }

  const r = await fetch(url, opts);
  const d = await r.json().catch(() => ({}));

  if (r.status === 401) {
    logout(false);
    throw new Error(d.error || 'Nicht angemeldet');
  }

  if (!r.ok) {
    throw new Error(d.error || 'Fehler');
  }

  return d;
}

function toast(msg, bad = false) {
  const t = $('#toast');

  t.textContent = msg;
  t.className = 'toast ' + (bad ? 'bad' : '');

  setTimeout(() => {
    t.className = '';
  }, 3000);
}

function logout(show = true) {
  localStorage.removeItem('spectra_token');

  state.token = null;
  state.user = null;

  $('#appView').classList.add('hidden');
  $('#loginView').classList.remove('hidden');

  if (show) {
    toast('Abgemeldet');
  }
}

async function init() {
  if (!state.token) return;

  try {
    const d = await api('/api/me');

    state.user = d.user;

    await loadBase();

    showApp();
    renderPage('dashboard');

  } catch {
    logout(false);
  }
}

async function loadBase() {
  state.organizations = await api('/api/organizations');
  state.vehicles = await api('/api/vehicles');
}

function showApp() {
  $('#loginView').classList.add('hidden');
  $('#appView').classList.remove('hidden');

  $('#userBadge').innerHTML = `
    <strong>${esc(state.user.username)}</strong>
    <span>
      ${esc(state.user.role)}
      ${
        state.user.organizationId
          ? ' · ' +
            esc(
              state.organizations.find(
                o => o.id === state.user.organizationId
              )?.name || ''
            )
          : ''
      }
    </span>
  `;

  $('#rolePill').textContent = state.user.role;

  document.querySelectorAll('.staffOnly').forEach(x => {
    x.style.display =
      ['ADMIN', 'PROJEKTLEITUNG'].includes(state.user.role)
        ? 'block'
        : 'none';
  });
}

function renderPage(page) {
  state.page = page;

  document
    .querySelectorAll('#nav button')
    .forEach(b =>
      b.classList.toggle('active', b.dataset.page === page)
    );

  const titles = {
    dashboard: 'Dashboard',
    requests: 'Fahrzeuganträge',
    fleet: 'Flotten',
    vehicles: 'Fahrzeugkatalog',
    rules: 'Bann-Richtlinien',
    jail: 'Admin-Jail',
    organizations: 'Organisationen',
    users: 'Benutzer',
    audit: 'Audit-Log'
  };

  $('#pageTitle').textContent = titles[page] || page;

  ({
    dashboard: renderDashboard,
    requests: renderRequests,
    fleet: renderFleet,
    vehicles: renderVehicles,
    rules: renderRules,
    jail: renderJail,
    organizations: renderOrganizations,
    users: renderUsers,
    audit: renderAudit
  }[page] || renderDashboard)();
}

async function renderDashboard() {
  const d = await api('/api/dashboard');

  $('#content').innerHTML = `
    <div class="grid stats">
      <div class="card stat">
        <small>Fahrzeuganträge</small>
        <strong>${d.stats.requests}</strong>
      </div>

      <div class="card stat">
        <small>Offen</small>
        <strong>${d.stats.pending}</strong>
      </div>

      <div class="card stat">
        <small>Genehmigt</small>
        <strong>${d.stats.approved}</strong>
      </div>

      <div class="card stat">
        <small>Flottenfahrzeuge</small>
        <strong>${d.stats.fleet}</strong>
      </div>
    </div>

    <div class="section-head">
      <h3>Letzte Anträge</h3>
      <button class="smallbtn" onclick="renderPage('requests')">
        Alle anzeigen
      </button>
    </div>

    <div class="card table-wrap">
      ${requestTable(d.recent || [], false)}
    </div>
  `;
}

function requestTable(rows, actions = true) {
  if (!rows.length) {
    return '<div class="empty">Noch keine Anträge vorhanden.</div>';
  }

  return `
    <table class="table">
      <thead>
        <tr>
          <th>Antragsteller</th>
          <th>Organisation</th>
          <th>Fahrzeug</th>
          <th>Datum</th>
          <th>Status</th>
          ${actions ? '<th>Aktion</th>' : ''}
        </tr>
      </thead>

      <tbody>
        ${rows
          .map(
            r => `
              <tr>
                <td>${esc(r.applicant)}</td>

                <td>
                  ${esc(
                    r.organizationName ||
                      orgName(r.organizationId)
                  )}
                </td>

                <td>
                  ${esc(
                    r.vehicleName ||
                      vehicleName(r.vehicleId)
                  )}
                </td>

                <td>${esc(r.date || '')}</td>

                <td>
                  <span class="status ${r.status}">
                    ${statusText(r.status)}
                  </span>
                </td>

                ${
                  actions
                    ? `
                      <td class="actions">
                        ${
                          ['ADMIN', 'PROJEKTLEITUNG'].includes(
                            state.user.role
                          )
                            ? `
                              <button
                                class="smallbtn ok"
                                onclick="reviewRequest('${r.id}','GENEHMIGT')"
                              >
                                Genehmigen
                              </button>

                              <button
                                class="smallbtn danger"
                                onclick="reviewRequest('${r.id}','ABGELEHNT')"
                              >
                                Ablehnen
                              </button>
                            `
                            : '—'
                        }
                      </td>
                    `
                    : ''
                }
              </tr>
            `
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function statusText(s) {
  return (
    {
      BEANTRAGT: 'Beantragt',
      IN_PRUEFUNG: 'In Prüfung',
      GENEHMIGT: 'Genehmigt',
      ABGELEHNT: 'Abgelehnt'
    }[s] || s
  );
}

function orgName(id) {
  return (
    state.organizations.find(o => o.id === id)?.name ||
    'Unbekannt'
  );
}

function vehicleName(id) {
  return (
    state.vehicles.find(v => v.id === id)?.name ||
    'Unbekannt'
  );
}

async function renderRequests() {
  const rows = await api('/api/requests');

  const leader = state.user.role === 'LEADER';

  $('#content').innerHTML = `
    <div class="section-head">
      <h3>Verwaltung</h3>

      ${
        leader ||
        ['ADMIN', 'PROJEKTLEITUNG'].includes(state.user.role)
          ? `
            <button
              class="primary"
              onclick="openRequestModal()"
            >
              + Neuer Antrag
            </button>
          `
          : ''
      }
    </div>

    <div class="card table-wrap">
      ${requestTable(rows, true)}
    </div>
  `;
}

async function reviewRequest(id, status) {
  try {
    await api('/api/requests/' + id, {
      method: 'PATCH',
      body: { status }
    });

    toast(
      status === 'GENEHMIGT'
        ? 'Antrag genehmigt'
        : 'Antrag abgelehnt'
    );

    await loadBase();

    renderPage(state.page);

  } catch (e) {
    toast(e.message, true);
  }
}

function openRequestModal() {
  const orgs =
    state.user.role === 'LEADER'
      ? state.organizations.filter(
          o => o.id === state.user.organizationId
        )
      : state.organizations;

  $('#modalContent').innerHTML = `
    <h3>Fahrzeugantrag erstellen</h3>

    <form id="reqForm">

      <div class="form-grid">

        <label>
          Antragsteller
          <input name="applicant" required>
        </label>

        <label>
          Datum
          <input
            name="date"
            type="date"
            value="${new Date()
              .toISOString()
              .slice(0, 10)}"
          >
        </label>

        <label>
          Organisation
          <select name="organizationId">
            ${orgs
              .map(
                o =>
                  `<option value="${o.id}">
                    ${esc(o.name)}
                  </option>`
              )
              .join('')}
          </select>
        </label>

        <label>
          Fahrzeug
          <select name="vehicleId">
            ${state.vehicles
              .map(
                v =>
                  `<option value="${v.id}">
                    ${esc(v.name)} · ${esc(v.category)}
                  </option>`
              )
              .join('')}
          </select>
        </label>

      </div>

      <label>
        Bild-URL
        <input
          name="imageUrl"
          type="url"
          placeholder="https://..."
        >
      </label>

      <label>
        Kommentar
        <textarea
          name="comment"
          rows="3"
        ></textarea>
      </label>

      <div class="btnrow">
        <button
          type="button"
          class="smallbtn"
          onclick="closeModal()"
        >
          Abbrechen
        </button>

        <button class="primary">
          Antrag senden
        </button>
      </div>

    </form>
  `;

  $('#reqForm').onsubmit = async e => {
    e.preventDefault();

    try {
      const data = Object.fromEntries(
        new FormData(e.target)
      );

      await api('/api/requests', {
        method: 'POST',
        body: data
      });

      closeModal();

      toast('Antrag erstellt');

      renderPage('requests');

    } catch (err) {
      toast(err.message, true);
    }
  };

  $('#modal').classList.remove('hidden');
}

async function renderFleet() {
  const rows = await api('/api/fleet');

  $('#content').innerHTML = `
    <div class="section-head">
      <h3>Aktuelle Flotten</h3>

      <span class="muted">
        Genehmigte Anträge werden automatisch hinzugefügt.
      </span>
    </div>

    <div class="grid cards">

      ${
        rows.length
          ? rows
              .map(
                x => `
                  <div class="card vehicle-card">

                    <div class="vehicle-image">
                      ${
                        x.vehicle?.image
                          ? `
                            <img
                              src="${esc(x.vehicle.image)}"
                              style="
                                width:100%;
                                height:100%;
                                object-fit:cover;
                              "
                              onerror="this.style.display='none'"
                            >
                          `
                          : '🚘'
                      }
                    </div>

                    <div class="body">

                      <h4>
                        ${esc(x.vehicle?.name)}
                      </h4>

                      <p>
                        ${esc(x.organization?.name)}
                        ·
                        ${esc(x.vehicle?.category)}
                      </p>

                    </div>

                  </div>
                `
              )
              .join('')
          : `
            <div class="card empty">
              Noch keine Fahrzeuge in einer Organisation.
            </div>
          `
      }

    </div>
  `;
}

/*
==================================================
FAHRZEUGKATALOG
==================================================
*/

async function renderVehicles() {
  const can = ['ADMIN', 'PROJEKTLEITUNG'].includes(
    state.user.role
  );

  $('#content').innerHTML = `
    <div class="section-head">

      <h3>Fahrzeugkatalog</h3>

      ${
        can
          ? `
            <button
              class="primary"
              onclick="openVehicleModal()"
            >
              + Fahrzeug hinzufügen
            </button>
          `
          : ''
      }

    </div>

    <div class="grid cards">

      ${
        state.vehicles.length
          ? state.vehicles
              .map(
                v => `
                  <div class="card vehicle-card">

                    <div class="vehicle-image">

                      ${
                        v.image
                          ? `
                            <img
                              src="${esc(v.image)}"
                              style="
                                width:100%;
                                height:100%;
                                object-fit:cover;
                              "
                              onerror="this.style.display='none'"
                            >
                          `
                          : '🚘'
                      }

                    </div>

                    <div class="body">

                      <h4>
                        ${esc(v.name)}
                      </h4>

                      <p>
                        ${esc(v.category)}
                      </p>

                      ${
                        can
                          ? `
                            <div
                              class="actions"
                              style="margin-top:12px"
                            >
                              <button
                                class="smallbtn danger"
                                onclick="deleteVehicle('${v.id}')"
                              >
                                Löschen
                              </button>
                            </div>
                          `
                          : ''
                      }

                    </div>

                  </div>
                `
              )
              .join('')
          : `
            <div class="card empty">
              Noch keine Fahrzeuge vorhanden.
            </div>
          `
      }

    </div>
  `;
}

/*
==================================================
FAHRZEUG HINZUFÜGEN
==================================================
*/

function openVehicleModal() {
  $('#modalContent').innerHTML = `
    <h3>Fahrzeug hinzufügen</h3>

    <form id="vehicleForm">

      <label>
        Name
        <input
          name="name"
          required
          placeholder="z.B. BMW M5"
        >
      </label>

      <label>
        Kategorie
        <input
          name="category"
          placeholder="z.B. Sportwagen"
        >
      </label>

      <label>
        Bild-URL
        <input
          name="image"
          type="url"
          placeholder="https://..."
        >

        <small class="muted">
          Füge einen direkten Link zu einem Bild ein.
        </small>
      </label>

      <div
        id="vehicleImagePreview"
        style="
          margin-top:12px;
          display:none;
          border-radius:12px;
          overflow:hidden;
          height:180px;
          background:#111;
        "
      >

        <img
          id="vehiclePreviewImg"
          alt="Bildvorschau"
          style="
            width:100%;
            height:100%;
            object-fit:cover;
          "
        >

      </div>

      <div class="btnrow">

        <button
          type="button"
          class="smallbtn"
          onclick="closeModal()"
        >
          Abbrechen
        </button>

        <button class="primary">
          Speichern
        </button>

      </div>

    </form>
  `;

  const form = $('#vehicleForm');

  const imageInput =
    form.querySelector('[name="image"]');

  const preview =
    $('#vehicleImagePreview');

  const previewImg =
    $('#vehiclePreviewImg');

  imageInput.addEventListener('input', () => {
    const url = imageInput.value.trim();

    if (!url) {
      preview.style.display = 'none';
      previewImg.removeAttribute('src');
      return;
    }

    previewImg.onload = () => {
      preview.style.display = 'block';
    };

    previewImg.onerror = () => {
      preview.style.display = 'none';
      previewImg.removeAttribute('src');
    };

    previewImg.src = url;
  });

  form.onsubmit = async e => {
    e.preventDefault();

    try {
      const data = Object.fromEntries(
        new FormData(e.target)
      );

      await api('/api/vehicles', {
        method: 'POST',
        body: data
      });

      closeModal();

      await loadBase();

      renderPage('vehicles');

      toast('Fahrzeug hinzugefügt');

    } catch (err) {
      toast(err.message, true);
    }
  };

  $('#modal').classList.remove('hidden');
}

async function deleteVehicle(id) {
  if (!confirm('Fahrzeug wirklich löschen?')) return;

  try {
    await api('/api/vehicles/' + id, {
      method: 'DELETE'
    });

    await loadBase();

    renderPage('vehicles');

    toast('Fahrzeug gelöscht');

  } catch (e) {
    toast(e.message, true);
  }
}

/*
==================================================
BANN-RICHTLINIEN
==================================================
*/

const banRules = [
  ['6 Stunden', ['Bug-Kleidung']],

  [
    '12 Stunden',
    [
      'Safezone nicht beachtet',
      'Unnötiges Beleidigen',
      'Combat-Logging',
      'Auf das Regelwerk hinweisen',
      'OOC Talk',
      'FailRP',
      'Meta-Gaming'
    ]
  ],

  [
    '1 Tag',
    [
      'PowerRP',
      'Leichenschändigung',
      'Medic-/Mech. Schutz nicht eingehalten',
      'RP-Flucht',
      'MD / PD Auto fahren'
    ]
  ],

  [
    '3 Tage',
    [
      'Drittpartei',
      'Supportflucht',
      'Leichen looten',
      'Medic / Mechaniker umgebracht',
      'Unangekündigte Stürmung',
      'Rechnung falsch ausstellen',
      'Baiting',
      'Reden am Boden',
      'Unnötiges Gambo',
      'Roleplay RDM',
      'Bugweitergabe'
    ]
  ],

  [
    '1 Woche',
    [
      'Job-Abuse',
      'Lügen im Support',
      'Beleidigung im Support',
      'Korruption als Führungsebene',
      'Bugusing',
      'SPAM (Calladmin etc.)',
      'Extreme Trolling (erstmalig)'
    ]
  ],

  ['2 Wochen', []],

  ['1 Monat', ['RDM', 'VDM']],

  [
    '1 Jahr',
    [
      'AFK-Farming',
      'Fake-Admin',
      'Import-Car weitergeben'
    ]
  ],

  [
    'Permanent',
    [
      'Modding',
      'Rassismus',
      'Verkauf auf Modding / Sicherheitsban',
      'CM Ausschluss',
      'Beleidigung der Toten',
      'Bugusing mit Geld',
      'Vergeltungs-RP',
      'Modderwaffen',
      'Import-Car weitergeben bei schwerem Missbrauch',
      'Staatswaffenhandel',
      'Handeln mit Staatsfahrzeugen',
      'Massen-RDM/VDM',
      'extremes Trolling',
      'Multiaccount',
      'Blacklist Wörter',
      'Trolling',
      'Cheating/Hacking',
      'Exploiting',
      'Doxxing',
      'Real-Life-Drohungen',
      'Ban-Umgehung',
      'Diskriminierung'
    ]
  ]
];

async function renderRules() {
  $('#content').innerHTML = `
    <div class="notice">
      Teamler sollen die Richtlinien einhalten.
      Abweichungen müssen begründet werden.
      Banns über TX sind nachvollziehbar zu dokumentieren,
      z.B. „Bann: FailRP“.
      Regeln können durch berechtigte Rollen angepasst werden.
    </div>

    <div style="margin-top:18px">

      ${banRules
        .map(
          g => `
            <div class="card rule-group">

              <h4>${g[0]}</h4>

              ${
                g[1].length
                  ? g[1]
                      .map(
                        x => `
                          <div class="rule">
                            <span>${esc(x)}</span>
                            <span class="sanction">
                              ${g[0]}
                            </span>
                          </div>
                        `
                      )
                      .join('')
                  : `
                    <div class="muted">
                      Keine Einträge.
                    </div>
                  `
              }

            </div>
          `
        )
        .join('')}

    </div>
  `;
}

async function renderJail() {
  const rows = await api('/api/admin-jail');

  $('#content').innerHTML = `
    <div class="card table-wrap">

      <table class="table">

        <thead>
          <tr>
            <th>Regel</th>
            <th>Admin-Jail</th>
          </tr>
        </thead>

        <tbody>

          ${rows
            .map(
              r => `
                <tr>
                  <td>${esc(r.name)}</td>
                  <td>
                    <b>${r.minutes} Minuten</b>
                  </td>
                </tr>
              `
            )
            .join('')}

        </tbody>

      </table>

    </div>
  `;
}

async function renderOrganizations() {
  $('#content').innerHTML = `
    <div class="grid cards">

      ${state.organizations
        .map(
          o => `
            <div class="card">

              <h3>
                ${esc(o.name)}
              </h3>

              <p class="muted">
                ${
                  state.user.role === 'LEADER' &&
                  state.user.organizationId !== o.id
                    ? '—'
                    : 'Organisation'
                }
              </p>

            </div>
          `
        )
        .join('')}

    </div>
  `;
}

async function renderUsers() {
  const rows = await api('/api/users');

  $('#content').innerHTML = `
    <div class="section-head">

      <h3>Benutzer & Rollen</h3>

      ${
        state.user.role === 'PROJEKTLEITUNG'
          ? `
            <button
              class="primary"
              onclick="openUserModal()"
            >
              + Benutzer
            </button>
          `
          : ''
      }

    </div>

    <div class="card table-wrap">

      <table class="table">

        <thead>
          <tr>
            <th>Benutzer</th>
            <th>Rolle</th>
            <th>Organisation</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>

          ${rows
            .map(
              u => `
                <tr>

                  <td>
                    ${esc(u.username)}
                  </td>

                  <td>
                    ${esc(u.role)}
                  </td>

                  <td>
                    ${esc(orgName(u.organizationId))}
                  </td>

                  <td>
                    ${
                      u.active
                        ? '<span class="success-text">Aktiv</span>'
                        : '<span class="danger-text">Deaktiviert</span>'
                    }
                  </td>

                </tr>
              `
            )
            .join('')}

        </tbody>

      </table>

    </div>
  `;
}

function openUserModal() {
  $('#modalContent').innerHTML = `
    <h3>Benutzer anlegen</h3>

    <form id="userForm">

      <label>
        Benutzername
        <input
          name="username"
          required
        >
      </label>

      <label>
        Passwort
        <input
          name="password"
          type="password"
          required
        >
      </label>

      <label>
        Rolle

        <select name="role">
          <option>LEADER</option>
          <option>ADMIN</option>
          <option>PROJEKTLEITUNG</option>
        </select>

      </label>

      <label>
        Organisation

        <select name="organizationId">

          ${state.organizations
            .map(
              o => `
                <option value="${o.id}">
                  ${esc(o.name)}
                </option>
              `
            )
            .join('')}

        </select>

      </label>

      <div class="btnrow">

        <button
          type="button"
          class="smallbtn"
          onclick="closeModal()"
        >
          Abbrechen
        </button>

        <button class="primary">
          Anlegen
        </button>

      </div>

    </form>
  `;

  $('#userForm').onsubmit = async e => {
    e.preventDefault();

    try {
      await api('/api/users', {
        method: 'POST',
        body: Object.fromEntries(
          new FormData(e.target)
        )
      });

      closeModal();

      renderPage('users');

      toast('Benutzer angelegt');

    } catch (err) {
      toast(err.message, true);
    }
  };

  $('#modal').classList.remove('hidden');
}

async function renderAudit() {
  const rows = await api('/api/audit');

  $('#content').innerHTML = `
    <div class="card table-wrap">

      <table class="table">

        <thead>
          <tr>
            <th>Zeit</th>
            <th>Benutzer</th>
            <th>Aktion</th>
            <th>Details</th>
          </tr>
        </thead>

        <tbody>

          ${rows
            .map(
              x => `
                <tr>

                  <td>
                    ${new Date(
                      x.at
                    ).toLocaleString('de-DE')}
                  </td>

                  <td>
                    ${esc(x.actor)}
                  </td>

                  <td>
                    ${esc(x.action)}
                  </td>

                  <td>
                    ${esc(x.details)}
                  </td>

                </tr>
              `
            )
            .join('')}

        </tbody>

      </table>

    </div>
  `;
}

function closeModal() {
  $('#modal').classList.add('hidden');
}

$('#loginForm').onsubmit = async e => {
  e.preventDefault();

  try {
    const d = await api('/api/login', {
      method: 'POST',
      body: {
        username: $('#loginUser').value,
        password: $('#loginPass').value
      }
    });

    state.token = d.token;
    state.user = d.user;

    localStorage.setItem(
      'spectra_token',
      state.token
    );

    await loadBase();

    showApp();

    renderPage('dashboard');

    toast('Erfolgreich angemeldet');

  } catch (err) {
    toast(err.message, true);
  }
};

$('#logoutBtn').onclick = () => logout();

$('#modalClose').onclick = closeModal;

$('#modal').onclick = e => {
  if (e.target.id === 'modal') {
    closeModal();
  }
};

document
  .querySelectorAll('#nav button')
  .forEach(b => {
    b.onclick = () => renderPage(b.dataset.page);
  });

init();

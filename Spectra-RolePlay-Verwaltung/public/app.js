const $ = s => document.querySelector(s);

const state = {
  token: localStorage.getItem('spectra_token'),
  token: localStorage.getItem('spectra_token') || '',
user: null,
  organizations: [],
  dashboard: null,
  requests: [],
vehicles: [],
  page: 'dashboard'
  organizations: [],
  users: [],
  audit: []
};

const $ = s => document.querySelector(s);
const pageTitles = {
  dashboard: 'Dashboard',
  requests: 'Fahrzeuganträge',
  fleet: 'Flotten',
  vehicles: 'Fahrzeuge',
  rules: 'Bann-Richtlinien',
  jail: 'Admin-Jail',
  organizations: 'Organisationen',
  users: 'Benutzer',
  audit: 'Audit-Log'
};

function toast(message, error = false) {
  const el = $('#toast');

const esc = s =>
  String(s ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
  el.textContent = message;
  el.className = error ? 'show error' : 'show';

  clearTimeout(window.__toastTimer);

  window.__toastTimer = setTimeout(() => {
    el.className = '';
  }, 3000);
}

async function api(url, opts = {}) {
opts.headers = {
...(opts.headers || {}),
    ...(state.token ? { Authorization: 'Bearer ' + state.token } : {})
    ...(state.token
      ? { Authorization: 'Bearer ' + state.token }
      : {})
};

  if (opts.body && typeof opts.body !== 'string') {
  if (
    opts.body &&
    typeof opts.body !== 'string' &&
    !(opts.body instanceof FormData)
  ) {
opts.headers['Content-Type'] = 'application/json';
opts.body = JSON.stringify(opts.body);
}

const r = await fetch(url, opts);

const d = await r.json().catch(() => ({}));

if (r.status === 401) {
@@ -43,623 +69,415 @@ async function api(url, opts = {}) {
return d;
}

function toast(msg, bad = false) {
  const t = $('#toast');
async function uploadImage(file) {
  const formData = new FormData();

  t.textContent = msg;
  t.className = 'toast ' + (bad ? 'bad' : '');
  formData.append('image', file);

  setTimeout(() => {
    t.className = '';
  }, 3000);
  const result = await api('/api/upload-image', {
    method: 'POST',
    body: formData
  });

  return result.url;
}

function logout(show = true) {
function logout(showToast = true) {
localStorage.removeItem('spectra_token');

  state.token = null;
  state.token = '';
state.user = null;

$('#appView').classList.add('hidden');
$('#loginView').classList.remove('hidden');

  if (show) {
  if (showToast) {
toast('Abgemeldet');
}
}

async function init() {
  if (!state.token) return;
async function login(username, password) {
  const result = await api('/api/login', {
    method: 'POST',
    body: {
      username,
      password
    }
  });

  try {
    const d = await api('/api/me');
  state.token = result.token;
  state.user = result.user;

    state.user = d.user;
  localStorage.setItem('spectra_token', state.token);

    await loadBase();
  $('#loginView').classList.add('hidden');
  $('#appView').classList.remove('hidden');

    showApp();
    renderPage('dashboard');
  updateUserUI();

  } catch {
    logout(false);
  }
}
  await loadBase();

async function loadBase() {
  state.organizations = await api('/api/organizations');
  state.vehicles = await api('/api/vehicles');
  renderPage('dashboard');
}

function showApp() {
  $('#loginView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
function updateUserUI() {
  if (!state.user) return;

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
    <strong>${escapeHtml(state.user.username)}</strong>
    <span>${escapeHtml(state.user.role)}</span>
 `;

  $('#rolePill').textContent = state.user.role;
  $('#rolePill').textContent =
    state.user.organization_id
      ? `${state.user.role} · ${state.user.organization_id}`
      : state.user.role;

  document.querySelectorAll('.staffOnly').forEach(el => {
    const allowed =
      state.user.role === 'ADMIN' ||
      state.user.role === 'PROJEKTLEITUNG';

  document.querySelectorAll('.staffOnly').forEach(x => {
    x.style.display =
      ['ADMIN', 'PROJEKTLEITUNG'].includes(state.user.role)
        ? 'block'
        : 'none';
    el.style.display = allowed ? '' : 'none';
});
}

async function loadBase() {
  const [
    dashboard,
    requests,
    vehicles,
    organizations
  ] = await Promise.all([
    api('/api/dashboard'),
    api('/api/requests'),
    api('/api/vehicles'),
    api('/api/organizations')
  ]);

  state.dashboard = dashboard;
  state.requests = requests.requests || requests;
  state.vehicles = vehicles.vehicles || vehicles;
  state.organizations =
    organizations.organizations || organizations;

  if (
    state.user?.role === 'ADMIN' ||
    state.user?.role === 'PROJEKTLEITUNG'
  ) {
    const [users, audit] = await Promise.all([
      api('/api/users'),
      api('/api/audit')
    ]);

    state.users = users.users || users;
    state.audit = audit.audit || audit;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderPage(page) {
  state.page = page;
  $('#pageTitle').textContent =
    pageTitles[page] || page;

document
    .querySelectorAll('#nav button')
    .forEach(b =>
      b.classList.toggle('active', b.dataset.page === page)
    );
    .querySelectorAll('#nav button[data-page]')
    .forEach(btn => {
      btn.classList.toggle(
        'active',
        btn.dataset.page === page
      );
    });

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
  const content = $('#content');

  if (page === 'dashboard') {
    renderDashboard();
    return;
  }

  if (page === 'requests') {
    renderRequests();
    return;
  }

  if (page === 'fleet') {
    renderFleet();
    return;
  }

  if (page === 'vehicles') {
    renderVehicles();
    return;
  }

  if (page === 'rules') {
    renderRules();
    return;
  }

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
  if (page === 'jail') {
    renderJail();
    return;
  }

  if (page === 'organizations') {
    renderOrganizations();
    return;
  }

  if (page === 'users') {
    renderUsers();
    return;
  }

  if (page === 'audit') {
    renderAudit();
    return;
  }

  content.innerHTML = `
    <div class="card">
      <h3>Seite nicht gefunden</h3>
    </div>
  `;
}

async function renderDashboard() {
  const d = await api('/api/dashboard');
function renderDashboard() {
  const d = state.dashboard || {};

$('#content').innerHTML = `
    <div class="grid stats">
      <div class="card stat">
        <small>Fahrzeuganträge</small>
        <strong>${d.stats.requests}</strong>
    <div class="stats">
      <div class="stat">
        <span>Benutzer</span>
        <strong>${d.users ?? state.users.length}</strong>
     </div>

      <div class="card stat">
        <small>Offen</small>
        <strong>${d.stats.pending}</strong>
      <div class="stat">
        <span>Fahrzeuge</span>
        <strong>${d.vehicles ?? state.vehicles.length}</strong>
     </div>

      <div class="card stat">
        <small>Genehmigt</small>
        <strong>${d.stats.approved}</strong>
      <div class="stat">
        <span>Anträge</span>
        <strong>${d.requests ?? state.requests.length}</strong>
     </div>

      <div class="card stat">
        <small>Flottenfahrzeuge</small>
        <strong>${d.stats.fleet}</strong>
      <div class="stat">
        <span>Organisationen</span>
        <strong>${d.organizations ?? state.organizations.length}</strong>
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
    <div class="card">
      <h3>Willkommen zurück</h3>
      <p class="muted">
        Angemeldet als
        <strong>${escapeHtml(state.user?.username)}</strong>.
      </p>
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
function renderRequests() {
  const canReview =
    state.user?.role === 'ADMIN' ||
    state.user?.role === 'PROJEKTLEITUNG';

  const rows = state.requests.map(r => `
    <tr>
      <td>${escapeHtml(r.id)}</td>
      <td>${escapeHtml(r.organization_id || '-')}</td>
      <td>${escapeHtml(r.vehicle_name || r.name || '-')}</td>
      <td>${escapeHtml(r.category || '-')}</td>
      <td>${escapeHtml(r.status || '-')}</td>
      <td>
        ${
          canReview && r.status === 'PENDING'
            ? `
              <button
                class="smallbtn"
                onclick="reviewRequest('${escapeHtml(r.id)}','APPROVED')"
              >
                Genehmigen
              </button>

              <button
                class="smallbtn danger"
                onclick="reviewRequest('${escapeHtml(r.id)}','REJECTED')"
              >
                Ablehnen
              </button>
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
            : ''
        }
      </td>
    </tr>
  `).join('');

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
    <div class="card">
      <div class="card-head">
        <div>
          <h3>Fahrzeuganträge</h3>
          <p class="muted">
            Eingereichte Fahrzeuganträge verwalten.
          </p>
        </div>
      </div>

    <div class="card table-wrap">
      ${requestTable(rows, true)}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Organisation</th>
              <th>Fahrzeug</th>
              <th>Kategorie</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>

          <tbody>
            ${
              rows ||
              `
                <tr>
                  <td colspan="6">
                    <span class="muted">Keine Anträge vorhanden.</span>
                  </td>
                </tr>
              `
            }
          </tbody>
        </table>
      </div>
   </div>
 `;
}

async function reviewRequest(id, status) {
try {
    await api('/api/requests/' + id, {
    await api(`/api/requests/${id}`, {
method: 'PATCH',
body: { status }
});

    await loadBase();

    renderPage('requests');

toast(
      status === 'GENEHMIGT'
      status === 'APPROVED'
? 'Antrag genehmigt'
: 'Antrag abgelehnt'
);

    await loadBase();

    renderPage(state.page);

  } catch (e) {
    toast(e.message, true);
  } catch (err) {
    toast(err.message, true);
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
function renderVehicles() {
  const canManage =
    state.user?.role === 'ADMIN' ||
    state.user?.role === 'PROJEKTLEITUNG';

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
  const cards = state.vehicles.map(v => `
    <div class="vehicle-card">

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
        v.image
          ? `
            <img
              src="${escapeHtml(v.image)}"
              alt="${escapeHtml(v.name)}"
              class="vehicle-image"
            >
          `
         : `
            <div class="card empty">
              Noch keine Fahrzeuge in einer Organisation.
            <div class="vehicle-placeholder">
              🚘
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
      <div class="vehicle-body">
        <h3>${escapeHtml(v.name)}</h3>

        <p class="muted">
          ${escapeHtml(v.category || 'Keine Kategorie')}
        </p>

        ${
          canManage
            ? `
              <button
                class="smallbtn danger"
                onclick="deleteVehicle('${escapeHtml(v.id)}')"
              >
                Löschen
              </button>
            `
            : ''
        }
      </div>

   </div>
  `).join('');

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
  $('#content').innerHTML = `
    <div class="card">

      <div class="card-head">

        <div>
          <h3>Fahrzeuge</h3>
          <p class="muted">
            Zentrale Fahrzeugverwaltung.
          </p>
        </div>

        ${
          canManage
            ? `
              <button
                class="primary"
                onclick="openVehicleModal()"
              >
                + Fahrzeug
              </button>
            `
            : ''
        }

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
      <div class="vehicle-grid">

                  </div>
                `
              )
              .join('')
          : `
            <div class="card empty">
        ${
          cards ||
          `
            <div class="empty">
             Noch keine Fahrzeuge vorhanden.
           </div>
         `
      }
        }

      </div>

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
@@ -684,15 +502,15 @@ function openVehicleModal() {
     </label>

     <label>
        Bild-URL
        Fahrzeugbild
       <input
          name="image"
          type="url"
          placeholder="https://..."
          name="imageFile"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
       >

       <small class="muted">
          Füge einen direkten Link zu einem Bild ein.
          JPG, PNG, WEBP oder GIF · maximal 5 MB
       </small>
     </label>

@@ -707,7 +525,6 @@ function openVehicleModal() {
         background:#111;
       "
     >

       <img
         id="vehiclePreviewImg"
         alt="Bildvorschau"
@@ -717,7 +534,6 @@ function openVehicleModal() {
           object-fit:cover;
         "
       >

     </div>

     <div class="btnrow">
@@ -730,7 +546,10 @@ function openVehicleModal() {
         Abbrechen
       </button>

        <button class="primary">
        <button
          id="vehicleSubmitBtn"
          class="primary"
        >
         Speichern
       </button>

@@ -740,48 +559,101 @@ function openVehicleModal() {
 `;

const form = $('#vehicleForm');

const imageInput =
    form.querySelector('[name="image"]');
    form.querySelector('[name="imageFile"]');

const preview =
$('#vehicleImagePreview');

const previewImg =
$('#vehiclePreviewImg');

  imageInput.addEventListener('input', () => {
    const url = imageInput.value.trim();
  imageInput.addEventListener('change', () => {
    const file = imageInput.files?.[0];

    if (!url) {
    if (!file) {
preview.style.display = 'none';
previewImg.removeAttribute('src');
return;
}

    previewImg.onload = () => {
      preview.style.display = 'block';
    };
    if (file.size > 5 * 1024 * 1024) {
      toast('Das Bild darf maximal 5 MB groß sein.', true);

      imageInput.value = '';

    previewImg.onerror = () => {
preview.style.display = 'none';
previewImg.removeAttribute('src');

      return;
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast(
        'Bitte JPG, PNG, WEBP oder GIF auswählen.',
        true
      );

      imageInput.value = '';

      preview.style.display = 'none';
      previewImg.removeAttribute('src');

      return;
    }

    const objectUrl =
      URL.createObjectURL(file);

    previewImg.onload = () => {
      preview.style.display = 'block';
};

    previewImg.src = url;
    previewImg.src = objectUrl;
});

form.onsubmit = async e => {
e.preventDefault();

    const submitBtn =
      $('#vehicleSubmitBtn');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Wird gespeichert...';

try {
      const data = Object.fromEntries(
        new FormData(e.target)
      );
      const formData =
        new FormData(form);

      const name =
        String(formData.get('name') || '').trim();

      const category =
        String(formData.get('category') || '').trim();

      const file =
        formData.get('imageFile');

      let imageUrl = '';

      if (file && file instanceof File && file.size > 0) {
        imageUrl = await uploadImage(file);
      }

await api('/api/vehicles', {
method: 'POST',
        body: data
        body: {
          name,
          category,
          image: imageUrl
        }
});

closeModal();
@@ -794,17 +666,22 @@ function openVehicleModal() {

} catch (err) {
toast(err.message, true);

      submitBtn.disabled = false;
      submitBtn.textContent = 'Speichern';
}
};

$('#modal').classList.remove('hidden');
}

async function deleteVehicle(id) {
  if (!confirm('Fahrzeug wirklich löschen?')) return;
  if (!confirm('Fahrzeug wirklich löschen?')) {
    return;
  }

try {
    await api('/api/vehicles/' + id, {
    await api(`/api/vehicles/${id}`, {
method: 'DELETE'
});

@@ -814,513 +691,347 @@ async function deleteVehicle(id) {

toast('Fahrzeug gelöscht');

  } catch (e) {
    toast(e.message, true);
  } catch (err) {
    toast(err.message, true);
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
function renderFleet() {
  const fleets = state.organizations.map(org => {
    const vehicles =
      state.vehicles.filter(
        v => v.organization_id === org.id
      );

    return `
      <div class="card">
        <h3>${escapeHtml(org.name || org.id)}</h3>

        <p class="muted">
          ${escapeHtml(org.id)}
        </p>

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
        ${
          vehicles.length
            ? `
              <div class="vehicle-grid">
                ${vehicles.map(v => `
                  <div class="vehicle-card">

                    ${
                      v.image
                        ? `
                          <img
                            src="${escapeHtml(v.image)}"
                            alt="${escapeHtml(v.name)}"
                            class="vehicle-image"
                          >
                        `
                        : `
                          <div class="vehicle-placeholder">
                            🚘
                         </div>
                       `
                      )
                      .join('')
                  : `
                    <div class="muted">
                      Keine Einträge.
                    }

                    <div class="vehicle-body">
                      <h3>
                        ${escapeHtml(v.name)}
                      </h3>

                      <p class="muted">
                        ${escapeHtml(v.category || '')}
                      </p>
                   </div>
                  `
              }

            </div>
          `
        )
        .join('')}
                  </div>
                `).join('')}
              </div>
            `
            : `
              <p class="muted">
                Keine Fahrzeuge zugeordnet.
              </p>
            `
        }
      </div>
    `;
  }).join('');

  $('#content').innerHTML =
    fleets ||
    `
      <div class="card">
        <p class="muted">
          Keine Organisationen vorhanden.
        </p>
      </div>
    `;
}

function renderOrganizations() {
  const rows = state.organizations.map(org => `
    <tr>
      <td>${escapeHtml(org.id)}</td>
      <td>${escapeHtml(org.name || '-')}</td>
    </tr>
  `).join('');

  $('#content').innerHTML = `
    <div class="card">
      <h3>Organisationen</h3>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
            </tr>
          </thead>

          <tbody>
            ${
              rows ||
              `
                <tr>
                  <td colspan="2">
                    <span class="muted">
                      Keine Organisationen vorhanden.
                    </span>
                  </td>
                </tr>
              `
            }
          </tbody>
        </table>
      </div>
   </div>
 `;
}

async function renderJail() {
  const rows = await api('/api/admin-jail');

function renderUsers() {
$('#content').innerHTML = `
    <div class="card table-wrap">
    <div class="card">

      <table class="table">
      <h3>Benutzer</h3>

        <thead>
          <tr>
            <th>Regel</th>
            <th>Admin-Jail</th>
          </tr>
        </thead>
      <div class="table-wrap">

        <tbody>
        <table>

          ${rows
            .map(
              r => `
          <thead>
            <tr>
              <th>Benutzername</th>
              <th>Rolle</th>
              <th>Organisation</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>

            ${
              state.users.map(u => `
               <tr>
                  <td>${esc(r.name)}</td>
                  <td>${escapeHtml(u.username)}</td>
                  <td>${escapeHtml(u.role)}</td>
                  <td>${escapeHtml(u.organization_id || '-')}</td>
                 <td>
                    <b>${r.minutes} Minuten</b>
                    ${u.active === false ? 'Inaktiv' : 'Aktiv'}
                 </td>
               </tr>
              `).join('') ||
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
                <tr>
                  <td colspan="4">
                    <span class="muted">
                      Keine Benutzer vorhanden.
                    </span>
                  </td>
                </tr>
              `
            }

              <h3>
                ${esc(o.name)}
              </h3>
          </tbody>

              <p class="muted">
                ${
                  state.user.role === 'LEADER' &&
                  state.user.organizationId !== o.id
                    ? '—'
                    : 'Organisation'
                }
              </p>
        </table>

            </div>
          `
        )
        .join('')}
      </div>

   </div>
 `;
}

async function renderUsers() {
  const rows = await api('/api/users');

function renderAudit() {
$('#content').innerHTML = `
    <div class="section-head">
    <div class="card">

      <h3>Benutzer & Rollen</h3>
      <h3>Audit-Log</h3>

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
      <div class="table-wrap">

    </div>

    <div class="card table-wrap">

      <table class="table">
        <table>

        <thead>
          <tr>
            <th>Benutzer</th>
            <th>Rolle</th>
            <th>Organisation</th>
            <th>Status</th>
          </tr>
        </thead>
          <thead>
            <tr>
              <th>Zeit</th>
              <th>Benutzer</th>
              <th>Aktion</th>
            </tr>
          </thead>

        <tbody>
          <tbody>

          ${rows
            .map(
              u => `
            ${
              state.audit.map(a => `
               <tr>

                 <td>
                    ${esc(u.username)}
                    ${escapeHtml(
                      a.created_at ||
                      a.timestamp ||
                      '-'
                    )}
                 </td>

                 <td>
                    ${esc(u.role)}
                    ${escapeHtml(
                      a.username ||
                      a.user ||
                      '-'
                    )}
                 </td>

                 <td>
                    ${esc(orgName(u.organizationId))}
                    ${escapeHtml(
                      a.action ||
                      '-'
                    )}
                 </td>

                  <td>
                    ${
                      u.active
                        ? '<span class="success-text">Aktiv</span>'
                        : '<span class="danger-text">Deaktiviert</span>'
                    }
                </tr>
              `).join('') ||
              `
                <tr>
                  <td colspan="3">
                    <span class="muted">
                      Keine Einträge vorhanden.
                    </span>
                 </td>

               </tr>
             `
            )
            .join('')}
            }

        </tbody>
          </tbody>

      </table>
        </table>

      </div>

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
function renderRules() {
  $('#content').innerHTML = `
    <div class="card">

        <button
          type="button"
          class="smallbtn"
          onclick="closeModal()"
        >
          Abbrechen
        </button>
      <h3>Bann-Richtlinien</h3>

        <button class="primary">
          Anlegen
        </button>
      <ul>
        <li>Cheating / Exploiting</li>
        <li>Massives Trolling</li>
        <li>Beleidigungen und Belästigung</li>
        <li>Ausnutzen von Bugs</li>
        <li>Umgehen von Sanktionen</li>
      </ul>

      </div>
      <p class="muted">
        Die konkreten Sanktionen werden durch die Teamleitung festgelegt.
      </p>

    </form>
    </div>
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

function renderJail() {
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
    <div class="card">

                  <td>
                    ${esc(x.action)}
                  </td>
      <h3>Admin-Jail</h3>

                  <td>
                    ${esc(x.details)}
                  </td>

                </tr>
              `
            )
            .join('')}

        </tbody>

      </table>
      <p class="muted">
        Hier können künftig Admin-Jail-Fälle verwaltet werden.
      </p>

   </div>
 `;
}

function closeModal() {
$('#modal').classList.add('hidden');
  $('#modalContent').innerHTML = '';
}

$('#loginForm').onsubmit = async e => {
$('#loginForm').addEventListener('submit', async e => {
e.preventDefault();

  const username =
    $('#loginUser').value.trim();

  const password =
    $('#loginPass').value;

try {
    const d = await api('/api/login', {
      method: 'POST',
      body: {
        username: $('#loginUser').value,
        password: $('#loginPass').value
      }
    await login(username, password);
  } catch (err) {
    toast(err.message, true);
  }
});

$('#logoutBtn').addEventListener('click', () => {
  logout(true);
});

document.querySelectorAll('#nav button[data-page]')
  .forEach(btn => {
    btn.addEventListener('click', () => {
      renderPage(btn.dataset.page);
});
  });

    state.token = d.token;
    state.user = d.user;
$('#modalClose').addEventListener(
  'click',
  closeModal
);

    localStorage.setItem(
      'spectra_token',
      state.token
    );
$('#modal').addEventListener('click', e => {
  if (e.target === $('#modal')) {
    closeModal();
  }
});

    await loadBase();
async function init() {
  if (!state.token) {
    return;
  }

    showApp();
  try {
    const me = await api('/api/me');

    renderPage('dashboard');
    state.user = me.user || me;

    toast('Erfolgreich angemeldet');
    $('#loginView').classList.add('hidden');
    $('#appView').classList.remove('hidden');

  } catch (err) {
    toast(err.message, true);
  }
};
    updateUserUI();

$('#logoutBtn').onclick = () => logout();
    await loadBase();

$('#modalClose').onclick = closeModal;
    renderPage('dashboard');

$('#modal').onclick = e => {
  if (e.target.id === 'modal') {
    closeModal();
  } catch {
    logout(false);
}
};

document
  .querySelectorAll('#nav button')
  .forEach(b => {
    b.onclick = () => renderPage(b.dataset.page);
  });
}

init();

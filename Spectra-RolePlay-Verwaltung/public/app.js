const $ = s => document.querySelector(s);

const state = {
  token: localStorage.getItem('spectra_token') || '',
  user: null,
  dashboard: null,
  requests: [],
  vehicles: [],
  organizations: [],
  users: [],
  audit: []
};

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
    ...(state.token
      ? { Authorization: 'Bearer ' + state.token }
      : {})
  };

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
    logout(false);
    throw new Error(d.error || 'Nicht angemeldet');
  }

  if (!r.ok) {
    throw new Error(d.error || 'Fehler');
  }

  return d;
}

async function uploadImage(file) {
  const formData = new FormData();

  formData.append('image', file);

  const response = await fetch('/api/upload-image', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + state.token
    },
    body: formData
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result.error || 'Bild konnte nicht hochgeladen werden'
    );
  }

  if (!result.url) {
    throw new Error(
      'Upload erfolgreich, aber keine Bild-URL erhalten'
    );
  }

  return result.url;
}
  const formData = new FormData();

  formData.append('image', file);

  const result = await api('/api/upload-image', {
    method: 'POST',
    body: formData
  });

  return result.url;
}

function logout(showToast = true) {
  localStorage.removeItem('spectra_token');

  state.token = '';
  state.user = null;

  $('#appView').classList.add('hidden');
  $('#loginView').classList.remove('hidden');

  if (showToast) {
    toast('Abgemeldet');
  }
}

async function login(username, password) {
  const result = await api('/api/login', {
    method: 'POST',
    body: {
      username,
      password
    }
  });

  state.token = result.token;
  state.user = result.user;

  localStorage.setItem('spectra_token', state.token);

  $('#loginView').classList.add('hidden');
  $('#appView').classList.remove('hidden');

  updateUserUI();

  await loadBase();

  renderPage('dashboard');
}

function updateUserUI() {
  if (!state.user) return;

  $('#userBadge').innerHTML = `
    <strong>${escapeHtml(state.user.username)}</strong>
    <span>${escapeHtml(state.user.role)}</span>
  `;

  $('#rolePill').textContent =
    state.user.organization_id
      ? `${state.user.role} · ${state.user.organization_id}`
      : state.user.role;

  document.querySelectorAll('.staffOnly').forEach(el => {
    const allowed =
      state.user.role === 'ADMIN' ||
      state.user.role === 'PROJEKTLEITUNG';

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
  $('#pageTitle').textContent =
    pageTitles[page] || page;

  document
    .querySelectorAll('#nav button[data-page]')
    .forEach(btn => {
      btn.classList.toggle(
        'active',
        btn.dataset.page === page
      );
    });

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

function renderDashboard() {
  const d = state.dashboard || {};

  $('#content').innerHTML = `
    <div class="stats">
      <div class="stat">
        <span>Benutzer</span>
        <strong>${d.users ?? state.users.length}</strong>
      </div>

      <div class="stat">
        <span>Fahrzeuge</span>
        <strong>${d.vehicles ?? state.vehicles.length}</strong>
      </div>

      <div class="stat">
        <span>Anträge</span>
        <strong>${d.requests ?? state.requests.length}</strong>
      </div>

      <div class="stat">
        <span>Organisationen</span>
        <strong>${d.organizations ?? state.organizations.length}</strong>
      </div>
    </div>

    <div class="card">
      <h3>Willkommen zurück</h3>
      <p class="muted">
        Angemeldet als
        <strong>${escapeHtml(state.user?.username)}</strong>.
      </p>
    </div>
  `;
}

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
            : ''
        }
      </td>
    </tr>
  `).join('');

  $('#content').innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <h3>Fahrzeuganträge</h3>
          <p class="muted">
            Eingereichte Fahrzeuganträge verwalten.
          </p>
        </div>
      </div>

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
    await api(`/api/requests/${id}`, {
      method: 'PATCH',
      body: { status }
    });

    await loadBase();

    renderPage('requests');

    toast(
      status === 'APPROVED'
        ? 'Antrag genehmigt'
        : 'Antrag abgelehnt'
    );
  } catch (err) {
    toast(err.message, true);
  }
}

function renderVehicles() {
  const canManage =
    state.user?.role === 'ADMIN' ||
    state.user?.role === 'PROJEKTLEITUNG';

  const cards = state.vehicles.map(v => `
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

      </div>

      <div class="vehicle-grid">

        ${
          cards ||
          `
            <div class="empty">
              Noch keine Fahrzeuge vorhanden.
            </div>
          `
        }

      </div>

    </div>
  `;
}

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
        Fahrzeugbild
        <input
          name="imageFile"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
        >

        <small class="muted">
          JPG, PNG, WEBP oder GIF · maximal 5 MB
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

        <button
          id="vehicleSubmitBtn"
          class="primary"
        >
          Speichern
        </button>

      </div>

    </form>
  `;

  const form = $('#vehicleForm');
  const imageInput =
    form.querySelector('[name="imageFile"]');

  const preview =
    $('#vehicleImagePreview');

  const previewImg =
    $('#vehiclePreviewImg');

  imageInput.addEventListener('change', () => {
    const file = imageInput.files?.[0];

    if (!file) {
      preview.style.display = 'none';
      previewImg.removeAttribute('src');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast('Das Bild darf maximal 5 MB groß sein.', true);

      imageInput.value = '';

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

    previewImg.src = objectUrl;
  });

  form.onsubmit = async e => {
    e.preventDefault();

    const submitBtn =
      $('#vehicleSubmitBtn');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Wird gespeichert...';

    try {
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
        body: {
          name,
          category,
          image: imageUrl
        }
      });

      closeModal();

      await loadBase();

      renderPage('vehicles');

      toast('Fahrzeug hinzugefügt');

    } catch (err) {
      toast(err.message, true);

      submitBtn.disabled = false;
      submitBtn.textContent = 'Speichern';
    }
  };

  $('#modal').classList.remove('hidden');
}

async function deleteVehicle(id) {
  if (!confirm('Fahrzeug wirklich löschen?')) {
    return;
  }

  try {
    await api(`/api/vehicles/${id}`, {
      method: 'DELETE'
    });

    await loadBase();

    renderPage('vehicles');

    toast('Fahrzeug gelöscht');

  } catch (err) {
    toast(err.message, true);
  }
}

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
                    }

                    <div class="vehicle-body">
                      <h3>
                        ${escapeHtml(v.name)}
                      </h3>

                      <p class="muted">
                        ${escapeHtml(v.category || '')}
                      </p>
                    </div>

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

function renderUsers() {
  $('#content').innerHTML = `
    <div class="card">

      <h3>Benutzer</h3>

      <div class="table-wrap">

        <table>

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
                  <td>${escapeHtml(u.username)}</td>
                  <td>${escapeHtml(u.role)}</td>
                  <td>${escapeHtml(u.organization_id || '-')}</td>
                  <td>
                    ${u.active === false ? 'Inaktiv' : 'Aktiv'}
                  </td>
                </tr>
              `).join('') ||
              `
                <tr>
                  <td colspan="4">
                    <span class="muted">
                      Keine Benutzer vorhanden.
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

function renderAudit() {
  $('#content').innerHTML = `
    <div class="card">

      <h3>Audit-Log</h3>

      <div class="table-wrap">

        <table>

          <thead>
            <tr>
              <th>Zeit</th>
              <th>Benutzer</th>
              <th>Aktion</th>
            </tr>
          </thead>

          <tbody>

            ${
              state.audit.map(a => `
                <tr>
                  <td>
                    ${escapeHtml(
                      a.created_at ||
                      a.timestamp ||
                      '-'
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      a.username ||
                      a.user ||
                      '-'
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      a.action ||
                      '-'
                    )}
                  </td>
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
            }

          </tbody>

        </table>

      </div>

    </div>
  `;
}

function renderRules() {
  $('#content').innerHTML = `
    <div class="card">

      <h3>Bann-Richtlinien</h3>

      <ul>
        <li>Cheating / Exploiting</li>
        <li>Massives Trolling</li>
        <li>Beleidigungen und Belästigung</li>
        <li>Ausnutzen von Bugs</li>
        <li>Umgehen von Sanktionen</li>
      </ul>

      <p class="muted">
        Die konkreten Sanktionen werden durch die Teamleitung festgelegt.
      </p>

    </div>
  `;
}

function renderJail() {
  $('#content').innerHTML = `
    <div class="card">

      <h3>Admin-Jail</h3>

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

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();

  const username =
    $('#loginUser').value.trim();

  const password =
    $('#loginPass').value;

  try {
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

$('#modalClose').addEventListener(
  'click',
  closeModal
);

$('#modal').addEventListener('click', e => {
  if (e.target === $('#modal')) {
    closeModal();
  }
});

async function init() {
  if (!state.token) {
    return;
  }

  try {
    const me = await api('/api/me');

    state.user = me.user || me;

    $('#loginView').classList.add('hidden');
    $('#appView').classList.remove('hidden');

    updateUserUI();

    await loadBase();

    renderPage('dashboard');

  } catch {
    logout(false);
  }
}

init();

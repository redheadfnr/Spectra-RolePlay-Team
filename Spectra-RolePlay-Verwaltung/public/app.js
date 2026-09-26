const $ = s => document.querySelector(s);

const state = {
  token: localStorage.getItem('spectra_token') || '',
  user: null,
  organizations: [],
  dashboard: null,
  requests: [],
  vehicles: [],
  users: [],
  audit: [],
  page: 'dashboard'
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toast(message, error = false) {
  const el = $('#toast');

  if (!el) return;

  el.textContent = message;
  el.className = error ? 'show error' : 'show';

  clearTimeout(window.__toastTimer);

  window.__toastTimer = setTimeout(() => {
    el.className = '';
  }, 3000);
}

/*
==================================================
API
==================================================
*/

async function api(url, opts = {}) {
  opts.headers = {
    ...(opts.headers || {})
  };

  if (state.token) {
    opts.headers.Authorization =
      'Bearer ' + state.token;
  }

  /*
   * JSON automatisch setzen.
   * FormData NICHT verändern.
   */
  if (
    opts.body &&
    typeof opts.body !== 'string' &&
    !(opts.body instanceof FormData)
  ) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }

  const response = await fetch(url, opts);

  const data =
    await response.json().catch(() => ({}));

  if (response.status === 401) {
    logout(false);
    throw new Error(
      data.error || 'Nicht angemeldet'
    );
  }

  if (!response.ok) {
    throw new Error(
      data.error || 'Fehler'
    );
  }

  return data;
}

/*
==================================================
LOGIN
==================================================
*/

async function login(username, password) {
  const result = await api('/api/login', {
    method: 'POST',
    body: {
      username,
      password
    }
  });

  if (!result.token) {
    throw new Error(
      'Login erfolgreich, aber kein Session-Token erhalten.'
    );
  }

  state.token = result.token;
  state.user = result.user || null;

  localStorage.setItem(
    'spectra_token',
    state.token
  );

  $('#loginView').classList.add('hidden');
  $('#appView').classList.remove('hidden');

  updateUserUI();

  await loadBase();

  renderPage('dashboard');

  toast('Erfolgreich angemeldet');
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

function updateUserUI() {
  if (!state.user) return;

  $('#userBadge').innerHTML = `
    <strong>
      ${escapeHtml(state.user.username)}
    </strong>

    <span>
      ${escapeHtml(state.user.role)}
      ${
        state.user.organization_id
          ? ' · ' +
            escapeHtml(
              state.user.organization_id
            )
          : ''
      }
    </span>
  `;

  $('#rolePill').textContent =
    state.user.organization_id
      ? `${state.user.role} · ${state.user.organization_id}`
      : state.user.role;

  const isStaff =
    state.user.role === 'ADMIN' ||
    state.user.role === 'PROJEKTLEITUNG';

  document
    .querySelectorAll('.staffOnly')
    .forEach(el => {
      el.style.display =
        isStaff ? '' : 'none';
    });
}

/*
==================================================
DATEN LADEN
==================================================
*/

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

  state.requests =
    requests.requests || requests || [];

  state.vehicles =
    vehicles.vehicles || vehicles || [];

  state.organizations =
    organizations.organizations ||
    organizations ||
    [];

  const isStaff =
    state.user?.role === 'ADMIN' ||
    state.user?.role === 'PROJEKTLEITUNG';

  if (isStaff) {
    const [users, audit] =
      await Promise.all([
        api('/api/users'),
        api('/api/audit')
      ]);

    state.users =
      users.users || users || [];

    state.audit =
      audit.audit || audit || [];
  }
}

/*
==================================================
SEITEN
==================================================
*/

function renderPage(page) {
  state.page = page;

  $('#pageTitle').textContent =
    pageTitles[page] || page;

  document
    .querySelectorAll('#nav button[data-page]')
    .forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.page === page
      );
    });

  switch (page) {
    case 'dashboard':
      renderDashboard();
      break;

    case 'requests':
      renderRequests();
      break;

    case 'fleet':
      renderFleet();
      break;

    case 'vehicles':
      renderVehicles();
      break;

    case 'rules':
      renderRules();
      break;

    case 'jail':
      renderJail();
      break;

    case 'organizations':
      renderOrganizations();
      break;

    case 'users':
      renderUsers();
      break;

    case 'audit':
      renderAudit();
      break;

    default:
      $('#content').innerHTML = `
        <div class="card">
          <h3>Seite nicht gefunden</h3>
        </div>
      `;
  }
}

/*
==================================================
DASHBOARD
==================================================
*/

function renderDashboard() {
  const d = state.dashboard || {};

  const stats =
    d.stats || {};

  $('#content').innerHTML = `
    <div class="stats">

      <div class="stat">
        <span>Fahrzeuganträge</span>
        <strong>
          ${
            stats.requests ??
            state.requests.length
          }
        </strong>
      </div>

      <div class="stat">
        <span>Offen</span>
        <strong>
          ${
            stats.pending ??
            state.requests.filter(
              r =>
                r.status === 'PENDING' ||
                r.status === 'BEANTRAGT'
            ).length
          }
        </strong>
      </div>

      <div class="stat">
        <span>Fahrzeuge</span>
        <strong>
          ${
            d.vehicles ??
            state.vehicles.length
          }
        </strong>
      </div>

      <div class="stat">
        <span>Organisationen</span>
        <strong>
          ${
            d.organizations ??
            state.organizations.length
          }
        </strong>
      </div>

    </div>

    <div class="card">

      <h3>Willkommen zurück</h3>

      <p class="muted">
        Angemeldet als
        <strong>
          ${escapeHtml(
            state.user?.username
          )}
        </strong>.
      </p>

    </div>
  `;
}

/*
==================================================
ANTRÄGE
==================================================
*/

function renderRequests() {
  const canReview =
    state.user?.role === 'ADMIN' ||
    state.user?.role === 'PROJEKTLEITUNG';

  const rows =
    state.requests
      .map(request => {

        const status =
          request.status || '';

        const vehicleName =
          request.vehicle_name ||
          request.vehicleName ||
          request.name ||
          '-';

        return `
          <tr>

            <td>
              ${escapeHtml(
                request.id
              )}
            </td>

            <td>
              ${escapeHtml(
                request.organization_id ||
                request.organizationId ||
                '-'
              )}
            </td>

            <td>
              ${escapeHtml(
                vehicleName
              )}
            </td>

            <td>
              ${escapeHtml(
                request.category || '-'
              )}
            </td>

            <td>
              ${escapeHtml(status)}
            </td>

            <td>

              ${
                canReview &&
                (
                  status === 'PENDING' ||
                  status === 'BEANTRAGT' ||
                  status === 'IN_PRUEFUNG'
                )
                  ? `
                    <button
                      class="smallbtn"
                      onclick="reviewRequest(
                        '${escapeHtml(request.id)}',
                        'APPROVED'
                      )"
                    >
                      Genehmigen
                    </button>

                    <button
                      class="smallbtn danger"
                      onclick="reviewRequest(
                        '${escapeHtml(request.id)}',
                        'REJECTED'
                      )"
                    >
                      Ablehnen
                    </button>
                  `
                  : ''
              }

            </td>

          </tr>
        `;
      })
      .join('');

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
                    <span class="muted">
                      Keine Anträge vorhanden.
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

async function reviewRequest(id, status) {
  try {
    await api(
      `/api/requests/${id}`,
      {
        method: 'PATCH',
        body: { status }
      }
    );

    await loadBase();

    renderPage('requests');

    toast(
      status === 'APPROVED'
        ? 'Antrag genehmigt'
        : 'Antrag abgelehnt'
    );

  } catch (error) {
    toast(
      error.message,
      true
    );
  }
}

/*
==================================================
FAHRZEUGE
==================================================
*/

function renderVehicles() {
  const canManage =
    state.user?.role === 'ADMIN' ||
    state.user?.role === 'PROJEKTLEITUNG';

  const cards =
    state.vehicles
      .map(vehicle => `
        <div class="vehicle-card">

          ${
            vehicle.image
              ? `
                <img
                  src="${escapeHtml(
                    vehicle.image
                  )}"
                  alt="${escapeHtml(
                    vehicle.name
                  )}"
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
              ${escapeHtml(
                vehicle.name
              )}
            </h3>

            <p class="muted">
              ${escapeHtml(
                vehicle.category ||
                'Keine Kategorie'
              )}
            </p>

            ${
              canManage
                ? `
                  <button
                    class="smallbtn danger"
                    onclick="deleteVehicle(
                      '${escapeHtml(vehicle.id)}'
                    )"
                  >
                    Löschen
                  </button>
                `
                : ''
            }

          </div>

        </div>
      `)
      .join('');

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

/*
==================================================
BILD UPLOAD
==================================================
*/

async function uploadImage(file) {
  const formData =
    new FormData();

  formData.append(
    'image',
    file
  );

  const response =
    await fetch(
      '/api/upload-image',
      {
        method: 'POST',

        headers: {
          Authorization:
            'Bearer ' +
            state.token
        },

        body: formData
      }
    );

  const result =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result.error ||
      'Bild konnte nicht hochgeladen werden.'
    );
  }

  if (!result.url) {
    throw new Error(
      'Upload erfolgreich, aber keine Bild-URL erhalten.'
    );
  }

  return result.url;
}

/*
==================================================
FAHRZEUG MODAL
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
        Fahrzeugbild

        <input
          name="imageFile"
          type="file"
          accept="
            image/jpeg,
            image/png,
            image/webp,
            image/gif
          "
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
          type="submit"
        >
          Speichern
        </button>

      </div>

    </form>
  `;

  const form =
    $('#vehicleForm');

  const imageInput =
    form.querySelector(
      '[name="imageFile"]'
    );

  const preview =
    $('#vehicleImagePreview');

  const previewImg =
    $('#vehiclePreviewImg');

  imageInput.addEventListener(
    'change',
    () => {

      const file =
        imageInput.files?.[0];

      if (!file) {
        preview.style.display =
          'none';

        previewImg.removeAttribute(
          'src'
        );

        return;
      }

      if (
        file.size >
        5 * 1024 * 1024
      ) {
        toast(
          'Das Bild darf maximal 5 MB groß sein.',
          true
        );

        imageInput.value = '';

        preview.style.display =
          'none';

        previewImg.removeAttribute(
          'src'
        );

        return;
      }

      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif'
      ];

      if (
        !allowedTypes.includes(
          file.type
        )
      ) {
        toast(
          'Bitte JPG, PNG, WEBP oder GIF auswählen.',
          true
        );

        imageInput.value = '';

        preview.style.display =
          'none';

        previewImg.removeAttribute(
          'src'
        );

        return;
      }

      const objectUrl =
        URL.createObjectURL(file);

      previewImg.onload = () => {
        preview.style.display =
          'block';
      };

      previewImg.src =
        objectUrl;
    }
  );

  form.onsubmit =
    async event => {

      event.preventDefault();

      const submitButton =
        $('#vehicleSubmitBtn');

      submitButton.disabled =
        true;

      submitButton.textContent =
        'Wird gespeichert...';

      try {
        const formData =
          new FormData(form);

        const name =
          String(
            formData.get('name') ||
            ''
          ).trim();

        const category =
          String(
            formData.get('category') ||
            ''
          ).trim();

        const file =
          formData.get(
            'imageFile'
          );

        let imageUrl = '';

        /*
         * Nur hochladen,
         * wenn wirklich ein Bild
         * ausgewählt wurde.
         */
        if (
          file &&
          file instanceof File &&
          file.size > 0
        ) {
          imageUrl =
            await uploadImage(file);
        }

        await api(
          '/api/vehicles',
          {
            method: 'POST',

            body: {
              name,
              category,
              image: imageUrl
            }
          }
        );

        closeModal();

        await loadBase();

        renderPage('vehicles');

        toast(
          'Fahrzeug hinzugefügt'
        );

      } catch (error) {

        toast(
          error.message,
          true
        );

        submitButton.disabled =
          false;

        submitButton.textContent =
          'Speichern';
      }
    };

  $('#modal').classList.remove(
    'hidden'
  );
}

async function deleteVehicle(id) {
  if (
    !confirm(
      'Fahrzeug wirklich löschen?'
    )
  ) {
    return;
  }

  try {
    await api(
      `/api/vehicles/${id}`,
      {
        method: 'DELETE'
      }
    );

    await loadBase();

    renderPage('vehicles');

    toast(
      'Fahrzeug gelöscht'
    );

  } catch (error) {
    toast(
      error.message,
      true
    );
  }
}

/*
==================================================
FLOTTEN
==================================================
*/

async function renderFleet() {
  try {
    const result =
      await api('/api/fleet');

    const rows =
      result.fleet ||
      result ||
      [];

    $('#content').innerHTML = `
      <div class="card">

        <div class="card-head">

          <div>
            <h3>Aktuelle Flotten</h3>

            <p class="muted">
              Genehmigte Fahrzeuge der Organisationen.
            </p>
          </div>

        </div>

        <div class="vehicle-grid">

          ${
            rows.length
              ? rows.map(item => {

                  const vehicle =
                    item.vehicle || {};

                  const organization =
                    item.organization || {};

                  return `
                    <div class="vehicle-card">

                      ${
                        vehicle.image
                          ? `
                            <img
                              src="${escapeHtml(
                                vehicle.image
                              )}"
                              alt="${escapeHtml(
                                vehicle.name
                              )}"
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
                          ${escapeHtml(
                            vehicle.name ||
                            '-'
                          )}
                        </h3>

                        <p class="muted">
                          ${escapeHtml(
                            organization.name ||
                            organization.id ||
                            '-'
                          )}
                        </p>

                        <p class="muted">
                          ${escapeHtml(
                            vehicle.category ||
                            ''
                          )}
                        </p>

                      </div>

                    </div>
                  `;
                }).join('')
              : `
                <div class="empty">
                  Noch keine Flottenfahrzeuge vorhanden.
                </div>
              `
          }

        </div>

      </div>
    `;

  } catch (error) {
    toast(
      error.message,
      true
    );
  }
}

/*
==================================================
ORGANISATIONEN
==================================================
*/

function renderOrganizations() {
  const rows =
    state.organizations
      .map(org => `
        <tr>

          <td>
            ${escapeHtml(
              org.id
            )}
          </td>

          <td>
            ${escapeHtml(
              org.name ||
              org.id ||
              '-'
            )}
          </td>

        </tr>
      `)
      .join('');

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

/*
==================================================
BENUTZER
==================================================
*/

function renderUsers() {
  const rows =
    state.users
      .map(user => `
        <tr>

          <td>
            ${escapeHtml(
              user.username
            )}
          </td>

          <td>
            ${escapeHtml(
              user.role
            )}
          </td>

          <td>
            ${escapeHtml(
              user.organization_id ||
              '-'
            )}
          </td>

          <td>
            ${
              user.active === false
                ? 'Inaktiv'
                : 'Aktiv'
            }
          </td>

        </tr>
      `)
      .join('');

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
              rows ||
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

/*
==================================================
AUDIT
==================================================
*/

function renderAudit() {
  const rows =
    state.audit
      .map(entry => `
        <tr>

          <td>
            ${escapeHtml(
              entry.created_at ||
              entry.timestamp ||
              entry.at ||
              '-'
            )}
          </td>

          <td>
            ${escapeHtml(
              entry.username ||
              entry.user ||
              entry.actor ||
              '-'
            )}
          </td>

          <td>
            ${escapeHtml(
              entry.action ||
              '-'
            )}
          </td>

        </tr>
      `)
      .join('');

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
              rows ||
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

/*
==================================================
REGELN
==================================================
*/

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

/*
==================================================
ADMIN-JAIL
==================================================
*/

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

/*
==================================================
MODAL
==================================================
*/

function closeModal() {
  $('#modal').classList.add(
    'hidden'
  );

  $('#modalContent').innerHTML = '';
}

/*
==================================================
EVENTS
==================================================
*/

$('#loginForm').addEventListener(
  'submit',
  async event => {

    event.preventDefault();

    const username =
      $('#loginUser')
        .value
        .trim();

    const password =
      $('#loginPass')
        .value;

    if (!username || !password) {
      toast(
        'Bitte Benutzername und Passwort eingeben.',
        true
      );

      return;
    }

    try {
      await login(
        username,
        password
      );

    } catch (error) {
      toast(
        error.message,
        true
      );
    }
  }
);

$('#logoutBtn').addEventListener(
  'click',
  () => logout(true)
);

document
  .querySelectorAll(
    '#nav button[data-page]'
  )
  .forEach(button => {

    button.addEventListener(
      'click',
      () => {
        renderPage(
          button.dataset.page
        );
      }
    );

  });

$('#modalClose').addEventListener(
  'click',
  closeModal
);

$('#modal').addEventListener(
  'click',
  event => {

    if (
      event.target ===
      $('#modal')
    ) {
      closeModal();
    }

  }
);

/*
==================================================
START
==================================================
*/

async function init() {
  if (!state.token) {
    return;
  }

  try {
    const result =
      await api('/api/me');

    state.user =
      result.user ||
      result;

    $('#loginView')
      .classList
      .add('hidden');

    $('#appView')
      .classList
      .remove('hidden');

    updateUserUI();

    await loadBase();

    renderPage(
      'dashboard'
    );

  } catch {
    logout(false);
  }
}

init();

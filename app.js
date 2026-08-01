const API = {
  summary: '/api/public/stats',
  request: '/api/requests',
  adminLogin: '/api/admin/login',
  adminLogout: '/api/admin/logout',
  adminMe: '/api/admin/me',
  adminRequests: '/api/admin/requests',
};

const requestForm = document.getElementById('requestForm');
const ranchRequestForm = document.getElementById('ranchRequestForm');
const requestMessage = document.getElementById('requestMessage');
const ranchRequestMessage = document.getElementById('ranchRequestMessage');
const requestCount = document.getElementById('requestCount');
const pickleCount = document.getElementById('pickleCount');
const ranchCount = document.getElementById('ranchCount');
const qualitySlideshow = document.getElementById('qualitySlideshow');
const qualitySlideImage = document.getElementById('qualitySlideImage');
const qualitySlideKicker = document.getElementById('qualitySlideKicker');
const qualitySlideTitle = document.getElementById('qualitySlideTitle');
const qualitySlideCopy = document.getElementById('qualitySlideCopy');
const qualitySlideDots = document.getElementById('qualitySlideDots');
const qualityPrev = document.getElementById('qualityPrev');
const qualityNext = document.getElementById('qualityNext');
const adminPanel = document.getElementById('admin');
const adminContent = document.getElementById('adminContent');

const QUALITY_SLIDES = [
  {
    src: './assets/quality-slides/slide-6.png',
    alt: 'Classic Big Jims pickle jar hero shot with fresh cucumbers in the foreground',
    kicker: 'Hero shot',
    title: 'The jar that proves the point before the first bite',
    copy: 'A single front-facing hero jar lets the label, glass, and brine do all the talking. It is the kind of image that tells customers the product is real, intentional, and ready to be trusted.',
  },
  {
    src: './assets/quality-slides/slide-1.png',
    alt: 'Classic and spicy Big Jims pickle jars standing side by side',
    kicker: 'Shelf ready',
    title: 'Two labels, one standard',
    copy: 'The classic and spicy jars sit side by side, showing the product family at a glance. The packaging stays consistent even when the flavor changes, which is exactly what a quality line should do.',
  },
  {
    src: './assets/quality-slides/slide-4.png',
    alt: 'Four Big Jims pickle jars lined up on a wooden table',
    kicker: 'Batch line',
    title: 'Consistency across the whole run',
    copy: 'A multi-jar lineup is the clearest sign that the process stays steady from one jar to the next. Same seal, same finish, same bold Big Jims look every time.',
  },
  {
    src: './assets/quality-slides/slide-3.png',
    alt: 'Single Big Jims spicy pickle jar with peppers and sliced pickles around it',
    kicker: 'Flavor hero',
    title: 'A bottle shot with depth and warmth',
    copy: 'The table scene gives the jars a lived-in, handmade feel that matches the brand voice. It feels less like a stock product photo and more like something that just came out of the kitchen.',
  },
  {
    src: './assets/quality-slides/slide-5.png',
    alt: 'Floating Big Jims pickle jar in a green stylized background',
    kicker: 'Movement',
    title: 'Texture, motion, and a little drama',
    copy: 'The angled bottle and suspended pickle bits turn quality into a visual story, not just a label. It adds a bit of energy without losing the handcrafted feeling.',
  },
  {
    src: './assets/quality-slides/slide-2.png',
    alt: 'Close up of the spicy Big Jims label on a pickle jar',
    kicker: 'Close-up',
    title: 'The spicy badge up close',
    copy: 'The close crop lets the label artwork and the product color take center stage. That close detail is where the brand feels the most premium and memorable.',
  },
];

const state = {
  summary: {
    totalRequests: 0,
    pickleCount: 0,
    ranchCount: 0,
  },
  requests: [],
  isAdminAuthed: false,
  requestFilter: '',
  requestCategoryFilter: 'All',
  requestsLoading: false,
  requestsError: '',
  loginMessage: '',
  loginMessageColor: '#6d705d',
};

let qualityCurrentIndex = 0;
let qualityRotationId = null;

function escapeSearchValue(value) {
  return value.trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

async function fetchJson(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers,
  });

  const raw = await response.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { message: raw };
    }
  }

  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}.`);
  }

  return data;
}

function renderStats() {
  requestCount.textContent = String(state.summary.totalRequests);
  pickleCount.textContent = String(state.summary.pickleCount);
  ranchCount.textContent = String(state.summary.ranchCount);
}

function renderAll() {
  renderStats();
  renderAdmin();
}

function updateQualityCaption(index) {
  const slide = QUALITY_SLIDES[index];
  qualitySlideKicker.textContent = slide.kicker;
  qualitySlideTitle.textContent = slide.title;
  qualitySlideCopy.textContent = slide.copy;
}

function updateQualityDots() {
  [...qualitySlideDots.children].forEach((dot, index) => {
    const active = index === qualityCurrentIndex;
    dot.classList.toggle('is-active', active);
    dot.setAttribute('aria-pressed', String(active));
  });
}

function stopQualityRotation() {
  if (qualityRotationId !== null) {
    window.clearInterval(qualityRotationId);
    qualityRotationId = null;
  }
}

function startQualityRotation() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  stopQualityRotation();
  qualityRotationId = window.setInterval(() => {
    showQualitySlide(qualityCurrentIndex + 1);
  }, 10000);
}

function showQualitySlide(nextIndex, restartTimer = false) {
  const normalizedIndex = (nextIndex + QUALITY_SLIDES.length) % QUALITY_SLIDES.length;
  if (normalizedIndex === qualityCurrentIndex && !restartTimer) {
    return;
  }

  const slide = QUALITY_SLIDES[normalizedIndex];
  qualitySlideImage.classList.remove('is-active');
  window.setTimeout(() => {
    qualitySlideImage.src = slide.src;
    qualitySlideImage.alt = slide.alt;
    qualitySlideImage.classList.add('is-active');
    qualityCurrentIndex = normalizedIndex;
    updateQualityCaption(normalizedIndex);
    updateQualityDots();
  }, restartTimer ? 90 : 0);

  if (restartTimer) {
    stopQualityRotation();
    startQualityRotation();
  }
}

function initializeQualitySlideshow() {
  if (!qualitySlideshow || !qualitySlideImage || !qualitySlideDots) {
    return;
  }

  qualitySlideImage.alt = QUALITY_SLIDES[0].alt;
  updateQualityCaption(0);
  qualitySlideDots.replaceChildren(
    ...QUALITY_SLIDES.map((slide, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'slideshow-dot';
      dot.setAttribute('aria-label', `Show slide ${index + 1}: ${slide.kicker}`);
      dot.setAttribute('aria-pressed', String(index === 0));
      dot.addEventListener('click', () => {
        showQualitySlide(index, true);
      });
      return dot;
    }),
  );
  updateQualityDots();

  qualityPrev.addEventListener('click', () => {
    showQualitySlide(qualityCurrentIndex - 1, true);
  });

  qualityNext.addEventListener('click', () => {
    showQualitySlide(qualityCurrentIndex + 1, true);
  });

  startQualityRotation();
}

async function refreshSummary() {
  try {
    const data = await fetchJson(API.summary);
    state.summary = {
      totalRequests: Number(data.totalRequests || 0),
      pickleCount: Number(data.pickleCount || 0),
      ranchCount: Number(data.ranchCount || 0),
    };
  } catch (error) {
    console.error('Failed to load request summary.', error);
  }
  renderStats();
}

async function refreshAdminSession() {
  try {
    const data = await fetchJson(API.adminMe);
    state.isAdminAuthed = Boolean(data.authenticated);
  } catch {
    state.isAdminAuthed = false;
  }
}

async function refreshAdminRequests({ quiet = false } = {}) {
  if (!state.isAdminAuthed) {
    state.requests = [];
    state.requestsError = '';
    state.requestsLoading = false;
    renderAdmin();
    return [];
  }

  if (!quiet) {
    state.requestsLoading = true;
    state.requestsError = '';
    renderAdmin();
  }

  try {
    const data = await fetchJson(API.adminRequests);
    state.requests = Array.isArray(data.requests)
      ? data.requests.map((request) => ({
          ...request,
          category: request.category || 'Pickles',
          status: request.status || 'New',
          notes: request.notes || '',
        }))
      : [];
    state.requestsError = '';
  } catch (error) {
    state.requests = [];
    state.requestsError = error.message || 'We could not load the request queue.';
  } finally {
    state.requestsLoading = false;
    renderAdmin();
  }

  return state.requests;
}

function renderAdmin() {
  if (adminPanel) {
    adminPanel.classList.toggle('is-open', state.isAdminAuthed);
  }

  if (!state.isAdminAuthed) {
    adminContent.innerHTML = `
      <div class="admin-locked">
        <form class="admin-login" id="loginForm">
          <div>
            <p class="eyebrow">Secret snack access</p>
            <h3>Admin access is tucked away</h3>
            <p>Log in to expand this strip into the full request board.</p>
          </div>
          <label>
            Username
            <input name="username" type="text" autocomplete="username" placeholder="admin" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autocomplete="current-password" placeholder="Ask the pickle oracle" required />
          </label>
          <div class="login-actions">
            <button class="button button-primary" type="submit">Log in</button>
          </div>
          <p class="login-hint">Hint: the password sounds like a compliment for a very confident pickle.</p>
          <p class="form-note" id="adminMessage" role="status" aria-live="polite" style="color: ${state.loginMessageColor};">${escapeHtml(state.loginMessage)}</p>
        </form>
      </div>
    `;

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }
    return;
  }

  const filteredRequests = state.requests
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter((request) => {
      if (state.requestCategoryFilter !== 'All' && request.category !== state.requestCategoryFilter) {
        return false;
      }
      if (!state.requestFilter) {
        return true;
      }
      const haystack = [
        request.category,
        request.name,
        request.contact,
        request.style,
        request.quantity,
        request.notes,
        request.status,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(state.requestFilter);
    });

  const categoryCounts = state.requests.reduce(
    (accumulator, request) => {
      accumulator[request.category] = (accumulator[request.category] || 0) + 1;
      return accumulator;
    },
    { Pickles: 0, Ranch: 0 },
  );

  const statusCounts = state.requests.reduce(
    (accumulator, request) => {
      accumulator[request.status] = (accumulator[request.status] || 0) + 1;
      return accumulator;
    },
    { New: 0, Contacted: 0, 'In Progress': 0, Ready: 0, Complete: 0 },
  );

  const noticeText = state.requestsLoading
    ? 'Loading requests from the database…'
    : state.requestsError;

  adminContent.innerHTML = `
    <div class="admin-shell">
      <div class="admin-tabs" role="tablist" aria-label="Request type filters">
        ${['All', 'Pickles', 'Ranch']
          .map(
            (category) => `
              <button
                class="admin-tab ${state.requestCategoryFilter === category ? 'is-active' : ''}"
                type="button"
                data-category="${category}"
              >
                ${category}
              </button>
            `,
          )
          .join('')}
      </div>

      <div class="admin-summary">
        <div class="summary-card"><span>Total</span><strong>${state.requests.length}</strong></div>
        <div class="summary-card"><span>Pickles</span><strong>${categoryCounts.Pickles}</strong></div>
        <div class="summary-card summary-card-ranch"><span>Ranch</span><strong>${categoryCounts.Ranch}</strong></div>
        <div class="summary-card"><span>New</span><strong>${statusCounts.New}</strong></div>
      </div>

      ${noticeText ? `<p class="form-note admin-notice" role="status" aria-live="polite">${escapeHtml(noticeText)}</p>` : ''}

      <div class="admin-card">
        <div class="admin-controls">
          <input id="searchRequests" type="search" placeholder="Search requests by name, style, or note" value="${escapeHtml(state.requestFilter)}" />
          <button class="button button-secondary" id="logoutButton" type="button">Log out</button>
        </div>

        <div class="request-list" id="requestList"></div>
      </div>
    </div>
  `;

  const searchRequests = document.getElementById('searchRequests');
  const logoutButton = document.getElementById('logoutButton');
  const requestList = document.getElementById('requestList');
  const categoryButtons = [...document.querySelectorAll('[data-category]')];

  if (searchRequests) {
    searchRequests.addEventListener('input', (event) => {
      state.requestFilter = escapeSearchValue(event.currentTarget.value);
      renderAdmin();
    });
  }

  categoryButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.requestCategoryFilter = button.dataset.category || 'All';
      renderAdmin();
    });
  });

  if (logoutButton) {
    logoutButton.addEventListener('click', handleLogout);
  }

  if (!requestList) {
    return;
  }

  if (state.requestsLoading) {
    requestList.innerHTML = `
      <div class="empty-state">
        Loading requests from the database...
      </div>
    `;
    return;
  }

  if (filteredRequests.length === 0) {
    requestList.innerHTML = `
      <div class="empty-state">
        No requests match this search yet.
      </div>
    `;
    return;
  }

  requestList.replaceChildren(
    ...filteredRequests.map((request) => {
      const card = document.createElement('article');
      card.className = 'request-card';

      const head = document.createElement('div');
      head.className = 'request-card-head';

      const title = document.createElement('div');
      title.className = 'request-title';

      const name = document.createElement('strong');
      name.textContent = request.name;
      const meta = document.createElement('small');
      meta.textContent = `${request.contact} · ${formatDate(request.createdAt)}`;

      title.append(name, meta);

      const badge = document.createElement('span');
      badge.className = 'request-badge';
      badge.textContent = request.status;

      const categoryBadge = document.createElement('span');
      categoryBadge.className = `request-category ${
        request.category === 'Ranch' ? 'request-category-ranch' : ''
      }`;
      categoryBadge.textContent = request.category;

      head.append(title, categoryBadge, badge);

      const details = document.createElement('div');
      details.className = 'request-meta';

      const pieces = [
        `Style: ${request.style}`,
        `Quantity: ${request.quantity}`,
        request.notes ? `Notes: ${request.notes}` : 'Notes: none',
      ];

      pieces.forEach((piece) => {
        const span = document.createElement('span');
        span.textContent = piece;
        details.append(span);
      });

      const controls = document.createElement('div');
      controls.className = 'request-controls';

      const statusSelect = document.createElement('select');
      const statuses = ['New', 'Contacted', 'In Progress', 'Ready', 'Complete'];

      statuses.forEach((status) => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        if (status === request.status) {
          option.selected = true;
        }
        statusSelect.append(option);
      });

      statusSelect.addEventListener('change', async (event) => {
        try {
          await updateRequest(request.id, { status: event.currentTarget.value });
        } catch (error) {
          state.requestsError = error.message || 'Could not update the request.';
          renderAdmin();
        }
      });

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'button ghost-button';
      deleteButton.textContent = 'Remove';
      deleteButton.addEventListener('click', async () => {
        try {
          await deleteRequest(request.id);
        } catch (error) {
          state.requestsError = error.message || 'Could not remove the request.';
          renderAdmin();
        }
      });

      controls.append(statusSelect, deleteButton);

      card.append(head, details, controls);
      return card;
    }),
  );
}

async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const username = String(formData.get('username') || '');
  const password = String(formData.get('password') || '');

  try {
    await fetchJson(API.adminLogin, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    state.isAdminAuthed = true;
    state.loginMessage = '';
    state.loginMessageColor = '#6d705d';
    state.requestsLoading = true;
    state.requestsError = '';
    renderAdmin();
    await refreshSummary();
    await refreshAdminRequests({ quiet: true });
  } catch (error) {
    state.loginMessage = error.message || 'That admin login did not match the stored credentials.';
    state.loginMessageColor = '#8b5b45';
    renderAdmin();
  }
}

async function handleLogout() {
  try {
    await fetchJson(API.adminLogout, { method: 'POST' });
  } catch (error) {
    console.error('Logout request failed.', error);
  } finally {
    state.isAdminAuthed = false;
    state.requests = [];
    state.requestsError = '';
    state.requestsLoading = false;
    state.requestFilter = '';
    state.requestCategoryFilter = 'All';
    state.loginMessage = '';
    state.loginMessageColor = '#6d705d';
    renderAdmin();
  }
}

async function updateRequest(id, updates) {
  const data = await fetchJson(`${API.adminRequests}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });

  if (data.summary) {
    state.summary = {
      totalRequests: Number(data.summary.totalRequests || 0),
      pickleCount: Number(data.summary.pickleCount || 0),
      ranchCount: Number(data.summary.ranchCount || 0),
    };
    renderStats();
  }

  await refreshAdminRequests({ quiet: true });
  return data.request;
}

async function deleteRequest(id) {
  const data = await fetchJson(`${API.adminRequests}/${id}`, {
    method: 'DELETE',
  });

  if (data.summary) {
    state.summary = {
      totalRequests: Number(data.summary.totalRequests || 0),
      pickleCount: Number(data.summary.pickleCount || 0),
      ranchCount: Number(data.summary.ranchCount || 0),
    };
    renderStats();
  }

  await refreshAdminRequests({ quiet: true });
}

async function handleRequestSubmit(event, category, messageElement, successText, accentColor) {
  event.preventDefault();
  const formElement = event.currentTarget;
  const formData = new FormData(formElement);
  const name = String(formData.get('name') || '').trim();
  const contact = String(formData.get('contact') || '').trim();
  const style = String(formData.get('style') || '').trim();
  const quantity = String(formData.get('quantity') || '').trim();
  const notes = String(formData.get('notes') || '').trim();

  try {
    if (messageElement) {
      messageElement.textContent = 'Saving request...';
      messageElement.style.color = '#6d705d';
    }

    await fetchJson(API.request, {
      method: 'POST',
      body: JSON.stringify({
        category,
        name,
        contact,
        style,
        quantity,
        notes,
      }),
    });

    formElement.reset();
    if (messageElement) {
      messageElement.textContent = successText;
      messageElement.style.color = accentColor;
    }

    await refreshSummary();
    if (state.isAdminAuthed) {
      await refreshAdminRequests({ quiet: true });
    }
  } catch (error) {
    if (messageElement) {
      messageElement.textContent = error.message || 'We could not save that request right now.';
      messageElement.style.color = '#8b5b45';
    }
  }
}

async function bootstrap() {
  initializeQualitySlideshow();
  renderAll();

  await Promise.all([refreshSummary(), refreshAdminSession()]);
  renderAll();

  if (state.isAdminAuthed) {
    await refreshAdminRequests();
  } else {
    renderAdmin();
  }
}

requestForm?.addEventListener('submit', (event) =>
  handleRequestSubmit(
    event,
    'Pickles',
    requestMessage,
    'Pickle request saved. Big Jims can review it from the admin area.',
    '#3f5a35',
  ),
);

ranchRequestForm?.addEventListener('submit', (event) =>
  handleRequestSubmit(
    event,
    'Ranch',
    ranchRequestMessage,
    'Ranch request saved. Big Jims can review it from the admin area.',
    '#224b7a',
  ),
);

bootstrap().catch((error) => {
  console.error('Application bootstrap failed.', error);
  if (requestMessage) {
    requestMessage.textContent = 'The site could not connect to the request database yet.';
    requestMessage.style.color = '#8b5b45';
  }
});

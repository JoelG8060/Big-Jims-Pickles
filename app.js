const STORAGE_KEY = 'big-jims-pickels-requests';
const SESSION_KEY = 'big-jims-pickels-admin-session';
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'BIGBOY',
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

let requests = loadRequests();
let isAdminAuthed = loadAdminSession();
let requestFilter = '';
let requestCategoryFilter = 'All';
let qualityCurrentIndex = 0;
let qualityRotationId = null;

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

function loadRequests() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map((request) => ({
          ...request,
          category: request.category || 'Pickles',
          status: request.status || 'New',
        }))
      : [];
  } catch {
    return [];
  }
}

function saveRequests(nextRequests) {
  requests = nextRequests;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  renderAll();
}

function loadAdminSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) === true : false;
  } catch {
    return false;
  }
}

function setAdminSession(value) {
  isAdminAuthed = value;
  if (value) {
    sessionStorage.setItem(SESSION_KEY, 'true');
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
  renderAdmin();
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Math.random().toString(36).slice(2, 11)}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

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

function renderStats() {
  requestCount.textContent = String(requests.length);
  pickleCount.textContent = String(requests.filter((request) => request.category === 'Pickles').length);
  ranchCount.textContent = String(requests.filter((request) => request.category === 'Ranch').length);
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

function renderAdmin() {
  if (adminPanel) {
    adminPanel.classList.toggle('is-open', isAdminAuthed);
  }

  if (!isAdminAuthed) {
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
          <p class="form-note" id="adminMessage" role="status" aria-live="polite"></p>
        </form>
      </div>
    `;

    const loginForm = document.getElementById('loginForm');
    const adminMessage = document.getElementById('adminMessage');

    loginForm.addEventListener('submit', handleLogin);
    return;
  }

  const filteredRequests = requests
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter((request) => {
      if (requestCategoryFilter !== 'All' && request.category !== requestCategoryFilter) {
        return false;
      }
      if (!requestFilter) return true;
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
      return haystack.includes(requestFilter);
    });

  const categoryCounts = requests.reduce(
    (accumulator, request) => {
      accumulator[request.category] = (accumulator[request.category] || 0) + 1;
      return accumulator;
    },
    { Pickles: 0, Ranch: 0 },
  );

  const statusCounts = requests.reduce(
    (accumulator, request) => {
      accumulator[request.status] = (accumulator[request.status] || 0) + 1;
      return accumulator;
    },
    { New: 0, Contacted: 0, 'In Progress': 0, Ready: 0, Complete: 0 },
  );

  adminContent.innerHTML = `
    <div class="admin-shell">
      <div class="admin-tabs" role="tablist" aria-label="Request type filters">
        ${['All', 'Pickles', 'Ranch']
          .map(
            (category) => `
              <button
                class="admin-tab ${requestCategoryFilter === category ? 'is-active' : ''}"
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
        <div class="summary-card"><span>Total</span><strong>${requests.length}</strong></div>
        <div class="summary-card"><span>Pickles</span><strong>${categoryCounts.Pickles}</strong></div>
        <div class="summary-card summary-card-ranch"><span>Ranch</span><strong>${categoryCounts.Ranch}</strong></div>
        <div class="summary-card"><span>New</span><strong>${statusCounts.New}</strong></div>
      </div>

      <div class="admin-card">
        <div class="admin-controls">
          <input id="searchRequests" type="search" placeholder="Search requests by name, style, or note" value="${escapeHtml(requestFilter)}" />
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

  searchRequests.addEventListener('input', (event) => {
    requestFilter = escapeSearchValue(event.currentTarget.value);
    renderAdmin();
  });

  categoryButtons.forEach((button) => {
    button.addEventListener('click', () => {
      requestCategoryFilter = button.dataset.category || 'All';
      renderAdmin();
    });
  });

  logoutButton.addEventListener('click', () => {
    setAdminSession(false);
  });

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
      details.innerHTML = '';

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

      statusSelect.addEventListener('change', (event) => {
        updateRequest(request.id, { status: event.currentTarget.value });
      });

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'button ghost-button';
      deleteButton.textContent = 'Remove';
      deleteButton.addEventListener('click', () => deleteRequest(request.id));

      controls.append(statusSelect, deleteButton);

      card.append(head, details, controls);
      return card;
    }),
  );
}

function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const username = String(formData.get('username') || '');
  const password = String(formData.get('password') || '');
  const adminMessage = document.getElementById('adminMessage');

  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    if (adminMessage) {
      adminMessage.textContent = '';
    }
    setAdminSession(true);
    return;
  }

  if (adminMessage) {
    adminMessage.textContent = 'That admin login did not match the demo credentials.';
    adminMessage.style.color = '#8b5b45';
  }
}

function updateRequest(id, updates) {
  const nextRequests = requests.map((request) =>
    request.id === id ? { ...request, ...updates } : request,
  );
  saveRequests(nextRequests);
}

function deleteRequest(id) {
  const nextRequests = requests.filter((request) => request.id !== id);
  saveRequests(nextRequests);
}

function handleRequestSubmit(event, category, messageElement, successText, accentColor) {
  event.preventDefault();
  const formElement = event.currentTarget;
  const formData = new FormData(formElement);
  const name = String(formData.get('name') || '').trim();
  const contact = String(formData.get('contact') || '').trim();
  const style = String(formData.get('style') || '');
  const quantity = String(formData.get('quantity') || '');
  const notes = String(formData.get('notes') || '').trim();

  const nextRequest = {
    id: createId(),
    category,
    name,
    contact,
    style,
    quantity,
    notes,
    status: 'New',
    createdAt: new Date().toISOString(),
  };

  saveRequests([nextRequest, ...requests]);
  formElement.reset();
  messageElement.textContent = successText;
  messageElement.style.color = accentColor;
}

requestForm.addEventListener('submit', (event) =>
  handleRequestSubmit(
    event,
    'Pickles',
    requestMessage,
    'Pickle request saved. Big Jims can review it from the admin area.',
    '#3f5a35',
  ),
);

ranchRequestForm.addEventListener('submit', (event) =>
  handleRequestSubmit(
    event,
    'Ranch',
    ranchRequestMessage,
    'Ranch request saved. Big Jims can review it from the admin area.',
    '#224b7a',
  ),
);

initializeQualitySlideshow();
renderAll();

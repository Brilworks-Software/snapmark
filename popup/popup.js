// popup/popup.js

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function init() {
  const tab = await getActiveTab();
  const isRestrictedPage = !tab?.url ||
    tab.url.startsWith('chrome://') ||
    tab.url.startsWith('chrome-extension://') ||
    tab.url.startsWith('edge://') ||
    tab.url.startsWith('about:');

  if (isRestrictedPage) {
    document.querySelectorAll('.capture-btn').forEach(btn => {
      btn.classList.add('disabled');
      btn.disabled = true;
    });
  }

  // ── Region capture
  document.getElementById('btnRegion').addEventListener('click', async () => {
    if (isRestrictedPage) return;
    chrome.runtime.sendMessage({ type: 'START_REGION_CAPTURE', tabId: tab.id });
    setTimeout(() => window.close(), 100);
  });

  // ── Visible area capture
  document.getElementById('btnVisible').addEventListener('click', async () => {
    if (isRestrictedPage) return;
    chrome.runtime.sendMessage({ type: 'START_VISIBLE_CAPTURE', tabId: tab.id });
    setTimeout(() => window.close(), 100);
  });

  // ── Pro State Check
  const { pro_unlocked } = await chrome.storage.local.get('pro_unlocked');
  if (pro_unlocked) {
    document.getElementById('btnShowPromo').style.display = 'none';
    document.getElementById('proStatus').style.display = 'block';
  }

  // ── Full page (Pro)
  document.getElementById('btnFullPage').addEventListener('click', async () => {
    const { pro_unlocked } = await chrome.storage.local.get('pro_unlocked');
    if (pro_unlocked) {
      // In a real pro version, this would trigger the scrolling capture.
      // For now, we'll just show it's enabled.
      alert('Full Page Capture is enabled! (Feature coming soon to Pro users)');
    } else {
      chrome.tabs.create({ url: 'https://snapmark.brilworks.com/#pricing' });
    }
  });

  // ── Promo Code Logic
  document.getElementById('btnShowPromo').addEventListener('click', () => {
    document.getElementById('promoInputGroup').style.display = 'flex';
    document.getElementById('btnShowPromo').style.display = 'none';
  });

  const promoInput = document.getElementById('promoCode');
  promoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btnRedeem').click();
    e.stopPropagation(); // Prevent shortcuts from firing
  });

  document.getElementById('btnRedeem').addEventListener('click', async () => {
    const code = promoInput.value.trim();
    if (code === 'Brilworks') {
      await chrome.storage.local.set({ pro_unlocked: true });
      document.getElementById('promoInputGroup').style.display = 'none';
      document.getElementById('proStatus').style.display = 'block';
    } else {
      alert('Invalid promo code');
    }
  });

  // ── Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key.toLowerCase() === 'r') document.getElementById('btnRegion').click();
    if (e.key.toLowerCase() === 'v') document.getElementById('btnVisible').click();
  });

  // ── Load recents
  loadRecents();
}

async function loadRecents() {
  const result = await chrome.storage.local.get('snapmark_history');
  const history = result.snapmark_history || [];
  const list = document.getElementById('recentsList');

  if (!history.length) return;

  list.innerHTML = '';
  history.slice(0, 5).forEach(item => {
    const el = document.createElement('div');
    el.className = 'recent-item';
    el.innerHTML = `
      <img class="recent-thumb" src="${item.thumbnail}" alt="Screenshot">
      <div class="recent-info">
        <div class="recent-name">${item.sourceDomain || 'Screenshot'}</div>
        <div class="recent-time">${formatTime(item.timestamp)}</div>
      </div>
      <button class="recent-open-btn" data-id="${item.id}" title="Open in editor">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </button>
    `;
    el.querySelector('.recent-open-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = e.currentTarget.dataset.id;
      const saved = await chrome.storage.local.get(`snapmark_img_${id}`);
      if (saved[`snapmark_img_${id}`]) {
        await chrome.storage.session.set({ 'snapmark_pending_image': saved[`snapmark_img_${id}`] });
        chrome.tabs.create({ url: chrome.runtime.getURL('editor/editor.html') });
      }
    });
    list.appendChild(el);
  });
}

function formatTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

init();

// background/service-worker.js

// ─── Message handler ──────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('SnapMark: Received message', message.type);
  if (message.type === 'START_REGION_CAPTURE') {
    handleRegionCapture(message.tabId);
  }

  if (message.type === 'START_VISIBLE_CAPTURE') {
    handleVisibleCapture(message.tabId);
  }

  if (message.type === 'REGION_SELECTED') {
    console.log('SnapMark: Region selected', message.rect);
    handleRegionSelected(sender.tab, message.rect, message.devicePixelRatio);
  }

  if (message.type === 'CANCEL_OVERLAY') {
    // User pressed Escape — do nothing, overlay already removed itself
  }

  return false;
});

// ─── Region capture flow ──────────────────────────────────────────────

async function handleRegionCapture(tabId) {
  try {
    // Inject overlay CSS + JS into the active tab
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content/overlay.css']
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/overlay.js']
    });
    console.log('SnapMark: Overlay injected successfully');
  } catch (e) {
    console.error('SnapMark: failed to inject overlay. Error:', e.message);
  }
}

async function handleRegionSelected(tab, rect, dpr) {
  try {
    // Capture the full visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png'
    });

    // Crop to the selected region using OffscreenCanvas
    const croppedDataUrl = await cropImage(dataUrl, rect, dpr);

    // Store image in session storage so editor can read it
    await chrome.storage.session.set({
      'snapmark_pending_image': croppedDataUrl,
      'snapmark_source_url': tab.url,
      'snapmark_timestamp': Date.now()
    });

    // Open the editor in a new tab
    await chrome.tabs.create({
      url: chrome.runtime.getURL('editor/editor.html'),
      active: true
    });
    console.log('SnapMark: Editor opened');
  } catch (e) {
    console.error('SnapMark: region capture failed. Error:', e.message);
  }
}

// ─── Visible area capture ─────────────────────────────────────────────

async function handleVisibleCapture(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png'
    });

    await chrome.storage.session.set({
      'snapmark_pending_image': dataUrl,
      'snapmark_source_url': tab.url,
      'snapmark_timestamp': Date.now()
    });

    await chrome.tabs.create({
      url: chrome.runtime.getURL('editor/editor.html'),
      active: true
    });
  } catch (e) {
    console.error('SnapMark: visible capture failed', e);
  }
}

// ─── Image crop utility ───────────────────────────────────────────────

async function cropImage(dataUrl, rect, dpr) {
  // Use OffscreenCanvas (available in service workers)
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const scaledRect = {
    x: Math.round(rect.x * dpr),
    y: Math.round(rect.y * dpr),
    w: Math.round(rect.w * dpr),
    h: Math.round(rect.h * dpr)
  };

  const canvas = new OffscreenCanvas(scaledRect.w, scaledRect.h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    bitmap,
    scaledRect.x, scaledRect.y, scaledRect.w, scaledRect.h,
    0, 0, scaledRect.w, scaledRect.h
  );

  const outputBlob = await canvas.convertToBlob({ type: 'image/png' });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(outputBlob);
  });
}

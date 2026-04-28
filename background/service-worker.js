// background/service-worker.js

// ─── Message handler ──────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_REGION_CAPTURE') {
    handleRegionCapture(message.tabId);
  } else if (message.type === 'START_VISIBLE_CAPTURE') {
    handleVisibleCapture(message.tabId);
  } else if (message.type === 'START_FULL_PAGE_CAPTURE') {
    handleFullPageCapture(message.tabId);
  } else if (message.type === 'REGION_SELECTED') {
    handleRegionSelected(sender.tab, message.rect, message.devicePixelRatio);
  } else if (message.type === 'CAPTURE_PART_REQUEST') {
    // Capture the visible part and send back to content script
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' }, (dataUrl) => {
      sendResponse({ dataUrl });
    });
    return true; // async
  } else if (message.type === 'FINISH_FULL_PAGE_CAPTURE') {
    finishFullPageCapture(sender.tab, message.data);
  }

  return false;
});

// ─── Region capture flow ──────────────────────────────────────────────
async function handleRegionCapture(tabId) {
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['content/overlay.css'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content/overlay.js'] });
  } catch (e) { console.error('SnapMark: Overlay failed', e); }
}

async function handleRegionSelected(tab, rect, dpr) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const croppedDataUrl = await cropImage(dataUrl, rect, dpr);
    await openEditor(tab, croppedDataUrl);
  } catch (e) { console.error('SnapMark: Region failed', e); }
}

// ─── Visible area capture ─────────────────────────────────────────────
async function handleVisibleCapture(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    await openEditor(tab, dataUrl);
  } catch (e) { console.error('SnapMark: Visible failed', e); }
}

// ─── Full page capture ───────────────────────────────────────────────
async function handleFullPageCapture(tabId) {
  try {
    // Inject the new scrolling script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/fullpage.js']
    });
  } catch (e) { console.error('SnapMark: FullPage script failed', e); }
}

async function finishFullPageCapture(tab, data) {
  try {
    const { segments, width, height } = data;
    const stitchedDataUrl = await stitchImages(segments, width, height);
    await openEditor(tab, stitchedDataUrl);
  } catch (e) { console.error('SnapMark: Stitching failed', e); }
}

// ─── Helpers ──────────────────────────────────────────────────────────
async function openEditor(tab, dataUrl) {
  // Use local storage for large images to avoid session limits
  await chrome.storage.local.set({
    'snapmark_pending_image': dataUrl,
    'snapmark_source_url': tab.url,
    'snapmark_timestamp': Date.now()
  });
  await chrome.tabs.create({ url: chrome.runtime.getURL('editor/editor.html') });
}

async function stitchImages(images, totalWidth, totalHeight) {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen/offscreen.html'),
      reasons: ['DOM_CANVAS'],
      justification: 'Stitching'
    });
  }
  const response = await chrome.runtime.sendMessage({
    type: 'stitch-images',
    target: 'offscreen',
    data: { images, totalWidth, totalHeight }
  });
  await chrome.offscreen.closeDocument();
  if (!response?.success) throw new Error(response?.error || 'Timeout');
  return response.dataUrl;
}

async function cropImage(dataUrl, rect, dpr) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const sw = Math.round(rect.w * dpr), sh = Math.round(rect.h * dpr);
  const canvas = new OffscreenCanvas(sw, sh);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, Math.round(rect.x * dpr), Math.round(rect.y * dpr), sw, sh, 0, 0, sw, sh);
  const output = await canvas.convertToBlob({ type: 'image/png' });
  return new Promise(r => {
    const reader = new FileReader();
    reader.onloadend = () => r(reader.result);
    reader.readAsDataURL(output);
  });
}

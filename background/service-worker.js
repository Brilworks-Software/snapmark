// background/service-worker.js

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_REGION_CAPTURE') {
    handleRegionCapture(message.tabId);
  } else if (message.type === 'START_VISIBLE_CAPTURE') {
    handleVisibleCapture(message.tabId);
  } else if (message.type === 'START_FULL_PAGE_CAPTURE') {
    handleFullPageCapture(message.tabId);
  } else if (message.type === 'CAPTURE_PART_REQUEST') {
    handleCapturePart(sender.tab.windowId).then(dataUrl => {
      sendResponse({ dataUrl });
    }).catch(err => {
      sendResponse({ error: err.message });
    });
    return true; 
  } else if (message.type === 'FINISH_FULL_PAGE_CAPTURE') {
    finishFullPageCapture(sender.tab, message.data);
  } else if (message.type === 'PUSH_SEGMENT') {
    const key = `sm_seg_${message.index}`;
    chrome.storage.local.set({ [key]: message.segment }, () => {
      sendResponse({ success: true });
    });
    return true;
  } else if (message.type === 'REGION_SELECTED') {
    handleRegionSelected(sender.tab, message.rect, message.devicePixelRatio);
  }
  return false;
});

async function handleCapturePart(windowId) {
  return new Promise((resolve, reject) => {
    // Quality 0.8 to save memory
    chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 80 }, (dataUrl) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(dataUrl);
    });
  });
}

async function handleFullPageCapture(tabId) {
  try {
    // Clear old segments before starting
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter(k => k.startsWith('sm_seg_'));
    await chrome.storage.local.remove(keys);
    
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content/fullpage.js'] });
  } catch (e) { console.error('FullPage script failed', e); }
}

async function finishFullPageCapture(tab, data) {
  try {
    const { width, height, count } = data;
    console.log(`Background: Stitching ${count} segments from storage...`);
    
    const stitchedDataUrl = await stitchImages(count, width, height);
    await openEditor(tab, stitchedDataUrl);
    
    // Cleanup segments
    const keys = Array.from({ length: count }, (_, i) => `sm_seg_${i}`);
    await chrome.storage.local.remove(keys);
  } catch (e) {
    console.error('Stitching failed', e);
    chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_ERROR', error: e.message });
  }
}

async function stitchImages(count, totalWidth, totalHeight) {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen/offscreen.html'),
      reasons: ['BLOBS'],
      justification: 'Stitching'
    });
  }
  
  const response = await chrome.runtime.sendMessage({
    type: 'stitch-images-from-storage',
    target: 'offscreen',
    data: { count, totalWidth, totalHeight }
  });
  
  await chrome.offscreen.closeDocument();
  if (!response?.success) throw new Error(response?.error || 'Stitch failed');
  return response.dataUrl;
}

async function handleRegionCapture(tabId) {
  await chrome.scripting.insertCSS({ target: { tabId }, files: ['content/overlay.css'] });
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content/overlay.js'] });
}

async function handleRegionSelected(tab, rect, dpr) {
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 90 });
  const croppedDataUrl = await cropImage(dataUrl, rect, dpr);
  await openEditor(tab, croppedDataUrl);
}

async function handleVisibleCapture(tabId) {
  const tab = await chrome.tabs.get(tabId);
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 90 });
  await openEditor(tab, dataUrl);
}

async function openEditor(tab, dataUrl) {
  await chrome.storage.local.set({
    'snapmark_pending_image': dataUrl,
    'snapmark_source_url': tab.url,
    'snapmark_timestamp': Date.now()
  });
  await chrome.tabs.create({ url: chrome.runtime.getURL('editor/editor.html') });
}

async function cropImage(dataUrl, rect, dpr) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const sw = Math.round(rect.w * dpr), sh = Math.round(rect.h * dpr);
  const canvas = new OffscreenCanvas(sw, sh);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, Math.round(rect.x * dpr), Math.round(rect.y * dpr), sw, sh, 0, 0, sw, sh);
  const output = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
  return new Promise(r => {
    const reader = new FileReader();
    reader.onloadend = () => r(reader.result);
    reader.readAsDataURL(output);
  });
}

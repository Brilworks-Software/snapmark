// content/overlay.js — handles drag-selection on the page

(function () {
  // Prevent double-inject
  if (document.getElementById('snapmark-overlay')) return;

  let startX = 0, startY = 0;
  let isDragging = false;

  // Create overlay elements
  const overlay = document.createElement('div');
  overlay.id = 'snapmark-overlay';

  const selection = document.createElement('div');
  selection.id = 'snapmark-selection';

  const hint = document.createElement('div');
  hint.id = 'snapmark-hint';
  hint.textContent = 'Drag to select area  •  Esc to cancel';

  const dimensions = document.createElement('div');
  dimensions.id = 'snapmark-dimensions';

  document.body.appendChild(overlay);
  document.body.appendChild(selection);
  document.body.appendChild(hint);
  document.body.appendChild(dimensions);

  // Prevent scroll while overlay is active
  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  function cleanup() {
    overlay.remove();
    selection.remove();
    hint.remove();
    dimensions.remove();
    document.body.style.overflow = originalOverflow;
    document.removeEventListener('keydown', onKeyDown);
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    selection.style.display = 'block';
    hint.style.display = 'none';
    updateSelection(e.clientX, e.clientY);
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    updateSelection(e.clientX, e.clientY);
  }

  function onMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;

    const rect = getRect(startX, startY, e.clientX, e.clientY);

    // Minimum capture size: 10x10px
    if (rect.w < 10 || rect.h < 10) {
      cleanup();
      return;
    }

    cleanup();

    // Send selection to background
    chrome.runtime.sendMessage({
      type: 'REGION_SELECTED',
      rect,
      devicePixelRatio: window.devicePixelRatio || 1
    });
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      cleanup();
      chrome.runtime.sendMessage({ type: 'CANCEL_OVERLAY' });
    }
  }

  function updateSelection(currentX, currentY) {
    const rect = getRect(startX, startY, currentX, currentY);
    selection.style.left   = rect.x + 'px';
    selection.style.top    = rect.y + 'px';
    selection.style.width  = rect.w + 'px';
    selection.style.height = rect.h + 'px';

    // Dimension label
    dimensions.textContent = `${rect.w} × ${rect.h}`;
    dimensions.style.display = 'block';
    dimensions.style.left = (rect.x + rect.w - 70) + 'px';
    dimensions.style.top  = (rect.y + rect.h + 6) + 'px';
  }

  function getRect(x1, y1, x2, y2) {
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.abs(x2 - x1),
      h: Math.abs(y2 - y1)
    };
  }

  overlay.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keydown', onKeyDown);
})();

// editor/editor.js

// ─── Config ───────────────────────────────────────────────────────────
const TOOLS = [
  { id: 'select',    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3l14 9-7 1-4 7z"/></svg>`,                   title: 'Select (S)' },
  { id: 'arrow',     icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`, title: 'Arrow (A)' },
  { id: 'rectangle', icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`, title: 'Rectangle (R)' },
  { id: 'circle',    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>`,               title: 'Ellipse (E)' },
  { id: 'pen',       icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`, title: 'Pen (P)' },
  { id: 'text',      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`, title: 'Text (T)' },
  { id: 'blur',      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>`, title: 'Blur / Redact (B)' },
  { id: 'crop',      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 2 6 17 21 17"/><polyline points="2 6 17 6 17 21"/></svg>`, title: 'Crop (C)' },
];

// ─── Supabase Config ─────────────────────────────────────────────────
const BUCKET_NAME = 'screenshots';

let supabaseClient = null;
if (typeof supabase !== 'undefined' && typeof SUPABASE_CONFIG !== 'undefined') {
  supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
}

const COLORS = [
  '#EF4444', // red
  '#F97316', // orange
  '#FACC15', // yellow
  '#22C55E', // green
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#FFFFFF', // white
  '#000000', // black
];

// ─── State ────────────────────────────────────────────────────────────
let activeTool   = 'arrow';
let activeColor  = '#EF4444';
let strokeSize   = 3;
let isDrawing    = false;
let startX = 0, startY = 0;
let penPath      = [];
let undoStack    = [];
let redoStack    = [];
let baseImage    = null;

// Canvas refs
let baseCanvas, drawCanvas, cursorCanvas;
let baseCtx, drawCtx, cursorCtx;

// ─── Init ─────────────────────────────────────────────────────────────
async function init() {
  baseCanvas   = document.getElementById('baseCanvas');
  drawCanvas   = document.getElementById('drawCanvas');
  cursorCanvas = document.getElementById('cursorCanvas');
  
  // Optimization for blur tool readback
  baseCtx      = baseCanvas.getContext('2d', { willReadFrequently: true });
  drawCtx      = drawCanvas.getContext('2d');
  cursorCtx    = cursorCanvas.getContext('2d');

  renderToolbar();
  renderColors();
  bindControls();

  // Hide canvas wrapper until image loads
  document.getElementById('canvasWrapper').style.display = 'none';

  // Load image from session storage
  const result = await chrome.storage.session.get('snapmark_pending_image');
  if (result.snapmark_pending_image) {
    await loadImage(result.snapmark_pending_image);
    // Save to local history
    saveToHistory(result.snapmark_pending_image);
  } else {
    document.getElementById('loadingState').innerHTML = `
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3D4358" stroke-width="1.5">
        <rect x="2" y="4" width="20" height="16" rx="2"/>
        <path d="M8 20h8M12 16v4"/>
      </svg>
      <p style="color:#3D4358">No screenshot found.<br>Close this tab and capture again.</p>
    `;
  }
}

async function loadImage(dataUrl) {
  const img = new Image();
  img.onload = () => {
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    // Size all canvases
    [baseCanvas, drawCanvas, cursorCanvas].forEach(c => {
      c.width = w;
      c.height = h;
    });

    // Draw screenshot to base canvas
    baseCtx.drawImage(img, 0, 0);
    baseImage = img;

    // Update dimensions badge
    document.getElementById('imageDimensions').textContent = `${w} × ${h}`;

    // Hide loader, show canvas
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('canvasWrapper').style.display = 'inline-block';

    // Scale down if needed
    fitCanvasToWindow(w, h);
  };
  img.src = dataUrl;
}

function fitCanvasToWindow(w, h) {
  const area = document.getElementById('canvasArea');
  const maxW = area.clientWidth - 40;
  const maxH = area.clientHeight - 40;
  const scale = Math.min(1, maxW / w, maxH / h);
  if (scale < 1) {
    const wrapper = document.getElementById('canvasWrapper');
    wrapper.style.transform = `scale(${scale})`;
    wrapper.style.transformOrigin = 'top left';
  }
}

// ─── Toolbar rendering ────────────────────────────────────────────────
function renderToolbar() {
  const bar = document.getElementById('toolBar');
  bar.innerHTML = '';
  TOOLS.forEach(tool => {
    const btn = document.createElement('button');
    btn.className = `tool-btn ${tool.id === activeTool ? 'active' : ''}`;
    btn.id = `tool_${tool.id}`;
    btn.title = tool.title;
    btn.innerHTML = tool.icon;
    btn.addEventListener('click', () => setTool(tool.id));
    bar.appendChild(btn);
  });
}

function setTool(toolId) {
  activeTool = toolId;
  document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`tool_${toolId}`)?.classList.add('active');
  drawCanvas.style.cursor = toolId === 'text' ? 'text' : 'crosshair';
}

function renderColors() {
  const row = document.getElementById('colorRow');
  row.innerHTML = '';
  COLORS.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = `color-swatch ${color === activeColor ? 'active' : ''}`;
    swatch.style.background = color;
    if (color === '#FFFFFF') swatch.style.border = '2px solid rgba(255,255,255,0.3)';
    swatch.addEventListener('click', () => {
      activeColor = color;
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
    });
    row.appendChild(swatch);
  });
}

// ─── Controls ─────────────────────────────────────────────────────────
function bindControls() {
  const sizeInput = document.getElementById('strokeSize');
  sizeInput.addEventListener('input', () => {
    strokeSize = parseInt(sizeInput.value);
  });

  document.getElementById('btnUndo').addEventListener('click', undo);
  document.getElementById('btnShare').addEventListener('click', handleShare);
  document.getElementById('btnCopy').addEventListener('click', copyToClipboard);
  document.getElementById('btnDownload').addEventListener('click', downloadPNG);

  // Drawing events
  drawCanvas.addEventListener('mousedown', onMouseDown);
  drawCanvas.addEventListener('mousemove', onMouseMove);
  drawCanvas.addEventListener('mouseup', onMouseUp);
  drawCanvas.addEventListener('mouseleave', () => {
    cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z') { e.preventDefault(); undo(); }
      if (e.key === 'y' || (e.shiftKey && e.key === 'z')) { e.preventDefault(); redo(); }
      if (e.key === 'c' && !isDrawing) { e.preventDefault(); copyToClipboard(); }
      if (e.key === 's') { e.preventDefault(); downloadPNG(); }
    }
    const toolMap = { a: 'arrow', r: 'rectangle', e: 'circle', p: 'pen', t: 'text', b: 'blur', c: 'crop', s: 'select' };
    if (!e.ctrlKey && !e.metaKey && toolMap[e.key.toLowerCase()]) {
      setTool(toolMap[e.key.toLowerCase()]);
    }
    if (e.key === 'Escape') cancelTextInput();
  });
}

// ─── Drawing logic ────────────────────────────────────────────────────
function getCanvasPos(e) {
  const rect = drawCanvas.getBoundingClientRect();
  const scaleX = drawCanvas.width / rect.width;
  const scaleY = drawCanvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function onMouseDown(e) {
  if (activeTool === 'text') {
    showTextInput(e);
    return;
  }
  const pos = getCanvasPos(e);
  isDrawing = true;
  startX = pos.x;
  startY = pos.y;

  if (activeTool === 'pen') {
    penPath = [{ x: startX, y: startY }];
    // Save undo state at start of pen stroke
    saveUndoState();
  }
}

function onMouseMove(e) {
  const pos = getCanvasPos(e);

  // Clear preview layer on every move
  cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);

  if (isDrawing && activeTool === 'pen') {
    penPath.push({ x: pos.x, y: pos.y });
    drawCtx.strokeStyle = activeColor;
    drawCtx.lineWidth = strokeSize;
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';
    drawCtx.beginPath();
    if (penPath.length > 1) {
      const prev = penPath[penPath.length - 2];
      drawCtx.moveTo(prev.x, prev.y);
      drawCtx.lineTo(pos.x, pos.y);
      drawCtx.stroke();
    }
    return;
  }

  // Live shape preview for non-pen tools using cursorCtx
  const needsPreview = ['arrow', 'rectangle', 'circle', 'blur', 'crop'].includes(activeTool);
  if (isDrawing && needsPreview) {
    drawPreview(pos.x, pos.y, cursorCtx);
  }
}

function onMouseUp(e) {
  if (!isDrawing) return;
  isDrawing = false;
  const pos = getCanvasPos(e);

  // Clear preview layer
  cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);

  drawCtx.strokeStyle = activeColor;
  drawCtx.fillStyle = activeColor;
  drawCtx.lineWidth = strokeSize;
  drawCtx.lineCap = 'round';
  drawCtx.lineJoin = 'round';

  if (activeTool !== 'pen') {
    saveUndoState();
  }

  switch (activeTool) {
    case 'arrow':     drawArrow(startX, startY, pos.x, pos.y, drawCtx); break;
    case 'rectangle': drawRect(startX, startY, pos.x, pos.y, drawCtx); break;
    case 'circle':    drawEllipse(startX, startY, pos.x, pos.y, drawCtx); break;
    case 'blur':      
      saveUndoState(); // Save state BEFORE applying blur to base canvas
      applyBlur(startX, startY, pos.x - startX, pos.y - startY); 
      break;
    case 'crop':      confirmCrop(startX, startY, pos.x, pos.y); break;
  }

  updateUndoRedo();
}

function drawPreview(curX, curY, ctx) {
  ctx.strokeStyle = activeColor;
  ctx.fillStyle = activeColor;
  ctx.lineWidth = strokeSize;
  ctx.lineCap = 'round';
  
  switch (activeTool) {
    case 'arrow':     drawArrow(startX, startY, curX, curY, ctx); break;
    case 'rectangle': drawRect(startX, startY, curX, curY, ctx); break;
    case 'circle':    drawEllipse(startX, startY, curX, curY, ctx); break;
    case 'blur':
    case 'crop':
      drawSelectionBox(startX, startY, curX, curY, ctx);
      break;
  }
}

function drawSelectionBox(x1, y1, x2, y2, ctx) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  
  ctx.save();
  ctx.strokeStyle = activeTool === 'crop' ? '#3B82F6' : '#ffffff';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(x, y, w, h);
  
  // Fill overlay for crop
  if (activeTool === 'crop') {
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

// ─── Drawing primitives ───────────────────────────────────────────────
function drawArrow(x1, y1, x2, y2, ctx) {
  const headLen = Math.max(12, strokeSize * 4);
  const angle = Math.atan2(y2 - y1, x2 - x1);

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle - Math.PI / 7),
    y2 - headLen * Math.sin(angle - Math.PI / 7)
  );
  ctx.lineTo(
    x2 - headLen * Math.cos(angle + Math.PI / 7),
    y2 - headLen * Math.sin(angle + Math.PI / 7)
  );
  ctx.closePath();
  ctx.fillStyle = activeColor;
  ctx.fill();
}

function drawRect(x1, y1, x2, y2, ctx) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, strokeSize);
  ctx.stroke();
}

function drawEllipse(x1, y1, x2, y2, ctx) {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const rx = Math.abs(x2 - x1) / 2;
  const ry = Math.abs(y2 - y1) / 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
  ctx.stroke();
}

function applyBlur(x, y, w, h) {
  const bx = Math.min(x, x + w);
  const by = Math.min(y, y + h);
  const bw = Math.abs(w);
  const bh = Math.abs(h);
  if (bw < 5 || bh < 5) return;

  // Use a temporary canvas for better blur effect
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = bw;
  tempCanvas.height = bh;
  const tCtx = tempCanvas.getContext('2d');

  // Draw region to temp
  tCtx.drawImage(baseCanvas, bx, by, bw, bh, 0, 0, bw, bh);

  // Apply pixelation
  const PIXEL_SIZE = Math.max(8, Math.round(Math.min(bw, bh) / 10));
  tCtx.imageSmoothingEnabled = false;
  
  const smallW = Math.max(1, bw / PIXEL_SIZE);
  const smallH = Math.max(1, bh / PIXEL_SIZE);
  
  const offCanvas = document.createElement('canvas');
  offCanvas.width = smallW;
  offCanvas.height = smallH;
  offCanvas.getContext('2d').drawImage(tempCanvas, 0, 0, bw, bh, 0, 0, smallW, smallH);
  
  baseCtx.imageSmoothingEnabled = false;
  baseCtx.drawImage(offCanvas, 0, 0, smallW, smallH, bx, by, bw, bh);
  baseCtx.imageSmoothingEnabled = true;
}

// ─── Text input ───────────────────────────────────────────────────────
// ─── Text input (Improved: Draggable & Resizable) ─────────────────────
let isDraggingText = false;
let textOffset = { x: 0, y: 0 };

function showTextInput(e) {
  const pos = getCanvasPos(e);
  const rect = drawCanvas.getBoundingClientRect();
  const scaleX = rect.width / drawCanvas.width;
  const scaleY = rect.height / drawCanvas.height;

  const textInput = document.getElementById('textInput');
  textInput.style.display = 'block';
  textInput.style.left = (rect.left + pos.x * scaleX + window.scrollX) + 'px';
  textInput.style.top  = (rect.top  + pos.y * scaleY + window.scrollY) + 'px';
  textInput.style.width = 'auto';
  textInput.style.height = 'auto';

  textPlacedX = pos.x;
  textPlacedY = pos.y;

  const textarea = document.getElementById('textInputArea');
  textarea.style.fontSize = `${Math.max(16, strokeSize * 5)}px`;
  textarea.style.color = activeColor;
  textarea.value = '';
  
  // Auto-focus
  setTimeout(() => textarea.focus(), 10);

  // Make it draggable
  textInput.onmousedown = (me) => {
    if (me.target === textarea) return;
    isDraggingText = true;
    textOffset.x = me.clientX - textInput.offsetLeft;
    textOffset.y = me.clientY - textInput.offsetTop;
  };

  window.onmousemove = (me) => {
    if (!isDraggingText) return;
    textInput.style.left = (me.clientX - textOffset.x) + 'px';
    textInput.style.top  = (me.clientY - textOffset.y) + 'px';
    
    const rect = drawCanvas.getBoundingClientRect();
    const scX = drawCanvas.width / rect.width;
    const scY = drawCanvas.height / rect.height;
    textPlacedX = (textInput.offsetLeft - rect.left - window.scrollX) * scX;
    textPlacedY = (textInput.offsetTop - rect.top - window.scrollY) * scY;
  };

  window.onmouseup = () => {
    isDraggingText = false;
  };

  textarea.onkeydown = (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      commitText(textarea.value);
    }
    if (ev.key === 'Escape') cancelTextInput();
  };
}

function commitText(text) {
  if (!text.trim()) { cancelTextInput(); return; }
  saveUndoState();
  const fontSize = Math.max(16, strokeSize * 5);
  drawCtx.font = `bold ${fontSize}px -apple-system, sans-serif`;
  drawCtx.fillStyle = activeColor;
  drawCtx.strokeStyle = 'rgba(0,0,0,0.5)';
  drawCtx.lineWidth = 4;
  drawCtx.textBaseline = 'top';

  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const yOffset = textPlacedY + (i * (fontSize * 1.2));
    drawCtx.strokeText(line, textPlacedX, yOffset);
    drawCtx.fillText(line, textPlacedX, yOffset);
  });
  cancelTextInput();
  updateUndoRedo();
}

function cancelTextInput() {
  document.getElementById('textInput').style.display = 'none';
  const textarea = document.getElementById('textInputArea');
  textarea.value = '';
  window.onmousemove = null;
  window.onmouseup = null;
}

// ─── Crop Logic ───────────────────────────────────────────────────────
function confirmCrop(x1, y1, x2, y2) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  if (w < 10 || h < 10) return;

  saveUndoState();

  // Create temporary canvases to hold the cropped content
  const tempBase = document.createElement('canvas');
  tempBase.width = w;
  tempBase.height = h;
  tempBase.getContext('2d').drawImage(baseCanvas, x, y, w, h, 0, 0, w, h);

  const tempDraw = document.createElement('canvas');
  tempDraw.width = w;
  tempDraw.height = h;
  tempDraw.getContext('2d').drawImage(drawCanvas, x, y, w, h, 0, 0, w, h);

  // Resize main canvases
  [baseCanvas, drawCanvas, cursorCanvas].forEach(c => {
    c.width = w;
    c.height = h;
  });

  // Restore content
  baseCtx.drawImage(tempBase, 0, 0);
  drawCtx.drawImage(tempDraw, 0, 0);

  // Update dimensions
  document.getElementById('imageDimensions').textContent = `${Math.round(w)} × ${Math.round(h)}`;
  
  // Re-fit if needed
  fitCanvasToWindow(w, h);
}

// ─── Undo / Redo ──────────────────────────────────────────────────────
function saveUndoState() {
  const state = {
    base: baseCanvas.toDataURL(),
    draw: drawCanvas.toDataURL(),
    width: baseCanvas.width,
    height: baseCanvas.height
  };
  undoStack.push(state);
  if (undoStack.length > 30) undoStack.shift();
  redoStack = [];
  updateUndoRedo();
}

function undo() {
  if (undoStack.length === 0) return;
  const currentState = {
    base: baseCanvas.toDataURL(),
    draw: drawCanvas.toDataURL(),
    width: baseCanvas.width,
    height: baseCanvas.height
  };
  redoStack.push(currentState);
  const prev = undoStack.pop();
  restoreFullState(prev);
  updateUndoRedo();
}

function redo() {
  if (redoStack.length === 0) return;
  const currentState = {
    base: baseCanvas.toDataURL(),
    draw: drawCanvas.toDataURL(),
    width: baseCanvas.width,
    height: baseCanvas.height
  };
  undoStack.push(currentState);
  const next = redoStack.pop();
  restoreFullState(next);
  updateUndoRedo();
}

function restoreFullState(state) {
  if (!state) return;
  
  // Restore dimensions
  [baseCanvas, drawCanvas, cursorCanvas].forEach(c => {
    c.width = state.width;
    c.height = state.height;
  });
  document.getElementById('imageDimensions').textContent = `${state.width} × ${state.height}`;

  // Restore images
  const imgBase = new Image();
  imgBase.onload = () => baseCtx.drawImage(imgBase, 0, 0);
  imgBase.src = state.base;

  const imgDraw = new Image();
  imgDraw.onload = () => drawCtx.drawImage(imgDraw, 0, 0);
  imgDraw.src = state.draw;

  fitCanvasToWindow(state.width, state.height);
}

function updateUndoRedo() {
  document.getElementById('btnUndo').disabled = undoStack.length === 0;
}

// ─── Export ───────────────────────────────────────────────────────────
function getMergedCanvas() {
  const merged = document.createElement('canvas');
  merged.width  = baseCanvas.width;
  merged.height = baseCanvas.height;
  const mCtx = merged.getContext('2d');
  mCtx.drawImage(baseCanvas, 0, 0);
  mCtx.drawImage(drawCanvas, 0, 0);
  return merged;
}

async function copyToClipboard() {
  try {
    const merged = getMergedCanvas();
    const blob = await new Promise(r => merged.toBlob(r, 'image/png'));
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    showToast('✓ Copied to clipboard!', true);
  } catch (e) {
    console.error('Copy failed:', e);
    showToast('Copy failed — try downloading instead', false);
  }
}

async function handleShare() {
  if (!supabaseClient) {
    showToast('⚠️ Supabase not connected!', false);
    return;
  }

  const btn = document.getElementById('btnShare');
  const originalContent = btn.innerHTML;
  
  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;margin-right:8px"></span>Uploading…';
    
    const merged = getMergedCanvas();
    const blob = await new Promise(r => merged.toBlob(r, 'image/png'));
    const fileName = `snap-${Date.now()}.png`;

    const { data, error } = await supabaseClient.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, {
        contentType: 'image/png',
        cacheControl: '3600'
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabaseClient.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    await navigator.clipboard.writeText(publicUrl);
    showToast('🚀 Link copied to clipboard!', true);
  } catch (e) {
    console.error('Share failed:', e);
    showToast('Share failed: ' + e.message, false);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalContent;
  }
}

function downloadPNG() {
  const merged = getMergedCanvas();
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  a.download = `snapmark-${ts}.png`;
  a.href = merged.toDataURL('image/png');
  a.click();
  showToast('✓ Downloaded!', true);
}

// ─── History ──────────────────────────────────────────────────────────
async function saveToHistory(dataUrl) {
  try {
    const id = Date.now().toString();
    const histResult = await chrome.storage.local.get('snapmark_history');
    const history = histResult.snapmark_history || [];

    // Create thumbnail (200x120 max)
    const thumb = await createThumbnail(dataUrl, 200, 120);

    // Get source URL from session
    const sessionData = await chrome.storage.session.get('snapmark_source_url');
    let sourceDomain = '';
    try {
      if (sessionData.snapmark_source_url) {
        sourceDomain = new URL(sessionData.snapmark_source_url).hostname;
      }
    } catch (_) {}

    history.unshift({
      id,
      thumbnail: thumb,
      sourceDomain,
      timestamp: Date.now()
    });

    const trimmed = history.slice(0, 10);
    await chrome.storage.local.set({ 'snapmark_history': trimmed });
    await chrome.storage.local.set({ [`snapmark_img_${id}`]: dataUrl });

    // Clean up old images beyond 10
    if (history.length > 10) {
      const toDelete = history.slice(10).map(h => `snapmark_img_${h.id}`);
      await chrome.storage.local.remove(toDelete);
    }
  } catch (e) {
    console.error('SnapMark: failed to save history', e);
  }
}

async function createThumbnail(dataUrl, maxW, maxH) {
  const img = await new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxW / img.width, maxH / img.height);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.7);
}

// ─── Toast ────────────────────────────────────────────────────────────
function showToast(msg, success = true) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `show ${success ? 'success' : ''}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = ''; }, 2500);
}

// ─── Start ────────────────────────────────────────────────────────────
init();

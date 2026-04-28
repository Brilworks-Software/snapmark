// editor/editor.js

// ─── Config ───────────────────────────────────────────────────────────
const TOOLS = [
  { id: 'select',    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3l14 9-7 1-4 7z"/></svg>`, title: 'Select (S)' },
  { id: 'arrow',     icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`, title: 'Arrow (A)' },
  { id: 'rectangle', icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`, title: 'Rectangle (R)' },
  { id: 'circle',    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>`, title: 'Ellipse (E)' },
  { id: 'pen',       icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`, title: 'Pen (P)' },
  { id: 'text',      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`, title: 'Text (T)' },
  { id: 'blur',      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>`, title: 'Blur (B)' },
  { id: 'crop',      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 2 6 17 21 17"/><polyline points="2 6 17 6 17 21"/></svg>`, title: 'Crop (C)' },
];

const COLORS = ['#EF4444', '#F97316', '#FACC15', '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899', '#FFFFFF', '#000000'];
const BUCKET_NAME = 'screenshots';

// ─── State ────────────────────────────────────────────────────────────
let activeTool = 'arrow';
let activeColor = '#EF4444';
let strokeSize = 3;
let isDrawing = false, isMoving = false, isResizing = false;
let startX = 0, startY = 0, lastX = 0, lastY = 0;
let resizeHandle = null;
let shapes = [];
let selectedShapeIndex = -1;
let undoStack = [], redoStack = [];
let baseCanvas, drawCanvas, cursorCanvas;
let baseCtx, drawCtx, cursorCtx;
let supabaseClient = null;

// ─── Init ─────────────────────────────────────────────────────────────
async function init() {
  baseCanvas = document.getElementById('baseCanvas');
  drawCanvas = document.getElementById('drawCanvas');
  cursorCanvas = document.getElementById('cursorCanvas');
  baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
  drawCtx = drawCanvas.getContext('2d');
  cursorCtx = cursorCanvas.getContext('2d');

  if (typeof supabase !== 'undefined' && typeof SUPABASE_CONFIG !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  }

  renderToolbar();
  renderColors();
  bindControls();

  const result = await chrome.storage.session.get('snapmark_pending_image');
  if (result.snapmark_pending_image) {
    await loadImage(result.snapmark_pending_image);
  }
}

async function loadImage(dataUrl) {
  const img = new Image();
  img.onload = () => {
    [baseCanvas, drawCanvas, cursorCanvas].forEach(c => {
      c.width = img.width;
      c.height = img.height;
    });
    baseCtx.drawImage(img, 0, 0);
    document.getElementById('imageDimensions').textContent = `${img.width} × ${img.height}`;
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('canvasWrapper').style.display = 'inline-block';
    fitCanvasToWindow(img.width, img.height);
    render();
  };
  img.src = dataUrl;
}

function fitCanvasToWindow(w, h) {
  const area = document.getElementById('canvasArea');
  const scale = Math.min(1, (area.clientWidth - 40) / w, (area.clientHeight - 40) / h);
  const wrapper = document.getElementById('canvasWrapper');
  wrapper.style.transform = scale < 1 ? `scale(${scale})` : 'none';
  wrapper.style.transformOrigin = 'top left';
}

// ─── Interaction ──────────────────────────────────────────────────────
function getCanvasPos(e) {
  const rect = drawCanvas.getBoundingClientRect();
  const scaleX = drawCanvas.width / rect.width;
  const scaleY = drawCanvas.height / rect.height;
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

function onMouseDown(e) {
  const pos = getCanvasPos(e);
  startX = lastX = pos.x;
  startY = lastY = pos.y;

  if (activeTool === 'text') { showTextInput(e); return; }

  if (activeTool === 'select') {
    if (selectedShapeIndex !== -1) {
      const handle = getHandleAt(pos.x, pos.y, shapes[selectedShapeIndex]);
      if (handle) { isResizing = true; resizeHandle = handle; return; }
    }
    const idx = getShapeAt(pos.x, pos.y);
    selectedShapeIndex = idx;
    if (idx !== -1) isMoving = true;
    render();
    return;
  }

  if (['arrow', 'rectangle', 'circle', 'pen'].includes(activeTool)) {
    isDrawing = true;
    saveUndoState();
    const shape = { type: activeTool, color: activeColor, size: strokeSize };
    if (activeTool === 'pen') shape.path = [{ x: pos.x, y: pos.y }];
    else { shape.x = pos.x; shape.y = pos.y; shape.w = 0; shape.h = 0; }
    shapes.push(shape);
    selectedShapeIndex = shapes.length - 1;
  } else if (activeTool === 'blur' || activeTool === 'crop') {
    isDrawing = true;
  }
}

function onMouseMove(e) {
  const pos = getCanvasPos(e);
  cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);

  if (isResizing && selectedShapeIndex !== -1) {
    resizeShape(shapes[selectedShapeIndex], pos.x, pos.y);
    render();
  } else if (isMoving && selectedShapeIndex !== -1) {
    moveShape(shapes[selectedShapeIndex], pos.x - lastX, pos.y - lastY);
    lastX = pos.x; lastY = pos.y;
    render();
  } else if (isDrawing) {
    if (['blur', 'crop'].includes(activeTool)) {
      drawSelectionBox(startX, startY, pos.x, pos.y, cursorCtx);
    } else {
      const shape = shapes[shapes.length - 1];
      if (shape.type === 'pen') shape.path.push({ x: pos.x, y: pos.y });
      else { shape.w = pos.x - startX; shape.h = pos.y - startY; }
      render();
    }
  } else if (activeTool === 'select') {
    const idx = getShapeAt(pos.x, pos.y);
    drawCanvas.style.cursor = idx !== -1 ? 'move' : 'default';
  }
}

function onMouseUp(e) {
  const pos = getCanvasPos(e);
  if (isDrawing && ['blur', 'crop'].includes(activeTool)) {
    saveUndoState();
    if (activeTool === 'blur') applyBlur(startX, startY, pos.x - startX, pos.y - startY);
    else confirmCrop(startX, startY, pos.x, pos.y);
  }
  isDrawing = isMoving = isResizing = false;
  resizeHandle = null;
  cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
  render();
  updateUndoRedo();
}

// ─── Rendering ────────────────────────────────────────────────────────
function render() {
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  shapes.forEach((s, i) => {
    drawShape(s, drawCtx);
    if (i === selectedShapeIndex) drawBoundingBox(s, drawCtx);
  });
}

function drawShape(s, ctx) {
  ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = s.size;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (s.type === 'pen') {
    ctx.moveTo(s.path[0].x, s.path[0].y);
    s.path.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();
  } else if (s.type === 'rectangle') {
    ctx.roundRect(Math.min(s.x, s.x+s.w), Math.min(s.y, s.y+s.h), Math.abs(s.w), Math.abs(s.h), s.size); ctx.stroke();
  } else if (s.type === 'circle') {
    ctx.ellipse(s.x + s.w/2, s.y + s.h/2, Math.abs(s.w/2), Math.abs(s.h/2), 0, 0, Math.PI*2); ctx.stroke();
  } else if (s.type === 'arrow') {
    drawArrowHead(s.x, s.y, s.x+s.w, s.y+s.h, ctx, s.color, s.size);
  } else if (s.type === 'text') {
    drawTextOnCanvas(s, ctx);
  }
}

function drawArrowHead(x1, y1, x2, y2, ctx, color, size) {
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.max(12, size * 4);
  ctx.beginPath(); ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - len * Math.cos(angle - Math.PI/7), y2 - len * Math.sin(angle - Math.PI/7));
  ctx.lineTo(x2 - len * Math.cos(angle + Math.PI/7), y2 - len * Math.sin(angle + Math.PI/7));
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

function drawTextOnCanvas(s, ctx) {
  ctx.font = `bold ${s.size}px sans-serif`; ctx.textBaseline = 'top';
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 4;
  s.text.split('\n').forEach((line, i) => {
    const y = s.y + i * s.size * 1.2;
    ctx.strokeText(line, s.x, y); ctx.fillText(line, s.x, y);
  });
}

function drawBoundingBox(s, ctx) {
  if (s.type === 'pen') return;
  const x = Math.min(s.x, s.x+s.w), y = Math.min(s.y, s.y+s.h), w = Math.abs(s.w), h = Math.abs(s.h);
  ctx.save(); ctx.strokeStyle = '#3B82F6'; ctx.setLineDash([4, 4]);
  ctx.strokeRect(x-4, y-4, w+8, h+8);
  ctx.setLineDash([]); ctx.fillStyle = '#fff';
  [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].forEach(([px,py]) => {
    ctx.fillRect(px-4, py-4, 8, 8); ctx.strokeRect(px-4, py-4, 8, 8);
  });
  ctx.restore();
}

function drawSelectionBox(x1, y1, x2, y2, ctx) {
  const x = Math.min(x1, x2), y = Math.min(y1, y2), w = Math.abs(x2-x1), h = Math.abs(y2-y1);
  ctx.save(); ctx.strokeStyle = activeTool === 'crop' ? '#3B82F6' : '#fff';
  ctx.setLineDash([5, 5]); ctx.strokeRect(x, y, w, h);
  if (activeTool === 'crop') { ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'; ctx.fillRect(x,y,w,h); }
  ctx.restore();
}

// ─── Logic ────────────────────────────────────────────────────────────
function moveShape(s, dx, dy) {
  if (s.type === 'pen') s.path.forEach(p => { p.x += dx; p.y += dy; });
  else { s.x += dx; s.y += dy; }
}

function resizeShape(s, cx, cy) {
  if (s.type === 'pen') return;
  if (resizeHandle === 'se') { s.w = cx - s.x; s.h = cy - s.y; }
  else if (resizeHandle === 'nw') { s.w += s.x - cx; s.h += s.y - cy; s.x = cx; s.y = cy; }
  else if (resizeHandle === 'ne') { s.w = cx - s.x; s.h += s.y - cy; s.y = cy; }
  else if (resizeHandle === 'sw') { s.w += s.x - cx; s.x = cx; s.h = cy - s.y; }
}

function getShapeAt(x, y) {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    const buffer = 10;
    const rx = Math.min(s.x, s.x+s.w), ry = Math.min(s.y, s.y+s.h), rw = Math.abs(s.w), rh = Math.abs(s.h);
    if (x >= rx-buffer && x <= rx+rw+buffer && y >= ry-buffer && y <= ry+rh+buffer) return i;
  }
  return -1;
}

function getHandleAt(x, y, s) {
  if (s.type === 'pen') return null;
  const rx = Math.min(s.x, s.x+s.w), ry = Math.min(s.y, s.y+s.h), rw = Math.abs(s.w), rh = Math.abs(s.h);
  if (Math.abs(x-rx) < 10 && Math.abs(y-ry) < 10) return 'nw';
  if (Math.abs(x-(rx+rw)) < 10 && Math.abs(y-ry) < 10) return 'ne';
  if (Math.abs(x-rx) < 10 && Math.abs(y-(ry+rh)) < 10) return 'sw';
  if (Math.abs(x-(rx+rw)) < 10 && Math.abs(y-(ry+rh)) < 10) return 'se';
  return null;
}

function applyBlur(x, y, w, h) {
  const bx = Math.min(x, x+w), by = Math.min(y, y+h), bw = Math.abs(w), bh = Math.abs(h);
  if (bw < 5 || bh < 5) return;
  const temp = document.createElement('canvas'); temp.width = bw; temp.height = bh;
  const tCtx = temp.getContext('2d'); tCtx.drawImage(baseCanvas, bx, by, bw, bh, 0, 0, bw, bh);
  const PIX = Math.max(8, Math.round(Math.min(bw, bh)/10));
  const sw = Math.max(1, bw/PIX), sh = Math.max(1, bh/PIX);
  const off = document.createElement('canvas'); off.width = sw; off.height = sh;
  off.getContext('2d').drawImage(temp, 0, 0, bw, bh, 0, 0, sw, sh);
  baseCtx.imageSmoothingEnabled = false;
  baseCtx.drawImage(off, 0, 0, sw, sh, bx, by, bw, bh);
  baseCtx.imageSmoothingEnabled = true;
}

function confirmCrop(x1, y1, x2, y2) {
  const x = Math.min(x1, x2), y = Math.min(y1, y2), w = Math.abs(x2-x1), h = Math.abs(y2-y1);
  if (w < 10 || h < 10) return;
  const tb = document.createElement('canvas'); tb.width = w; tb.height = h;
  tb.getContext('2d').drawImage(baseCanvas, x, y, w, h, 0, 0, w, h);
  [baseCanvas, drawCanvas, cursorCanvas].forEach(c => { c.width = w; c.height = h; });
  baseCtx.drawImage(tb, 0, 0);
  shapes.forEach(s => { if (s.type !== 'pen') { s.x -= x; s.y -= y; } else s.path.forEach(p => { p.x -= x; p.y -= y; }); });
  document.getElementById('imageDimensions').textContent = `${Math.round(w)} × ${Math.round(h)}`;
  fitCanvasToWindow(w, h);
}

// ─── Text ─────────────────────────────────────────────────────────────
let textPlacedX = 0, textPlacedY = 0;
function showTextInput(e) {
  const pos = getCanvasPos(e); const rect = drawCanvas.getBoundingClientRect();
  const scX = rect.width/drawCanvas.width, scY = rect.height/drawCanvas.height;
  const ti = document.getElementById('textInput'), ta = document.getElementById('textInputArea');
  ti.style.display = 'block';
  ti.style.left = `${rect.left + pos.x*scX + window.scrollX}px`;
  ti.style.top = `${rect.top + pos.y*scY + window.scrollY}px`;
  textPlacedX = pos.x; textPlacedY = pos.y;
  ta.style.fontSize = `${Math.max(16, strokeSize*5)}px`; ta.style.color = activeColor; ta.value = '';
  setTimeout(() => ta.focus(), 10);
  ta.onkeydown = (ev) => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); commitText(ta.value); } if (ev.key === 'Escape') cancelTextInput(); };
}

function commitText(txt) {
  if (!txt.trim()) { cancelTextInput(); return; }
  const ta = document.getElementById('textInputArea');
  shapes.push({ type: 'text', text: txt, x: textPlacedX, y: textPlacedY, w: ta.clientWidth, h: ta.clientHeight, color: activeColor, size: parseInt(ta.style.fontSize) });
  saveUndoState(); cancelTextInput(); render();
}

function cancelTextInput() { document.getElementById('textInput').style.display = 'none'; }

// ─── System ───────────────────────────────────────────────────────────
function saveUndoState() {
  undoStack.push({ shapes: JSON.parse(JSON.stringify(shapes)), base: baseCanvas.toDataURL(), w: baseCanvas.width, h: baseCanvas.height });
  redoStack = []; updateUndoRedo();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push({ shapes: JSON.parse(JSON.stringify(shapes)), base: baseCanvas.toDataURL(), w: baseCanvas.width, h: baseCanvas.height });
  const s = undoStack.pop(); applyState(s);
}

function applyState(s) {
  shapes = s.shapes; [baseCanvas, drawCanvas, cursorCanvas].forEach(c => { c.width = s.w; c.height = s.h; });
  const img = new Image(); img.onload = () => { baseCtx.drawImage(img, 0, 0); render(); }; img.src = s.base;
  updateUndoRedo();
}

function updateUndoRedo() { document.getElementById('btnUndo').disabled = undoStack.length === 0; }

function getMergedCanvas() {
  const c = document.createElement('canvas'); c.width = baseCanvas.width; c.height = baseCanvas.height;
  const ctx = c.getContext('2d'); ctx.drawImage(baseCanvas, 0, 0); ctx.drawImage(drawCanvas, 0, 0); return c;
}

async function copyToClipboard() {
  const blob = await new Promise(r => getMergedCanvas().toBlob(r, 'image/png'));
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  showToast('✓ Copied!', true);
}

function downloadPNG() {
  const a = document.createElement('a'); a.download = `snap-${Date.now()}.png`;
  a.href = getMergedCanvas().toDataURL('image/png'); a.click();
}

async function handleShare() {
  if (!supabaseClient) return;
  const btn = document.getElementById('btnShare'); btn.disabled = true;
  const blob = await new Promise(r => getMergedCanvas().toBlob(r, 'image/png'));
  const name = `snap-${Date.now()}.png`;
  await supabaseClient.storage.from(BUCKET_NAME).upload(name, blob);
  const { data: { publicUrl } } = supabaseClient.storage.from(BUCKET_NAME).getPublicUrl(name);
  await navigator.clipboard.writeText(publicUrl);
  showToast('🚀 Link copied!', true); btn.disabled = false;
}

function showToast(m, s) {
  const t = document.getElementById('toast'); t.textContent = m; t.className = `show ${s?'success':''}`;
  setTimeout(() => t.className = '', 2000);
}

function renderToolbar() {
  const bar = document.getElementById('toolBar'); bar.innerHTML = '';
  TOOLS.forEach(t => {
    const b = document.createElement('button'); b.className = `tool-btn ${t.id===activeTool?'active':''}`;
    b.id = `tool_${t.id}`; b.innerHTML = t.icon; b.title = t.title;
    b.onclick = () => { activeTool = t.id; document.querySelectorAll('.tool-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); };
    bar.appendChild(b);
  });
}

function renderColors() {
  const row = document.getElementById('colorRow'); row.innerHTML = '';
  COLORS.forEach(c => {
    const s = document.createElement('div'); s.className = `color-swatch ${c===activeColor?'active':''}`;
    s.style.background = c; s.onclick = () => { activeColor = c; document.querySelectorAll('.color-swatch').forEach(x=>x.classList.remove('active')); s.classList.add('active'); };
    row.appendChild(s);
  });
}

function bindControls() {
  document.getElementById('strokeSize').oninput = (e) => strokeSize = parseInt(e.target.value);
  document.getElementById('btnUndo').onclick = undo;
  document.getElementById('btnShare').onclick = handleShare;
  document.getElementById('btnCopy').onclick = copyToClipboard;
  document.getElementById('btnDownload').onclick = downloadPNG;
  drawCanvas.onmousedown = onMouseDown; drawCanvas.onmousemove = onMouseMove; drawCanvas.onmouseup = onMouseUp;
}

init();

let N = 6, mode = 'snake', connectors = [], history = [];
let isDragging = false, dragStartSq = null, dragStartPos = null, dragCurrentPos = null;
let simRunning = false, simCancel = false, tokenEl = null, barHeights = [];
let currentTokenColour = 0, hittingTimes = null, heatmapOn = false;
let dragPaletteIdx = 0, dragAmpOffsets = [];

const TOKEN_COLOURS = [
  {body:'#2980D9', top:'#5DADE2', base:'#1a6bb5'},
  {body:'#C0392B', top:'#E74C3C', base:'#922B21'},
  {body:'#27AE60', top:'#2ECC71', base:'#1E8449'},
  {body:'#D35400', top:'#E67E22', base:'#A04000'},
  {body:'#8E44AD', top:'#9B59B6', base:'#6C3483'},
  {body:'#17202A', top:'#2C3E50', base:'#0d1117'},
];

const SNAKE_PALETTES = [
  {dark:'#8B2A2A', mid:'#C0392B', light:'#F0705A'},
  {dark:'#1A5C2A', mid:'#27AE60', light:'#6DE89A'},
  {dark:'#1A3A5C', mid:'#2471A3', light:'#5DADE2'},
  {dark:'#4A235A', mid:'#7D3C98', light:'#C39BD3'},
  {dark:'#7D6608', mid:'#D4AC0D', light:'#F9E27A'},
  {dark:'#1B4F72', mid:'#117A65', light:'#48C9B0'},
  {dark:'#641E16', mid:'#A93226', light:'#F1948A'},
  {dark:'#0B3D0B', mid:'#1E8449', light:'#58D68D'},
];

const dieMap = {
  coin: [1,2],
  d4:   [1,2,3,4],
  d6:   [1,2,3,4,5,6],
  d8:   [1,2,3,4,5,6,7,8]
};

let dieFaces = [1,2];

// ---- snake appearance helpers ----

function randomPaletteIdx() {
  return Math.floor(Math.random() * SNAKE_PALETTES.length);
}

function randomAmpOffsets(segs) {
  const offsets = [];
  for (let i = 0; i < segs; i++) offsets.push(0.7 + Math.random() * 0.6);
  return offsets;
}

// ---- board generation ----

function randomBoard() {
  const sizes = [6,7,8,9,10];
  const n = sizes[Math.floor(Math.random() * sizes.length)];
  const total = n * n, nc = [], usedFrom = new Set(), usedTo = new Set();
  const ns = Math.floor(n * 0.6 + Math.random() * n * 0.4);
  const nl = Math.floor(n * 0.5 + Math.random() * n * 0.4);
  let att = 0;
  while (nc.filter(c => c.type === 'snake').length < ns && att < 500) {
    att++;
    const from = Math.floor(Math.random() * (total - 2)) + 2;
    const minDrop = Math.ceil((from - 1) * 0.2);
    const maxTo = from - 1 - minDrop;
    if (maxTo < 1) continue;
    const to = Math.floor(Math.random() * maxTo) + 1;
    if (usedFrom.has(from) || usedTo.has(to) || from === to || from === total) continue;
    usedFrom.add(from); usedTo.add(to);
    nc.push({from, to, type:'snake', paletteIdx: randomPaletteIdx(), ampOffsets: randomAmpOffsets(4)});
  }
  att = 0;
  while (nc.filter(c => c.type === 'ladder').length < nl && att < 500) {
    att++;
    const from = Math.floor(Math.random() * (total - 2)) + 1;
    const minClimb = Math.ceil((total - from) * 0.2);
    const maxTo = total - from - minClimb;
    if (maxTo < 1) continue;
    const to = from + minClimb + Math.floor(Math.random() * maxTo);
    if (to >= total) continue;
    if (usedFrom.has(from) || usedTo.has(to) || from === to) continue;
    usedFrom.add(from); usedTo.add(to);
    nc.push({from, to, type:'ladder'});
  }
  return {n, connectors: nc};
}

// ---- coordinate helpers ----

function cellToSquare(row, col) {
  const r = N - 1 - row;
  return r % 2 === 0 ? r * N + col + 1 : r * N + (N - col);
}

function squareToCell(sq) {
  const r = Math.floor((sq - 1) / N);
  const pos = (sq - 1) % N;
  const row = N - 1 - r;
  const col = r % 2 === 0 ? pos : N - 1 - pos;
  return {row, col};
}

function getSquareFromPoint(x, y) {
  const grid = document.getElementById('grid');
  const rect = grid.getBoundingClientRect();
  const col = Math.floor((x - rect.left) / (rect.width / N));
  const row = Math.floor((y - rect.top) / (rect.height / N));
  if (col < 0 || col >= N || row < 0 || row >= N) return null;
  return cellToSquare(row, col);
}

function getCellCenter(sq) {
  const {row, col} = squareToCell(sq);
  const grid = document.getElementById('grid');
  const rect = grid.getBoundingClientRect();
  const cellW = rect.width / N, cellH = rect.height / N;
  return {x: col * cellW + cellW / 2, y: row * cellH + cellH / 2, w: cellW};
}

function getCellRect(sq) {
  const {row, col} = squareToCell(sq);
  const grid = document.getElementById('grid');
  const gr = grid.getBoundingClientRect();
  const wr = document.getElementById('board-inner').getBoundingClientRect();
  const cellW = gr.width / N, cellH = gr.height / N;
  return {
    x: (gr.left - wr.left) + col * cellW,
    y: (gr.top - wr.top) + row * cellH,
    w: cellW,
    h: cellH
  };
}

// ---- grid ----

function buildGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${N}, 1fr)`;
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      const sq = cellToSquare(row, col);
      const div = document.createElement('div');
      div.className = 'sq' + ((row + col) % 2 === 0 ? ' light' : '');
      if (sq === N * N) div.classList.add('finish');
      if (sq === 1) div.classList.add('start-sq');
      div.dataset.sq = sq;
      const num = document.createElement('span');
      num.textContent = sq;
      div.appendChild(num);
      grid.appendChild(div);
    }
  }
  if (tokenEl) { tokenEl.remove(); tokenEl = null; }
  if (heatmapOn && hittingTimes) applyHeatmap();
  redrawOverlay();
}

// ---- heatmap ----

function applyHeatmap() {
  const total = N * N;
  const vals = hittingTimes ? Object.values(hittingTimes).filter(v => isFinite(v) && v > 0) : [];
  const minV = vals.length ? Math.min(...vals) : 0;
  const maxV = vals.length ? Math.max(...vals) : 1;
  const range = maxV - minV || 1;
  document.querySelectorAll('.sq').forEach(el => {
    const sq = parseInt(el.dataset.sq);
    if (!heatmapOn || !hittingTimes) { el.style.background = ''; return; }
    if (sq === total) { el.style.background = ''; return; }
    const v = hittingTimes[sq];
    if (v === undefined || !isFinite(v)) { el.style.background = ''; return; }
    const t = (v - minV) / range;
    el.style.background = `rgb(${Math.round(100 + t * 130)},${Math.round(140 - t * 40)},${Math.round(200 - t * 110)})`;
  });
}

// ---- drawing ----

function drawSnake(svg, x1, y1, x2, y2, cellW, opacity, paletteIdx, ampOffsets) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx*dx + dy*dy);
  if (len < 2) return;
  const ux = dx/len, uy = dy/len, nx = -uy, ny = ux;
  const pal = SNAKE_PALETTES[paletteIdx];

  const SEGS = 4;
  const pts = [];
  for (let i = 0; i <= SEGS; i++) pts.push({x: x1 + dx*i/SEGS, y: y1 + dy*i/SEGS});

  const baseAmp = Math.min(len * 0.18, cellW * 0.38);

  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < SEGS; i++) {
    const sign = i % 2 === 0 ? 1 : -1;
    const randAmp = baseAmp * ampOffsets[i];
    const mx = (pts[i].x + pts[i+1].x) / 2 + nx * randAmp * sign;
    const my = (pts[i].y + pts[i+1].y) / 2 + ny * randAmp * sign;
    d += ` Q${mx},${my} ${pts[i+1].x},${pts[i+1].y}`;
  }

  const mkP = (sw, sc) => {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d); p.setAttribute('stroke', sc); p.setAttribute('stroke-width', sw);
    p.setAttribute('stroke-linecap', 'round'); p.setAttribute('fill', 'none'); p.setAttribute('opacity', opacity);
    svg.appendChild(p);
  };
  mkP(cellW*0.22, pal.dark); mkP(cellW*0.14, pal.mid); mkP(cellW*0.05, pal.light);

  const headR = cellW * 0.13, headAngle = Math.atan2(-uy, -ux) * 180 / Math.PI;
  const mkE = (cx, cy, rx, ry, fill, tr='') => {
    const e = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    e.setAttribute('cx', cx); e.setAttribute('cy', cy); e.setAttribute('rx', rx); e.setAttribute('ry', ry);
    e.setAttribute('fill', fill); e.setAttribute('opacity', opacity);
    if (tr) e.setAttribute('transform', tr);
    svg.appendChild(e);
  };
  mkE(x1, y1, headR*1.6, headR*1.1, pal.dark, `rotate(${headAngle} ${x1} ${y1})`);
  mkE(x1, y1, headR*1.35, headR, pal.mid, `rotate(${headAngle} ${x1} ${y1})`);
  mkE(x1-ux*headR*0.3+nx*headR*0.2, y1-uy*headR*0.3+ny*headR*0.2, headR*0.55, headR*0.3, 'rgba(255,255,255,0.22)');
  const eye = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  eye.setAttribute('cx', x1+nx*headR*0.55-ux*headR*0.3);
  eye.setAttribute('cy', y1+ny*headR*0.55-uy*headR*0.3);
  eye.setAttribute('r', headR*0.3); eye.setAttribute('fill', '#1a0505'); eye.setAttribute('opacity', opacity);
  svg.appendChild(eye);
  const eyeS = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  eyeS.setAttribute('cx', x1+nx*headR*0.55-ux*headR*0.3+headR*0.1);
  eyeS.setAttribute('cy', y1+ny*headR*0.55-uy*headR*0.3-headR*0.1);
  eyeS.setAttribute('r', headR*0.1); eyeS.setAttribute('fill', 'rgba(255,255,255,0.6)'); eyeS.setAttribute('opacity', opacity);
  svg.appendChild(eyeS);
  const snoutX = x1 - ux*headR*1.4, snoutY = y1 - uy*headR*1.4;
  [[1],[-1]].forEach(([s]) => {
    const tl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tl.setAttribute('x1', snoutX); tl.setAttribute('y1', snoutY);
    tl.setAttribute('x2', snoutX-ux*headR*1.1+nx*s*headR*0.55);
    tl.setAttribute('y2', snoutY-uy*headR*1.1+ny*s*headR*0.55);
    tl.setAttribute('stroke', pal.light); tl.setAttribute('stroke-width', headR*0.3);
    tl.setAttribute('stroke-linecap', 'round'); tl.setAttribute('opacity', opacity);
    svg.appendChild(tl);
  });
}

function drawLadder(svg, x1, y1, x2, y2, cellW, opacity) {
  const dx = x2-x1, dy = y2-y1, len = Math.sqrt(dx*dx+dy*dy);
  if (len < 2) return;
  const nx = -dy/len, ny = dx/len, off = cellW * 0.08;
  [-1,1].forEach(s => {
    const mkL = (sw, sc, m=1) => {
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', x1+nx*off*s*m); l.setAttribute('y1', y1+ny*off*s*m);
      l.setAttribute('x2', x2+nx*off*s*m); l.setAttribute('y2', y2+ny*off*s*m);
      l.setAttribute('stroke', sc); l.setAttribute('stroke-width', sw);
      l.setAttribute('stroke-linecap', 'round'); l.setAttribute('opacity', opacity);
      svg.appendChild(l);
    };
    mkL(cellW*0.072, '#4A3510', 1.15); mkL(cellW*0.052, '#8B6320', 1); mkL(cellW*0.016, '#C8973A', 0.7);
  });
  const numRungs = Math.max(3, Math.floor(len / (cellW * 0.5)));
  for (let i = 1; i < numRungs; i++) {
    const t = i / numRungs;
    const mkR = (sw, sc, m=1) => {
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      r.setAttribute('x1', x1+dx*t+nx*off*m); r.setAttribute('y1', y1+dy*t+ny*off*m);
      r.setAttribute('x2', x1+dx*t-nx*off*m); r.setAttribute('y2', y1+dy*t-ny*off*m);
      r.setAttribute('stroke', sc); r.setAttribute('stroke-width', sw);
      r.setAttribute('stroke-linecap', 'round'); r.setAttribute('opacity', opacity);
      svg.appendChild(r);
    };
    mkR(cellW*0.058, '#4A3510', 1.15); mkR(cellW*0.040, '#8B6320', 1); mkR(cellW*0.013, '#C8973A', 0.7);
  }
}

function redrawOverlay() {
  const svg = document.getElementById('overlay');
  svg.innerHTML = '';
  const grid = document.getElementById('grid');
  svg.setAttribute('viewBox', `0 0 ${grid.offsetWidth} ${grid.offsetHeight}`);
  connectors.forEach(c => {
    const f = getCellCenter(c.from), t = getCellCenter(c.to);
    if (c.type === 'snake') drawSnake(svg, f.x, f.y, t.x, t.y, f.w, 1, c.paletteIdx, c.ampOffsets);
    else drawLadder(svg, f.x, f.y, t.x, t.y, f.w, 1);
  });
}

function drawPreview() {
  const svg = document.getElementById('preview');
  svg.innerHTML = '';
  const grid = document.getElementById('grid');
  svg.setAttribute('viewBox', `0 0 ${grid.offsetWidth} ${grid.offsetHeight}`);
  if (!dragStartPos || !dragCurrentPos) return;
  const cellW = grid.offsetWidth / N;
  if (mode === 'snake') drawSnake(svg, dragStartPos.x, dragStartPos.y, dragCurrentPos.x, dragCurrentPos.y, cellW, 0.45, dragPaletteIdx, dragAmpOffsets);
  else drawLadder(svg, dragStartPos.x, dragStartPos.y, dragCurrentPos.x, dragCurrentPos.y, cellW, 0.45);
}

function clearPreview() { document.getElementById('preview').innerHTML = ''; }

// ---- token ----

function makeToken(cellW, colour) {
  const s = Math.max(12, cellW * 0.46);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', s); svg.setAttribute('height', s * 0.7); svg.setAttribute('viewBox', '0 0 40 28');
  const mk = (tag, attrs) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v));
    svg.appendChild(el); return el;
  };
  mk('ellipse', {cx:20, cy:26, rx:12, ry:2, fill:'rgba(0,0,0,0.14)'});
  mk('ellipse', {cx:20, cy:18, rx:16, ry:7, fill:colour.base});
  mk('ellipse', {cx:20, cy:16, rx:16, ry:7, fill:colour.body});
  mk('ellipse', {cx:20, cy:16, rx:11, ry:4.8, fill:colour.top});
  mk('ellipse', {cx:20, cy:16, rx:6,  ry:2.5, fill:colour.body});
  mk('ellipse', {cx:14, cy:12, rx:7,  ry:3,   fill:'rgba(255,255,255,0.26)'});
  return {svg, s};
}

function placeToken(sq) {
  const wrap = document.getElementById('board-inner');
  if (tokenEl) { tokenEl.remove(); tokenEl = null; }
  if (sq === null) return;
  const cell = getCellRect(sq);
  const {svg, s} = makeToken(cell.w, TOKEN_COLOURS[currentTokenColour]);
  svg.style.cssText = `position:absolute;left:${cell.x+cell.w/2-s/2}px;top:${cell.y+cell.h/2-s*0.35}px;pointer-events:none;z-index:10;`;
  wrap.appendChild(svg); tokenEl = svg;
}

// ---- ui helpers ----

function setHint(msg) { document.getElementById('hint-text').textContent = msg; }

function clearResults() {
  document.getElementById('res-mean').textContent = '--';
  document.getElementById('res-std').textContent = '--';
  document.getElementById('sim-block').style.display = 'none';
  document.getElementById('heatmap-toggle').style.display = 'none';
  document.getElementById('mc-section').style.display = 'none';
  clearHist();
}

function clearHist() {
  const canvas = document.getElementById('hist');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ['hist-min','hist-mid','hist-max'].forEach(id => document.getElementById(id).textContent = '');
  barHeights = [];
}

function highlightSquare(sq, on) {
  document.querySelectorAll('.sq').forEach(el => {
    if (parseInt(el.dataset.sq) === sq) on ? el.classList.add('highlight') : el.classList.remove('highlight');
  });
}

function buildMoveFunction() {
  const snakes = {}, ladders = {};
  connectors.forEach(c => { if (c.type === 'snake') snakes[c.from] = c.to; else ladders[c.from] = c.to; });
  return sq => sq in snakes ? snakes[sq] : sq in ladders ? ladders[sq] : sq;
}

function cancelSim() {
  simCancel = true; simRunning = false; placeToken(null);
  document.getElementById('sim-btn').textContent = 'simulate run';
  document.getElementById('sim-btn').disabled = false;
}

// ---- markov ----

function gaussianElimination(A, b) {
  const n = b.length, aug = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    const piv = aug[col][col];
    if (Math.abs(piv) < 1e-12) continue;
    for (let j = col; j <= n; j++) aug[col][j] /= piv;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = aug[row][col];
      for (let j = col; j <= n; j++) aug[row][j] -= f * aug[col][j];
    }
  }
  return aug.map(row => row[n]);
}

function runMarkov() {
  const total = N * N, move = buildMoveFunction(), p = 1 / dieFaces.length;
  const states = Array.from({length: total - 1}, (_, i) => i + 1);
  const index = {}; states.forEach((s, i) => index[s] = i);
  const n = states.length;
  const P = Array.from({length: n}, () => new Array(n).fill(0));
  for (const sq of states) {
    for (const roll of dieFaces) {
      const dest = sq + roll > total ? sq : move(sq + roll);
      if (dest < total) P[index[sq]][index[dest]] += p;
    }
  }
  const IminusP = P.map((row, i) => row.map((v, j) => (i === j ? 1 : 0) - v));
  const k = gaussianElimination(IminusP.map(r => [...r]), Array(n).fill(1));
  const Pk = P.map(row => row.reduce((s, v, j) => s + v * k[j], 0));
  const m = gaussianElimination(IminusP.map(r => [...r]), k.map((ki, i) => 1 + 2 * Pk[i]));
  const variance = Math.max(0, m[index[1]] - k[index[1]] ** 2);
  const ht = {}; states.forEach((s, i) => { ht[s] = k[i]; }); ht[total] = 0;
  return {mean: k[index[1]], std: Math.sqrt(variance), hittingTimes: ht};
}

// ---- drag ----

const boardInner = document.getElementById('board-inner');

boardInner.addEventListener('mousedown', e => {
  if (simRunning) return;
  const sq = getSquareFromPoint(e.clientX, e.clientY);
  if (!sq) return;
  isDragging = true; dragStartSq = sq;
  dragPaletteIdx = randomPaletteIdx();
  dragAmpOffsets = randomAmpOffsets(4);
  const grid = document.getElementById('grid');
  const rect = grid.getBoundingClientRect();
  dragStartPos = {x: e.clientX - rect.left, y: e.clientY - rect.top};
  dragCurrentPos = {...dragStartPos};
  highlightSquare(sq, true);
  e.preventDefault();
});

window.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const grid = document.getElementById('grid');
  const rect = grid.getBoundingClientRect();
  dragCurrentPos = {x: e.clientX - rect.left, y: e.clientY - rect.top};
  drawPreview();
});

window.addEventListener('mouseup', e => {
  if (!isDragging) return;
  isDragging = false;
  highlightSquare(dragStartSq, false);
  clearPreview();
  const endSq = getSquareFromPoint(e.clientX, e.clientY);
  if (!endSq || endSq === dragStartSq) { dragStartSq = null; return; }
  if (mode === 'snake' && endSq >= dragStartSq) { setHint('snakes must go downward, try again'); dragStartSq = null; return; }
  if (mode === 'ladder' && endSq <= dragStartSq) { setHint('ladders must go upward, try again'); dragStartSq = null; return; }
  if (connectors.find(c => c.from === dragStartSq || c.from === endSq)) { setHint('that square already has a connector head, try again'); dragStartSq = null; return; }
  history.push([...connectors]);
  connectors.push({
    from: dragStartSq,
    to: endSq,
    type: mode,
    paletteIdx: mode === 'snake' ? dragPaletteIdx : null,
    ampOffsets: mode === 'snake' ? dragAmpOffsets : null
  });
  setHint(mode === 'snake' ? 'drag from one square to another to place a snake' : 'drag from one square to another to place a ladder');
  dragStartSq = null;
  redrawOverlay();
});

// ---- button listeners ----

document.querySelectorAll('.die-card').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.die-card').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    dieFaces = dieMap[btn.dataset.die];
  });
});

document.getElementById('btn-snake').addEventListener('click', () => {
  mode = 'snake';
  document.getElementById('btn-snake').classList.add('active-mode');
  document.getElementById('btn-ladder').classList.remove('active-mode');
  setHint('drag from one square to another to place a snake');
});

document.getElementById('btn-ladder').addEventListener('click', () => {
  mode = 'ladder';
  document.getElementById('btn-ladder').classList.add('active-mode');
  document.getElementById('btn-snake').classList.remove('active-mode');
  setHint('drag from one square to another to place a ladder');
});

document.getElementById('size-slider').addEventListener('input', e => {
  N = parseInt(e.target.value);
  document.getElementById('size-out').textContent = `${N} x ${N}`;
  connectors = []; history = []; hittingTimes = null; heatmapOn = false;
  cancelSim(); buildGrid();
});

document.getElementById('clear-btn').addEventListener('click', () => {
  history.push([...connectors]); connectors = [];
  hittingTimes = null; heatmapOn = false;
  cancelSim(); clearResults(); buildGrid();
});

document.getElementById('undo-btn').addEventListener('click', () => {
  if (!history.length) return;
  connectors = history.pop(); buildGrid(); redrawOverlay();
});

document.getElementById('random-btn').addEventListener('click', () => {
  history.push([...connectors]);
  const board = randomBoard();
  N = board.n; connectors = board.connectors;
  document.getElementById('size-slider').value = N;
  document.getElementById('size-out').textContent = `${N} x ${N}`;
  hittingTimes = null; heatmapOn = false;
  clearResults(); buildGrid(); redrawOverlay();
});

document.getElementById('heatmap-toggle').addEventListener('click', () => {
  if (!hittingTimes) return;
  heatmapOn = !heatmapOn;
  const tog = document.getElementById('heatmap-toggle');
  heatmapOn ? tog.classList.add('on') : tog.classList.remove('on');
  applyHeatmap();
});

document.getElementById('calc-btn').addEventListener('click', () => {
  const result = runMarkov();
  document.getElementById('res-mean').textContent = result.mean.toFixed(1);
  document.getElementById('res-std').textContent = result.std.toFixed(1);
  hittingTimes = result.hittingTimes;
  document.getElementById('heatmap-toggle').style.display = 'flex';
  if (heatmapOn) applyHeatmap();
});

document.getElementById('monte-btn').addEventListener('click', () => {
  const total = N * N, move = buildMoveFunction();
  function simulate() {
    let sq = 1, steps = 0;
    while (sq < total) {
      const roll = dieFaces[Math.floor(Math.random() * dieFaces.length)];
      sq = sq + roll > total ? sq : move(sq + roll);
      steps++;
      if (steps > 500000) break;
    }
    return steps;
  }
  const N_SIMS = 10000, results = [];
  const btn = document.getElementById('monte-btn');
  btn.disabled = true; btn.textContent = 'running...';
  const canvas = document.getElementById('hist');
  canvas.width = canvas.offsetWidth * window.devicePixelRatio;
  canvas.height = canvas.offsetHeight * window.devicePixelRatio;
  const ctx = canvas.getContext('2d');
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  const NBINS = 30;
  let targetHeights = new Array(NBINS).fill(0), barH = new Array(NBINS).fill(0);
  barHeights = barH;
  let gMin = Infinity, gMax = -Infinity, animFrame = null;
  let pMin = 0, pMax = 1;

  function computeBins() {
    if (results.length < 2) return;
    gMin = Math.min(...results); gMax = Math.max(...results);
    const sorted = [...results].sort((a,b) => a-b);
    pMin = gMin;
    pMax = sorted[Math.floor(sorted.length * 0.99)];
    if (pMax <= pMin) pMax = gMax;
    const range = pMax - pMin || 1, counts = new Array(NBINS).fill(0);
    results.forEach(v => {
      const t = (v - pMin) / range;
      const bin = Math.min(NBINS - 1, Math.max(0, Math.floor(t * NBINS)));
      counts[bin]++;
    });
    const maxC = Math.max(...counts);
    targetHeights = counts.map(c => c / maxC);
  }

  function drawCDF() {
    if (results.length < 100) return;
    const sorted = [...results].sort((a,b) => a-b);
    const range = pMax - pMin || 1;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(175,175,185,0.88)';
    ctx.lineWidth = 1.6;
    ctx.moveTo(0, H);
    for (let i = 0; i < sorted.length; i++) {
        const x = Math.min(W, ((sorted[i] - pMin) / range) * W);
        const yPrev = H - (i / sorted.length) * H;
        const yCur  = H - ((i + 1) / sorted.length) * H;
        ctx.lineTo(x, yPrev);
        ctx.lineTo(x, yCur);
    }
    ctx.lineTo(W, 0);
    ctx.stroke();

    ctx.fillStyle = 'rgba(175,175,185,0.88)';
    ctx.font = `9px Inter, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText('1', W - 2, 9);
    ctx.fillText('0', W - 2, H - 2);

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(175,175,185,0.3)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);
    ctx.moveTo(0, H * 0.5);
    ctx.lineTo(W, H * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText('0.5', W - 2, H * 0.5 - 2);
  }

  function animateBars() {
    for (let i = 0; i < NBINS; i++) barH[i] += (targetHeights[i] - barH[i]) * 0.18;
    ctx.clearRect(0, 0, W, H);
    const bw = W / NBINS;
    const mean = results.length ? results.reduce((a,b) => a+b, 0) / results.length : 0;
    const range = pMax - pMin || 1;
    barH.forEach((h, idx) => {
      if (h <= 0.001) return;
      const bH = h * H, bc = pMin + (idx + 0.5) * (range / NBINS);
      const t = Math.min(1, Math.abs(bc - mean) / (range * 0.5));
      ctx.fillStyle = `rgb(${Math.round(160+t*60)},${Math.round(80-t*60)},${Math.round(60-t*40)})`;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(idx*bw+1, H-bH, bw-2, bH, [2,2,0,0]);
      else ctx.rect(idx*bw+1, H-bH, bw-2, bH);
      ctx.fill();
    });
    drawCDF();
    document.getElementById('hist-min').textContent = isFinite(gMin) ? gMin : '';
    document.getElementById('hist-mid').textContent = results.length ? Math.round(results.reduce((a,b) => a+b,0) / results.length) : '';
    document.getElementById('hist-max').textContent = isFinite(gMax) ? gMax : '';
    animFrame = requestAnimationFrame(animateBars);
  }

  animFrame = requestAnimationFrame(animateBars);
  let i = 0;
  function step() {
    for (let b = 0; b < 100 && i < N_SIMS; b++, i++) results.push(simulate());
    computeBins();
    if (i < N_SIMS) {
      requestAnimationFrame(step);
    } else {
      setTimeout(() => {
        cancelAnimationFrame(animFrame);
        btn.disabled = false; btn.textContent = 'monte carlo';
        const mean = results.reduce((a,b) => a+b, 0) / results.length;
        const sorted = [...results].sort((a,b) => a-b);
        const median = sorted.length % 2 === 0
          ? (sorted[sorted.length/2-1] + sorted[sorted.length/2]) / 2
          : sorted[Math.floor(sorted.length/2)];
        const variance = results.reduce((s,v) => s + (v-mean)**2, 0) / results.length;
        const std = Math.sqrt(variance);
        const skew = results.reduce((s,v) => s + ((v-mean)/std)**3, 0) / results.length;
        const prob = results.filter(r => r <= mean).length / results.length;
        document.getElementById('mc-mean').textContent = mean.toFixed(1);
        document.getElementById('mc-median').textContent = median.toFixed(1);
        document.getElementById('mc-skew').textContent = skew.toFixed(2);
        document.getElementById('mc-prob').textContent = (prob * 100).toFixed(1) + '%';
        document.getElementById('mc-section').style.display = 'block';
      }, 600);
    }
  }
  requestAnimationFrame(step);
});

document.getElementById('sim-btn').addEventListener('click', () => {
  if (simRunning) { cancelSim(); return; }
  const total = N * N, move = buildMoveFunction();
  const btn = document.getElementById('sim-btn');
  const prev = currentTokenColour; let next = prev;
  while (next === prev) next = Math.floor(Math.random() * TOKEN_COLOURS.length);
  currentTokenColour = next;
  const path = [1]; let sq = 1, steps = 0;
  while (sq < total && steps < 50000) {
    const roll = dieFaces[Math.floor(Math.random() * dieFaces.length)];
    const nextSq = sq + roll > total ? sq : move(sq + roll);
    path.push(nextSq); sq = nextSq; steps++;
  }
  simRunning = true; simCancel = false; btn.textContent = 'stop';
  document.getElementById('sim-block').style.display = 'block';
  document.getElementById('sim-steps').textContent = '0';
  let idx = 0;
  function step() {
    if (simCancel || idx >= path.length) {
      simRunning = false; simCancel = false;
      document.getElementById('sim-steps').textContent = path.length - 1;
      setTimeout(() => placeToken(null), 800);
      btn.textContent = 'simulate run'; btn.disabled = false; return;
    }
    placeToken(path[idx]);
    document.getElementById('sim-steps').textContent = Math.max(0, idx);
    idx++; setTimeout(step, 80);
  }
  step();
});

window.addEventListener('resize', () => redrawOverlay());

buildGrid();
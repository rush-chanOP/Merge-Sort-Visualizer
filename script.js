/* =====================================================================
   PART 1 - ALGORITHM (no DOM here). Merge Sort is written by hand;
   instead of just sorting, it records a "step" for every meaningful
   operation so the UI can replay it. .sort() is never used.
   ===================================================================== */

// Turn the text box content into numbers, or return a friendly error.
function parseInput(text) {
  const raw = text.trim();
  if (!raw) return { error: 'Please enter some numbers, e.g. 38, 27, 43, 3' };
  const nums = [];
  for (const t of raw.split(/[\s,]+/).filter(Boolean)) {
    const n = Number(t);
    if (!Number.isFinite(n)) return { error: '"' + t + '" is not a valid number. Use numbers separated by commas.' };
    nums.push(n);
  }
  if (nums.length < 2) return { error: 'Enter at least 2 numbers so there is something to sort.' };
  if (nums.length > 16) return { error: 'Please use at most 16 numbers so the animation stays readable.' };
  return { values: nums };
}

// Plain Merge Sort (used for self-tests and to double check the steps).
function mergeSort(a) {
  if (a.length <= 1) return a;
  const mid = Math.floor(a.length / 2);
  const left = mergeSort(a.slice(0, mid)), right = mergeSort(a.slice(mid));
  const out = []; let i = 0, j = 0;
  while (i < left.length && j < right.length) out.push(left[i] <= right[j] ? left[i++] : right[j++]);
  while (i < left.length) out.push(left[i++]);
  while (j < right.length) out.push(right[j++]);
  return out;
}

// Build the recursion tree: each node is a range [lo..hi] of the array.
function buildTree(lo, hi) {
  if (lo === hi) return { lo, hi, kids: [] };
  const mid = (lo + hi) >> 1;
  return { lo, hi, kids: [buildTree(lo, mid), buildTree(mid + 1, hi)] };
}

// Run Merge Sort and record every step as a snapshot.
// Cards are tracked by id (their original index) so the UI can move them.
function buildSteps(values) {
  const n = values.length;
  const steps = [];
  const order = values.map((_, i) => i);            // order[pos] = id of card at that position
  let segs = [{ lo: 0, hi: n - 1, sorted: false }]; // current row-0 portions
  const done = [];                                  // tree nodes that are finished
  const key = (lo, hi) => lo + '-' + hi;
  const show = (lo, hi) => order.slice(lo, hi + 1).map(id => values[id]).join(' ');

  // Save the whole visible state: groups of cards, highlights, text.
  function snap(stage, text, node, ex) {
    ex = ex || {};
    const groups = [];
    for (const s of segs) {
      if (ex.m && s.lo === ex.m.lo) groups.push({ ids: ex.m.L.slice(), row: 0, kind: 's', active: true });
      else if (ex.m && s.lo === ex.m.mid + 1) {
        groups.push({ ids: ex.m.R.slice(), row: 0, kind: 's' });
        groups.push({ ids: ex.m.M.slice(), row: 1, kind: 'm', under: true });
      } else groups.push({ ids: order.slice(s.lo, s.hi + 1), row: 0, kind: ex.final ? 'f' : (s.sorted ? 's' : 'u') });
    }
    steps.push({ stage, text, node, done: done.slice(), groups, mark: ex.mark || {}, vs: ex.vs || null, split: ex.split });
  }

  function sortRange(lo, hi) {
    const k = key(lo, hi);
    if (lo === hi) {                                 // BASE CASE
      segs.find(s => s.lo === lo && s.hi === hi).sorted = true;
      done.push(k);
      snap('DIVIDING', 'Base case: [' + values[order[lo]] + '] is a single element, and a single element is already sorted.', k, { mark: { [order[lo]]: 'pick' } });
      return;
    }
    const mid = (lo + hi) >> 1;                      // DIVIDE
    const idx = segs.findIndex(s => s.lo === lo && s.hi === hi);
    segs.splice(idx, 1, { lo, hi: mid, sorted: false }, { lo: mid + 1, hi, sorted: false });
    snap('DIVIDING', 'Divide: [' + show(lo, hi) + '] is split into [' + show(lo, mid) + '] and [' + show(mid + 1, hi) + '].', k, { split: order[mid] });
    sortRange(lo, mid);                              // CONQUER left
    sortRange(mid + 1, hi);                          // CONQUER right
    merge(lo, mid, hi, k);                           // COMBINE
  }

  function merge(lo, mid, hi, k) {
    let L = order.slice(lo, mid + 1), R = order.slice(mid + 1, hi + 1);
    const M = [];                                    // merged result
    const m = () => ({ lo, mid, hi, L, R, M });
    snap('MERGING', 'Now merge the two sorted portions [' + L.map(i => values[i]).join(' ') + '] and [' + R.map(i => values[i]).join(' ') + '] into one sorted portion.', k, { m: m() });
    while (L.length && R.length) {
      const a = L[0], b = R[0], va = values[a], vb = values[b];
      snap('COMPARING', 'We are comparing the first remaining elements of the two sorted portions: ' + va + ' VS ' + vb + '.', k, { m: m(), mark: { [a]: 'cmp', [b]: 'cmp' }, vs: [va, vb] });
      const takeLeft = va <= vb;
      const p = takeLeft ? L.shift() : R.shift();
      M.push(p);
      const msg = va === vb ? va + ' and ' + vb + ' are equal, so the left one is selected first (keeps the sort stable).'
        : (takeLeft ? va + ' is smaller' : vb + ' is smaller') + ', so it is selected first and placed into the merged portion.';
      snap('MERGING', msg, k, { m: m(), mark: { [p]: 'pick' } });
    }
    if (L.length || R.length) {                      // one side ran out
      const rest = (L.length ? L : R).slice(), side = L.length ? 'left' : 'right';
      M.push(...rest); L = []; R = [];
      const mark = {}; rest.forEach(id => mark[id] = 'pick');
      snap('MERGING', 'The ' + side + ' portion still has ' + rest.map(i => values[i]).join(', ') + '. The other side is empty, so these sorted elements are copied over.', k, { m: m(), mark });
    }
    order.splice(lo, hi - lo + 1, ...M);             // write result back
    segs = segs.filter(s => s.hi < lo || s.lo > hi);
    segs.push({ lo, hi, sorted: true });
    segs.sort((x, y) => x.lo - y.lo);                // (tiny array of portions, not the data)
    done.push(k);
    snap('MERGING', '[' + show(lo, hi) + '] is now one sorted portion.', k);
  }

  snap('READY', 'This is the unsorted array. Merge Sort uses Divide and Conquer: split, solve small parts, then merge.', key(0, n - 1));
  sortRange(0, n - 1);
  snap('SORTED', 'All sorted portions have been merged into the final sorted array.', key(0, n - 1), { final: true });
  return { steps, result: order.map(id => values[id]) };
}

if (typeof module !== 'undefined') module.exports = { parseInput, mergeSort, buildSteps };

/* =====================================================================
   PART 2 - UI (DOM). Only reads the recorded steps and draws them.
   ===================================================================== */
if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  const STEP = 60, GAP = 30, ROW_Y = [36, 140];
  let values = [], steps = [], cur = 0, timer = null, cards = {}, boxes = {}, maxW = 0, gboxes = new Map();

  function setError(msg) { $('error').textContent = msg || ''; }

  // Generate: parse -> run algorithm -> build cards and tree -> draw step 0.
  function generate() {
    const r = parseInput($('arrayInput').value);
    if (r.error) { setError(r.error); return; }
    setError(''); pause();
    values = r.values;
    steps = buildSteps(values).steps;
    maxW = values.length * STEP + (values.length - 1) * GAP;
    $('stage').style.minWidth = (maxW + 24) + 'px';
    $('stage').innerHTML = '<div class="rowlabel" id="rowLabel" style="top:203px;opacity:0">Merged result</div>' +
      '<div class="splitmark" id="splitMark"></div><div class="cmpline" id="cmpLine"></div>' +
      '<div class="ptr pi" id="ptrI">i</div><div class="ptr pj" id="ptrJ">j</div>' +
      '<div class="vsbadge" id="vsBadge">VS</div><div class="drop" id="dropArrow"></div>';
    gboxes = new Map();
    cards = {};
    values.forEach((v, id) => {
      const d = document.createElement('div');
      d.className = 'card u'; d.textContent = v;
      $('stage').appendChild(d); cards[id] = d;
    });
    $('tree').innerHTML = ''; boxes = {};
    $('tree').appendChild(drawTree(buildTree(0, values.length - 1)));
    cur = 0; render();
  }

  function drawTree(node) {
    const wrap = document.createElement('div'); wrap.className = 'tnode';
    const box = document.createElement('div'); box.className = 'tbox';
    box.textContent = values.slice(node.lo, node.hi + 1).join(' ');
    boxes[node.lo + '-' + node.hi] = box; wrap.appendChild(box);
    if (node.kids.length) {
      const kids = document.createElement('div'); kids.className = 'tkids';
      node.kids.forEach(k => kids.appendChild(drawTree(k)));
      wrap.appendChild(kids);
    }
    return wrap;
  }

  // Dashed box around one group of cards. Boxes are reused by the id of the
  // group's first card, so a box shrinks when its group is split.
  function drawBox(g, x, live) {
    const key = g.ids[0] + '-' + g.row;
    let b = gboxes.get(key);
    if (!b) { b = document.createElement('div'); b.className = 'gbox'; $('stage').appendChild(b); gboxes.set(key, b); }
    const set = () => {
      b.style.left = (x - 8) + 'px'; b.style.top = (ROW_Y[g.row] - 8) + 'px';
      b.style.width = (g.ids.length * STEP + 8) + 'px';
    };
    if (!b.classList.contains('on')) { b.className = 'gbox snap k' + g.kind; set(); void b.offsetWidth; }
    b.className = 'gbox on k' + g.kind; set(); live.add(key);
  }

  // Place a helper element (arrow, pointer, line) centred on x; null hides it.
  function put(id, x, w) {
    const e = $(id);
    if (x === null) { e.style.opacity = 0; return; }
    if (e.style.opacity !== '1') {            // first appearance: no sliding from old spot
      e.style.transition = 'opacity .3s';
      e.style.left = (x - w / 2) + 'px'; e.style.width = w + 'px'; void e.offsetWidth;
      e.style.transition = '';
    }
    e.style.left = (x - w / 2) + 'px'; e.style.width = w + 'px'; e.style.opacity = 1;
  }

  // Draw the current step: position every card, box, arrow and the text.
  function render() {
    const st = steps[cur];
    const off = Math.max(12, ($('stageWrap').clientWidth - maxW) / 2);
    let cursor = 0, activeX = 0, labelX = null, headL = null, headR = null, dropX = null, splitX = null, prevActive = false;
    const live = new Set();
    st.groups.forEach(g => {
      if (g.active) activeX = cursor;
      const x = g.under ? activeX : cursor;
      const isRight = prevActive && !g.under; prevActive = !!g.active;
      if (g.under && g.ids.length) labelX = x;
      if (g.active && g.ids.length) headL = off + x + 26;     // pointer i: front of left portion
      if (isRight && g.ids.length) headR = off + x + 26;      // pointer j: front of right portion
      g.ids.forEach((id, i) => {
        const c = cards[id];
        c.style.left = (off + x + i * STEP) + 'px';
        c.style.top = ROW_Y[g.row] + 'px';
        c.className = 'card ' + g.kind + (st.mark[id] ? ' ' + st.mark[id] : '');
        if (g.under && st.mark[id] === 'pick' && dropX === null) dropX = off + x + i * STEP + 26;
        if (st.split === id) splitX = off + x + i * STEP + 52 + 19;   // centre of the new gap
      });
      if (g.ids.length) drawBox(g, off + x, live);
      if (!g.under && g.ids.length) cursor += g.ids.length * STEP + GAP;
    });
    gboxes.forEach((b, k) => { if (!live.has(k)) b.className = 'gbox'; });

    const cmp = st.vs && headL !== null && headR !== null;
    put('ptrI', headL, 22); put('ptrJ', headR, 22);
    put('cmpLine', cmp ? (headL + headR) / 2 : null, cmp ? headR - headL : 0);
    put('vsBadge', cmp ? (headL + headR) / 2 : null, 30);
    put('dropArrow', dropX, 20); put('splitMark', splitX, 2);
    const lab = $('rowLabel');
    lab.style.opacity = labelX === null ? 0 : 1;
    if (labelX !== null) lab.style.left = (off + labelX) + 'px';

    $('mascot').dataset.mood = st.stage;
    $('stageBadge').textContent = st.stage;
    $('stageBadge').className = 'badge ' + st.stage;
    $('stepCount').textContent = 'Step ' + (cur + 1) + ' / ' + steps.length;
    $('vs').textContent = st.vs ? st.vs[0] + '  VS  ' + st.vs[1] : '';
    $('vs').classList.toggle('on', !!st.vs);
    const t = $('explainText'); t.textContent = st.text;
    t.classList.remove('swap'); void t.offsetWidth; t.classList.add('swap');
    $('complete').classList.toggle('on', st.stage === 'SORTED');
    for (const k in boxes) boxes[k].className = 'tbox' + (st.done.includes(k) ? ' done' : '') + (k === st.node ? ' active' : '');
    $('prevBtn').disabled = cur === 0;
    $('nextBtn').disabled = cur === steps.length - 1;
  }

  function speedMs() { return 2400 / Number($('speed').value); }  // delay between steps
  function applySpeed() { document.documentElement.style.setProperty('--dur', Math.min(700, speedMs() * 0.45) + 'ms'); }

  function next() { if (cur < steps.length - 1) { cur++; render(); } else pause(); }
  function prev() { if (cur > 0) { cur--; render(); } }
  function play() {
    if (cur === steps.length - 1) cur = 0;
    $('playBtn').innerHTML = '&#10074;&#10074; Pause';
    const tick = () => {
      next();
      if (cur < steps.length - 1) timer = setTimeout(tick, speedMs()); else pause();
    };
    render(); timer = setTimeout(tick, speedMs());
  }
  function pause() { clearTimeout(timer); timer = null; $('playBtn').innerHTML = '&#9654; Play'; }
  function restart() { pause(); cur = 0; render(); }

  $('startBtn').onclick = generate;
  $('exampleBtn').onclick = () => { $('arrayInput').value = '38, 27, 43, 3, 9, 82, 10'; generate(); };
  $('randomBtn').onclick = () => {
    const n = 6 + Math.floor(Math.random() * 5);
    $('arrayInput').value = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 99)).join(', ');
    generate();
  };
  $('nextBtn').onclick = () => { pause(); next(); };
  $('prevBtn').onclick = () => { pause(); prev(); };
  $('playBtn').onclick = () => timer ? pause() : play();
  $('restartBtn').onclick = restart;
  $('speed').oninput = applySpeed;
  $('arrayInput').onkeydown = e => { if (e.key === 'Enter') generate(); };
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') { pause(); next(); }
    if (e.key === 'ArrowLeft') { pause(); prev(); }
    if (e.key === ' ') { e.preventDefault(); $('playBtn').click(); }
  });
  window.addEventListener('resize', () => steps.length && render());

  // Console self-test: runSelfTests()
  window.runSelfTests = function () {
    ['38, 27, 43, 3, 9, 82, 10', '5, 2, 5, 1, 2', '1, 2, 3, 4, 5', '5, 4, 3, 2, 1', '10, 10, 10, 10'].forEach(s => {
      const v = parseInput(s).values, res = buildSteps(v).result.join(',');
      const expect = mergeSort(v).join(',');
      console.log(res === expect ? 'PASS' : 'FAIL', s, '->', res);
    });
  };
  applySpeed(); generate();
}

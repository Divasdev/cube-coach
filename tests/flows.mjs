// Regression check for stale cube state between the demo, finished solves, and new scans.
// It runs the real dist/app.mjs against a tiny DOM stand-in and a fake camera, and reads state
// through the app's own read_cube_state tool.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url), Cube = require('../dist/vendor/cube.js');
require('../dist/vendor/solve.js');

// ---- Tiny DOM: enough HTML parsing and selector matching for app.mjs ----
const VOID = new Set(['input', 'br', 'img', 'meta', 'link', 'hr']), ENT = {amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'"};
const decode = s => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ENT[e]);
class El {
  constructor(tag, attrs = {}) {
    Object.assign(this, {tag, attrs, children: [], parent: null, style: {}, dataset: {}, listeners: {}});
    for (const [k, v] of Object.entries(attrs)) if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-(.)/g, (_, c) => c.toUpperCase())] = v;
    Object.assign(this, {disabled: 'disabled' in attrs, hidden: 'hidden' in attrs, checked: 'checked' in attrs, value: attrs.value ?? ''});
    this.classList = {add: c => this.setClass(c, true), remove: c => this.setClass(c, false), contains: c => this.classes().includes(c)};
    if (tag === 'canvas') Object.assign(this, {width: 600, height: 600, clientWidth: 600, clientHeight: 600, getContext: () => camera.ctx, toDataURL: () => '', setPointerCapture() {}});
    if (tag === 'video') Object.assign(this, {readyState: 4, videoWidth: 600, videoHeight: 600, currentTime: 0, play: async () => {},
      requestVideoFrameCallback: cb => { this.nextFrame = cb; return 1; }, cancelVideoFrameCallback: () => { this.nextFrame = null; }});
  }
  classes() { return (this.attrs.class || '').split(/\s+/).filter(Boolean); }
  setClass(c, on) { const list = this.classes().filter(x => x !== c); if (on) list.push(c); this.attrs.class = list.join(' '); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  set innerHTML(html) { this.children = []; parseInto(this, html); }
  get textContent() { return this.children.map(c => typeof c === 'string' ? c : c.textContent).join(''); }
  set textContent(t) { this.children = [String(t)]; }
  append(...nodes) { this.children.push(...nodes); }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  click() { if (this.disabled) return; const e = {target: this, preventDefault() {}}; this.onclick?.(e); (this.listeners.click || []).forEach(f => f(e)); }
  *walk() { for (const c of this.children) if (typeof c !== 'string') { yield c; yield* c.walk(); } }
}
function parseInto(root, html) {
  const stack = [root];
  for (const m of html.matchAll(/<\/([\w-]+)\s*>|<([\w-]+)((?:\s+[^\s=>\/]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g)) {
    const top = stack.at(-1);
    if (m[1]) { const i = stack.findLastIndex(e => e.tag === m[1].toLowerCase()); if (i > 0) stack.length = i; }
    else if (m[2]) {
      const attrs = {};
      for (const a of m[3].matchAll(/([^\s=>\/]+)(?:="([^"]*)")?/g)) attrs[a[1]] = decode(a[2] ?? '');
      const el = new El(m[2].toLowerCase(), attrs);
      el.parent = top; top.children.push(el);
      if (!m[4] && !VOID.has(el.tag)) stack.push(el);
    } else top.children.push(decode(m[5]));
  }
}
const compile = sel => sel.trim().split(/\s+/).map(part => {
  const s = {tag: null, id: null, cls: [], attrs: []};
  part.replace(/^[a-z][\w-]*/i, t => { s.tag = t.toLowerCase(); return ''; })
    .replace(/#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]/g, (_, id, cls, attr, val) => {
      if (id) s.id = id; else if (cls) s.cls.push(cls); else s.attrs.push([attr, val]); return '';
    });
  return s;
});
const matchOne = (el, s) => (!s.tag || el.tag === s.tag) && (!s.id || el.attrs.id === s.id) && s.cls.every(c => el.classes().includes(c)) && s.attrs.every(([k, v]) => k in el.attrs && (v === undefined || el.attrs[k] === v));
function matches(el, parts) {
  if (!matchOne(el, parts.at(-1))) return false;
  let i = parts.length - 2;
  for (let p = el.parent; p && i >= 0; p = p.parent) if (matchOne(p, parts[i])) i--;
  return i < 0;
}

// ---- Browser globals the app touches ----
let clock = 10000, tools = {};
const RGB = {U: [242, 243, 234], R: [204, 28, 26], F: [23, 160, 67], D: [238, 215, 32], L: [245, 115, 26], B: [25, 76, 184]};
// The fake camera always shows `camera.face`: nine sticker letters, read row by row.
// `camera.split` puts one guide dot across two stickers, as a slightly misaligned cube would.
const camera = {face: '', split: -1, ctx: {fillRect() {}, save() {}, translate() {}, rotate() {}, drawImage() {}, restore() {}, getImageData(x, y, w, h) {
  const c = Math.max(0, Math.min(2, Math.floor((x + w / 2 - 90) / 140))), r = Math.max(0, Math.min(2, Math.floor((y + h / 2 - 90) / 140)));
  const sticker = camera.face[r * 3 + c], rgb = RGB[sticker] || [20, 20, 20], other = sticker === 'U' ? [20, 20, 20] : RGB.U;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) data.set([...(camera.split === r * 3 + c && i < data.length / 2 ? other : rgb), 255], i);
  return {data};
}}};
const track = {stop() {}, addEventListener() {}}, stream = {getTracks: () => [track], getVideoTracks: () => [track]};
Object.defineProperty(globalThis, 'navigator', {value: {mediaDevices: {getUserMedia: async () => stream}}, configurable: true});
Object.defineProperty(globalThis, 'performance', {value: {now: () => clock}, configurable: true, writable: true});
Object.assign(globalThis, {window: globalThis, addEventListener() {}, Cube,
  requestAnimationFrame: cb => setTimeout(() => cb(clock), 0), cancelAnimationFrame: id => clearTimeout(id)});
let solverReady = false;
globalThis.Worker = class {
  postMessage({state, id}) {
    setTimeout(() => {
      if (this.dead) return;
      if (!solverReady) { Cube.initSolver(); solverReady = true; }
      const c = Cube.fromString(state);
      this.onmessage?.({data: {type: 'solution', algorithm: c.isSolved() ? '' : c.solve(), id}});
    }, 0);
  }
  terminate() { this.dead = true; }
};

// ---- Helpers ----
let run = 0;
async function openApp() {
  const body = new El('body');
  body.innerHTML = '<div id="app"></div><div id="toast" role="status"></div>';
  const all = sel => { const parts = compile(sel); return [...body.walk()].filter(el => matches(el, parts)); };
  tools = {};
  globalThis.document = {body, hidden: false, querySelector: s => all(s)[0] ?? null, querySelectorAll: all, addEventListener() {},
    modelContext: {registerTool(tool) { tools[tool.name] = tool; }}};
  await import(`../dist/app.mjs?run=${++run}`);
}
const $ = s => document.querySelector(s);
const click = sel => { const el = $(sel); assert.ok(el, `missing ${sel}`); assert.ok(!el.disabled, `${sel} is disabled`); el.click(); };
const state = () => tools.read_cube_state.execute();
const tick = () => new Promise(r => setTimeout(r, 0));
const ORDER = 'URFDLB', faceOf = (s, f) => s.slice(ORDER.indexOf(f) * 9, ORDER.indexOf(f) * 9 + 9);
const BLANK = [...ORDER].map(f => '????' + f + '????').join('');
const DEMO = new Cube().move("R U R' F2 D L2 B U2 R2 F D' L B2 R U' F2").asString();
const MINE = new Cube().move("F R U' L2 D B' R2 U F' L D2 R'").asString();
const OTHER = new Cube().move("B2 L U2 R' D F2 L' U B D2").asString();

// Advance the live camera by 100 ms frames.
function pump(frames) {
  for (let i = 0; i < frames; i++) {
    const video = $('#camera-video'), next = video?.nextFrame;
    if (!next) return false;
    clock += 100; video.currentTime += .1; video.nextFrame = null; next(clock);
  }
  return true;
}
// Show one face to the camera until the app saves a capture.
async function scanFace(cube, f) {
  if (!$('#camera-video')) { click('#start-scan'); await tick(); }
  camera.face = faceOf(cube, f);
  $('#toast').textContent = '';
  for (let i = 0; i < 80 && !/captured/.test($('#toast').textContent); i++) assert.ok(pump(1), `camera stopped before the ${f} face was captured`);
  assert.match($('#toast').textContent, /captured/, `${f} face was not captured`);
}
async function finishSolve() {
  click('#solve');
  for (let i = 0; i < 400 && state().view !== 'solve'; i++) await new Promise(r => setTimeout(r, 25));
  const {moveCount} = state();
  assert.ok(moveCount > 0, 'solution should have moves');
  click(`[data-jump="${moveCount - 1}"]`);
  click('#next-move');
  await tick();
  assert.equal(state().moveIndex, moveCount);
  assert.ok($('#new-cube'), 'solve should be complete');
}
function expectFreshScan(label, selected = 'F') {
  const s = state();
  assert.equal(s.view, 'scan', label);
  assert.deepEqual(s.capturedFaces, [], `${label}: no faces should carry over`);
  assert.equal(s.facelets, BLANK, `${label}: colors should be blank`);
  assert.equal(s.moveCount, 0, `${label}: old solution should be cleared`);
  assert.equal($('.counter').textContent, '0/ 6 faces', label);
  assert.equal($('.face-rail .selected').dataset.face, selected, label);
  assert.equal($('#cube-badge').textContent, 'SCAN PREVIEW', label);
}
function expectFirstFace(label, cube) {
  const s = state();
  assert.equal(s.view, 'scan', `${label}: one scanned face must not open review`);
  assert.deepEqual(s.capturedFaces, ['F'], label);
  assert.equal(faceOf(s.facelets, 'F'), faceOf(cube, 'F'), label);
  for (const f of 'URDLB') assert.equal(faceOf(s.facelets, f), '????' + f + '????', `${label}: ${f} should still be blank`);
  assert.equal($('.counter').textContent, '1/ 6 faces', label);
  assert.equal($('#scan-caption').textContent, '1 face ready', label);
  assert.equal($('.face-rail .selected').dataset.face, 'R', `${label}: should prompt for the next uncaptured face`);
  assert.ok(!$('[data-step=review]').disabled, `${label}: Check the colors should be available`);
}

// 1. Demo → "Add your cube" → scan one face.
await openApp();
click('#demo');
assert.equal(state().view, 'review');
assert.ok(!$('[data-step=scan] svg'), 'the demo should not mark "Add your cube" as done');
click('[data-step=scan]');
expectFreshScan('demo → Add your cube');
await scanFace(MINE, 'F');
expectFirstFace('demo → Add your cube → one face', MINE);

// 2. Demo review → "Back to scanning" or "Retake" also start the user's own cube.
await openApp();
click('#demo');
click('#back-scan');
expectFreshScan('demo → Back to scanning');
await openApp();
click('#demo');
click('[data-rescan=R]');
expectFreshScan('demo → Retake right', 'R');

// 3. Capture all six faces, return to scanning, retake one face, then solve.
await openApp();
for (const f of ['F', 'R', 'B', 'L', 'U', 'D']) await scanFace(MINE, f);
assert.equal(state().view, 'review', 'six faces should open review');
assert.equal(state().facelets, MINE);
assert.equal(state().validation.ok, true);
click('#back-scan');
assert.equal(state().view, 'scan');
assert.equal(state().facelets, MINE, 'Back to scanning keeps captured faces');
assert.equal($('.counter').textContent, '6/ 6 faces');
click('#review');
click('[data-rescan=R]');
assert.equal(state().view, 'scan');
assert.deepEqual(state().capturedFaces.sort(), [...'BDFLU']);
assert.equal($('.counter').textContent, '5/ 6 faces');
assert.equal($('.face-rail .selected').dataset.face, 'R');
for (const f of 'UFDLB') assert.equal(faceOf(state().facelets, f), faceOf(MINE, f), `Retake keeps the ${f} face`);
await scanFace(MINE, 'R');
assert.equal(state().view, 'review', 'retaking the missing face returns to review');
assert.equal(state().facelets, MINE);

// 4. Completed solve → "Add your cube" → scan one face of a different cube.
await finishSolve();
click('[data-step=scan]');
expectFreshScan('finished solve → Add your cube');
await scanFace(OTHER, 'F');
expectFirstFace('finished solve → Add your cube → one face', OTHER);

// 5. "Try my cube" after the lessons.
await openApp();
click('#demo');
click('#nav-learn');
for (let i = 0; i < 4; i++) click('#next-lesson');
expectFreshScan('demo → Try my cube');
await openApp();
await scanFace(MINE, 'F');
await scanFace(MINE, 'R');
click('#nav-learn');
for (let i = 0; i < 4; i++) click('#next-lesson');
assert.equal(state().view, 'scan');
assert.deepEqual(state().capturedFaces, ['F', 'R'], 'Try my cube keeps an unfinished scan');
assert.equal($('.counter').textContent, '2/ 6 faces');

// 6. Demo solve → "Scan my cube".
await openApp();
click('#demo');
await finishSolve();
assert.equal(state().facelets, DEMO, 'the demo starts from its scramble');
assert.equal(state().displayedFacelets, new Cube().asString(), 'the demo solve ends on a solved cube');
click('#new-cube');
expectFreshScan('demo solve → Scan my cube');

// 7. A dot sitting across two stickers blocks auto-capture; a manual capture keeps that sticker flagged in review.
await openApp();
for (const f of ['F', 'R', 'B', 'L', 'U']) await scanFace(MINE, f);
camera.face = faceOf(MINE, 'D'); camera.split = 0; $('#toast').textContent = '';
pump(50);
assert.doesNotMatch($('#toast').textContent, /captured/, 'a misaligned face must not auto-capture');
click('#capture-now');
camera.split = -1;
assert.equal(state().view, 'review');
assert.ok($('[data-sticker="D:0"]').classList.contains('uncertain'), 'the misaligned sticker should be flagged after calibration');

console.log('PASS: demo/finished-solve → new cube starts at 0 of 6, one scan stays on 1 of 6, six-face capture, retake and Back to scanning keep faces, Try my cube, demo solve, misaligned sticker flagged.');
process.exit(0);

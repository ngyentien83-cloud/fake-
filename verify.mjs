import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('malware-demo/index.html', 'utf8');
const engine = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const files = ['era-pipe.js', 'era-worm2000.js', 'era-ransom2017.js'];
const source = [engine, ...files.map(f => fs.readFileSync('malware-demo/' + f, 'utf8'))].join('\n;\n');

const mkCanvasCtx = (node) => {
  const ops = [];
  const rec = (name) => (...a) => { ops.push({ op: name, a: a.slice(0, 6) }); };
  return {
    node, ops,
    setTransform() {}, fillRect: rec('fillRect'), fillText: rec('fillText'), clearRect: rec('clearRect'),
    drawImage: rec('drawImage'),
    beginPath() {}, closePath: rec('closePath'), moveTo: rec('moveTo'), lineTo: rec('lineTo'),
    stroke: rec('stroke'), fill: rec('fill'),
    arc: rec('arc'), ellipse: rec('ellipse'), quadraticCurveTo: rec('qcurve'), bezierCurveTo: rec('bcurve'),
    save() {}, restore() {}, translate: rec('translate'), rotate: rec('rotate'), scale() {},
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
    fillStyle: '', strokeStyle: '', font: '', globalAlpha: 1, lineWidth: 1, lineCap: '',
  };
};

let CANVASES = [];

function mkNode(tag, n) {
  const e = {
    tagName: (tag || 'div').toUpperCase() + (n ? '-' + n : ''), _tag: (tag || 'div').toLowerCase(),
    children: [], _h: {}, _text: '',
    className: '', id: '', value: '', tabIndex: 0, parentNode: null,
    style: { setProperty(k, v) { this[k] = v; } },
    getAttribute() { return null; }, setAttribute() {},
    addEventListener(t, f) { (this._h[t] = this._h[t] || []).push(f); },
    dispatch(t, ev) { (this._h[t] || []).forEach(f => f(Object.assign({ preventDefault() {} }, ev))); },
    click() { this.dispatch('click', {}); },
    appendChild(c) { c.parentNode = e; e.children.push(c); return c; },
    insertBefore(c, ref) {
      const i = e.children.indexOf(ref);
      c.parentNode = e;
      if (i < 0) e.children.push(c); else e.children.splice(i, 0, c);
      return c;
    },
    append(...cs) { cs.forEach(c => c && e.appendChild(c)); },
    removeChild(c) { const i = e.children.indexOf(c); if (i >= 0) e.children.splice(i, 1); c.parentNode = null; },
    getContext() { if (!e._ctx) { e._ctx = mkCanvasCtx(e); CANVASES.push(e); } return e._ctx; },
    get childElementCount() { return e.children.length; },
    get firstElementChild() { return e.children[0] || null; },
    get firstChild() { return e.children[0] || null; },
    get textContent() {
      if (e._text != null && e.children.length === 0) return e._text;
      if (e.children.length) return e.children.map(c => c.textContent).join('\n');
      return e._text;
    },
    set textContent(v) { e._text = String(v); if (v === '') e.children.length = 0; },
    get classList() {
      const list = () => e.className.split(' ').filter(Boolean);
      const write = (arr) => { e.className = arr.join(' '); };
      return {
        add(c) { const a = list(); if (!a.includes(c)) write([...a, c]); },
        remove(c) { write(list().filter(x => x !== c)); },
        contains(c) { return list().includes(c); },
        toggle(c, force) {
          const has = list().includes(c);
          const want = force === undefined ? !has : !!force;
          if (want) { if (!has) write([...list(), c]); } else if (has) write(list().filter(x => x !== c));
          return want;
        },
      };
    },
  };
  return e;
}

function buildWorld(variantId) {
  CANVASES = [];
  const ids = {};
  const get = (i) => ids[i] || (ids[i] = mkNode(i === 'rain' ? 'canvas' : 'div'));
  ['stage', 'term', 'rain', 'wall', 'hearts', 'glitch', 'dim', 'bsod', 'bsodtext', 'cursor',
    'clock', 'gate', 'ended', 'cards', 'reload', 'task', 'tray', 'start', 'icons', 'wins',
    'blood', 'bloodfx', 'horrorbox'].forEach(get);
  const stage = get('stage'), term = get('term'), wins = get('wins'), hearts = get('hearts');
  const bsod = get('bsod'), cursor = get('cursor'), ended = get('ended'), gate = get('gate');
  const clock = get('clock'), wall = get('wall');

  const docH = {};
  let created = 0;
  const document = {
    readyState: 'loading',
    getElementById: get,
    createElement: (t) => mkNode(t, ++created),
    addEventListener: (t, f) => { (docH[t] = docH[t] || []).push(f); },
    fullscreenElement: null,
    exitFullscreen: () => Promise.resolve(),
  };

  const rafQ = [];
  const audio = { calls: [] };
  const gainStub = () => ({ gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} } });
  class FakeAC {
    constructor() { this.currentTime = 0; this.destination = {}; }
    createOscillator() {
      const o = { type: '', frequency: { value: 0 }, _g: null };
      o.connect = (n) => { o._g = n; return n; };
      o.start = () => { audio.calls.push(['osc', o.type, o.frequency.value]); };
      o.stop = () => {};
      return o;
    }
    createGain() {
      const g = gainStub();
      g.gain.setValueAtTime = (v) => { audio.calls.push(['gain', v]); };
      g.gain.exponentialRampToValueAtTime = () => {};
      g.connect = (n) => n;
      return g;
    }
    createBuffer(ch, len) {
      return { length: len, sampleRate: 48000, getChannelData: () => new Float32Array(len) };
    }
    createBufferSource() {
      return { buffer: null, connect(n) { return n; }, start() { audio.calls.push(['noise']); } };
    }
    createBiquadFilter() {
      return { type: '', frequency: { value: 0 }, connect(n) { return n; } };
    }
  }

  const winObj = {
    addEventListener: (t, f) => { (docH[t] = docH[t] || []).push(f); },
    innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1,
    requestAnimationFrame: (cb) => { rafQ.push(cb); return rafQ.length; },
    cancelAnimationFrame: () => {},
    matchMedia: () => ({ matches: false }),
    AudioContext: FakeAC,
    SIM: undefined,
  };

  const sandbox = vm.createContext({
    document, window: winObj, console,
    requestAnimationFrame: winObj.requestAnimationFrame,
    cancelAnimationFrame: () => {},
    devicePixelRatio: 1, innerWidth: 1440, innerHeight: 900,
    performance: { now: () => 0 },
    location: { reload() { sandbox.__reloaded = true; } },
    AudioContext: FakeAC,
    Float32Array, Math, Date, JSON, String, Number, Array, Object, Set, Promise, Error, RegExp, Boolean,
  });
  sandbox.globalThis = sandbox;

  const loadErr = [];
  try { vm.runInContext(source, sandbox, { filename: 'bundle.js' }); }
  catch (e) { loadErr.push('LOAD: ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]); }

  (docH.DOMContentLoaded || []).forEach(f => { try { f(); } catch (e) { loadErr.push('DCL: ' + e.message); } });

  const SIM = winObj.SIM;
  const found = SIM ? SIM.VARIANTS.find(v => v.id === variantId) : null;
  return { SIM, stage, term, wins, hearts, bsod, cursor, ended, gate, clock, wall, ids, document, winObj, loadErr, variant: found, rafQ, sandbox, audio, handlers: docH };
}

const FRAME = 1000 / 60;

function drive(id, opts) {
  const w = buildWorld(id);
  const out = { id, errors: [...w.loadErr], phasesRun: [], notes: [] };
  if (!w.variant) { out.errors.push('variant ' + id + ' not registered'); return out; }
  if (!w.SIM) { out.errors.push('SIM global missing'); return out; }

  const v = w.variant;
  out.label = v.label + ' [' + v.year + '] era=' + v.era;
  v.phases.forEach((p, i) => {
    const orig = p.setup;
    p.setup = function () {
      out.phasesRun.push(i + ':' + p.dur);
      let f;
      try { f = orig.apply(this, arguments); }
      catch (e) { out.errors.push('phase ' + i + ' setup: ' + e.message); return null; }
      if (typeof f !== 'function') return f;
      return (t) => { try { f(t); } catch (e) { out.errors.push('phase ' + i + ' frame: ' + e.message + ' @t=' + Math.round(t)); } };
    };
  });

  const total = v.phases.reduce((s, p) => s + p.dur, 0);
  const span = (total === Infinity ? total : total + 5000);
  const limit = Number.isFinite(span) ? span : 40000;

  try { w.SIM.launch(v); } catch (e) { out.errors.push('launch: ' + e.message); }
  out.cardsRendered = w.ids.cards.children.length;
  out.gateHidden = w.gate.style.display;

  let t = 0, frames = 0;
  while (t < limit) {
    t += FRAME; frames++;
    const q = w.rafQ.splice(0, w.rafQ.length);
    if (!q.length) { out.errors.push('rAF starved at frame ' + frames); break; }
    q.forEach(cb => { try { cb(t); } catch (e) { out.errors.push('tick: ' + e.message); } });
  }
  out.simSeconds = +(t / 1000).toFixed(1);
  out.windowsLive = w.wins.children.length;
  out.termRows = w.term.childElementCount;
  out.heartsBuilt = w.hearts.textContent.length > 50;
  out.clockShown = w.clock.textContent;
  out.audioCalls = w.audio.calls.length;
  out.eraClass = w.stage.className;

  const dlg = w.wins.children.find(c => /ransom|wana/.test(c.className || ''));
  const pump = (frames, from) => {
    let tt = from;
    for (let i = 0; i < frames; i++) {
      tt += FRAME;
      const q = w.rafQ.splice(0, w.rafQ.length);
      if (!q.length) break;
      q.forEach(cb => { try { cb(tt); } catch (e) { out.errors.push('pump: ' + e.message); } });
    }
    return tt;
  };
  if (dlg) {
    const btns = [];
    (function walk(n) { n.children.forEach(c => { if (c._tag === 'button') btns.push(c); walk(c); }); })(dlg);
    out.dialogButtons = btns.map(b => b.textContent);
    const msgEl = (function find(n) {
      if (/(^|\s)(r)?msg(\s|$)/.test(n.className || '')) return n;
      for (const c of n.children) { const r = find(c); if (r) return r; }
      return null;
    })(dlg);
    const byLabel = (re) => btns.find(b => re.test(b.textContent || ''));
    const submit = byLabel(/decrypt/i) || btns[0];
    out.keyAttempts = [];
    for (let i = 0; i < 3; i++) { submit.click(); out.keyAttempts.push(msgEl ? msgEl.textContent : null); }
    const pay = byLabel(/check payment/i);
    if (pay) { pay.click(); out.checkPaymentMsg = msgEl.textContent; }
    const copy = byLabel(/^copy$/i);
    if (copy) {
      copy.click();
      out.copyRightAfter = copy.textContent;
      pump(150, t);
      out.copyAfter2_5sSim = copy.textContent;
    }
    const leds = [];
    (function walk2(n) { if ((n.className || '').includes('lednum')) leds.push(n); n.children.forEach(walk2); })(dlg);
    out.ledInitial = leds.map(l => l.textContent);
    pump(240, t);
    out.ledAfter4sSim = leds.map(l => l.textContent);
    const band = (function fb(n) {
      if ((n.className || '').split(' ').includes('band')) return n;
      for (const c of n.children) { const r = fb(c); if (r) return r; }
      return null;
    })(dlg);
    out.band = band ? band.textContent : null;
    const heads = [];
    (function wk(n) { if (n._tag === 'h5') heads.push(n.textContent); n.children.forEach(wk); })(dlg);
    out.noteHeadings = heads;
    const addrBox = (function fa(n) {
      if ((n.className || '').split(' ').includes('addr')) return n.textContent;
      for (const c of n.children) { const r = fa(c); if (r) return r; }
      return null;
    })(dlg);
    out.addressBox = addrBox;
  }
  out.wallpaperPainted = String(w.wall.className || '').includes('wana') && w.hearts.textContent.length > 20;
  out.wallpaperFirstLine = w.hearts.textContent.split('\n')[0];
  out.bloodLevel = w.SIM.bloodLevel();
  out.bloodOpacity = w.ids.blood.style.opacity;
  out.horrorOn = w.SIM.isHorror();
  out.bsodRed = String(w.bsod.className || '').includes('red') || 'not-toggled';

  const bsodLive = w.bsod.style.display === 'block';
  out.bsodOnAtEnd = bsodLive;
  return out;
}

function escTest(id) {
  const w = buildWorld(id);
  const v = w.variant;
  try { w.SIM.launch(v); } catch (e) { return { id, err: 'launch failed' }; }
  let t = 0;
  const half = Math.min(8000, v.phases.reduce((s, p) => s + p.dur, 0) / 2);
  let at1s = null;
  while (t < half) {
    t += FRAME;
    const q = w.rafQ.splice(0, w.rafQ.length);
    if (!q.length) break;
    q.forEach(cb => cb(t));
    if (!at1s && t >= 1000) at1s = { wins: w.wins.children.length, term: w.term.childElementCount };
  }
  const mid = { wins: w.wins.children.length, term: w.term.childElementCount };
  const runningControl = (at1s.wins !== mid.wins || at1s.term !== mid.term);
  const kd = w.handlers.keydown || [];
  const fire = (key) => kd.forEach(f => f({ key, preventDefault() {}, target: { tagName: 'BODY' } }));
  fire('m');
  const mutedFirst = w.SIM.isMuted();
  fire('m');
  const mutedSecond = w.SIM.isMuted();
  const bloodBeforeH = w.SIM.bloodLevel();
  fire('h');
  const horrorOff = w.SIM.isHorror();
  const bloodOpacityOff = w.ids.blood.style.opacity;
  const bsodClassOff = w.bsod.className;
  fire('h');
  const horrorBack = w.SIM.isHorror();
  fire('Escape');
  const stateAfterStop = { wins: w.wins.children.length, term: w.term.childElementCount };
  let t2 = t;
  let pumped = 0;
  for (let i = 0; i < 900; i++) {
    t2 += FRAME;
    const q = w.rafQ.splice(0, w.rafQ.length);
    if (!q.length) break;
    pumped++;
    q.forEach(cb => { try { cb(t2); } catch (e) {} });
  }
  return {
    id,
    escapeHandlerCount: kd.length,
    muteToggles: mutedFirst + ' -> ' + mutedSecond,
    horrorToggle: 'blood@' + bloodBeforeH + ' -> off:' + horrorOff + ' opacity:' + bloodOpacityOff + ' -> on:' + horrorBack,
    bsodClassWhenHorrorOff: bsodClassOff || '(empty)',
    endedShown: w.ended.style.display,
    stateAtStop: mid,
    runningControlAt1s: at1s,
    simWasProgressing: runningControl,
    framesPumpedAfterEsc: pumped,
    stateAfterStop,
    stateAfter15MoreSimSeconds: { wins: w.wins.children.length, term: w.term.childElementCount },
    bsodCleared: w.bsod.style.display === 'none',
    heartsCleared: w.wall.style.opacity === '0',
    cursorHidden: w.cursor.style.opacity === '0',
    realCursorRestored: !String(w.stage.className).includes('nocursor'),
    transformCleared: w.stage.style.transform === '',
  };
}

const results = ['pipe', 'worm2000', 'ransom2017'].map(id => drive(id));
console.log('======== variant drives (60fps synthetic clock) ========');
for (const r of results) {
  console.log('\n### ' + r.id + '  ' + r.label);
  console.log('  gate cards rendered : ' + r.cardsRendered + '   gate display after launch: ' + r.gateHidden);
  console.log('  era class           : ' + r.eraClass);
  console.log('  phases entered      : ' + r.phasesRun.length + ' [' + r.phasesRun.join(', ') + ']');
  console.log('  sim seconds pumped  : ' + r.simSeconds);
  console.log('  live windows        : ' + r.windowsLive + '   terminal rows: ' + r.termRows + '   taskbar clock: ' + r.clockShown);
  console.log('  heart field built   : ' + r.heartsBuilt + '   oscillator calls: ' + r.audioCalls);
  console.log('  errors              : ' + (r.errors.length ? '\n     ' + r.errors.join('\n     ') : 'NONE'));
  if (r.dialogButtons) {
    console.log('  band                : ' + r.band);
    console.log('  note headings       : ' + JSON.stringify(r.noteHeadings));
    console.log('  dialog buttons      : ' + JSON.stringify(r.dialogButtons));
    console.log('  key attempts        : ' + JSON.stringify(r.keyAttempts));
    if (r.checkPaymentMsg) console.log('  Check Payment msg   : ' + r.checkPaymentMsg);
    if (r.copyRightAfter) console.log('  Copy button         : "' + r.copyRightAfter + '" -> "' + r.copyAfter2_5sSim + '" (clock-driven revert)');
    console.log('  LED counters        : ' + JSON.stringify(r.ledInitial) + ' -> ' + JSON.stringify(r.ledAfter4sSim));
    console.log('  address box         : ' + r.addressBox);
  }
  console.log('  wallpaper takeover  : ' + r.wallpaperPainted + '  first line: ' + JSON.stringify(r.wallpaperFirstLine));
  console.log('  blood / horror      : level ' + r.bloodLevel + '  layer opacity ' + r.bloodOpacity + '  horror ' + r.horrorOn);
}
console.log('\n======== ESC teardown per variant ========');for (const id of ['pipe', 'worm2000', 'ransom2017']) {
  const e = escTest(id);
  console.log('\n### ' + id);
  console.log('  ' + JSON.stringify(e, null, 2).replace(/\n/g, '\n  '));
}

console.log('\n======== blood droplet physics (recorded canvas draw calls) ========');
{
  const w = buildWorld('ransom2017');
  try { w.SIM.launch(w.variant); } catch (e) { console.log('  launch failed: ' + e.message); }
  const main = w.ids.bloodfx._ctx;
  const layerNode = CANVASES.find(c => c !== w.ids.bloodfx && c !== w.ids.rain && c._tag === 'canvas');
  const layer = layerNode && layerNode._ctx;
  const count = (c, op, pred) => (c ? c.ops : []).filter(o => o.op === op && (!pred || pred(o.a))).length;
  let t = 0;
  const pump = (n) => {
    for (let i = 0; i < n; i++) {
      t += FRAME;
      const q = w.rafQ.splice(0, w.rafQ.length);
      if (!q.length) break;
      q.forEach(cb => cb(t));
    }
  };
  const maxY = (c) => {
    let m = 0;
    for (const o of (c ? c.ops : [])) if (o.op === 'arc' || o.op === 'ellipse') m = Math.max(m, o.a[1] || 0);
    return Math.round(m);
  };

  pump(1200);
  console.log('  sim pumped to         : ' + (t / 1000).toFixed(1) + 's (dialog holds from 13.4s)  level ' + w.SIM.bloodLevel());
  console.log('  offscreen stain layer : ' + (layerNode ? 'found (' + layerNode._tag + ')' : 'NOT FOUND'));
  console.log('  blobs painted         : ' + count(layer, 'closePath') + '   spatter ellipses: ' + count(layer, 'ellipse'));
  console.log('  composites so far     : ' + count(main, 'drawImage') + '   drips that reached bottom: maxY ' + maxY(main));
  const window_ = (n) => { const a = count(main, 'arc'); pump(n); return count(main, 'arc') - a; };
  const w1 = window_(60), w2 = window_(60), w3 = window_(60);
  console.log('  arc ops per 60 frames : ' + w1 + ' / ' + w2 + ' / ' + w3 +
    (w3 === 0 ? '   => fully settled, zero steady-state cost'
      : w3 <= w1 * 1.05 ? '   => plateaued at ~' + Math.round(w3 / 60) + '/frame'
        : '   => STILL GROWING (perf risk on the infinite hold)'));
  const arcPre = count(main, 'arc');
  w.SIM.blood(1);
  pump(30);
  console.log('  re-awaken on level 1  : arcs +' + (count(main, 'arc') - arcPre) +
    ((count(main, 'arc') - arcPre) > 0 ? '   => animation resumed' : '   => STUCK (FAIL)'));
  w.SIM.setHorror(false);
  const offPre = count(main, 'arc');
  pump(30);
  console.log('  horror OFF            : arcs +' + (count(main, 'arc') - offPre) + ', layer opacity "' + w.ids.blood.style.opacity + '"');
}

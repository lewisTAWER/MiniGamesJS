(function () {
'use strict';
const D = window.DATA;
const KEY = 'jsarena-v1';
const ROUND = 10, LIVES = 3;
const RANKS = [[0, 'Новичок'], [100, 'Стажёр'], [300, 'Джуниор'], [700, 'Мидл'], [1500, 'Сеньор'], [3000, 'Архитектор']];

/* ───────── утилиты ───────── */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const k in (attrs || {})) {
    const v = attrs[k];
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  kids.flat().forEach(x => { if (x != null && x !== false) e.append(x.nodeType ? x : document.createTextNode(x)); });
  return e;
}
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const TOKEN = /(\/\/[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(___)|\b(const|let|var|function|return|if|else|for|while|of|in|new|class|typeof|true|false|null|undefined|void)\b|(\b\d+n?(?:\.\d+)?\b)/g;
function hl(code) {
  let out = '', last = 0, m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(code))) {
    out += esc(code.slice(last, m.index));
    const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'blank' : m[4] ? 'k' : 'n';
    out += '<span class="' + cls + '">' + (cls === 'blank' ? '?' : esc(m[0])) + '</span>';
    last = m.index + m[0].length;
  }
  return out + esc(code.slice(last));
}
const codeBlock = (code, extra) => h('pre', { class: 'code' + (extra ? ' ' + extra : ''), html: '<code>' + hl(code) + '</code>' });

/* защита от бесконечных циклов в «Собери код» */
function guard(code) {
  let out = '', last = 0, m;
  const re = /\b(for|while)\s*\(/g;
  while ((m = re.exec(code))) {
    let j = m.index + m[0].length, depth = 1;
    while (j < code.length && depth > 0) { const ch = code[j]; if (ch === '(') depth++; else if (ch === ')') depth--; j++; }
    let k = j; while (k < code.length && /\s/.test(code[k])) k++;
    if (code[k] === '{') { out += code.slice(last, k + 1) + '__g();'; last = k + 1; re.lastIndex = k + 1; }
  }
  return out + code.slice(last);
}
function runOut(code) {
  const logs = []; let n = 0;
  const con = { log: (...a) => logs.push(a.map(String).join(' ')) };
  const g = () => { if (++n > 200000) throw new Error('loop'); };
  try { new Function('console', '__g', guard(code))(con, g); return logs.join('\n'); }
  catch (e) { return 'ERR'; }
}

/* ───────── хранилище ───────── */
const def = () => ({ xp: 0, streak: 0, last: '', stats: {}, seen: {}, miss: {} });
function load() { try { return Object.assign(def(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return def(); } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
let S = load();
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function liveStreak() {
  const t = ymd(new Date()), y = ymd(new Date(Date.now() - 864e5));
  return (S.last === t || S.last === y) ? S.streak : 0;
}
function rankInfo(xp) {
  let i = 0; RANKS.forEach((r, k) => { if (xp >= r[0]) i = k; });
  const nxt = RANKS[i + 1];
  const pct = nxt ? Math.round((xp - RANKS[i][0]) / (nxt[0] - RANKS[i][0]) * 100) : 100;
  return { i, name: RANKS[i][1], nxt, pct };
}

/* ───────── игры ───────── */
const GAMES = [
  { id: 'predict', icon: '🔮', title: 'Угадай вывод', desc: 'Что напечатает этот код?', color: '#2D4BFF', bank: D.predict, render: rPredict, sum: sPredict },
  { id: 'bugs', icon: '🐞', title: 'Найди баг', desc: 'Тапни по строке с ошибкой', color: '#E5484D', bank: D.bugs, render: rBugs, sum: sBugs },
  { id: 'assemble', icon: '🧩', title: 'Собери код', desc: 'Расставь строки в нужном порядке', color: '#7C3AED', bank: D.assemble, render: rAssemble, sum: sAssemble },
  { id: 'gaps', icon: '✍️', title: 'Заполни пропуск', desc: 'Выбери недостающее слово', color: '#12A594', bank: D.gaps, render: rGaps, sum: sGaps },
  { id: 'types', icon: '⚡', title: 'Тип-блиц', desc: 'Что вернёт typeof? 10 секунд на ответ', color: '#F59E0B', bank: D.types, render: rTypes, sum: sTypes }
];

function rPredict(q, area, done) {
  const opts = shuffle([q.a, ...q.w]);
  area.append(h('p', { class: 'q' }, 'Что выведет этот код?'), codeBlock(q.c));
  const list = h('div', { class: 'opts' });
  opts.forEach(o => {
    const b = h('button', { class: 'opt', type: 'button' }, o);
    b.onclick = () => {
      const ok = o === q.a;
      list.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (x.textContent === q.a) x.classList.add('ok'); });
      if (!ok) b.classList.add('no');
      done(ok, { why: q.why, answer: ok ? null : q.a });
    };
    list.append(b);
  });
  area.append(list);
}
function sPredict(q) { return [codeBlock(q.c), h('p', { html: 'Ответ: <code>' + esc(q.a.replace(/\n/g, ' ⏎ ')) + '</code>' }), h('p', {}, q.why)]; }

function rBugs(q, area, done) {
  area.append(h('p', { class: 'q' }, 'Найди строку с ошибкой', h('small', {}, 'Тапни по строке, где, по-твоему, баг')));
  const box = h('div', { class: 'lines' });
  q.lines.forEach((ln, i) => {
    const b = h('button', { class: 'line', type: 'button', 'aria-label': 'Строка ' + (i + 1) },
      h('span', { class: 'ln' }, String(i + 1)), h('code', { html: hl(ln) }));
    b.onclick = () => {
      const ok = q.bug.includes(i);
      box.querySelectorAll('.line').forEach(x => x.disabled = true);
      b.classList.add(ok ? 'ok' : 'no');
      if (!ok) box.children[q.bug[0]].classList.add('ok');
      done(ok, { why: q.why, fix: q.fix });
    };
    box.append(b);
  });
  area.append(box);
}
function sBugs(q) { return [codeBlock(q.lines.join('\n')), h('p', { html: 'Баг в строке ' + (q.bug[0] + 1) + '. Исправление: <b>' + esc(q.fix) + '</b>' }), h('p', {}, q.why)]; }

function rAssemble(q, area, done) {
  const items = q.lines.map((t, i) => ({ t, i }));
  let pool = shuffle(items);
  for (let k = 0; k < 6 && pool.every((x, i) => x.i === i); k++) pool = shuffle(items);
  let placed = [];
  const zone = h('div', { class: 'zone' }), poolEl = h('div', { class: 'pool' });
  const check = h('button', { class: 'btn', type: 'button' }, 'Проверить');
  area.append(h('p', { class: 'q' }, q.t, h('small', {}, 'Тапай строки по порядку. Тап по строке сверху вернёт её обратно.')), zone, poolEl, check);
  function draw() {
    zone.innerHTML = ''; poolEl.innerHTML = '';
    if (!placed.length) zone.append(h('div', { class: 'hint' }, 'Здесь появится твой код'));
    placed.forEach(it => { const b = h('button', { class: 'chip', type: 'button' }, it.t); b.onclick = () => { placed = placed.filter(x => x !== it); pool.push(it); draw(); }; zone.append(b); });
    pool.forEach(it => { const b = h('button', { class: 'chip', type: 'button' }, it.t); b.onclick = () => { pool = pool.filter(x => x !== it); placed.push(it); draw(); }; poolEl.append(b); });
    check.disabled = pool.length > 0;
  }
  draw();
  check.onclick = () => {
    const code = placed.map(x => x.t).join('\n');
    const ok = code === q.lines.join('\n') || runOut(code) === q.out;
    check.disabled = true;
    zone.querySelectorAll('.chip').forEach(x => x.disabled = true);
    done(ok, { why: q.why, code: ok ? null : q.lines.join('\n') });
  };
}
function sAssemble(q) { return [h('p', { class: 'q' }, q.t), codeBlock(q.lines.join('\n')), h('p', {}, q.why)]; }

function rGaps(q, area, done) {
  area.append(h('p', { class: 'q' }, q.t, h('small', {}, 'Чего не хватает в коде?')));
  const pre = codeBlock(q.c); area.append(pre);
  const blank = pre.querySelector('.blank');
  const list = h('div', { class: 'opts two' });
  shuffle(q.o).forEach(o => {
    const b = h('button', { class: 'opt center', type: 'button' }, o);
    b.onclick = () => {
      const ok = o === q.a;
      list.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (x.textContent === q.a) x.classList.add('ok'); });
      if (!ok) b.classList.add('no');
      blank.textContent = o; blank.classList.add(ok ? 'ok' : 'no');
      done(ok, { why: q.why, answer: ok ? null : q.a });
    };
    list.append(b);
  });
  area.append(list);
}
function sGaps(q) { return [h('p', { class: 'q' }, q.t), codeBlock(q.c.replace('___', q.a)), h('p', {}, q.why)]; }

const TYPES = ['string', 'number', 'boolean', 'undefined', 'object', 'function', 'symbol', 'bigint'];
function rTypes(q, area, done, X) {
  area.append(h('p', { class: 'q' }, 'Что вернёт typeof?', h('small', {}, 'Отвечай быстро — время идёт')));
  const bar = h('i'); area.append(h('div', { class: 'timer' }, bar));
  area.append(h('div', { class: 'big' }, 'typeof (' + q.e + ')'));
  const list = h('div', { class: 'opts two' });
  let over = false;
  const finish = (ok, picked, timeout) => {
    if (over) return; over = true; clearInterval(tm);
    list.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (x.textContent === q.a) x.classList.add('ok'); });
    if (picked && !ok) picked.classList.add('no');
    done(ok, { why: (timeout ? 'Время вышло. ' : '') + q.why, answer: ok ? null : q.a });
  };
  TYPES.forEach(t => {
    const b = h('button', { class: 'opt center', type: 'button' }, t);
    b.onclick = () => finish(t === q.a, b, false);
    list.append(b);
  });
  area.append(list);
  const T = 10000, t0 = performance.now();
  const tm = setInterval(() => {
    const p = 1 - (performance.now() - t0) / T;
    bar.style.width = Math.max(0, p * 100) + '%';
    if (p <= 0) finish(false, null, true);
  }, 80);
  X.cleanup = () => clearInterval(tm);
}
function sTypes(q) { return [codeBlock('typeof (' + q.e + ')'), h('p', { html: 'Ответ: <code>' + esc(q.a) + '</code>' }), h('p', {}, q.why)]; }

/* ───────── выбор вопросов ───────── */
function pick(g, n) {
  const seen = S.seen[g.id] || {}, miss = S.miss[g.id] || {};
  const pool = g.bank.map((_, i) => i), out = [];
  while (out.length < n && pool.length) {
    const w = pool.map(i => 1 / (1 + (seen[i] || 0)) + 1.5 * (miss[i] || 0));
    let r = Math.random() * w.reduce((a, b) => a + b, 0), k = 0;
    for (; k < pool.length - 1; k++) { r -= w[k]; if (r <= 0) break; }
    out.push(pool.splice(k, 1)[0]);
  }
  return out;
}

/* ───────── экраны ───────── */
const app = document.getElementById('app');
function mount(node) { app.innerHTML = ''; app.append(node); window.scrollTo(0, 0); }

function home() {
  if (X && X.cleanup) X.cleanup();
  X = null;
  const ri = rankInfo(S.xp), st = liveStreak();
  const rank = h('div', { class: 'rank' },
    h('div', { class: 'rank-top' }, h('span', { class: 'rank-name' }, ri.name), h('span', { class: 'rank-xp' }, S.xp + ' XP')),
    h('div', { class: 'meter' }, h('i', { style: 'width:' + ri.pct + '%' })),
    h('small', {}, ri.nxt ? 'До ранга «' + ri.nxt[1] + '» ещё ' + (ri.nxt[0] - S.xp) + ' XP' : 'Максимальный ранг. Ты сделал это'),
    st ? h('small', {}, '🔥 Дней подряд: ' + st) : null);
  const list = h('div', { class: 'games' }, GAMES.map(g => {
    const s = S.stats[g.id];
    const b = h('button', { class: 'game', type: 'button', style: '--a:' + g.color },
      h('span', { class: 'gi' }, g.icon),
      h('span', {}, h('div', { class: 'gt' }, g.title), h('div', { class: 'gd' }, g.desc),
        h('div', { class: 'gs' }, s ? 'Сыграно ' + s.played + ' · лучший результат ' + s.best + '/' + ROUND : 'Раунд из ' + ROUND + ' вопросов')));
    b.onclick = () => start(g);
    return b;
  }));
  const reset = h('button', { class: 'link', type: 'button' }, 'Сбросить прогресс');
  reset.onclick = () => { if (confirm('Удалить весь прогресс, XP и статистику?')) { S = def(); save(); home(); } };
  mount(h('div', { class: 'wrap' },
    h('div', { class: 'hero' }, h('h1', {}, 'JS Арена'), h('p', {}, 'Короткие игры, чтобы JavaScript засел в голове. Играй по чуть-чуть каждый день.')),
    rank, list, h('div', { class: 'foot' }, reset)));
}

let X = null;
function start(g) {
  X = { g, idx: pick(g, ROUND), i: 0, lives: LIVES, correct: 0, xp: 0, combo: 0, miss: [], answered: false, cleanup: null };
  nextQ();
}
function livesHtml() { let s = ''; for (let k = 0; k < LIVES; k++) s += k < X.lives ? '♥' : '<span class="off">♥</span>'; return s; }
function nextQ() {
  if (X.cleanup) { X.cleanup(); X.cleanup = null; }
  if (X.i >= X.idx.length || X.lives <= 0) return finish();
  X.answered = false;
  const g = X.g, q = g.bank[X.idx[X.i]];
  const x = h('button', { class: 'x', type: 'button', 'aria-label': 'Выйти в меню' }, '✕');
  x.onclick = () => { if (confirm('Выйти в меню? Раунд не сохранится.')) home(); };
  const fill = h('i', { style: 'width:' + (X.i / ROUND * 100) + '%' });
  const lives = h('div', { class: 'lives', id: 'lives', 'aria-label': 'Жизней: ' + X.lives, html: livesHtml() });
  const area = h('div', {});
  const wrap = h('div', { class: 'wrap in-game', style: '--a:' + g.color }, h('div', { class: 'bar' }, x, h('div', { class: 'prog' }, fill), lives), area);
  wrap._fill = fill;
  mount(wrap);
  g.render(q, area, (ok, info) => answer(q, ok, info, wrap), X);
}
function answer(q, ok, info, wrap) {
  if (X.answered) return;
  X.answered = true;
  if (X.cleanup) { X.cleanup(); X.cleanup = null; }
  const id = X.g.id, idx = X.idx[X.i];
  (S.seen[id] = S.seen[id] || {})[idx] = (S.seen[id][idx] || 0) + 1;
  const m = (S.miss[id] = S.miss[id] || {});
  let gain = 0;
  if (ok) { X.correct++; X.combo++; gain = 5 + (X.combo >= 3 ? 2 : 0); X.xp += gain; if (m[idx]) m[idx]--; }
  else { X.lives--; X.combo = 0; X.miss.push(q); m[idx] = (m[idx] || 0) + 1; }
  save();
  document.getElementById('lives').innerHTML = livesHtml();
  wrap._fill.style.width = ((X.i + 1) / ROUND * 100) + '%';
  const lastOne = X.i + 1 >= X.idx.length || X.lives <= 0;
  const parts = [h('h3', {}, ok ? 'Верно! +' + gain + ' XP' + (X.combo >= 3 ? ' · серия ×' + X.combo : '') : 'Не совсем')];
  if (info.answer != null) parts.push(h('p', { html: 'Правильно: <code>' + esc(String(info.answer).replace(/\n/g, ' ⏎ ')) + '</code>' }));
  if (info.fix) parts.push(h('p', { html: 'Исправление: <b>' + esc(info.fix) + '</b>' }));
  if (info.code) parts.push(h('p', {}, 'Правильный порядок:'), codeBlock(info.code));
  parts.push(h('p', {}, info.why));
  const btn = h('button', { class: 'btn', type: 'button' }, lastOne ? 'Итоги' : 'Дальше');
  btn.onclick = () => { X.i++; nextQ(); };
  const sheet = h('div', { class: 'sheet' + (ok ? '' : ' bad'), role: 'status' }, h('div', { class: 'sheet-in' }, parts, btn));
  wrap.append(sheet);
  btn.focus({ preventScroll: true });
}

function finish() {
  const g = X.g, played = X.i, perfectish = played === ROUND && X.correct >= 8;
  if (perfectish) X.xp += 5;
  const before = rankInfo(S.xp);
  S.xp += X.xp;
  const after = rankInfo(S.xp);
  const t = ymd(new Date()), y = ymd(new Date(Date.now() - 864e5));
  if (S.last !== t) { S.streak = (S.last === y) ? S.streak + 1 : 1; S.last = t; }
  const st = S.stats[g.id] || { played: 0, best: 0 };
  st.played++; st.best = Math.max(st.best, X.correct); S.stats[g.id] = st;
  save();
  const title = X.lives <= 0 ? 'Жизни закончились' : X.correct >= 9 ? 'Отличный раунд' : X.correct >= 6 ? 'Хороший раунд' : 'Есть куда расти';
  const kids = [
    h('div', { class: 'result' },
      h('h2', {}, title),
      h('div', { class: 'score' }, X.correct + '/' + ROUND),
      h('div', { class: 'gain' }, '+' + X.xp + ' XP' + (perfectish ? ' (с бонусом за раунд)' : '')),
      after.i > before.i ? h('div', { class: 'up' }, 'Новый ранг: ' + after.name) : null)
  ];
  if (X.miss.length) kids.push(h('div', { class: 'miss' }, h('h3', {}, 'Разбери ошибки'), X.miss.map(q => h('div', { class: 'mi' }, g.sum(q)))));
  const again = h('button', { class: 'btn', type: 'button' }, 'Ещё раунд');
  again.onclick = () => start(g);
  const menu = h('button', { class: 'btn alt', type: 'button' }, 'В меню');
  menu.onclick = home;
  kids.push(h('div', { class: 'acts' }, again, menu));
  mount(h('div', { class: 'wrap', style: '--a:' + g.color }, kids));
}

home();
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
})();

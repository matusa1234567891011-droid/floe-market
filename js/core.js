function h(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'style') node.style.cssText = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === '') continue;
    node.append(c instanceof Node ? c : String(c));
  }
  return node;
}

const money = n => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n) + ' ₽';
const num = n => new Intl.NumberFormat('ru-RU').format(n);
const dateFmt = t => new Date(t).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function hashStr(s) {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return x >>> 0;
}

function rng(seed) {
  let a = hashStr(String(seed));
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const between = (r, a, b) => Math.floor(a + r() * (b - a + 1));
const logBetween = (r, a, b) => Math.exp(Math.log(a) + r() * (Math.log(b) - Math.log(a)));
function nicePrice(p) {
  if (p < 100) return Math.max(1, Math.round(p));
  if (p < 1000) return Math.round(p / 10) * 10;
  if (p < 10000) return Math.round(p / 50) * 50;
  return Math.round(p / 500) * 500;
}

const ALPINE = [['#4fb3d9', '#2b7fa8'], ['#3d9e78', '#236b52'], ['#ff8a66', '#e0573a'], ['#8a7cf0', '#5a4bc7'],
  ['#f4b545', '#d98a1c'], ['#e05a8a', '#b1335f'], ['#4f7fe0', '#2f56b0'], ['#94b84a', '#66852a']];

const TILE_OVERRIDE = { 'Counter-Strike 2': 4, 'Telegram': 0, 'Roblox': 3, 'Brawl Stars': 5, 'Dota 2': 2, 'Standoff 2': 6, 'Steam': 1, 'Genshin Impact': 7 };
function tileColors(name) { return ALPINE[TILE_OVERRIDE[name] ?? hashStr('tile' + name) % ALPINE.length]; }
function tileStyle(name) {
  const [a, b] = tileColors(name);
  return `background: linear-gradient(145deg, ${a}, ${b})`;
}
function monogram(name) {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  if (/\d/.test(words[words.length - 1] || '') && words.length > 1) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
}
function icon(d) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'ico'); svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); svg.append(p);
  return svg;
}
const helpIcon = () => icon('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 16a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm1.4-5.3c-.6.4-.8.7-.8 1.2v.4h-2.2v-.6c0-1.3.7-2 1.5-2.5.6-.4 1-.7 1-1.4 0-.7-.6-1.2-1.4-1.2-.9 0-1.4.5-1.5 1.3l-2.2-.3C8 7.6 9.7 6.3 12 6.3c2.3 0 3.9 1.3 3.9 3.1 0 1.6-1 2.4-1.5 2.8z');

const gameImages = () => (typeof GAME_IMAGES !== 'undefined' ? GAME_IMAGES : {});

const gameImgSrc = (slug, big) => `img/g/${big ? 256 : 96}/${slug}.webp`;

function tile(name, size = '') {
  const slug = slugify(name);
  const color = gameImages()[slug];
  if (color) {
    return h('span', { class: 'tile has-img ' + size, style: `background:${color}`, 'aria-hidden': 'true' },
      h('img', { src: gameImgSrc(slug, size === 'lg'), alt: '', loading: 'lazy', decoding: 'async' }));
  }
  return h('span', { class: 'tile ' + size, style: tileStyle(name), 'aria-hidden': 'true' }, monogram(name));
}

const DB_KEY = 'floe-db-v1';
const db = (() => {
  let data;
  try { data = JSON.parse(localStorage.getItem(DB_KEY)); } catch (e) { data = null; }
  const d = data && data.users ? data : { users: {}, session: null, offers: [], orders: [] };
  d.chats ||= [];
  d.tickets ||= [];
  d.reviews ||= [];
  return d;
})();

window.addEventListener('storage', e => {
  if (e.key !== DB_KEY || !e.newValue) return;
  try {
    const session = db.session;
    Object.assign(db, JSON.parse(e.newValue));
    db.session = session;
    if (session && !sessionStillValid()) { db.session = null; localStorage.removeItem(SID_KEY); toast('Сеанс завершён на другом устройстве', 'info'); }
    window.onDbChange?.();
  } catch (err) {  }
});
function saveDb() {

  try { localStorage.setItem(DB_KEY, JSON.stringify({ ...db, session: null })); }
  catch (e) { toast('Не удалось сохранить данные в браузере', 'error'); }
}
db.session = null;
const currentUser = () => (db.session ? db.users[db.session] : null);

const SID_KEY = 'floe-sid';
const SESSION_TTL = 14 * 864e5;
const SESSION_IDLE = 3 * 864e5;

function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('floe-device', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('keys');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbReq(mode, fn) {
  const d = await idbOpen();
  return new Promise((res, rej) => {
    const q = fn(d.transaction('keys', mode).objectStore('keys'));
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}
async function deviceKey(create) {
  let kp = await idbReq('readonly', s => s.get('device'));
  if (!kp && create) {
    kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    await idbReq('readwrite', s => s.put(kp, 'device'));
  }
  return kp;
}
async function sha256Hex(str) {
  return bytesToHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)));
}
function deviceLabel() {
  const ua = navigator.userAgent;
  const br = /Edg\//.test(ua) ? 'Edge' : /YaBrowser/.test(ua) ? 'Яндекс Браузер' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Браузер';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${br}, ${os}` : br;
}

async function startSession(key) {
  const user = db.users[key];
  const token = bytesToHex(randomBytes(32));
  const kp = await deviceKey(true);
  const pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const now = Date.now();
  const s = { sid: bytesToHex(randomBytes(12)), tokenHash: await sha256Hex(token), pub, device: deviceLabel(), created: now, seen: now, exp: now + SESSION_TTL };
  user.sessions = (user.sessions || []).filter(x => x.exp > now).concat(s);
  localStorage.setItem(SID_KEY, JSON.stringify({ u: key, sid: s.sid, token }));
  db.session = key;
  saveDb();
  return s.sid;
}

async function restoreSession() {
  db.session = null;
  let saved;
  try { saved = JSON.parse(localStorage.getItem(SID_KEY)); } catch (e) { saved = null; }
  if (!saved) return false;
  const fail = () => { localStorage.removeItem(SID_KEY); return false; };
  const user = db.users[saved.u];
  const s = user?.sessions?.find(x => x.sid === saved.sid);
  const now = Date.now();
  if (!s || s.exp < now || now - s.seen > SESSION_IDLE) return fail();
  if (!safeEqual(await sha256Hex(saved.token || ''), s.tokenHash)) return fail();
  try {
    const kp = await deviceKey(false);
    if (!kp) return fail();
    const challenge = randomBytes(32);
    const alg = { name: 'ECDSA', hash: 'SHA-256' };
    const sig = await crypto.subtle.sign(alg, kp.privateKey, challenge);
    const pub = await crypto.subtle.importKey('jwk', s.pub, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    if (!(await crypto.subtle.verify(alg, pub, sig, challenge))) return fail();
  } catch (e) { return fail(); }
  s.seen = now;
  db.session = saved.u;
  saveDb();
  return true;
}
const currentSid = () => { try { return JSON.parse(localStorage.getItem(SID_KEY))?.sid; } catch (e) { return null; } };

function endSession(sid = currentSid()) {
  const u = currentUser();
  if (u) u.sessions = (u.sessions || []).filter(x => x.sid !== sid);
  if (sid === currentSid()) { localStorage.removeItem(SID_KEY); db.session = null; }
  saveDb();
}

function sessionStillValid() {
  const sid = currentSid(), u = currentUser();
  return !!(u && sid && u.sessions?.some(x => x.sid === sid && x.exp > Date.now()));
}

const bytesToHex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
function randomBytes(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; }

async function hashPassword(password, saltHex) {
  const salt = saltHex ? Uint8Array.from(saltHex.match(/../g).map(x => parseInt(x, 16))) : randomBytes(16);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 150000 }, key, 256);
  return { salt: bytesToHex(salt), hash: bytesToHex(bits) };
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(str) {
  let bits = 0, value = 0; const out = [];
  for (const c of str.replace(/=+$/, '').toUpperCase()) {
    const i = B32.indexOf(c); if (i < 0) continue;
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}
async function hotp(secret, counter) {
  const key = await crypto.subtle.importKey('raw', base32Decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const msg = new ArrayBuffer(8);
  const view = new DataView(msg);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const off = sig[sig.length - 1] & 15;
  const code = ((sig[off] & 127) << 24 | sig[off + 1] << 16 | sig[off + 2] << 8 | sig[off + 3]) % 1e6;
  return String(code).padStart(6, '0');
}
async function verifyTotp(secret, code) {
  const step = Math.floor(Date.now() / 30000);
  for (const d of [-1, 0, 1]) if (safeEqual(await hotp(secret, step + d), code)) return true;
  return false;
}
const newTotpSecret = () => base32Encode(randomBytes(20));

function toast(text, type = 'info', opts = {}) {
  const box = document.getElementById('toasts');
  const t = h('div', { class: `toast ${type}`, role: 'status' },
    opts.title && h('b', { text: opts.title }),
    h('span', { text }),
    opts.code && h('span', { class: 'toast-code mono', text: opts.code }));
  box.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, opts.duration || 4000);
}

const modalEl = () => document.getElementById('modal');
function openModal(content, { wide = false, onClose } = {}) {
  const m = modalEl();
  m.className = 'modal' + (wide ? ' wide' : '');
  m.replaceChildren(
    h('button', { class: 'modal-x', 'aria-label': 'Закрыть', onclick: () => closeModal() }, '×'),
    content);
  m._onClose = onClose;
  if (!m.open) m.showModal();
  const first = m.querySelector('input, select, textarea');
  if (first) setTimeout(() => first.focus(), 30);
}
function closeModal() {
  const m = modalEl();
  if (m.open) m.close();
}

const FEE = 0.05;

function addTx(user, type, amount, note, status = 'done') {
  const tx = { id: uid(), type, amount, note, status, t: Date.now() };
  user.tx.unshift(tx);
  return tx;
}

function setStatus(o, status, text) {
  o.status = status;
  o.updated = Date.now();
  o.statusAt = Date.now();
  o.messages.push({ from: 'system', text, t: Date.now() });
  if (status === 'completed') {
    const seller = db.users[o.seller.toLowerCase()];
    if (seller) {
      const net = Math.floor(o.total * (1 - FEE));
      seller.balance += net;
      addTx(seller, 'sale', net, `Продажа #${o.id} (комиссия ${FEE * 100}%)`);
    }
    const offer = db.offers.find(x => x.id === o.offerId);
    if (offer && !o.stockTaken) { offer.stock = Math.max(0, offer.stock - o.qty); o.stockTaken = true; }
  }
  saveDb();
}

function refundMoney(o, text) {
  const buyer = db.users[o.buyer.toLowerCase()];
  if (buyer) {
    buyer.balance += o.total;
    addTx(buyer, 'refund', o.total, `Возврат по заказу #${o.id}`);
  }
  setStatus(o, 'refunded', text);
}

function resolveDispute(o, winner, note) {
  if (o.status !== 'dispute' || !['buyer', 'seller'].includes(winner)) return false;
  o.resolution = { winner, note, t: Date.now() };
  const why = note ? ` Комментарий арбитра: ${note}` : '';
  if (winner === 'buyer') refundMoney(o, `Арбитраж решил спор в пользу покупателя: ${money(o.total)} вернулись на его баланс.${why}`);
  else setStatus(o, 'completed', `Арбитраж решил спор в пользу продавца: сделка завершена, деньги ушли продавцу.${why}`);
  return true;
}

const NOT_LETTER = '(?<![\\p{L}\\p{N}])';
const END_WORD = '(?![\\p{L}\\p{N}])';
const MESSENGERS = [
  [`telegram|телеграм|телег[аеиуо]|${NOT_LETTER}(тг|tg|тгк|тлг)${END_WORD}`, 'telegram'],
  [`discord|дискорд|${NOT_LETTER}(дс|ds)${END_WORD}`, 'discord'],
  ['whats ?app|вотсап|ватсап|вацап', ''],
  ['viber|вайбер', ''],
  ['skype|скайп', ''],
  [`instagram|инстаграм|${NOT_LETTER}инст[аеуы]?${END_WORD}`, ''],
  [`вконтакт|${NOT_LETTER}(вк|vk)${END_WORD}`, ''],
].map(([re, slug]) => [new RegExp(re, 'iu'), slug]);
const RISK_RULES = [
  ['ссылка', /(https?:\/\/|www\.|t\.me\/|[a-z0-9-]{2,}\.(ru|com|net|org|me|io|gg|su|xyz|shop|site|link|cc|pro|online|store|top|рф)(?![\p{L}\p{N}]))/iu],
  ['@ник', /(?<![\p{L}\p{N}_.])@[a-z0-9_][a-z0-9_.]{2,}/iu],
  ['номер телефона', /(?<!\d)(\+7|8|7)[\s\-(]*\d{3}[\s\-)]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?!\d)/],
  ['номер карты', /(?<!\d)(\d{4}[\s-]?){3}\d{4}(?!\d)|номер карты/iu],
  ['оплата мимо Floe', /(на карт[уы](?![\p{L}])|по номеру (телефона|карты)|(?<![\p{L}])(сбп|сбер\p{L}*|тинькофф?|т-банк|qiwi|киви|юmoney|юмани|ю мани|usdt|крипт\p{L}*)(?![\p{L}])|мимо (сайта|floe|гаранта|сделки)|без (гаранта|сделки|комиссии)|(оплат|заплат|переве|перевод|скин|кин|плат)\p{L}*\s+(мне\s+)?напрямую|напрямую\s+(мне|на|переводом))/iu],
];
const RISK_TIP = 'Не уходите из чата Floe и не платите напрямую: вне сделки гарант не сможет вернуть деньги.';

function chatRisk(text, game) {
  const t = String(text || '').replace(/ё/gi, 'е');
  const found = RISK_RULES.filter(([, re]) => re.test(t)).map(([name]) => name);
  if (MESSENGERS.some(([re, slug]) => slug !== game && re.test(t))) found.splice(found.includes('ссылка') ? 1 : 0, 0, 'мессенджер');
  return found;
}

function riskNote(text, game, who) {
  const found = chatRisk(text, game);
  if (!found.length) return null;
  const head = { me: 'Вы отправили: ', them: 'Осторожно: ', arb: 'Фильтр: ' }[who] || 'Осторожно: ';
  return h('p', { class: 'msg-risk' }, h('b', { text: head + found.join(', ') + '. ' }), who === 'arb' ? '' : RISK_TIP);
}

function riskHint(input, game) {
  const p = h('p', { class: 'risk-live', role: 'status', hidden: true });
  input.addEventListener('input', () => {
    const found = chatRisk(input.value, game);
    p.hidden = !found.length;
    p.textContent = found.length ? `В сообщении: ${found.join(', ')}. ${RISK_TIP}` : '';
  });
  return p;
}

function msgImage(src) {
  if (typeof src !== 'string' || !src.startsWith('data:image/jpeg;base64,')) return null;
  return h('button', { class: 'msg-img', type: 'button', 'aria-label': 'Открыть скриншот', onclick: () => openModal(h('img', { class: 'shot-full', src, alt: 'Скриншот' }), { wide: true }) },
    h('img', { src, alt: 'Скриншот' }));
}

const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const plural = (n, forms) => forms[n % 100 > 10 && n % 100 < 20 ? 2 : [2, 0, 1, 1, 1, 2, 2, 2, 2, 2][n % 10]];
const reviewsOf = name => db.reviews.filter(r => r.seller === name).sort((a, b) => b.t - a.t);
function withReviews(s) {
  const list = reviewsOf(s.name);
  if (!list.length) return s;
  const n = s.reviews + list.length;
  const sum = s.rating * s.reviews + list.reduce((x, r) => x + r.rating, 0);
  return { ...s, rating: +(sum / n).toFixed(1), reviews: n };
}

const SELLER_NAMES = ['NordTrade', 'PixelVault', 'ice_shop', 'LootHarbor', 'Kira_Store', 'blueberry', 'SteamFox', 'arctic_deals', 'MaxBoost', 'OnlyLegit',
  'GoldenPaw', 'frostbyte', 'Sasha_Games', 'TrustZone', 'nightowl', 'QuickDrop', 'RaccoonMarket', 'Vega', 'polar_bear', 'CrystalLab',
  'DenisPro', 'Mint_Shop', 'lumen', 'Harbor77', 'Glacier', 'Tundra_Store', 'Oreo', 'sky_trader', 'CobaltKey', 'Frosty'];

function demoSeller(name) {
  const r = rng('seller' + name);
  return withReviews({ name, rating: +(4.3 + r() * 0.7).toFixed(1), reviews: between(r, 12, 4800), years: between(r, 1, 6), demo: true });
}

const SPECIAL_TITLES = {
  'counter-strike-2|Скины': [['AK-47 | Redline (Field-Tested)', 900, 2500], ['AWP | Asiimov (Field-Tested)', 6000, 14000], ['M4A1-S | Printstream (Minimal Wear)', 9000, 20000],
    ['★ Karambit | Doppler (Factory New)', 60000, 140000], ['Desert Eagle | Blaze (Factory New)', 25000, 45000], ['Glock-18 | Fade (Factory New)', 90000, 160000],
    ['USP-S | Kill Confirmed (Minimal Wear)', 5000, 11000], ['AK-47 | Slate (Field-Tested)', 150, 400], ['★ Sport Gloves | Vice (Field-Tested)', 70000, 150000],
    ['AWP | Dragon Lore (Field-Tested)', 600000, 900000], ['M4A4 | Howl (Minimal Wear)', 350000, 500000], ['★ Butterfly Knife | Fade (Factory New)', 150000, 260000]],
  'counter-strike-2|Кейсы': [['Kilowatt Case', 60, 110], ['Revolution Case', 90, 160], ['Dreams & Nightmares Case', 120, 200], ['Fracture Case', 40, 80], ['Recoil Case', 50, 90], ['Gallery Case', 70, 130], ['Operation Bravo Case', 4500, 7000]],
  'counter-strike-2|Prime': [['Prime-статус · на ваш аккаунт', 1100, 1500], ['Аккаунт с Prime · 0 часов', 1200, 1700], ['Prime · гифтом в Steam', 1150, 1450]],
  'counter-strike-2|Буст': [['Буст Premier до 15 000', 900, 1800], ['Буст Premier 15 000 → 20 000', 2500, 4500], ['FACEIT 3 → 10 lvl', 3500, 7000], ['Калибровка Premier', 1200, 2400]],
  'dota-2|Предметы': [['Arcana: Manifold Paradox (Phantom Assassin)', 2200, 3200], ['Arcana: Demon Eater (Shadow Fiend)', 2600, 3600], ['Arcana: Feast of Abscession (Pudge)', 2300, 3300],
    ['Arcana: Bladeform Legacy (Juggernaut)', 2000, 2900], ['Arcana: Fractal Horns of Inner Abysm (Terrorblade)', 2100, 3000], ['Dragonclaw Hook', 45000, 90000], ['Persona: Anti-Mage', 1400, 2200], ['Golden Basher Blades', 5000, 11000]],
  'dota-2|Буст MMR': [['+1000 MMR · Divine → Immortal', 6000, 11000], ['+500 MMR · любой ранг', 1500, 3500], ['Буст MMR · party, вы играете с бустером', 2000, 4000], ['Rank Legend → Ancient', 2500, 4800]],
  'rust|Предметы': [['Tempered AK47', 3500, 7000], ['Alien Red AK47', 2500, 5000], ['Big Grin Mask', 6000, 12000], ['No Mercy AK47', 1200, 2400], ['Punishment Mask', 5000, 9000], ['Glory AK47', 9000, 16000], ['Whiteout Kilt', 2000, 4000]],
  'roblox|Робуксы': [['400 Robux · через геймпасс', 380, 460], ['800 Robux · через геймпасс', 720, 880], ['1 700 Robux · официально', 1500, 1800], ['4 500 Robux · оптом', 3700, 4400], ['10 000 Robux · оптом', 7900, 9500]],
  'roblox|Blox Fruits': [['Kitsune — фрукт', 1400, 2400], ['Dragon — фрукт', 1800, 3000], ['Leopard — фрукт', 900, 1700], ['Dough — фрукт', 450, 900], ['Permanent Buddha', 1200, 2200], ['Аккаунт Max Level 2800 · Race V4', 700, 1900], ['Gamepass 2x Mastery', 300, 550]],
  'roblox|Adopt Me': [['Shadow Dragon (MFR)', 9000, 18000], ['Frost Dragon (NFR)', 2500, 5000], ['Bat Dragon (FR)', 3000, 6000], ['Giraffe (FR)', 1800, 3500], ['Owl (Neon)', 1200, 2400], ['Parrot (FR)', 900, 1800]],
  'roblox|Grow a Garden': [['Raccoon', 350, 900], ['Disco Bee', 800, 1600], ['Queen Bee', 300, 700], ['Dragonfly', 250, 600], ['Kitsune', 500, 1200], ['Candy Blossom — семена ×10', 120, 300]],
  'roblox|Murder Mystery 2': [['Chroma Seer', 900, 1800], ['Harvester', 500, 1100], ['Icebreaker', 300, 700], ['Corrupt', 250, 600], ['Gingerscope', 400, 900], ['Набор годли ×5', 350, 800]],
  'roblox|Steal a Brainrot': [['Strawberry Elephant', 1500, 3500], ['La Vacca Saturno Saturnita', 600, 1400], ['Dragon Cannelloni', 900, 2200], ['Garama and Madundung', 1200, 2600], ['Los Tralaleritos', 400, 1000]],
  'roblox|Pet Simulator 99': [['Huge Hell Rock', 1800, 3500], ['Titanic Cat', 6000, 12000], ['Huge Pixel Corgi', 700, 1500], ['Diamonds · 100M', 150, 350]],
  'brawl-stars|Гемы': [['30 гемов', 150, 220], ['80 гемов', 380, 520], ['170 гемов', 780, 1000], ['360 гемов', 1500, 1950], ['950 гемов', 3700, 4700], ['2 000 гемов', 7400, 9200]],
  'brawl-stars|Brawl Pass': [['Brawl Pass · текущий сезон', 550, 750], ['Brawl Pass Plus · текущий сезон', 850, 1150], ['Brawl Pass + 10 уровней', 900, 1200]],
  'brawl-stars|Буст кубков': [['+500 кубков на персонаже', 300, 700], ['+1 000 кубков', 700, 1400], ['Персонаж на 1 000 кубков', 900, 1800]],
  'standoff-2|Золото': [['100 G', 90, 130], ['500 G', 420, 560], ['1 000 G', 820, 1050], ['3 000 G', 2400, 3000], ['10 000 G', 7800, 9500]],
  'standoff-2|Предметы': [['Karambit «Gold»', 6000, 11000], ['Butterfly «Dragon Glass»', 4500, 8000], ['AKR «Treasure Hunter»', 900, 1800], ['M9 Bayonet «Scratch»', 2200, 4000], ['AWM «Genesis»', 1500, 3000], ['Flip Knife «Frozen»', 1800, 3200]],
  'pubg-mobile|UC': [['60 UC', 80, 110], ['325 UC', 380, 480], ['660 UC', 760, 950], ['1 800 UC', 1950, 2400], ['3 850 UC', 3900, 4700], ['8 100 UC', 7800, 9400]],
  'genshin-impact|Кристаллы сотворения': [['60 кристаллов', 80, 110], ['300 + 30 кристаллов', 380, 480], ['980 + 110 кристаллов', 1150, 1400], ['1 980 + 260 кристаллов', 2300, 2800], ['3 280 + 600 кристаллов', 3800, 4500], ['6 480 + 1 600 кристаллов', 7400, 8900]],
  'genshin-impact|Луна': [['Благословение полой луны · 30 дней', 330, 420], ['Благословение полой луны ×2', 650, 820]],
  'fortnite|В-баксы': [['1 000 В-баксов', 650, 850], ['2 800 В-баксов', 1650, 2000], ['5 000 В-баксов', 2700, 3300], ['13 500 В-баксов', 6300, 7600]],
  'valorant|Points': [['475 VP', 330, 420], ['1 000 VP', 680, 820], ['2 050 VP', 1350, 1650], ['3 650 VP', 2350, 2800], ['5 350 VP', 3400, 4000], ['11 000 VP', 6800, 8000]],
  'clash-royale|Гемы': [['80 гемов', 90, 130], ['500 гемов', 450, 580], ['1 200 гемов', 950, 1200], ['2 500 гемов', 1900, 2350], ['6 500 гемов', 4600, 5600]],
  'clash-of-clans|Гемы': [['80 гемов', 90, 130], ['500 гемов', 450, 580], ['1 200 гемов', 950, 1200], ['2 500 гемов', 1900, 2350], ['14 000 гемов', 9000, 11000]],
  'free-fire|Алмазы': [['100 алмазов', 90, 120], ['310 алмазов', 250, 320], ['520 алмазов', 400, 500], ['1 060 алмазов', 780, 950], ['2 180 алмазов', 1550, 1850]],
  'mobile-legends|Алмазы': [['86 алмазов', 120, 160], ['172 алмаза', 230, 300], ['257 алмазов', 340, 430], ['706 алмазов', 900, 1100], ['2 195 алмазов', 2700, 3200]],
  'escape-from-tarkov|Рубли': [['10 млн ₽ · PvP', 450, 800], ['50 млн ₽ · PvP', 1900, 3200], ['100 млн ₽ · PvE', 900, 1600]],
  'gta-5-rp|Вирты': [['1 000 000 вирт · Downtown', 90, 160], ['5 000 000 вирт · Strawberry', 400, 700], ['10 000 000 вирт · Vinewood', 800, 1300], ['500 000 вирт · Rockford', 50, 90]],
  'majestic-rp|Вирты': [['1 000 000 · Seattle', 80, 150], ['5 000 000 · Detroit', 380, 650], ['10 000 000 · Houston', 750, 1250]],
  'black-russia|Вирты': [['1 000 000 · сервер Red', 30, 60], ['10 000 000 · сервер Moscow', 250, 450], ['50 000 000 · любой сервер', 1100, 1900]],
  'telegram|Подарки': [['Plush Pepe #{k}', 150000, 900000], ['Durov\'s Cap #{k}', 40000, 160000], ['Signet Ring #{k}', 12000, 40000], ['Homemade Cake #{k}', 400, 1500],
    ['Lol Pop #{k}', 350, 1200], ['Swiss Watch #{k}', 9000, 26000], ['Jelly Bunny #{k}', 1200, 4000], ['Precious Peach #{k}', 25000, 70000], ['Eternal Rose #{k}', 6000, 18000], ['Loot Bag #{k}', 12000, 35000]],
  'telegram|Юзернеймы': [['@frostline', 18000, 40000], ['@nordic', 60000, 150000], ['@pixelbay', 9000, 25000], ['@orbitx', 30000, 80000], ['@bluewave', 22000, 60000], ['@lumen', 90000, 250000], ['@deltashop', 7000, 16000]],
  'telegram|Premium': [['Telegram Premium · 1 месяц, подарком', 250, 400], ['Telegram Premium · 3 месяца, вход не нужен', 900, 1300], ['Telegram Premium · 6 месяцев', 1600, 2200], ['Telegram Premium · 12 месяцев, на ваш аккаунт', 2600, 3600]],
  'telegram|Звёзды': [['50 звёзд · по юзернейму', 70, 95], ['100 звёзд · по юзернейму', 140, 180], ['500 звёзд · за 5 минут', 680, 850], ['1 000 звёзд · официально через Fragment', 1350, 1700], ['2 500 звёзд · оптом', 3300, 4100], ['10 000 звёзд · оптом', 13000, 16000]],
  'telegram|Каналы': [['Канал о играх · 12 000 подписчиков', 15000, 40000], ['Канал с мемами · 3 500 подписчиков', 4000, 9000], ['Новостной канал · 50 000 подписчиков', 60000, 150000]],
  'steam|Пополнение': [['Пополнение Steam · 500 ₽ (РФ)', 540, 590], ['Пополнение Steam · 1 000 ₽ (РФ)', 1060, 1150], ['Пополнение Steam · 5 000 ₽ (РФ)', 5200, 5600], ['Пополнение Steam · $10 (KZ/USD)', 1000, 1200]],
  'steam|Смена региона': [['Смена региона Steam на Казахстан', 300, 700], ['Смена региона на Турцию', 400, 900]],
  'discord|Nitro': [['Discord Nitro · 1 месяц, подарком', 350, 550], ['Discord Nitro · 12 месяцев', 3200, 4500], ['Nitro Basic · 1 месяц', 150, 260]],
};

const FAMILIES = [
  ['account', /аккаунт|каналы/i, [300, 12000], ['Аккаунт {g} · полный доступ, родная почта', 'Прокачанный аккаунт · {h} ч. в игре', 'Стартовый аккаунт {g} · смена всех данных', 'Аккаунт с редкими предметами · гарантия 14 дней', 'Основной аккаунт · много контента, без банов']],
  ['boost', /буст|калибров|обучен|помощь|сопровожд|рейд|подземел|прокачк|фарм|квест|достижен|отмыв|лбз|pvp|pve|исследован|босс|вылазк|квалификац|репутац|популярн|metro royale|dmz/i, [400, 6000], ['{s} · вручную, без читов', '{s} с трансляцией процесса', '{s} за {d} дн. · опытный игрок', '{s} — любой сервер, быстрый старт']],
  ['sub', /premium|nitro|plus|подписк|pass|пропуск|prime|премиум|turbo|тайм карт|switch online|^super$|^pro$|dota\+|vip|game pass/i, [149, 4500], ['{g} {s} · 1 месяц', '{g} {s} · 3 месяца', '{g} {s} · 12 месяцев, на ваш аккаунт', '{g} {s} · подарком, вход не нужен']],
  ['keys', /ключ|гифт|gifts|подарочн|пополн|лиценз|^игры$|eshop|активац|бонус-код|промокод|бумажник|донат|^подарки$|карточки/i, [100, 6000], ['{s} · номинал {n} ₽', '{s} — регион Россия и СНГ', '{s} · моментальная выдача', '{s} для любого региона']],
  ['cur', /валют|золот|монет|coins|гем|алмаз|^uc$|^cp$|робукс|robux|v-bucks|в-бакс|кристалл|points|кредит|платин|серебр|адена|юан|руны|рубл|деньги|вирты|осколк|токены|гранул|самоцвет|спины|кубики|isk|plex|^гил$|мезо|люсент|кроны|атомы|бакс|маммот|эоликс|кэш|орундум|пироксен|биокап|конфет|a-коин|wild cores|fc points|^vc$|riot points|^rp$|дублон|сталь|облигац|свеч|монохром|звёзд|звезд|bits|minecoins|сферы|рунические|штрих|фонд/i],
  ['other', /услуг|сервер|инвайт|смена региона|гайд|билд|конфиг|аддон|привязк|клан|професси|studio|прочее|прочие|расстановк|стикер/i, [150, 5000], ['{s} · {g}', '{s} под ключ', '{s} — индивидуально, обсудим в чате', '{s}: быстро и аккуратно']],
  ['items', /./, [30, 25000], ['{s}: редкий экземпляр', 'Набор «{adj}» — {q} шт.', '{s} на выбор из инвентаря', 'Легендарный предмет · быстрая передача', 'Коллекция из {q} предметов']],
];
const CURRENCY_AMOUNTS = [100, 250, 500, 1000, 2500, 5000, 10000];
const ADJ = ['Старт', 'Коллекционер', 'Тёмная ночь', 'Неон', 'Классика', 'Ледник'];

function fillTpl(tpl, r, game, section) {
  return tpl.replace(/\{g\}/g, game.name).replace(/\{s\}/g, section)
    .replace(/\{h\}/g, () => num(between(r, 80, 3500))).replace(/\{d\}/g, () => between(r, 1, 5))
    .replace(/\{k4\}/g, () => String(between(r, 1000, 9999))).replace(/\{k\}/g, () => between(r, 2, 40000)).replace(/\{q\}/g, () => between(r, 2, 30))
    .replace(/\{n\}/g, () => num(pick(r, [500, 1000, 2000, 5000]))).replace(/\{adj\}/g, () => pick(r, ADJ));
}

function demoOffers(game, section) {
  const r = rng(game.slug + '|' + section);
  const count = between(r, 7, 16);
  const special = SPECIAL_TITLES[game.slug + '|' + section];
  const family = FAMILIES.find(f => f[1].test(section));
  const rate = logBetween(r, 0.4, 6);
  const offers = [];

  const list = special || family[3] || [];
  const order = list.map((_, i) => i).sort(() => r() - .5);
  const nth = i => list[order[i % list.length]];
  for (let i = 0; i < count; i++) {
    let title, price;
    if (special) {
      const [t, a, b] = nth(i);
      title = fillTpl(t, r, game, section);
      price = logBetween(r, a, b);
    } else if (family[0] !== 'cur') {
      title = fillTpl(nth(i), r, game, section);
      price = logBetween(r, family[2][0], family[2][1]);
    } else {
      const n = pick(r, CURRENCY_AMOUNTS);
      title = `${section} · ${num(n)} шт. — ${pick(r, ['зачисление за 5 минут', 'без входа в аккаунт', 'оптом дешевле', 'с гарантией'])}`;
      price = n * rate * (0.85 + r() * 0.3) / 4;
    }
    const auto = r() < 0.45;
    offers.push({
      id: `d:${game.slug}:${section}:${i}`,
      game: game.slug, section, title,
      desc: pick(r, ['Работаю честно, отвечаю быстро. После покупки напишите в чат сделки.', 'Всё проверено, гарантия. Пишите — помогу разобраться.', 'Выдача в порядке очереди, обычно быстрее указанного времени.', 'Делаю аккуратно и без риска для вашего аккаунта.']),
      price: nicePrice(price),
      stock: between(r, 1, r() < 0.3 ? 3 : 120),
      auto,
      delivery: auto ? 'Моментально' : pick(r, ['5–15 мин', 'до 30 мин', 'до 1 часа', 'до 3 часов']),
      online: r() < 0.65,
      seller: demoSeller(pick(r, SELLER_NAMES)),
    });
  }
  return offers;
}

function offersFor(game, section) {
  const own = db.offers.filter(o => o.game === game.slug && o.section === section && o.stock > 0)
    .map(o => ({ ...o, seller: sellerOf(o.owner) }));
  return [...own, ...demoOffers(game, section)];
}
function sellerOf(username) {
  return withReviews({ name: username, rating: 5, reviews: 0, years: 0, own: true });
}
function findOffer(id) {
  if (id.startsWith('d:')) {

    const [, slug, ...rest] = id.split(':');
    const section = rest.slice(0, -1).join(':');
    const game = CATALOG_BY_SLUG[slug];
    return game ? demoOffers(game, section).find(o => o.id === id) : null;
  }
  const o = db.offers.find(x => x.id === id);
  return o ? { ...o, seller: sellerOf(o.owner) } : null;
}
function countOffers(game) {
  return game.sections.reduce((s, sec) => s + offersFor(game, sec).length, 0);
}

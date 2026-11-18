const DEAL_DAYS = 3;
const DEAL_MS = DEAL_DAYS * 864e5;
const POPULAR = ['counter-strike-2', 'telegram', 'roblox', 'brawl-stars', 'dota-2', 'standoff-2', 'steam', 'genshin-impact',
  'minecraft', 'rust', 'pubg-mobile', 'valorant', 'fortnite', 'discord', 'clash-royale', 'grand-theft-auto-v'];
const STATUS = {
  paid: ['Оплачен · деньги заморожены', 'blue'],
  delivered: ['Товар передан', 'amber'],
  completed: ['Завершён', 'green'],
  dispute: ['Спор', 'red'],
  refunded: ['Возврат', 'gray'],
};
const secSlug = s => encodeURIComponent(s);

const MOSAIC = ['counter-strike-2', 'dota-2', 'rust', 'grand-theft-auto-v', 'red-dead-redemption-2', 'apex-legends', 'pubg-battlegrounds', 'marvel-rivals', 'helldivers-2', 'deadlock'];
const platformLabel = g => g.platforms.map(p => PLATFORMS[p]).join(' · ');

const gameOf = slug => CATALOG_BY_SLUG[slug] || { name: 'Раздел закрыт', slug, platforms: [], sections: [] };
const PLATFORM_TABS = [['all', 'Все'], ['pc', 'ПК'], ['mobile', 'Мобильные'], ['app', 'Приложения']];

const sortKey = n => n.replace(/^[^\p{L}\p{N}]+/u, '');
const scriptRank = n => (/^\d/.test(sortKey(n)) ? 0 : /^[a-z]/i.test(sortKey(n)) ? 1 : 2);
const byName = (a, b) => scriptRank(a.name) - scriptRank(b.name) || sortKey(a.name).localeCompare(sortKey(b.name), 'ru', { numeric: true, sensitivity: 'base' });
const letterOf = n => (/^\d/.test(sortKey(n)) ? '0–9' : sortKey(n)[0].toUpperCase());
const SECS_IN_CARD = 8;
const SEC_TABS_SHOWN = 14;
const openSecs = new Set();

const app = document.getElementById('app');
let lastRoute = '';

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  return { name: parts[0] || 'home', args: parts.slice(1) };
}

function render() {
  const route = parseRoute();
  const key = location.hash;
  renderHeader();
  let view;
  if (route.name === 'home') view = viewHome();
  else if (route.name === 'catalog') view = viewCatalog();
  else if (route.name === 'chats') view = viewChats(route.args[0]);
  else if (route.name === 'login') { view = viewHome(); setTimeout(() => { if (!currentUser()) authModal('login'); }, 0); }
  else if (route.name === 'g') view = viewGame(route.args[0], route.args[1]);
  else if (route.name === 'account') view = viewAccount(route.args[0] || 'wallet');
  else if (route.name === 'order') view = viewOrder(route.args[0]);
  else if (route.name === 'guarantee') view = viewGuarantee();
  else if (route.name === 'safety') view = viewSafety();
  else view = viewNotFound();
  app.replaceChildren(view);
  if (key !== lastRoute) { window.scrollTo(0, 0); lastRoute = key; }
}
window.addEventListener('hashchange', render);

function needLogin() {
  if (currentUser()) return false;
  authModal('login');
  return true;
}

function renderHeader() {
  const box = document.getElementById('headerUser');
  const u = currentUser();
  const route = parseRoute().name;
  const unread = u ? db.chats.filter(c => c.owner === u.username).reduce((s, c) => s + (c.unread || 0), 0) : 0;
  document.getElementById('headerNav').replaceChildren(
    h('a', { class: 'nav-link' + (route === 'catalog' ? ' active' : ''), href: '#/catalog' }, 'Каталог'),
    h('a', { class: 'nav-link' + (route === 'chats' ? ' active' : ''), href: '#/chats', onclick: e => { if (!u) { e.preventDefault(); authModal('login'); } } },
      'Чаты', unread > 0 && h('span', { class: 'nav-badge', text: unread })),
    h('a', { class: 'nav-link support-link', href: 'support.html' }, helpIcon(), 'Поддержка'));
  if (!u) {
    box.replaceChildren(
      h('button', { class: 'btn ghost', onclick: () => authModal('login') }, 'Войти'),
      h('button', { class: 'btn primary', onclick: () => authModal('register') }, 'Регистрация'));
    return;
  }
  box.replaceChildren(
    h('a', { class: 'balance-chip', href: '#/account/wallet', title: 'Баланс' },
      h('span', { class: 'muted', text: 'Баланс' }), h('b', { class: 'mono', text: money(u.balance) })),
    h('a', { class: 'user-chip', href: '#/account/purchases' },
      h('span', { class: 'avatar sm', text: u.username.slice(0, 2).toUpperCase() }),
      h('span', { class: 'user-name', text: u.username })));
}

function searchCatalog(query) {
  const q = normalizeText(query);
  if (!q) return [];
  const tokens = q.split(' ');
  const results = [];
  for (const g of CATALOG) {
    const words = g.search.split(' ');
    const inGame = t => words.some(w => w.startsWith(t)) || (t.length > 2 && g.search.includes(t));
    const gameHits = tokens.filter(inGame);
    if (gameHits.length === tokens.length) {
      const starts = normalizeText(g.name).startsWith(q);
      results.push({ game: g, score: (starts ? 20 : 10) + (POPULAR.includes(g.slug) ? 3 : 0) });
    }

    for (const s of g.sections) {
      const sw = normalizeText(s).split(' ');
      const inSec = t => sw.some(w => w.startsWith(t));
      if (tokens.some(inSec) && tokens.every(t => inSec(t) || inGame(t)) && gameHits.length < tokens.length) {
        results.push({ game: g, section: s, score: 8 + (gameHits.length ? 4 : 0) + (POPULAR.includes(g.slug) ? 2 : 0) });
      }
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 9);
}

function attachSearch(input, list) {
  let items = [];
  let active = -1;

  const go = it => {
    list.hidden = true;
    input.value = '';
    input.blur();
    location.hash = `#/g/${it.game.slug}` + (it.section ? `/${secSlug(it.section)}` : '');
  };

  const draw = () => {
    const q = input.value.trim();
    items = q ? searchCatalog(q) : POPULAR.slice(0, 6).map(s => ({ game: CATALOG_BY_SLUG[s] }));
    active = -1;
    const rows = items.map((it, i) => h('li', { role: 'option', onmousedown: e => { e.preventDefault(); go(it); }, 'data-i': i },
      tile(it.game.name, 'sm'),
      h('span', { class: 'res-main' },
        h('b', { text: it.game.name }),
        h('small', { text: it.section ? `Раздел · ${it.section}` : platformLabel(it.game) })),
      h('span', { class: 'res-go', 'aria-hidden': 'true' }, '→')));
    list.replaceChildren(
      h('li', { class: 'res-label', text: q ? (items.length ? 'Найдено' : 'Ничего не найдено — попробуйте иначе: «кс», «тг звёзды», «бравл»') : 'Популярное' }),
      ...rows);
    list.hidden = false;
  };

  const setActive = i => {
    const rows = list.querySelectorAll('li[role=option]');
    if (!rows.length) return;
    active = (i + rows.length) % rows.length;
    rows.forEach((r, n) => r.classList.toggle('active', n === active));
  };

  input.addEventListener('input', draw);
  input.addEventListener('focus', draw);
  input.addEventListener('blur', () => { list.hidden = true; });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter' && items.length) { e.preventDefault(); go(items[Math.max(active, 0)]); }
    else if (e.key === 'Escape') { input.blur(); }
  });
}

function gameArt(g, cls = 'art') {
  const color = gameImages()[g.slug];
  if (!color) return h('span', { class: `${cls} no-img`, style: tileStyle(g.name) }, h('span', { class: 'art-mono', text: monogram(g.name) }));
  return h('span', { class: cls, style: `background:${color}` },
    h('img', { src: gameImgSrc(g.slug, true), alt: '', loading: 'lazy', decoding: 'async', width: 256, height: 256 }));
}

function viewHome() {
  const popular = POPULAR.map(s => CATALOG_BY_SLUG[s]).filter(Boolean);
  const wideSet = new Set(typeof WIDE_IMAGES !== 'undefined' ? WIDE_IMAGES : []);
  const mosaic = MOSAIC.map(s => CATALOG_BY_SLUG[s]).filter(g => g && wideSet.has(g.slug)).slice(0, 6);
  const heroInput = h('input', { class: 'input hero-search', type: 'search', placeholder: 'Название игры или сервиса', autocomplete: 'off', 'aria-label': 'Поиск игры' });
  const heroList = h('ul', { class: 'search-results', role: 'listbox', hidden: true });
  attachSearch(heroInput, heroList);

  const index = gameIndex();

  return h('div', {},
    h('section', { class: 'container home-top' },
      h('div', { class: 'home-intro' },
        h('h1', { text: 'Игровые ценности с гарантией сделки' }),
        h('p', { class: 'lead', text: `Аккаунты, валюта, предметы и подписки для ${CATALOG.length} игр и сервисов. Продавец получает деньги после вашего подтверждения или через ${DEAL_DAYS} дня, если вы не открыли спор.` }),
        h('div', { class: 'hero-search-box' }, heroInput, heroList),
        h('p', { class: 'hint' }, 'Например: ',
          ['Telegram Звёзды', 'CS2 скины', 'Brawl Stars гемы'].map((q, i) => [i ? ', ' : '', h('button', { class: 'link plain', type: 'button', onclick: () => { heroInput.value = q; heroInput.focus(); heroInput.dispatchEvent(new Event('input')); } }, q)]))),
      h('div', { class: 'mosaic', 'aria-hidden': 'true' }, mosaic.map(g => h('a', { href: `#/g/${g.slug}`, tabindex: '-1' },
        h('img', { class: 'mosaic-art', src: `img/w/${g.slug}.webp`, alt: '', width: 600, height: 281, decoding: 'async' }))))),

    h('section', { class: 'container section-block' },
      h('div', { class: 'block-head' },
        h('h2', { text: 'Популярное' }),
        h('a', { class: 'more-link', href: '#/catalog' }, 'Каталог с фильтрами')),
      h('div', { class: 'pop-grid' }, popular.slice(0, 12).map(g =>
        h('a', { class: 'pop-card', href: `#/g/${g.slug}` },
          gameArt(g),
          h('span', { class: 'pop-body' }, h('b', { text: g.name }), h('small', { text: g.sections.slice(0, 3).join(' · ') })))))),

    h('section', { class: 'container section-block', id: 'all' },
      h('div', { class: 'block-head' }, h('h2', { text: 'Все игры и приложения' }), index.tabs),
      index.letters,
      index.list));
}

function gameCard(g) {
  const shown = g.sections.length <= SECS_IN_CARD + 2 ? g.sections : g.sections.slice(0, SECS_IN_CARD);
  const rest = g.sections.length - shown.length;
  return h('article', { class: 'game-card' },
    h('a', { class: 'game-link', href: `#/g/${g.slug}` },
      tile(g.name),
      h('span', {}, h('b', { text: g.name }), h('small', { text: platformLabel(g) }))),
    h('div', { class: 'game-secs' },
      shown.map(s => h('a', { href: `#/g/${g.slug}/${secSlug(s)}`, text: s })),
      rest > 0 && h('a', { class: 'more', href: `#/g/${g.slug}`, text: `ещё ${rest}` })));
}

function gameIndex() {
  const state = { platform: 'all', filter: '' };
  const letters = h('nav', { class: 'az-nav', 'aria-label': 'Перейти к букве' });
  const list = h('div', { class: 'az' });

  const jump = group => {

    const pinned = getComputedStyle(letters).position === 'sticky' ? letters.offsetHeight : 0;
    const top = group.getBoundingClientRect().top + window.scrollY - document.querySelector('.header').offsetHeight - pinned - 8;
    window.scrollTo({ top });
  };

  const draw = () => {
    const f = normalizeText(state.filter);
    const games = CATALOG
      .filter(g => state.platform === 'all' || g.platforms.includes(state.platform))
      .filter(g => !f || g.search.includes(f))
      .sort(byName);
    const groups = new Map();
    for (const g of games) {
      const key = letterOf(g.name);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(g);
    }
    const sections = [...groups].map(([letter, items]) => h('section', { class: 'az-group' },
      h('h3', { class: 'az-letter', text: letter }),
      h('div', { class: 'az-games' }, items.map(gameCard))));

    letters.replaceChildren(...[...groups.keys()].flatMap((letter, i, all) => [
      i && scriptRank(letter) === 2 && scriptRank(all[i - 1]) < 2 && h('span', { class: 'az-break' }),
      h('button', { class: 'az-jump', type: 'button', onclick: () => jump(sections[i]) }, letter),
    ]).filter(Boolean));
    list.replaceChildren(...(sections.length ? sections
      : [h('p', { class: 'empty', text: 'Ничего не нашлось. Попробуйте написать иначе — например, «кс» или «тг».' })]));
  };

  const tabs = h('div', { class: 'tabs', role: 'tablist' }, PLATFORM_TABS.map(([k, label]) =>
    h('button', { class: 'tab' + (k === 'all' ? ' active' : ''), role: 'tab', onclick: e => {
      state.platform = k;
      tabs.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === e.currentTarget));
      draw();
    } }, label, h('span', { class: 'tab-count', text: k === 'all' ? CATALOG.length : CATALOG.filter(g => g.platforms.includes(k)).length }))));
  draw();

  new ResizeObserver(() => {
    list.style.setProperty('--az-top', document.querySelector('.header').offsetHeight + letters.offsetHeight + 12 + 'px');
  }).observe(letters);

  return { tabs, letters, list, setFilter: v => { state.filter = v; draw(); } };
}

function viewCatalog() {
  const index = gameIndex();
  return h('div', { class: 'container page' },
    h('h1', { class: 'page-title', text: 'Все игры и приложения' }),
    h('div', { class: 'block-head' },
      index.tabs,
      h('input', { class: 'input filter', type: 'search', placeholder: 'Фильтр по названию', 'aria-label': 'Фильтр каталога',
        oninput: e => index.setFilter(e.target.value) })),
    index.letters,
    index.list);
}

function viewGame(slug, sectionArg) {
  const game = CATALOG_BY_SLUG[slug];
  if (!game) return viewNotFound();
  const section = game.sections.includes(sectionArg) ? sectionArg : game.sections[0];
  const u = currentUser();
  const state = { q: '', online: false, auto: false, sort: 'price-asc' };
  const listBox = h('div', { class: 'offers' });
  const all = offersFor(game, section);

  const drawList = () => {
    const q = normalizeText(state.q);
    let list = all.filter(o => (!state.online || o.online || o.seller.own) && (!state.auto || o.auto) && (!q || normalizeText(o.title).includes(q)));
    const sorters = {
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      rating: (a, b) => b.seller.rating - a.seller.rating || b.seller.reviews - a.seller.reviews,
    };
    list = [...list].sort((a, b) => (b.seller.own && b.seller.name === u?.username) - (a.seller.own && a.seller.name === u?.username) || sorters[state.sort](a, b));
    listBox.replaceChildren(
      h('div', { class: 'offers-head' }, h('span', { text: 'Описание' }), h('span', { text: 'Продавец' }), h('span', { text: 'Выдача' }), h('span', { text: 'Наличие' }), h('span', { class: 'right', text: 'Цена' })),
      ...(list.length ? list.map(o => offerRow(o, u)) : [h('p', { class: 'empty', text: 'По этим условиям предложений нет.' })]));
  };

  const sellBtn = u
    ? h('button', { class: 'btn primary lg sell-btn', onclick: () => sellModal(game, section) }, `Продать в ${game.name}`)
    : h('button', { class: 'btn ghost lg sell-btn', onclick: () => authModal('register') }, 'Зарегистрируйтесь, чтобы продавать');

  const secTabs = h('div', { class: 'sec-tabs' });
  const drawTabs = () => {
    const many = game.sections.length > SEC_TABS_SHOWN + 2;
    const fold = many && !openSecs.has(game.slug);
    const secs = fold ? game.sections.filter((s, i) => i < SEC_TABS_SHOWN || s === section) : game.sections;
    secTabs.replaceChildren(
      ...secs.map(s => h('a', { class: 'sec-tab' + (s === section ? ' active' : ''), href: `#/g/${game.slug}/${secSlug(s)}` },
        s, h('span', { class: 'mono', text: offersFor(game, s).length }))),
      ...(many ? [h('button', { class: 'sec-tab more', type: 'button', onclick: () => {
        if (fold) openSecs.add(game.slug); else openSecs.delete(game.slug);
        drawTabs();
      } }, fold ? `Ещё ${game.sections.length - secs.length}` : 'Свернуть')] : []));
  };

  drawList();
  drawTabs();

  return h('div', { class: 'container page' },
    h('nav', { class: 'crumbs' }, h('a', { href: '#/', text: 'Главная' }), h('span', { text: '/' }), h('span', { text: platformLabel(game) }), h('span', { text: '/' }), h('b', { text: game.name })),
    h('header', { class: 'game-head' },
      tile(game.name, 'lg'),
      h('div', { class: 'game-title' },
        h('h1', { text: game.name }),
        h('p', { class: 'muted' }, `${platformLabel(game)} · ${num(countOffers(game))} предложений`)),
      sellBtn),
    secTabs,
    h('div', { class: 'toolbar' },
      h('input', { class: 'input', type: 'search', placeholder: `Поиск в разделе «${section}»`, oninput: e => { state.q = e.target.value; drawList(); } }),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: e => { state.online = e.target.checked; drawList(); } }), 'Продавец онлайн'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: e => { state.auto = e.target.checked; drawList(); } }), 'Автовыдача'),
      h('select', { class: 'input select', 'aria-label': 'Сортировка', onchange: e => { state.sort = e.target.value; drawList(); } },
        h('option', { value: 'price-asc', text: 'Сначала дешевле' }),
        h('option', { value: 'price-desc', text: 'Сначала дороже' }),
        h('option', { value: 'rating', text: 'По рейтингу продавца' }))),
    listBox);
}

function sellerBlock(s, compact) {
  return h('span', { class: 'seller' },
    h('span', { class: 'avatar' + (s.online ? ' on' : ''), text: s.name.slice(0, 2).toUpperCase() }),
    h('span', {},
      h('b', { text: s.name }),
      h('small', { class: 'muted' }, s.own && !s.reviews ? 'Новый продавец' : `★ ${s.rating.toFixed(1)} · ${num(s.reviews)} ${plural(s.reviews, ['отзыв', 'отзыва', 'отзывов'])}`, !compact && s.years ? ` · ${s.years} г. на Floe` : '')));
}

function offerRow(o, u) {
  const mine = o.seller.own && o.seller.name === u?.username;
  return h('button', { class: 'offer' + (mine ? ' mine' : ''), onclick: () => offerModal(o) },
    h('span', { class: 'offer-title' },
      mine && h('span', { class: 'badge blue', text: 'Ваше' }),
      o.auto && h('span', { class: 'badge green', text: 'Автовыдача' }),
      h('b', { text: o.title })),
    sellerBlock({ ...o.seller, online: o.online }, true),
    h('span', { class: 'offer-cell', 'data-label': 'Выдача', text: o.delivery }),
    h('span', { class: 'offer-cell mono', 'data-label': 'В наличии', text: num(o.stock) + ' шт.' }),
    h('span', { class: 'offer-price mono', text: money(o.price) }));
}

function offerModal(o) {
  const game = CATALOG_BY_SLUG[o.game];
  const u = currentUser();
  const mine = o.seller.own && o.seller.name === u?.username;
  let qty = 1;
  const total = h('b', { class: 'mono' });
  const note = h('p', { class: 'form-note' });
  const payBtn = h('button', { class: 'btn primary lg block', type: 'button' });
  const canPay = () => u && !mine && u.balance >= o.price * qty;

  const update = () => {
    const sum = o.price * qty;
    total.textContent = money(sum);
    payBtn.textContent = !u ? 'Войти и купить' : mine ? 'Это ваше предложение' : `Оплатить ${money(sum)}`;
    payBtn.disabled = mine;
    note.replaceChildren();
    if (u && !mine && u.balance < sum) {
      note.append(`На балансе ${money(u.balance)} — не хватает ${money(sum - u.balance)}. `,
        h('button', { class: 'link', onclick: () => topupModal(Math.ceil(sum - u.balance), () => offerModal(o)) }, 'Пополнить (демо)'));
    }
  };

  let paying = false;
  payBtn.addEventListener('click', () => {
    if (paying) return;
    if (!canPay()) { if (!needLogin()) update(); return; }
    paying = true;
    payBtn.disabled = true;
    const sum = o.price * qty;
    const order = createPurchase(o, qty);
    closeModal();
    toast(`${money(sum)} лежат на гарантийном счёте до завершения сделки`, 'success', { title: 'Заказ оплачен' });
    location.hash = `#/order/${order.id}`;
  });

  const chatBtn = !mine && h('button', { class: 'btn ghost lg block', type: 'button', onclick: () => {
    if (needLogin()) return;
    closeModal();
    openChatWith(o);
  } }, 'Написать продавцу');

  const qtyInput = h('input', { class: 'input qty mono', type: 'number', min: 1, max: o.stock, value: 1, 'aria-label': 'Количество',
    oninput: e => { qty = Math.min(o.stock, Math.max(1, parseInt(e.target.value, 10) || 1)); update(); },
    onblur: e => { e.target.value = qty; } });

  update();
  openModal(h('div', { class: 'offer-modal' },
    h('p', { class: 'eyebrow' }, `${game.name} · ${o.section}`),
    h('h2', { text: o.title }),
    h('div', { class: 'om-seller' }, sellerBlock({ ...o.seller, online: o.online })),
    reviewList(o.seller.name, 2),
    h('p', { class: 'om-desc', text: o.desc }),
    h('dl', { class: 'om-info' },
      h('div', {}, h('dt', { text: 'Выдача' }), h('dd', { text: o.delivery })),
      h('div', {}, h('dt', { text: 'В наличии' }), h('dd', { class: 'mono', text: num(o.stock) + ' шт.' })),
      h('div', {}, h('dt', { text: 'Цена за шт.' }), h('dd', { class: 'mono', text: money(o.price) }))),
    h('div', { class: 'om-buy' },
      h('label', {}, 'Количество', qtyInput),
      h('div', { class: 'om-total' }, h('span', { class: 'muted', text: 'Итого' }), total)),
    h('div', { class: 'om-actions' }, payBtn, chatBtn), note,
    h('p', { class: 'guarantee' }, `Деньги попадут продавцу, когда вы подтвердите получение или через ${DEAL_DAYS} дня после передачи товара, если вы не откроете спор. Если продавец не передаст товар за ${DEAL_DAYS} дня, деньги вернутся вам. `,
      h('a', { href: '#/guarantee', onclick: () => closeModal() }, 'Как работает гарант'))));
}

const typing = new Set();

function openChatWith(o) {
  const u = currentUser();
  let chat = db.chats.find(c => c.owner === u.username && c.with === o.seller.name);
  if (!chat) {
    chat = { id: uid(), owner: u.username, with: o.seller.name, demo: !!o.seller.demo, messages: [], unread: 0, updated: Date.now() };
    db.chats.unshift(chat);
  }
  chat.offer = { id: o.id, title: o.title, game: o.game, section: o.section, price: o.price };
  saveDb();
  location.hash = `#/chats/${chat.id}`;
}

function sellerReply(chat, text) {
  const o = chat.offer && findOffer(chat.offer.id);
  const t = normalizeText(text);
  if (/налич|есть ли|остал|актуал/.test(t)) return o ? `Да, в наличии ${num(o.stock)} шт. Можно покупать.` : 'Да, всё актуально.';
  if (/врем|долго|быстр|когда|ждать|скоро/.test(t)) {
    if (!o) return 'Обычно передаю в течение получаса.';
    return o.auto ? 'Выдача автоматическая — придёт сразу после оплаты.' : `Обычно передаю ${o.delivery}. Если я онлайн — быстрее.`;
  }
  if (/скидк|дешевл|торг|уступ/.test(t)) return 'От трёх штук могу сделать −5%. Напишите, сколько нужно.';
  if (/гарант|безопас|обман|кину|честн/.test(t)) return 'Всё через сделку Floe: деньги придут мне, только если вы подтвердите получение или 3 дня не будет спора. Так что вы ничем не рискуете.';
  if (!['telegram', 'discord'].includes(chat.offer?.game) && /телег|telegram|(^| )(тг|tg|дс|вк)( |$)|дискорд|discord|ватсап|whatsapp|контакт|связат|личк|(^| )лс( |$)/.test(t)) {
    return `Можно в Telegram: @${chat.with.toLowerCase()}_shop, там отвечаю быстрее. Если оплатите напрямую на карту, сделаю скидку 10%.`;
  }
  if (/спасиб/.test(t)) return 'Пожалуйста! Если что — пишите.';
  if (/^(привет|здравств|добр|хай|ку)/.test(t)) return 'Здравствуйте! Чем могу помочь?';
  return pick(Math.random, ['Понял вас. Уточните, пожалуйста, что именно важно — отвечу подробно.', 'Да, могу помочь с этим. Что ещё хотите узнать перед покупкой?', 'Хороший вопрос. Всё по описанию, после оплаты напишу в чат заказа.']);
}

function sendChatMessage(chat, text) {
  const u = currentUser();
  chat.messages.push({ from: u.username, text, t: Date.now() });
  chat.updated = Date.now();
  saveDb();
  if (!chat.demo) return;
  setTimeout(() => { typing.add(chat.id); refreshChat(chat); }, 500);
  setTimeout(() => {
    typing.delete(chat.id);
    chat.messages.push({ from: chat.with, text: sellerReply(chat, text), t: Date.now() });
    chat.updated = Date.now();
    const viewing = location.hash === `#/chats/${chat.id}` && document.visibilityState === 'visible';
    if (!viewing) { chat.unread = (chat.unread || 0) + 1; toast(chat.messages.at(-1).text, 'info', { title: `${chat.with} ответил` }); }
    saveDb();
    refreshChat(chat);
  }, 1700 + Math.random() * 1200);
}

function refreshChat(chat) {
  if (location.hash === `#/chats/${chat.id}`) {
    const draft = document.querySelector('.chat-form input')?.value || '';
    render();
    const inp = document.querySelector('.chat-form input');
    if (inp) { inp.value = draft; inp.focus(); inp.dispatchEvent(new Event('input')); }
  } else renderHeader();
}

function viewChats(id) {
  const u = currentUser();
  if (!u) return viewAccount('purchases');
  const chats = db.chats.filter(c => c.owner === u.username).sort((a, b) => b.updated - a.updated);
  const active = chats.find(c => c.id === id);
  if (active && active.unread) { active.unread = 0; saveDb(); setTimeout(renderHeader, 0); }

  const list = h('aside', { class: 'chat-side' },
    h('h1', { class: 'page-title', text: 'Чаты' }),
    chats.length ? h('div', { class: 'chat-items' }, chats.map(c => {
      const last = c.messages.at(-1);
      return h('a', { class: 'chat-item' + (c === active ? ' active' : ''), href: `#/chats/${c.id}` },
        h('span', { class: 'avatar', text: c.with.slice(0, 2).toUpperCase() }),
        h('span', { class: 'ci-body' },
          h('b', { text: c.with }),
          h('small', { text: last ? (last.from === u.username ? 'Вы: ' : '') + last.text : c.offer?.title || 'Новый чат' })),
        c.unread > 0 && h('span', { class: 'nav-badge', text: c.unread }));
    })) : h('p', { class: 'muted chat-empty', text: 'Здесь будут ваши переписки с продавцами. Начать чат можно из любого предложения — кнопка «Написать продавцу».' }));

  if (!active) {
    return h('div', { class: 'container page chats' }, list,
      h('section', { class: 'chat-main empty-pane' },
        h('p', { text: chats.length ? 'Выберите чат слева' : 'Пока тихо. Найдите игру и спросите продавца о чём угодно до покупки.' }),
        !chats.length && h('a', { class: 'btn primary', href: '#/catalog' }, 'Перейти в каталог')));
  }

  const input = h('input', { class: 'input', placeholder: 'Например: «Есть в наличии?» или «Как быстро передадите?»', maxlength: 500, 'aria-label': 'Сообщение' });
  const msgs = h('div', { class: 'chat-list' },
    active.messages.length ? null : h('p', { class: 'msg system', text: 'Спросите продавца о чём угодно до покупки. Не переводите деньги напрямую — только через сделку Floe.' }),
    active.messages.map(m => h('div', { class: 'msg ' + (m.from === u.username ? 'me' : 'them') },
      h('p', { text: m.text }), riskNote(m.text, active.offer?.game, m.from === u.username ? 'me' : 'them'),
      h('small', { class: 'muted mono', text: dateFmt(m.t) }))),
    typing.has(active.id) && h('div', { class: 'msg them typing' }, h('span'), h('span'), h('span')));
  setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 0);
  const offer = active.offer && findOffer(active.offer.id);
  const g = active.offer && gameOf(active.offer.game);

  return h('div', { class: 'container page chats has-active' }, list,
    h('section', { class: 'chat-main' },
      h('header', { class: 'chat-top' },
        h('a', { class: 'chat-back', href: '#/chats', 'aria-label': 'Ко всем чатам' }, '←'),
        h('span', { class: 'avatar on', text: active.with.slice(0, 2).toUpperCase() }),
        h('div', {}, h('b', { text: active.with }), h('small', { class: 'muted', text: active.demo ? 'Обычно отвечает за пару минут' : 'Продавец' }))),
      offer && h('button', { class: 'chat-offer', onclick: () => offerModal(offer) },
        tile(g.name, 'sm'),
        h('span', {}, h('b', { text: offer.title }), h('small', { class: 'muted', text: `${g.name} · ${offer.section}` })),
        h('span', { class: 'mono', text: money(offer.price) })),
      msgs,
      riskHint(input, active.offer?.game),
      h('form', { class: 'chat-form', onsubmit: e => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        sendChatMessage(active, text);
        refreshChat(active);
      } }, input, h('button', { class: 'btn primary', type: 'submit' }, 'Отправить'))));
}

function createPurchase(o, qty) {
  const user = currentUser();
  const total = o.price * qty;
  if (!(qty >= 1 && qty <= o.stock) || user.balance < total) throw new Error('Недостаточно средств или неверное количество');
  user.balance -= total;
  addTx(user, 'purchase', -total, `Оплата: ${o.title}`);
  const order = {
    id: 'F-' + Math.floor(10000 + Math.random() * 89999),
    offerId: o.id, game: o.game, section: o.section, title: o.title,
    price: o.price, qty, total,
    buyer: user.username, seller: o.seller.name, sellerDemo: !!o.seller.demo,
    status: 'paid', created: Date.now(), updated: Date.now(), statusAt: Date.now(), sellerOnline: o.online !== false,
    messages: [{ from: 'system', text: `Заказ оплачен. ${money(total)} заморожено на гарантийном счёте Floe.`, t: Date.now() }],
  };
  if (order.sellerDemo && !order.sellerOnline) {
    order.messages.push({ from: 'system', text: `Продавец сейчас не в сети. Если он не передаст товар за ${DEAL_DAYS} дня, деньги автоматически вернутся вам.`, t: Date.now() });
  }
  db.orders.unshift(order);
  saveDb();
  return order;
}

function sellModal(game, section) {
  const u = currentUser();
  if (!u) return authModal('login');
  const msg = h('p', { class: 'form-msg' });
  const receive = h('b', { class: 'mono', text: money(0) });
  const form = h('form', { class: 'form', novalidate: true },
    h('label', {}, 'Раздел', h('select', { class: 'input', name: 'section' },
      game.sections.map(s => h('option', { value: s, text: s, selected: s === section })))),
    h('label', {}, 'Название предложения', h('input', { class: 'input', name: 'title', maxlength: 100, required: true, placeholder: 'Например: 1 000 звёзд · отправка за 5 минут' })),
    h('label', {}, 'Описание', h('textarea', { class: 'input', name: 'desc', rows: 3, maxlength: 600, placeholder: 'Что получит покупатель, как проходит передача, гарантии' })),
    h('div', { class: 'row2' },
      h('label', {}, 'Цена за 1 шт., ₽', h('input', { class: 'input mono', name: 'price', type: 'number', min: 10, max: 1000000, step: 1, required: true,
        oninput: e => { receive.textContent = money(Math.floor((+e.target.value || 0) * (1 - FEE))); } })),
      h('label', {}, 'Количество', h('input', { class: 'input mono', name: 'stock', type: 'number', min: 1, max: 9999, value: 1, required: true }))),
    h('label', {}, 'Время выдачи', h('select', { class: 'input', name: 'delivery' },
      ['Моментально', '5–15 мин', 'до 30 мин', 'до 1 часа', 'до 3 часов'].map(d => h('option', { text: d })))),
    h('div', { class: 'receive' }, h('span', { class: 'muted', text: `Вы получите с каждой продажи (комиссия ${FEE * 100}%)` }), receive),
    h('button', { class: 'btn primary lg block', type: 'submit' }, 'Опубликовать предложение'),
    msg);

  form.addEventListener('submit', e => {
    e.preventDefault();
    const f = form.elements;
    const title = f.title.value.trim();
    const price = Math.round(+f.price.value);
    const stock = Math.round(+f.stock.value);
    if (title.length < 5) return (msg.textContent = 'Название — минимум 5 символов.');
    if (!(price >= 10 && price <= 1000000)) return (msg.textContent = 'Цена — от 10 до 1 000 000 ₽.');
    if (!(stock >= 1 && stock <= 9999)) return (msg.textContent = 'Количество — от 1 до 9 999.');
    db.offers.unshift({
      id: uid(), owner: u.username, game: game.slug, section: f.section.value,
      title, desc: f.desc.value.trim() || 'Без описания.', price, stock,
      auto: f.delivery.value === 'Моментально', delivery: f.delivery.value, online: true, created: Date.now(),
    });
    saveDb();
    closeModal();
    toast('Предложение опубликовано', 'success');
    location.hash = `#/g/${game.slug}/${secSlug(f.section.value)}`;
    render();
  });

  openModal(h('div', {},
    h('p', { class: 'eyebrow', text: 'Новое предложение' }),
    h('h2', { text: `Продать в ${game.name}` }),
    form));
}

function authModal(mode) {
  const msg = h('p', { class: 'form-msg' });
  const isReg = mode === 'register';
  const form = h('form', { class: 'form', novalidate: true },
    h('label', {}, isReg ? 'Логин' : 'Логин или email', h('input', { class: 'input', name: 'login', autocomplete: 'username', required: true, maxlength: 40 })),
    isReg && h('label', {}, 'Email', h('input', { class: 'input', name: 'email', type: 'email', autocomplete: 'email', required: true })),
    h('label', {}, 'Пароль', h('input', { class: 'input', name: 'password', type: 'password', autocomplete: isReg ? 'new-password' : 'current-password', required: true, minlength: isReg ? 8 : null })),
    isReg && h('label', {}, 'Повторите пароль', h('input', { class: 'input', name: 'password2', type: 'password', autocomplete: 'new-password', required: true })),
    isReg && h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'rules' }), 'Принимаю правила площадки'),
    h('button', { class: 'btn primary lg block', type: 'submit' }, isReg ? 'Создать аккаунт' : 'Войти'),
    msg);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = form.elements;
    const btn = form.querySelector('button[type=submit]');
    msg.textContent = '';
    if (!window.crypto?.subtle) return (msg.textContent = 'Браузер не поддерживает шифрование. Откройте сайт в Chrome, Edge или Firefox.');

    if (isReg) {
      const login = f.login.value.trim();
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(login)) return (msg.textContent = 'Логин: 3–20 символов, латиница, цифры и _.');
      if (db.users[login.toLowerCase()]) return (msg.textContent = 'Такой логин уже занят.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value)) return (msg.textContent = 'Проверьте email.');
      if (Object.values(db.users).some(u => u.email === f.email.value.toLowerCase())) return (msg.textContent = 'Этот email уже зарегистрирован.');
      if (!strongEnough(f.password.value)) return (msg.textContent = 'Пароль: минимум 8 символов, буквы и цифры.');
      if (f.password.value !== f.password2.value) return (msg.textContent = 'Пароли не совпадают.');
      if (!f.rules.checked) return (msg.textContent = 'Нужно принять правила.');
      btn.disabled = true;
      const { salt, hash } = await hashPassword(f.password.value);
      const key = login.toLowerCase();
      db.users[key] = { username: login, email: f.email.value.toLowerCase(), salt, hash, twofa: null, balance: 0, tx: [], created: Date.now() };
      saveDb();
      setup2FA(key, true);
      return;
    }

    const login = f.login.value.trim().toLowerCase();
    const key = db.users[login] ? login : Object.keys(db.users).find(k => db.users[k].email === login);
    const user = key && db.users[key];
    btn.disabled = true;

    const { hash } = await hashPassword(f.password.value, user ? user.salt : '00'.repeat(16));
    btn.disabled = false;
    if (!user || !safeEqual(hash, user.hash)) return (msg.textContent = 'Неверный логин или пароль.');
    if (user.twofa) {
      const ok = await require2FA('Вход в аккаунт', key);
      if (!ok) return;
    }
    await startSession(key);
    closeModal();
    toast(`С возвращением, ${user.username}!`, 'success');
    render();
  });

  openModal(h('div', {},
    h('div', { class: 'auth-tabs' },
      h('button', { class: 'auth-tab' + (!isReg ? ' active' : ''), onclick: () => authModal('login') }, 'Вход'),
      h('button', { class: 'auth-tab' + (isReg ? ' active' : ''), onclick: () => authModal('register') }, 'Регистрация')),
    h('h2', { text: isReg ? 'Создайте аккаунт' : 'Вход в Floe' }),
    isReg && h('p', { class: 'muted', text: 'Займёт минуту. Логин и почту никто, кроме вас, не увидит.' }),
    form));
}

function strongEnough(p) {
  return p.length >= 8 && /[a-zа-я]/i.test(p) && /\d/.test(p);
}

function setup2FA(key, isNewLogin, after) {
  const user = db.users[key];
  const secret = newTotpSecret();
  const uri = `otpauth://totp/Floe:${encodeURIComponent(user.username)}?secret=${secret}&issuer=Floe&digits=6&period=30`;
  const msg = h('p', { class: 'form-msg' });

  let finished = false;
  const finish = async type => {
    finished = true;
    user.twofa = type === 'totp' ? { type, secret } : { type: 'demo' };
    if (isNewLogin) await startSession(key);
    saveDb();
    modalEl()._onClose = null;
    closeModal();
    toast(type === 'totp' ? 'Приложение-аутентификатор подключено' : 'Демо-2FA включена', 'success', { title: '2FA активна' });
    render();
    if (after) after();
  };

  const qrBox = h('div', { class: 'qr' });
  if (window.qrcode) {
    const qr = qrcode(0, 'M'); qr.addData(uri); qr.make();
    qrBox.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  } else {
    qrBox.append(h('p', { class: 'muted', text: 'QR-код не загрузился (нет интернета). Введите ключ вручную.' }));
  }

  const codeInput = otpInput();
  const appPane = h('div', { class: 'pane' },
    h('ol', { class: 'setup-steps' },
      h('li', {}, 'Установите Google Authenticator, Яндекс Ключ, Microsoft Authenticator или любое TOTP-приложение.'),
      h('li', {}, 'Отсканируйте QR-код или введите ключ вручную.'),
      h('li', {}, 'Введите 6-значный код из приложения.')),
    h('div', { class: 'qr-row' }, qrBox,
      h('div', {},
        h('small', { class: 'muted', text: 'Ключ для ручного ввода' }),
        h('code', { class: 'secret mono', text: secret.match(/.{1,4}/g).join(' ') }),
        h('button', { class: 'link', type: 'button', onclick: () => navigator.clipboard?.writeText(secret).then(() => toast('Ключ скопирован'), () => toast('Не удалось скопировать — выделите ключ вручную')) }, 'Скопировать'))),
    h('form', { class: 'form', onsubmit: async e => {
      e.preventDefault();
      if (!/^\d{6}$/.test(codeInput.value)) return (msg.textContent = 'Введите 6 цифр.');
      if (await verifyTotp(secret, codeInput.value)) finish('totp');
      else msg.textContent = 'Код не подошёл. Проверьте время на телефоне и попробуйте следующий код.';
    } }, codeInput, h('button', { class: 'btn primary lg block', type: 'submit' }, 'Подключить'), msg));

  const demoPane = h('div', { class: 'pane', hidden: true },
    h('p', { text: 'Для демонстрации без телефона: код будет появляться во всплывающем уведомлении справа внизу — как SMS.' }),
    h('p', { class: 'muted', text: 'На настоящем сайте такой вариант использовать не стоит — приложение-аутентификатор надёжнее.' }),
    h('button', { class: 'btn primary lg block', type: 'button', onclick: () => finish('demo') }, 'Включить демо-2FA'));

  const choose = (which, btn) => {
    appPane.hidden = which !== 'app';
    demoPane.hidden = which !== 'demo';
    btn.parentElement.querySelectorAll('.opt').forEach(b => b.classList.toggle('active', b === btn));
  };

  openModal(h('div', {},
    h('p', { class: 'eyebrow', text: isNewLogin ? 'Последний шаг · защита аккаунта' : 'Защита аккаунта' }),
    h('h2', { text: 'Подключите 2FA' }),
    h('div', { class: 'options' },
      h('button', { class: 'opt active', type: 'button', onclick: e => choose('app', e.currentTarget) },
        h('b', { text: 'Приложение-аутентификатор' }), h('small', { text: 'Рекомендуется · работает без интернета' })),
      h('button', { class: 'opt', type: 'button', onclick: e => choose('demo', e.currentTarget) },
        h('b', { text: 'Демо-код' }), h('small', { text: 'Для проверки сайта без телефона' }))),
    appPane, demoPane,
    isNewLogin && h('button', { class: 'link later', type: 'button', onclick: () => closeModal() }, 'Настроить позже — понадобится только для вывода денег')),
  { wide: true, onClose: () => {
    if (finished) return;
    if (isNewLogin) startSession(key).then(() => { toast('Аккаунт создан. 2FA можно включить в разделе «Безопасность»', 'success', { title: 'Добро пожаловать!' }); render(); });
  } });
}

function otpInput() {
  return h('input', { class: 'input otp mono', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, placeholder: '000000', 'aria-label': 'Код 2FA',
    oninput: e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); } });
}

const lockState = {};

function require2FA(purpose, key = db.session) {
  return new Promise(resolve => {
    const user = db.users[key];
    const tf = user.twofa;
    const msg = h('p', { class: 'form-msg' });
    const input = otpInput();
    let demoCode = null, demoExpires = 0;
    let done = false;

    const sendDemo = () => {
      demoCode = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1e6).padStart(6, '0');
      demoExpires = Date.now() + 120000;
      toast('Никому не сообщайте этот код', 'code', { title: 'Floe · код подтверждения', code: demoCode, duration: 20000 });
    };

    const form = h('form', { class: 'form', onsubmit: async e => {
      e.preventDefault();
      const lock = lockState[key];
      if (lock && lock.until > Date.now()) return (msg.textContent = `Слишком много попыток. Подождите ${Math.ceil((lock.until - Date.now()) / 1000)} сек.`);
      if (!/^\d{6}$/.test(input.value)) return (msg.textContent = 'Введите 6 цифр.');
      const ok = tf.type === 'totp'
        ? await verifyTotp(tf.secret, input.value)
        : demoCode && Date.now() < demoExpires && safeEqual(demoCode, input.value);
      if (ok) {
        delete lockState[key];
        done = true;
        modalEl()._onClose = null;
        resolve(true);
        return;
      }
      const l = lockState[key] || (lockState[key] = { fails: 0, until: 0 });
      l.fails++;
      if (l.fails >= 5) { l.until = Date.now() + 60000; l.fails = 0; msg.textContent = 'Слишком много ошибок. Попробуйте через минуту.'; }
      else msg.textContent = `Неверный код. Осталось попыток: ${5 - l.fails}.`;
      input.select();
    } },
      input,
      h('button', { class: 'btn primary lg block', type: 'submit' }, 'Подтвердить'),
      tf.type === 'demo' && h('button', { class: 'link', type: 'button', onclick: sendDemo }, 'Отправить код ещё раз'),
      msg);

    openModal(h('div', { class: 'twofa' },
      h('div', { class: 'shield', 'aria-hidden': 'true' }, shieldIcon()),
      h('p', { class: 'eyebrow', text: 'Подтверждение 2FA' }),
      h('h2', { text: purpose }),
      h('p', { class: 'muted', text: tf.type === 'totp' ? 'Введите 6-значный код из приложения-аутентификатора.' : 'Введите код из уведомления справа внизу (демо).' }),
      form), { onClose: () => { if (!done) resolve(false); } });
    if (tf.type === 'demo') sendDemo();
  });
}

function shieldIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', 'M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.9-4.9 1.4 1.4-6.3 6.3z');
  svg.append(p);
  return svg;
}

function topupModal(prefill = 1000, after) {
  const u = currentUser();
  if (!u) return authModal('login');
  const amount = h('input', { class: 'input mono', type: 'number', min: 10, max: 500000, value: Math.max(10, prefill), 'aria-label': 'Сумма' });
  const msg = h('p', { class: 'form-msg' });
  let method = 'card';
  const methods = [['card', 'Банковская карта'], ['sbp', 'СБП'], ['crypto', 'Криптовалюта']];

  const form = h('form', { class: 'form', onsubmit: e => {
    e.preventDefault();
    const sum = Math.round(+amount.value);
    if (!(sum >= 10 && sum <= 500000)) return (msg.textContent = 'Сумма — от 10 до 500 000 ₽.');
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Обработка платежа…';
    setTimeout(() => {
      u.balance += sum;
      addTx(u, 'topup', sum, `Пополнение (демо) · ${methods.find(m => m[0] === method)[1]}`);
      saveDb();
      toast(`Баланс пополнен на ${money(sum)}`, 'success', { title: 'Демо-оплата прошла' });
      if (after) after(); else { closeModal(); }
      render();
    }, 1200);
  } },
    h('label', {}, 'Сумма, ₽', amount),
    h('div', { class: 'quick' }, [500, 1000, 3000, 5000, 10000].map(v =>
      h('button', { type: 'button', class: 'chip', onclick: () => { amount.value = v; } }, num(v) + ' ₽'))),
    h('div', { class: 'methods' }, methods.map(([k, label], i) =>
      h('label', { class: 'method' }, h('input', { type: 'radio', name: 'm', checked: i === 0, onchange: () => { method = k; } }), label))),
    h('p', { class: 'demo-note' }, h('b', { text: 'Демо-режим. ' }), 'Настоящие деньги не списываются, данные карты не запрашиваются и не сохраняются.'),
    h('button', { class: 'btn primary lg block', type: 'submit' }, 'Оплатить (демо)'),
    msg);

  openModal(h('div', {}, h('p', { class: 'eyebrow', text: 'Кошелёк' }), h('h2', { text: 'Пополнение баланса' }), form));
}

const WITHDRAW_METHODS = {
  sbp: ['СБП по номеру телефона', '+7 900 000-00-00', v => /^\+?\d[\d\s()-]{9,16}$/.test(v)],
  card: ['Банковская карта', '0000 0000 0000 0000', v => /^\d{16,19}$/.test(v.replace(/\s/g, ''))],
  usdt: ['USDT (TRC-20)', 'T… адрес кошелька', v => /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(v)],
};

const maskReq = v => { const d = v.replace(/\s/g, ''); return d.length > 4 ? '•••• ' + d.slice(-4) : d; };

function withdrawForm(u) {
  const msg = h('p', { class: 'form-msg' });
  const req = h('input', { class: 'input mono', name: 'req', placeholder: WITHDRAW_METHODS.sbp[1], autocomplete: 'off' });
  const form = h('form', { class: 'form card-box', onsubmit: async e => {
    e.preventDefault();
    const f = form.elements;
    const sum = Math.round(+f.amount.value);
    const m = WITHDRAW_METHODS[f.method.value];
    if (!(sum >= 100)) return (msg.textContent = 'Минимальная сумма вывода — 100 ₽.');
    if (sum > u.balance) return (msg.textContent = `Недостаточно средств: доступно ${money(u.balance)}.`);
    if (!m[2](f.req.value.trim())) return (msg.textContent = 'Проверьте реквизиты.');
    if (!u.twofa) {
      toast('Вывод защищён 2FA. Включите её — и нажмите «Вывести» ещё раз', 'info', { title: 'Нужна 2FA', duration: 7000 });
      return setup2FA(db.session, false);
    }
    const ok = await require2FA(`Вывод ${money(sum)}`);
    closeModal();
    if (!ok) return;
    u.balance -= sum;
    addTx(u, 'withdraw', -sum, `Вывод (демо) · ${m[0]} ${maskReq(f.req.value.trim())}`, 'processing');
    saveDb();
    toast('Заявка на вывод создана — обработка займёт пару секунд (демо)', 'success');
    render();
  } },
    h('h3', { text: 'Вывод средств' }),
    h('div', { class: 'row2' },
      h('label', {}, 'Сумма, ₽', h('input', { class: 'input mono', name: 'amount', type: 'number', min: 100, placeholder: 'от 100' })),
      h('label', {}, 'Способ', h('select', { class: 'input', name: 'method', onchange: e => { req.placeholder = WITHDRAW_METHODS[e.target.value][1]; } },
        Object.entries(WITHDRAW_METHODS).map(([k, v]) => h('option', { value: k, text: v[0] }))))),
    h('label', {}, 'Реквизиты', req),
    h('p', { class: 'demo-note' }, h('b', { text: 'Демо-вывод. ' }), 'Деньги никуда не отправляются. В истории сохраняются только последние 4 цифры.'),
    h('button', { class: 'btn primary block', type: 'submit' }, 'Вывести с подтверждением 2FA'),
    msg);
  return form;
}

function viewAccount(tab) {
  const u = currentUser();
  if (!u) {
    return h('div', { class: 'container page center' },
      h('h1', { text: 'Нужно войти' }),
      h('p', { class: 'muted', text: 'Кошелёк, заказы и предложения доступны после входа.' }),
      h('div', { class: 'hero-actions' },
        h('button', { class: 'btn primary lg', onclick: () => authModal('login') }, 'Войти'),
        h('button', { class: 'btn ghost lg', onclick: () => authModal('register') }, 'Регистрация')));
  }
  const tabs = [['wallet', 'Кошелёк'], ['purchases', 'Покупки'], ['sales', 'Продажи'], ['offers', 'Мои предложения'], ['security', 'Безопасность']];
  const views = { wallet: tabWallet, purchases: () => tabOrders('buyer'), sales: () => tabOrders('seller'), offers: tabOffers, security: tabSecurity };
  const body = (views[tab] || tabWallet)(u);

  return h('div', { class: 'container page account' },
    h('aside', { class: 'side' },
      h('div', { class: 'side-user' }, h('span', { class: 'avatar lg', text: u.username.slice(0, 2).toUpperCase() }),
        h('div', {}, h('b', { text: u.username }), h('small', { class: 'muted', text: u.email }))),
      h('nav', {}, tabs.map(([k, label]) => h('a', { class: 'side-link' + (k === tab ? ' active' : ''), href: `#/account/${k}`, text: label }))),
      h('button', { class: 'side-link out', onclick: () => { endSession(); location.hash = '#/'; render(); toast('Вы вышли из аккаунта'); } }, 'Выйти')),
    h('section', { class: 'side-body' }, body));
}

function frozenOf(u) {
  const active = ['paid', 'delivered', 'dispute'];
  return {
    buying: db.orders.filter(o => o.buyer === u.username && active.includes(o.status)).reduce((s, o) => s + o.total, 0),
    selling: db.orders.filter(o => o.seller === u.username && active.includes(o.status)).reduce((s, o) => s + Math.floor(o.total * (1 - FEE)), 0),
  };
}

const TX_LABEL = { topup: 'Пополнение', purchase: 'Покупка', sale: 'Продажа', withdraw: 'Вывод', refund: 'Возврат' };

function tabWallet(u) {
  const fr = frozenOf(u);
  return h('div', {},
    h('h1', { text: 'Кошелёк' }),
    h('div', { class: 'wallet-cards' },
      h('div', { class: 'wcard main' }, h('small', { text: 'Доступно' }), h('b', { class: 'mono', text: money(u.balance) }),
        h('button', { class: 'btn light', onclick: () => topupModal() }, 'Пополнить (демо)')),
      h('div', { class: 'wcard' }, h('small', { text: 'Заморожено в покупках' }), h('b', { class: 'mono', text: money(fr.buying) }), h('p', { class: 'muted', text: 'Вернётся продавцу после подтверждения' })),
      h('div', { class: 'wcard' }, h('small', { text: 'Ожидает зачисления' }), h('b', { class: 'mono', text: money(fr.selling) }), h('p', { class: 'muted', text: 'С продаж, которые ещё не подтвердили' }))),
    withdrawForm(u),
    h('h3', { class: 'sub-h', text: 'История операций' }),
    u.tx.length
      ? h('div', { class: 'table' }, u.tx.slice(0, 50).map(t => h('div', { class: 'trow' },
        h('span', { class: 'muted mono', text: dateFmt(t.t) }),
        h('span', {}, h('b', { text: TX_LABEL[t.type] }), h('small', { class: 'muted', text: ' · ' + t.note })),
        h('span', { class: 'badge ' + (t.status === 'processing' ? 'amber' : 'green'), text: t.status === 'processing' ? 'В обработке' : 'Выполнено' }),
        h('span', { class: 'mono right ' + (t.amount > 0 ? 'plus' : 'minus'), text: (t.amount > 0 ? '+' : '−') + money(Math.abs(t.amount)) }))))
      : h('p', { class: 'empty', text: 'Операций пока нет. Пополните демо-баланс, чтобы попробовать покупку.' }));
}

function tabOrders(role) {
  const u = currentUser();
  const list = db.orders.filter(o => o[role] === u.username);
  return h('div', {},
    h('h1', { text: role === 'buyer' ? 'Покупки' : 'Продажи' }),
    role === 'seller' && sellerRating(u),
    list.length
      ? h('div', { class: 'table' }, list.map(o => {
        const g = gameOf(o.game);
        return h('a', { class: 'trow link-row', href: `#/order/${o.id}` },
          h('span', { class: 'row-game' }, tile(g.name, 'sm'), h('span', {}, h('b', { text: o.title }), h('small', { class: 'muted', text: `${g.name} · #${o.id} · ${dateFmt(o.created)}` }))),
          h('span', { class: 'muted', text: role === 'buyer' ? `Продавец: ${o.seller}` : `Покупатель: ${o.buyer}` }),
          statusBadge(o.status),
          h('span', { class: 'mono right', text: money(o.total) }));
      }))
      : h('p', { class: 'empty' }, role === 'buyer' ? 'Покупок пока нет. Найдите игру через поиск вверху.' : 'Продаж пока нет. Выставите предложение в любой игре — кнопка «Продать» на странице игры.'));
}

function sellerRating(u) {
  const s = sellerOf(u.username);
  return h('div', { class: 'card-box seller-rating' },
    h('p', {}, 'Ваш рейтинг продавца: ', s.reviews ? h('b', { text: `★ ${s.rating.toFixed(1)} · ${s.reviews} ${plural(s.reviews, ['отзыв', 'отзыва', 'отзывов'])}` }) : h('b', { text: 'отзывов пока нет' })),
    reviewList(u.username, 3));
}

const statusBadge = s => h('span', { class: 'badge ' + STATUS[s][1], text: STATUS[s][0] });

function tabOffers(u) {
  const list = db.offers.filter(o => o.owner === u.username);
  return h('div', {},
    h('div', { class: 'block-head' }, h('h1', { text: 'Мои предложения' })),
    h('p', { class: 'muted', text: 'Чтобы добавить предложение, откройте игру или приложение и нажмите «Продать». Кнопка «Демо-покупка» покажет, как проходит продажа.' }),
    list.length
      ? h('div', { class: 'table' }, list.map(o => {
        const g = gameOf(o.game);
        return h('div', { class: 'trow' },
          h('a', { class: 'row-game', href: `#/g/${o.game}/${secSlug(o.section)}` }, tile(g.name, 'sm'), h('span', {}, h('b', { text: o.title }), h('small', { class: 'muted', text: `${g.name} · ${o.section}` }))),
          h('span', { class: 'mono', text: `${num(o.stock)} шт.` }),
          h('span', { class: 'mono', text: money(o.price) }),
          h('span', { class: 'row-actions' },
            h('button', { class: 'btn small', disabled: o.stock < 1, onclick: () => simulateSale(o) }, 'Демо-покупка'),
            h('button', { class: 'btn small ghost', onclick: () => {
              db.offers = db.offers.filter(x => x.id !== o.id); saveDb(); render(); toast('Предложение снято с продажи');
            } }, 'Снять')));
      }))
      : h('p', { class: 'empty', text: 'У вас пока нет предложений.' }));
}

function sessionsTable(u) {
  const cur = currentSid();
  const list = (u.sessions || []).filter(s => s.exp > Date.now()).sort((a, b) => (b.sid === cur) - (a.sid === cur) || b.seen - a.seen);
  const others = list.filter(s => s.sid !== cur);
  return h('div', {},
    h('div', { class: 'table' }, list.map(s => h('div', { class: 'trow session-row' },
      h('span', {}, h('b', { text: s.device }), s.sid === cur && h('span', { class: 'badge green', text: 'Это устройство' })),
      h('span', { class: 'muted', text: `Вход: ${dateFmt(s.created)}` }),
      h('span', { class: 'muted', text: `Активность: ${dateFmt(s.seen)}` }),
      s.sid === cur ? h('span') : h('button', { class: 'btn small ghost', onclick: () => { endSession(s.sid); render(); toast('Сеанс завершён'); } }, 'Завершить')))),
    others.length > 0 && h('button', { class: 'btn ghost sessions-out', onclick: () => {
      u.sessions = u.sessions.filter(s => s.sid === cur); saveDb(); render(); toast('Вы вышли на всех других устройствах', 'success');
    } }, 'Выйти на всех других устройствах'));
}

function tabSecurity(u) {
  const tf = u.twofa;
  return h('div', {},
    h('h1', { text: 'Безопасность' }),
    h('div', { class: 'card-box sec-card' },
      h('div', { class: 'shield' + (tf ? ' on' : ''), 'aria-hidden': 'true' }, shieldIcon()),
      h('div', {},
        h('h3', { text: tf ? 'Двухфакторная защита включена' : 'Двухфакторная защита выключена' }),
        h('p', { class: 'muted', text: !tf ? 'Без неё не получится вывести деньги. Включите — это займёт минуту.'
          : tf.type === 'totp' ? 'Способ: приложение-аутентификатор.' : 'Способ: демо-код в уведомлении. Для настоящей защиты подключите приложение.' })),
      tf
        ? h('button', { class: 'btn ghost', onclick: async () => { if (await require2FA('Смена способа 2FA')) setup2FA(db.session, false); } }, 'Сменить способ')
        : h('button', { class: 'btn primary', onclick: () => setup2FA(db.session, false) }, 'Включить 2FA')),
    h('h3', { class: 'sub-h', text: 'Где выполнен вход' }),
    sessionsTable(u),
    h('h3', { class: 'sub-h', text: 'Как мы защищаем ваши деньги' }),
    h('ul', { class: 'checklist' },
      h('li', { text: 'Сеанс привязан к ключу этого устройства: скопированный токен или cookies на другом компьютере не сработают.' }),
      h('li', { text: 'Сеанс сам завершается через 3 дня без активности и не живёт дольше 14 дней.' }),
      h('li', { text: `Деньги лежат в сейфе Floe до конца сделки: до вашего подтверждения или ${DEAL_DAYS} дней без спора.` }),
      h('li', { text: 'Вход и вывод — с кодом 2FA, если она включена.' }),
      h('li', { text: 'Пароль хранится только в виде хеша, реквизиты — замаскированы.' })));
}

function viewOrder(id) {
  const u = currentUser();
  const o = db.orders.find(x => x.id === id);
  if (!u) return viewAccount('purchases');
  if (!o || (o.buyer !== u.username && o.seller !== u.username)) return viewNotFound();
  const g = gameOf(o.game);
  const isBuyer = o.buyer === u.username;
  const order = ['paid', 'delivered', 'completed'];
  const idx = order.indexOf(o.status);

  const stepEl = (i, title, text) => h('li', { class: i <= idx ? 'done' : i === idx + 1 ? 'now' : '' },
    h('span', { class: 'dot' }), h('div', {}, h('b', { text: title }), h('small', { class: 'muted', text })));

  const actions = [];
  if (isBuyer && o.status === 'delivered') {
    actions.push(h('button', { class: 'btn primary lg', onclick: () => confirmReceipt(o) }, 'Подтвердить получение'));
  }
  if (isBuyer && ['paid', 'delivered'].includes(o.status)) {
    actions.push(h('button', { class: 'btn ghost lg', onclick: () => openDispute(o) }, 'Открыть спор'));
  }
  if (o.status === 'dispute') {
    actions.push(h('a', { class: 'btn primary lg', href: `support.html#/arbiter/${o.id}` }, 'Панель арбитра (демо)'));
  }
  actions.push(h('a', { class: 'btn ghost lg', href: `support.html#/new/order/${o.id}` }, 'Написать в поддержку'));
  const end = deadlineOf(o);
  const deadlineBox = end && h('div', { class: 'deadline' },
    h('p', {}, deadlineText(o, isBuyer)[0], h('b', { class: 'mono', 'data-deadline': end, text: timeLeft(end - Date.now()) }), deadlineText(o, isBuyer)[1]),
    h('button', { class: 'btn ghost small', type: 'button', onclick: () => shiftDeal(o) }, '+1 день (демо)'));
  if (!isBuyer && o.status === 'paid') {
    actions.push(h('button', { class: 'btn primary lg', onclick: () => markDelivered(o) }, 'Я передал товар'));
  }

  const chatList = h('div', { class: 'chat-list' }, o.messages.map(m => {
    const who = m.from === 'system' ? 'system' : m.from === u.username ? 'me' : 'them';
    return h('div', { class: 'msg ' + who },
      who === 'them' && h('small', { class: 'muted', text: m.from }),
      h('p', { text: m.text }),
      msgImage(m.image),
      who !== 'system' && riskNote(m.text, o.game, who),
      h('small', { class: 'muted mono', text: dateFmt(m.t) }));
  }));
  const chatInput = h('input', { class: 'input', placeholder: 'Сообщение', maxlength: 500, 'aria-label': 'Сообщение' });
  const chat = h('section', { class: 'chat card-box' },
    h('h3', { text: `Чат с ${isBuyer ? 'продавцом' : 'покупателем'}` }),
    chatList,
    !['completed', 'refunded'].includes(o.status) && riskHint(chatInput, o.game),
    ['completed', 'refunded'].includes(o.status) ? h('p', { class: 'muted', text: 'Сделка закрыта.' }) :
      h('form', { class: 'chat-form', onsubmit: e => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;
        o.messages.push({ from: u.username, text, t: Date.now() });
        if (o.sellerDemo && isBuyer && !o.replied) {
          o.replied = true;
          setTimeout(() => { o.messages.push({ from: o.seller, text: 'Принял, всё в порядке. Если будут вопросы — пишите сюда.', t: Date.now() }); saveDb(); if (location.hash === `#/order/${o.id}`) render(); }, 1500);
        }
        saveDb(); render();
      } }, chatInput, o.status === 'dispute' && attachShot(o), h('button', { class: 'btn primary', type: 'submit' }, 'Отправить')));
  setTimeout(() => { chatList.scrollTop = chatList.scrollHeight; }, 0);

  return h('div', { class: 'container page' },
    h('nav', { class: 'crumbs' }, h('a', { href: isBuyer ? '#/account/purchases' : '#/account/sales', text: isBuyer ? 'Покупки' : 'Продажи' }), h('span', { text: '/' }), h('b', { text: `Заказ #${o.id}` })),
    h('div', { class: 'order' },
      h('section', { class: 'card-box' },
        h('div', { class: 'order-head' }, tile(g.name),
          h('div', {}, h('small', { class: 'muted', text: `${g.name} · ${o.section}` }), h('h1', { text: o.title })),
          statusBadge(o.status)),
        h('dl', { class: 'om-info' },
          h('div', {}, h('dt', { text: 'Количество' }), h('dd', { class: 'mono', text: `${o.qty} шт.` })),
          h('div', {}, h('dt', { text: 'Сумма' }), h('dd', { class: 'mono', text: money(o.total) })),
          h('div', {}, h('dt', { text: isBuyer ? 'Продавец' : 'Покупатель' }), h('dd', { text: isBuyer ? o.seller : o.buyer })),
          !isBuyer && h('div', {}, h('dt', { text: 'Вы получите' }), h('dd', { class: 'mono', text: money(Math.floor(o.total * (1 - FEE))) }))),
        ['dispute', 'refunded'].includes(o.status)
          ? h('p', { class: 'guarantee warn', text: o.status === 'dispute' ? 'Открыт спор. Деньги заморожены, пока арбитраж разбирается в ситуации.' : 'Деньги возвращены покупателю.' })
          : h('ol', { class: 'timeline' },
            stepEl(0, 'Оплачено', 'Деньги на гарантийном счёте Floe'),
            stepEl(1, 'Товар передан', isBuyer ? 'Проверьте, что всё соответствует описанию' : 'Покупатель проверяет товар'),
            stepEl(2, 'Сделка завершена', isBuyer ? 'Деньги ушли продавцу' : 'Деньги зачислены на ваш баланс')),
        deadlineBox,
        actions.length && h('div', { class: 'order-actions' }, actions),
        isBuyer && o.status === 'delivered' && h('p', { class: 'muted small', text: 'Подтверждайте только после проверки товара — отменить подтверждение нельзя.' }),
        o.dispute && disputeCard(o),
        o.status === 'completed' && reviewBox(o, isBuyer)),
      chat));
}

function deadlineOf(o) {
  if (o.status !== 'paid' && o.status !== 'delivered') return null;
  return (o.statusAt || o.updated || o.created) + DEAL_MS;
}

function timeLeft(ms) {
  if (ms <= 60000) return 'меньше минуты';
  const d = Math.floor(ms / 864e5), hr = Math.floor(ms % 864e5 / 36e5), min = Math.floor(ms % 36e5 / 6e4);
  if (d) return `${d} дн. ${hr} ч`;
  if (hr) return `${hr} ч ${min} мин`;
  return `${min} мин`;
}

function deadlineText(o, isBuyer) {
  if (o.status === 'paid') return isBuyer
    ? ['Продавец должен передать товар: осталось ', '. Иначе деньги автоматически вернутся вам.']
    : ['Передайте товар: осталось ', '. Иначе деньги автоматически вернутся покупателю.'];
  return isBuyer
    ? ['На проверку осталось ', '. Если не открыть спор, сделка завершится автоматически.']
    : ['Покупатель проверяет товар: осталось ', '. Потом деньги поступят вам автоматически.'];
}

function shiftDeal(o) {
  o.statusAt = (o.statusAt || o.updated || o.created) - 864e5;
  saveDb();
  toast('Время сделки перемотано на 1 день вперёд', 'info', { title: 'Демо' });
  tick();
  render();
}

function confirmReceipt(o) {
  openModal(h('div', {},
    h('p', { class: 'eyebrow', text: `Заказ #${o.id}` }),
    h('h2', { text: 'Вы получили товар?' }),
    h('p', { class: 'muted', text: `После подтверждения ${money(o.total)} уйдут продавцу. Отменить это действие будет нельзя.` }),
    h('div', { class: 'modal-actions' },
      h('button', { class: 'btn ghost lg', onclick: closeModal }, 'Ещё проверю'),
      h('button', { class: 'btn primary lg', onclick: () => {
        setStatus(o, 'completed', 'Покупатель подтвердил получение. Сделка завершена.');
        closeModal(); render();
        toast('Спасибо! Сделка завершена', 'success');
      } }, 'Да, всё получил'))));
}

const DISPUTE_REASONS = ['Продавец не передал товар', 'Товар не соответствует описанию', 'Продавец просит общение или оплату вне Floe', 'Другое'];

function openDispute(o) {
  let image = null;
  const reason = h('select', { class: 'input' }, DISPUTE_REASONS.map(r => h('option', { text: r })));
  const text = h('textarea', { class: 'input', rows: 4, maxlength: 1000, placeholder: 'Например: продавец прислал не тот скин, на скриншоте мой инвентарь' });
  const preview = h('div', { class: 'shot-preview' });
  const note = h('p', { class: 'form-msg' });
  const file = h('input', { class: 'input file', type: 'file', accept: 'image/png,image/jpeg,image/webp', onchange: async e => {
    note.textContent = ''; image = null; preview.replaceChildren();
    const f = e.target.files[0];
    if (!f) return;
    try { image = await readShot(f); preview.replaceChildren(h('img', { src: image, alt: 'Скриншот к спору' })); }
    catch (err) { note.textContent = err.message; e.target.value = ''; }
  } });
  openModal(h('div', {},
    h('p', { class: 'eyebrow', text: `Заказ #${o.id}` }),
    h('h2', { text: 'Открыть спор' }),
    h('p', { class: 'muted', text: 'Деньги останутся на гарантийном счёте, пока арбитр Floe не разберётся. Опишите проблему и, если можно, приложите скриншот.' }),
    h('form', { class: 'form', onsubmit: e => {
      e.preventDefault();
      const desc = text.value.trim();
      if (desc.length < 10) { note.textContent = 'Опишите проблему подробнее: хотя бы 10 символов.'; return; }
      const me = currentUser().username, now = Date.now();
      const wasDelivered = o.status === 'delivered';
      o.dispute = { reason: reason.value, text: desc, by: me, t: now, image: !!image };
      o.messages.push({ from: me, text: `Спор: ${reason.value}. ${desc}`, t: now });
      if (image) o.messages.push({ from: me, text: 'Скриншот к спору', image, t: now });
      setStatus(o, 'dispute', 'Открыт спор. Деньги заморожены до решения арбитра. Обе стороны могут дописать подробности и приложить скриншоты в этот чат.');
      if (o.sellerDemo && wasDelivered) {
        setTimeout(() => {
          o.messages.push({ from: o.seller, text: 'Я передал товар, это видно выше в чате. Пусть арбитр проверит переписку.', t: Date.now() });
          saveDb();
          if (location.hash === `#/order/${o.id}`) render();
        }, 2000);
      }
      closeModal(); render();
      toast('Арбитр Floe рассмотрит спор. Деньги пока заморожены', 'info', { title: 'Спор открыт' });
    } },
      h('label', {}, 'Причина', reason),
      h('label', {}, 'Что случилось', text),
      h('label', {}, 'Скриншот (необязательно)', file), preview, note,
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn ghost lg', type: 'button', onclick: closeModal }, 'Отмена'),
        h('button', { class: 'btn primary lg', type: 'submit' }, 'Открыть спор')))));
}

function readShot(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return Promise.reject(new Error('Нужна картинка PNG, JPG или WebP'));
  if (file.size > 10e6) return Promise.reject(new Error('Файл больше 10 МБ'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не получилось прочитать файл'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Файл не похож на картинку'));
      img.onload = () => {
        const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = h('canvas', { width: Math.round(img.naturalWidth * k), height: Math.round(img.naturalHeight * k) });
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.72));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function attachShot(o) {
  const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true, onchange: async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const image = await readShot(f);
      o.messages.push({ from: currentUser().username, text: 'Скриншот', image, t: Date.now() });
      saveDb(); render();
    } catch (err) { toast(err.message, 'error'); }
  } });
  return h('label', { class: 'btn ghost attach', title: 'Приложить скриншот' }, 'Скриншот', file);
}

function disputeCard(o) {
  const d = o.dispute, r = o.resolution;
  return h('div', { class: 'dispute-card' },
    h('b', { text: `Спор: ${d.reason}` }),
    h('p', { text: d.text }),
    h('small', { class: 'muted', text: `Открыт ${dateFmt(d.t)}` + (d.image ? ' · скриншот в чате' : '') }),
    r && h('p', { class: 'resolution' }, h('b', { text: r.winner === 'buyer' ? 'Решение арбитра: деньги вернулись покупателю.' : 'Решение арбитра: деньги переданы продавцу.' }), r.note ? ` ${r.note}` : ''));
}

function addReview(o, rating, text) {
  if (db.reviews.some(r => r.orderId === o.id)) return;
  db.reviews.unshift({ id: uid(), orderId: o.id, seller: o.seller, author: o.buyer, rating, text, game: o.game, title: o.title, t: Date.now() });
  saveDb();
}

function reviewBox(o, isBuyer) {
  const done = db.reviews.find(r => r.orderId === o.id);
  if (done) {
    return h('div', { class: 'review-box' },
      h('b', { text: isBuyer ? 'Ваш отзыв' : 'Отзыв покупателя' }),
      h('span', { class: 'stars', 'aria-label': `${done.rating} из 5`, text: stars(done.rating) }),
      done.text && h('p', { text: done.text }));
  }
  if (!isBuyer) return null;
  let rating = 0;
  const pickRow = h('div', { class: 'star-pick', role: 'group', 'aria-label': 'Оценка' }, [1, 2, 3, 4, 5].map(n =>
    h('button', { class: 'star', type: 'button', 'aria-label': `${n} из 5`, onclick: () => {
      rating = n;
      note.textContent = '';
      pickRow.querySelectorAll('.star').forEach((b, i) => { b.classList.toggle('on', i < n); b.setAttribute('aria-pressed', i < n); });
    } }, '★')));
  const text = h('textarea', { class: 'input', rows: 3, maxlength: 500, placeholder: 'Как прошла сделка? Быстро ли продавец передал товар?' });
  const note = h('p', { class: 'form-msg' });
  return h('form', { class: 'review-box', onsubmit: e => {
    e.preventDefault();
    if (!rating) { note.textContent = 'Поставьте оценку от 1 до 5.'; return; }
    addReview(o, rating, text.value.trim());
    render();
    toast('Спасибо! Отзыв учтён в рейтинге продавца', 'success');
  } },
    h('b', { text: 'Оцените продавца' }),
    h('p', { class: 'muted small', text: 'Отзыв увидят другие покупатели, а оценка войдёт в рейтинг продавца. Оставить отзыв можно один раз.' }),
    pickRow, text, note,
    h('div', {}, h('button', { class: 'btn primary', type: 'submit' }, 'Оставить отзыв')));
}

function reviewList(name, limit) {
  const list = reviewsOf(name).slice(0, limit);
  if (!list.length) return null;
  return h('div', { class: 'reviews' },
    h('small', { class: 'muted', text: 'Последние отзывы' }),
    list.map(r => h('div', { class: 'review' },
      h('span', { class: 'stars', 'aria-label': `${r.rating} из 5`, text: stars(r.rating) }),
      h('small', { class: 'muted', text: ` ${r.author} · ${dateFmt(r.t).slice(0, 10)}` }),
      r.text && h('p', { text: r.text }))));
}
function markDelivered(o) {
  setStatus(o, 'delivered', 'Продавец отметил, что передал товар.');
  render();
}

function simulateSale(offer) {
  const u = currentUser();
  const order = {
    id: 'F-' + Math.floor(10000 + Math.random() * 89999),
    offerId: offer.id, game: offer.game, section: offer.section, title: offer.title,
    price: offer.price, qty: 1, total: offer.price,
    buyer: 'demo_buyer', seller: u.username, sellerDemo: false,
    status: 'paid', created: Date.now(), updated: Date.now(), statusAt: Date.now(),
    messages: [
      { from: 'system', text: `Покупатель оплатил заказ. ${money(offer.price)} заморожено на гарантийном счёте.`, t: Date.now() },
      { from: 'demo_buyer', text: 'Здравствуйте! Оплатил, жду товар.', t: Date.now() },
    ],
  };
  db.orders.unshift(order);
  saveDb();
  toast('Демо-покупатель оплатил ваше предложение', 'success', { title: 'Новая продажа' });
  location.hash = `#/order/${order.id}`;
}

function tick() {
  if (db.session && !sessionStillValid()) { db.session = null; localStorage.removeItem(SID_KEY); render(); toast('Сеанс завершён. Войдите снова'); return; }
  let changed = false;
  const now = Date.now();
  for (const o of db.orders) {
    const end = deadlineOf(o);
    if (end && now >= end) {
      if (o.status === 'paid') refundMoney(o, `Продавец не передал товар за ${DEAL_DAYS} дня. ${money(o.total)} автоматически вернулись покупателю.`);
      else setStatus(o, 'completed', `Покупатель не подтвердил получение и не открыл спор за ${DEAL_DAYS} дня. Сделка завершена автоматически, деньги ушли продавцу.`);
      changed = true;
      continue;
    }
    if (o.status === 'paid' && o.sellerDemo && o.sellerOnline !== false && now - o.updated > 3500) {
      o.status = 'delivered'; o.updated = now; o.statusAt = now;
      const acc = /аккаунт/i.test(o.section);
      o.messages.push({ from: o.seller, text: acc ? 'Добрый день! Данные от аккаунта: логин demo_' + o.id.slice(2) + ', пароль — в этом сообщении (демо). Смените пароль и почту сразу после входа.' : 'Готово, отправил. Проверьте, пожалуйста, и подтвердите заказ.', t: now });
      o.messages.push({ from: 'system', text: 'Продавец передал товар. Проверьте и подтвердите получение.', t: now });
      changed = true;
    }
    if (o.status === 'delivered' && o.buyer === 'demo_buyer' && now - o.updated > 3500) {
      o.messages.push({ from: 'demo_buyer', text: 'Всё получил, спасибо!', t: now });
      setStatus(o, 'completed', 'Покупатель подтвердил получение. Деньги зачислены продавцу.');
      addReview(o, 5, 'Всё пришло быстро, продавец на связи. Спасибо!');
      changed = true;
    }
  }
  for (const u of Object.values(db.users)) {
    for (const t of u.tx) if (t.status === 'processing' && now - t.t > 3000) { t.status = 'done'; changed = true; }
  }
  document.querySelectorAll('[data-deadline]').forEach(el => { el.textContent = timeLeft(+el.dataset.deadline - now); });
  if (changed) {
    saveDb();
    const r = parseRoute().name;
    const typing = document.activeElement && document.activeElement.closest('#app form') && document.activeElement.value;
    if (['order', 'account'].includes(r) && !typing && !modalEl().open) render();
    else renderHeader();
  }
}

function viewGuarantee() {
  const step = (n, title, text) => h('li', {}, h('span', { class: 'step-n', text: n }), h('div', {}, h('b', { text: title }), h('p', { class: 'muted', text })));
  return h('div', { class: 'container page narrow info-page' },
    h('p', { class: 'eyebrow', text: 'Безопасная сделка' }),
    h('h1', { class: 'page-title', text: 'Как работает гарант Floe' }),
    h('p', { class: 'lead', text: 'Гарант стоит между покупателем и продавцом. Деньги покупателя не уходят продавцу сразу: они ждут на гарантийном счёте Floe, пока сделка не закончится. Поэтому никто не может забрать деньги или товар и пропасть.' }),
    h('ol', { class: 'steps' },
      step(1, 'Покупатель оплачивает заказ', 'Деньги списываются с баланса и замораживаются на гарантийном счёте. Продавец видит, что заказ оплачен, но забрать деньги пока не может.'),
      step(2, 'Продавец передаёт товар', `Товар передаётся в чате заказа, после чего продавец нажимает «Я передал товар». На это у него ${DEAL_DAYS} дня. Не успел — деньги автоматически вернутся покупателю.`),
      step(3, 'Покупатель проверяет товар', `Если всё в порядке, покупатель нажимает «Подтвердить получение». На проверку тоже ${DEAL_DAYS} дня: если покупатель молчит и не открывает спор, сделка завершается сама.`),
      step(4, 'Продавец получает деньги', `Сумма заказа зачисляется на баланс продавца за вычетом комиссии Floe ${FEE * 100} %. Покупатель платит ровно ту цену, что указана в предложении.`)),
    h('h2', { class: 'sub-h', text: 'Если что-то пошло не так' }),
    h('div', { class: 'card-box info-box' },
      h('p', { text: 'Пока покупатель не подтвердил получение, он может открыть спор: выбрать причину, описать проблему и приложить скриншот. На время спора сроки сделки останавливаются, а деньги остаются замороженными.' }),
      h('p', { text: 'Арбитр Floe изучает жалобу, всю переписку в заказе и скриншоты обеих сторон и решает, кому отдать деньги. Если продавец не доказал, что передал товар, или просил заплатить мимо Floe, деньги возвращаются покупателю. Если товар передан и соответствует описанию, деньги получает продавец.' })),
    h('h2', { class: 'sub-h', text: 'Сроки сделки' }),
    h('dl', { class: 'om-info' },
      h('div', {}, h('dt', { text: 'Передать товар' }), h('dd', { text: `${DEAL_DAYS} дня после оплаты` })),
      h('div', {}, h('dt', { text: 'Проверить товар' }), h('dd', { text: `${DEAL_DAYS} дня после передачи` })),
      h('div', {}, h('dt', { text: 'Во время спора' }), h('dd', { text: 'сроки стоят' }))),
    h('h2', { class: 'sub-h', text: 'Гарант работает только внутри Floe' }),
    h('p', { class: 'guarantee warn', text: 'Если заплатить переводом на карту или договориться в мессенджере, у Floe не будет ни денег, ни переписки, и вернуть ничего не получится. Поэтому чат Floe предупреждает о ссылках, никах, телефонах и просьбах заплатить напрямую.' }),
    h('div', { class: 'hero-actions' },
      h('a', { class: 'btn primary lg', href: '#/safety' }, 'Правила безопасности'),
      h('a', { class: 'btn ghost lg', href: '#/catalog' }, 'Перейти в каталог')));
}

function viewSafety() {
  const block = (title, items) => h('section', {},
    h('h2', { class: 'sub-h', text: title }),
    h('ul', { class: 'rules' }, items.map(([b, t]) => h('li', {}, h('b', { text: b }), ' ', t))));
  return h('div', { class: 'container page narrow info-page' },
    h('p', { class: 'eyebrow', text: 'Безопасность' }),
    h('h1', { class: 'page-title', text: 'Правила безопасности' }),
    h('p', { class: 'lead', text: 'Мошенники в играх рассчитывают на спешку, жадность и доверие. Эти правила помогут не потерять ни деньги, ни аккаунт.' }),
    block('Покупателю', [
      ['Не уходите из чата Floe.', 'Просьба написать в мессенджер или перевести деньги на карту — главный признак обмана. Вне сделки гарант не сможет вернуть деньги, поэтому Floe предупреждает о таких сообщениях.'],
      ['Не торопитесь.', 'Слишком низкая цена, «акция закончится через час», давление и спешка — обычные приёмы мошенников.'],
      ['Проверяйте товар до подтверждения.', 'Тот ли это предмет, из той ли игры, такое ли у него качество. Подтверждение отменить нельзя.'],
      ['Не верьте нику на слово.', 'Аккаунт знакомого могли взломать, а ник — подделать, заменив одну букву.'],
    ]),
    block('Продавцу', [
      ['Не отдавайте товар «на проверку» или «на время».', 'На Floe покупатель платит заранее: когда вы передаёте товар, деньги уже лежат на гарантийном счёте.'],
      ['Не соглашайтесь на оплату мимо сделки.', 'Прямой платёж покупатель может потом отменить через свой банк, и вы останетесь без денег и без товара.'],
      ['Не устанавливайте программы удалённого доступа', 'по просьбе покупателя: так захватывают компьютер и аккаунты.'],
    ]),
    block('Аккаунт', [
      ['Включите двухфакторную аутентификацию', 'в разделе «Кабинет → Безопасность». Тогда одного пароля для входа будет мало.'],
      ['Заведите для каждого сайта свой пароль.', 'Если взломают один сайт, остальные аккаунты останутся в безопасности.'],
      ['Никому не сообщайте пароль и коды.', 'Поддержка Floe никогда не просит пароль, код 2FA или данные карты.'],
      ['Смотрите на адрес сайта перед вводом пароля.', 'Поддельные сайты отличаются от настоящих одной буквой или цифрой. По ссылкам из игровых чатов лучше не переходить.'],
      ['Не скачивайте читы и моды, которые просят отключить антивирус.', 'В них часто прячут вирусы.'],
      ['Для покупок в играх удобна отдельная карта с лимитом.', 'Даже если её данные украдут, потеря будет небольшой.'],
    ]),
    h('div', { class: 'card-box info-box' },
      h('p', {}, 'Что-то случилось? Откройте спор в заказе или ', h('a', { href: 'support.html#/new', text: 'напишите в поддержку' }),
        '. Как устроена сделка — на странице ', h('a', { href: '#/guarantee', text: '«Как работает гарант»' }), '.')),
    h('p', { class: 'muted small sources', text: 'Советы составлены по материалам Т—Ж («Как фрилансерам и продавцам не потерять деньги в интернете»), блога «Лаборатории Касперского» («Как торговать в онлайн-играх и не пожалеть об этом») и «Финансы Mail» («Мошенничество в онлайн-играх: как защитить аккаунт и деньги»).' }));
}

function viewNotFound() {
  return h('div', { class: 'container page center' },
    h('h1', { text: 'Страница не найдена' }),
    h('p', { class: 'muted', text: 'Возможно, ссылка устарела. Попробуйте найти игру через поиск.' }),
    h('a', { class: 'btn primary lg', href: '#/' }, 'На главную'));
}

(function init() {
  const modal = modalEl();
  modal.addEventListener('close', () => { const f = modal._onClose; modal._onClose = null; if (f) f(); });

  window.onDbChange = () => { if (!modal.open && !document.activeElement?.closest('form')) render(); else renderHeader(); };
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  attachSearch(document.getElementById('searchInput'), document.getElementById('searchResults'));
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !modal.open) {
      e.preventDefault(); document.getElementById('searchInput').focus();
    }
  });

  restoreSession().catch(() => false).then(() => { render(); setInterval(tick, 1000); });
})();

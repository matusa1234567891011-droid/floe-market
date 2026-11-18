const CATEGORIES = {
  order: ['Проблема с заказом', 'Товар не пришёл, не тот, продавец пропал'],
  payment: ['Оплата и вывод', 'Пополнение, вывод, баланс'],
  account: ['Аккаунт и безопасность', 'Вход, 2FA, подозрительная активность'],
  other: ['Другое', 'Идеи, жалобы, всё остальное'],
};
const TICKET_STATUS = {
  waiting: ['Ждёт ответа', 'amber'],
  answered: ['Есть ответ', 'blue'],
  closed: ['Закрыта', 'gray'],
};
const AGENTS = ['Аня', 'Марк', 'Лиза', 'Тимур'];

const FAQ = [
  ['Как работает безопасная сделка?', 'Когда вы оплачиваете заказ, деньги не уходят продавцу, а лежат в «сейфе» Floe. Продавец передаёт товар в чате заказа, вы проверяете и нажимаете «Подтвердить получение». После этого продавец получает деньги. Если за 3 дня вы не подтвердите получение и не откроете спор, сделка завершится сама. Если продавец не передаст товар за 3 дня, деньги автоматически вернутся вам.'],
  ['Продавец не отвечает — что делать?', 'Подождите время выдачи, указанное в предложении. Если продавец так и не появился — откройте спор в заказе или создайте заявку здесь. Деньги останутся в сейфе, пока мы не разберёмся. А если продавец не передаст товар за 3 дня, деньги вернутся вам автоматически.'],
  ['Как вернуть деньги?', 'Откройте спор в заказе до подтверждения получения: выберите причину, опишите проблему и приложите скриншот. Арбитр Floe изучит переписку и решит, кому достанутся деньги. Если товар не передан или не соответствует описанию, деньги вернутся на ваш баланс.'],
  ['Почему в чате появилось предупреждение?', 'Floe проверяет сообщения на ссылки, @ники, названия мессенджеров, номера телефонов и карт. Так мошенники уводят покупателей с сайта, где гарант уже не защищает. Сообщение всё равно отправится, но по таким ссылкам лучше не переходить и напрямую не платить.'],
  ['Как работают отзывы?', 'Отзыв можно оставить только после завершённой сделки, один раз на заказ. Оценка от 1 до 5 сразу входит в рейтинг продавца, поэтому накрутить его без настоящих сделок нельзя.'],
  ['Могут ли украсть мой аккаунт через cookies?', 'Нет. Вход привязан к ключу вашего устройства, который браузер не даёт скопировать. Даже если кто-то унесёт токен сессии или cookies, на другом компьютере они не сработают. Завершить чужие сеансы можно в «Кабинет → Безопасность».'],
  ['Как включить 2FA?', 'Зайдите в «Кабинет → Безопасность» и нажмите «Включить 2FA». Понадобится Google Authenticator, Яндекс Ключ или другое приложение. 2FA спрашивается при входе и выводе денег.'],
  ['Можно заплатить продавцу напрямую?', 'Не стоит. Если оплатить мимо Floe, мы не сможем вернуть деньги. Просьба продавца «переведи на карту» — повод написать нам.'],
];

const sapp = document.getElementById('sapp');
let lastKey = '';

function sRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  return { name: parts[0] || 'home', args: parts.slice(1) };
}

function sRender() {
  const r = sRoute();
  sHeader();
  let view;
  if (r.name === 'home') view = sHome();
  else if (r.name === 'new') view = sNew(r.args[0], r.args[1]);
  else if (r.name === 'tickets') view = sTickets();
  else if (r.name === 't') view = sTicket(r.args[0], false);
  else if (r.name === 'operator') view = r.args[0] ? sTicket(r.args[0], true) : sOperator();
  else if (r.name === 'arbiter') view = r.args[0] ? sDispute(r.args[0]) : sArbiter();
  else view = sHome();
  sapp.replaceChildren(view);
  if (location.hash !== lastKey) { window.scrollTo(0, 0); lastKey = location.hash; }
}
window.addEventListener('hashchange', sRender);
window.onDbChange = () => { if (!document.activeElement?.closest('form')) sRender(); };

function sHeader() {
  const u = currentUser();
  const mine = u ? db.tickets.filter(t => t.owner === u.username) : [];
  const fresh = mine.filter(t => t.status === 'answered' && !t.seen).length;
  const openDisputes = db.orders.filter(o => o.status === 'dispute').length;
  const r = sRoute().name;
  document.getElementById('supportNav').replaceChildren(
    h('a', { class: 'nav-link' + (r === 'home' ? ' active' : ''), href: '#/' }, 'Помощь'),
    h('a', { class: 'nav-link' + (['tickets', 't'].includes(r) ? ' active' : ''), href: '#/tickets' }, 'Мои заявки', fresh > 0 && h('span', { class: 'nav-badge', text: fresh })),
    h('a', { class: 'nav-link' + (r === 'operator' ? ' active' : ''), href: '#/operator' }, 'Оператор'),
    h('a', { class: 'nav-link' + (r === 'arbiter' ? ' active' : ''), href: '#/arbiter' }, 'Арбитраж', openDisputes > 0 && h('span', { class: 'nav-badge', text: openDisputes })));
  document.getElementById('supportUser').replaceChildren(u
    ? h('a', { class: 'user-chip', href: 'index.html#/account/wallet' }, h('span', { class: 'avatar sm', text: u.username.slice(0, 2).toUpperCase() }), h('span', { class: 'user-name', text: u.username }))
    : h('a', { class: 'btn primary', href: 'index.html#/login' }, 'Войти'));
}

const tStatus = s => h('span', { class: 'badge ' + TICKET_STATUS[s][1], text: TICKET_STATUS[s][0] });

function sHome() {
  const u = currentUser();
  const faqBox = h('div', { class: 'faq' });
  const drawFaq = q => {
    const n = normalizeText(q || '');
    const items = FAQ.filter(([a, b]) => !n || normalizeText(a + ' ' + b).includes(n));
    faqBox.replaceChildren(...(items.length ? items.map(([q2, a]) => h('details', { class: 'faq-item' }, h('summary', { text: q2 }), h('p', { text: a })))
      : [h('p', { class: 'empty', text: 'Не нашли ответ? Создайте заявку — мы поможем.' })]));
  };
  drawFaq('');
  const mine = u ? db.tickets.filter(t => t.owner === u.username && t.status !== 'closed').length : 0;

  return h('div', { class: 'container page' },
    h('section', { class: 'support-hero' },
      h('p', { class: 'eyebrow', text: 'Поддержка Floe' }),
      h('h1', { text: 'Чем помочь?' }),
      h('p', { class: 'hero-lead', text: 'Отвечают живые люди. Обычно — в течение нескольких минут.' }),
      h('input', { class: 'input big-search', type: 'search', placeholder: 'Опишите вопрос в двух словах: «не пришёл товар», «вывод»…', 'aria-label': 'Поиск по частым вопросам',
        oninput: e => drawFaq(e.target.value) })),
    h('div', { class: 'support-grid' },
      h('section', {},
        h('h2', { class: 'sub-h first', text: 'Частые вопросы' }),
        faqBox),
      h('aside', { class: 'support-side' },
        h('h2', { class: 'sub-h first', text: 'Написать нам' }),
        h('div', { class: 'cat-list' }, Object.entries(CATEGORIES).map(([k, [title, sub]]) =>
          h('a', { class: 'cat-card', href: `#/new/${k}` }, h('b', { text: title }), h('small', { class: 'muted', text: sub })))),
        u && h('a', { class: 'btn ghost block', href: '#/tickets' }, mine ? `Открытые заявки: ${mine}` : 'Мои заявки'))));
}

function sNew(cat = 'order', orderId) {
  const u = currentUser();
  if (!u) return needLoginView('Чтобы создать заявку, войдите в аккаунт Floe — так мы увидим ваши заказы.');
  const orders = db.orders.filter(o => o.buyer === u.username || o.seller === u.username);
  const msg = h('p', { class: 'form-msg' });
  const form = h('form', { class: 'form card-box', novalidate: true },
    h('label', {}, 'Тема', h('select', { class: 'input', name: 'cat' }, Object.entries(CATEGORIES).map(([k, [t]]) => h('option', { value: k, text: t, selected: k === cat })))),
    h('label', {}, 'Заказ (если вопрос о нём)', h('select', { class: 'input', name: 'order' },
      h('option', { value: '', text: orders.length ? 'Не выбран' : 'Заказов пока нет' }),
      orders.map(o => h('option', { value: o.id, selected: o.id === orderId, text: `#${o.id} · ${o.title.slice(0, 50)}` })))),
    h('label', {}, 'Что случилось?', h('textarea', { class: 'input', name: 'text', rows: 6, maxlength: 2000, placeholder: 'Расскажите своими словами. Чем подробнее — тем быстрее поможем.' })),
    h('button', { class: 'btn primary lg', type: 'submit' }, 'Отправить заявку'),
    msg);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const f = form.elements;
    const text = f.text.value.trim();
    if (text.length < 10) return (msg.textContent = 'Опишите проблему чуть подробнее — хотя бы пару предложений.');
    const t = {
      id: 'T-' + Math.floor(1000 + Math.random() * 8999), owner: u.username, category: f.cat.value, orderId: f.order.value || null,
      subject: text.split(/[.!?\n]/)[0].slice(0, 70), status: 'waiting', created: Date.now(), updated: Date.now(),
      agent: pick(Math.random, AGENTS), messages: [{ from: 'user', name: u.username, text, t: Date.now() }],
    };
    db.tickets.unshift(t);
    saveDb();
    toast('Мы получили заявку и скоро ответим', 'success', { title: `Заявка #${t.id}` });
    location.hash = `#/t/${t.id}`;
  });
  return h('div', { class: 'container page narrow' },
    h('nav', { class: 'crumbs' }, h('a', { href: '#/', text: 'Помощь' }), h('span', { text: '/' }), h('b', { text: 'Новая заявка' })),
    h('h1', { class: 'page-title', text: 'Новая заявка' }),
    h('p', { class: 'muted intro', text: 'Никогда не присылайте пароли и коды 2FA — сотрудники Floe их не спрашивают.' }),
    form);
}

function sTickets() {
  const u = currentUser();
  if (!u) return needLoginView('Войдите, чтобы увидеть свои заявки.');
  const list = db.tickets.filter(t => t.owner === u.username);
  return h('div', { class: 'container page narrow' },
    h('div', { class: 'block-head' }, h('h1', { class: 'page-title', text: 'Мои заявки' }), h('a', { class: 'btn primary', href: '#/new' }, 'Новая заявка')),
    list.length ? ticketTable(list, false) : h('p', { class: 'empty', text: 'Заявок пока нет — и это хорошо. Если что-то случится, мы рядом.' }));
}

function ticketTable(list, operator) {
  return h('div', { class: 'table' }, list.map(t => h('a', { class: 'trow link-row ticket-row', href: operator ? `#/operator/${t.id}` : `#/t/${t.id}` },
    h('span', {}, h('b', { text: t.subject }), h('small', { class: 'muted', text: ` · #${t.id} · ${CATEGORIES[t.category][0]}` + (operator ? ` · ${t.owner}` : '') })),
    h('span', { class: 'muted mono', text: dateFmt(t.updated) }),
    tStatus(t.status),
    h('span', { class: 'muted right', text: `${t.messages.length} сообщ.` }))));
}

function sTicket(id, operator) {
  const u = currentUser();
  const t = db.tickets.find(x => x.id === id);
  if (!operator && !u) return needLoginView('Войдите, чтобы открыть заявку.');
  if (!t || (!operator && t.owner !== u.username)) return h('div', { class: 'container page narrow' }, h('p', { class: 'empty', text: 'Заявка не найдена.' }));
  if (!operator && t.status === 'answered' && !t.seen) { t.seen = true; saveDb(); setTimeout(sHeader, 0); }

  const input = h('textarea', { class: 'input', rows: 3, maxlength: 2000, placeholder: operator ? 'Ответ пользователю' : 'Ваш ответ', 'aria-label': 'Сообщение' });
  const thread = h('div', { class: 'thread' }, t.messages.map(m => {
    const staff = m.from === 'agent';
    return h('article', { class: 'tmsg ' + (staff ? 'staff' : 'user') },
      h('header', {},
        h('span', { class: 'avatar' + (staff ? ' staff' : ''), text: (m.name || '?').slice(0, 2).toUpperCase() }),
        h('b', { text: m.name }), staff && h('small', { class: 'muted', text: 'поддержка Floe' + (m.demo ? ' · демо' : '') }),
        h('small', { class: 'muted mono', text: dateFmt(m.t) })),
      h('p', { text: m.text }));
  }));

  const order = t.orderId && db.orders.find(o => o.id === t.orderId);
  const closed = t.status === 'closed';

  return h('div', { class: 'container page narrow' },
    h('nav', { class: 'crumbs' }, h('a', { href: operator ? '#/operator' : '#/tickets', text: operator ? 'Оператор' : 'Мои заявки' }), h('span', { text: '/' }), h('b', { text: `#${t.id}` })),
    h('header', { class: 'ticket-head' },
      h('div', {}, h('h1', { class: 'page-title', text: t.subject }),
        h('p', { class: 'muted' }, `${CATEGORIES[t.category][0]} · создана ${dateFmt(t.created)}`,
          order && ' · ', order && h('a', { href: `index.html#/order/${order.id}`, text: `заказ #${order.id}` }))),
      tStatus(t.status)),
    operator && h('p', { class: 'demo-note' }, h('b', { text: 'Режим оператора (демо). ' }), `Вы отвечаете пользователю ${t.owner} от имени поддержки.`),
    thread,
    closed
      ? h('div', { class: 'card-box rate' },
        h('b', { text: t.rating ? (t.rating === 'yes' ? 'Спасибо! Рады, что помогли.' : 'Жаль. Мы разберём эту заявку и станем лучше.') : 'Заявка закрыта. Мы помогли?' }),
        !t.rating && !operator && h('div', { class: 'hero-actions' },
          h('button', { class: 'btn ghost', onclick: () => { t.rating = 'yes'; saveDb(); sRender(); } }, 'Да, помогли'),
          h('button', { class: 'btn ghost', onclick: () => { t.rating = 'no'; saveDb(); sRender(); } }, 'Не совсем')))
      : h('form', { class: 'form card-box', onsubmit: e => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        if (operator) {
          t.messages.push({ from: 'agent', name: 'Оператор', text, t: Date.now() });
          t.status = 'answered'; t.manual = true; t.seen = false;
        } else {
          t.messages.push({ from: 'user', name: u.username, text, t: Date.now() });
          t.status = 'waiting';
        }
        t.updated = Date.now();
        saveDb(); sRender();
      } }, input,
        h('div', { class: 'modal-actions left' },
          h('button', { class: 'btn primary', type: 'submit' }, operator ? 'Ответить' : 'Отправить'),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => { t.status = 'closed'; t.updated = Date.now(); saveDb(); sRender(); } },
            operator ? 'Закрыть заявку' : 'Вопрос решён, закрыть'))));
}

function sOperator() {
  let filter = 'waiting';
  const box = h('div', {});
  const draw = () => {
    const list = db.tickets.filter(t => filter === 'all' || t.status === filter);
    box.replaceChildren(list.length ? ticketTable(list, true) : h('p', { class: 'empty', text: 'Здесь пусто.' }));
  };
  const tabs = h('div', { class: 'tabs' }, [['waiting', 'Ждут ответа'], ['answered', 'С ответом'], ['closed', 'Закрытые'], ['all', 'Все']].map(([k, label]) =>
    h('button', { class: 'tab' + (k === filter ? ' active' : ''), onclick: e => {
      filter = k; tabs.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === e.currentTarget)); draw();
    } }, label, h('span', { class: 'tab-count', text: db.tickets.filter(t => k === 'all' || t.status === k).length }))));
  draw();
  return h('div', { class: 'container page narrow' },
    h('h1', { class: 'page-title', text: 'Панель оператора' }),
    h('p', { class: 'demo-note' }, h('b', { text: 'Демо. ' }), 'Так поддержка видит заявки всех пользователей. На настоящем сайте сюда пускают только сотрудников.'),
    h('div', { class: 'block-head' }, tabs),
    box);
}

const isDispute = o => o.dispute || o.status === 'dispute';
const arbStatus = o => o.status === 'dispute' ? h('span', { class: 'badge red', text: 'Ждёт решения' })
  : o.resolution?.winner === 'seller' ? h('span', { class: 'badge green', text: 'В пользу продавца' })
    : h('span', { class: 'badge gray', text: 'В пользу покупателя' });

function sArbiter() {
  let filter = 'open';
  const groups = { open: o => o.status === 'dispute', done: o => o.status !== 'dispute' };
  const all = db.orders.filter(isDispute);
  const box = h('div', {});
  const draw = () => {
    const list = all.filter(groups[filter]);
    box.replaceChildren(list.length
      ? h('div', { class: 'table' }, list.map(o => h('a', { class: 'trow link-row ticket-row', href: `#/arbiter/${o.id}` },
        h('span', {}, h('b', { text: o.title }), h('small', { class: 'muted', text: ` · #${o.id} · ${o.buyer} → ${o.seller}` })),
        h('span', { class: 'muted mono', text: dateFmt(o.dispute?.t || o.updated) }),
        arbStatus(o),
        h('span', { class: 'mono right', text: money(o.total) }))))
      : h('p', { class: 'empty', text: filter === 'open' ? 'Открытых споров нет.' : 'Решённых споров пока нет.' }));
  };
  const tabs = h('div', { class: 'tabs' }, [['open', 'Ждут решения'], ['done', 'Решённые']].map(([k, label]) =>
    h('button', { class: 'tab' + (k === filter ? ' active' : ''), onclick: e => {
      filter = k; tabs.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === e.currentTarget)); draw();
    } }, label, h('span', { class: 'tab-count', text: all.filter(groups[k]).length }))));
  draw();
  return h('div', { class: 'container page narrow' },
    h('h1', { class: 'page-title', text: 'Арбитраж' }),
    h('p', { class: 'demo-note' }, h('b', { text: 'Демо. ' }), 'Так арбитр Floe видит спорные сделки. На настоящем сайте решение принимает сотрудник, а не участник сделки.'),
    h('div', { class: 'block-head' }, tabs),
    box);
}

function sDispute(id) {
  const o = db.orders.find(x => x.id === id);
  if (!o || !isDispute(o)) return h('div', { class: 'container page narrow' }, h('p', { class: 'empty', text: 'Спор не найден.' }));
  const g = CATALOG_BY_SLUG[o.game];
  const d = o.dispute || { reason: 'Причина не указана', text: 'Спор открыт без формы жалобы.', t: o.updated };
  const delivered = o.messages.some(m => m.from === 'system' && /передал товар/.test(m.text));
  const flagged = o.messages.filter(m => m.from !== 'system' && chatRisk(m.text, o.game).length).length;
  const note = h('textarea', { class: 'input', rows: 3, maxlength: 500, placeholder: 'Почему принято такое решение. Комментарий увидят обе стороны в чате заказа' });
  const decide = winner => {
    if (!resolveDispute(o, winner, note.value.trim())) return;
    sRender();
    toast(winner === 'buyer' ? `${money(o.total)} вернулись покупателю` : 'Деньги переданы продавцу', 'success', { title: 'Спор решён' });
  };
  const chat = h('div', { class: 'chat-list arb-chat' }, o.messages.map(m => {
    const role = m.from === 'system' ? 'system' : m.from === o.buyer ? 'them' : 'them from-seller';
    return h('div', { class: 'msg ' + role },
      role !== 'system' && h('small', { class: 'muted', text: `${m.from} · ${m.from === o.buyer ? 'покупатель' : 'продавец'}` }),
      h('p', { text: m.text }),
      msgImage(m.image),
      role !== 'system' && riskNote(m.text, o.game, 'arb'),
      h('small', { class: 'muted mono', text: dateFmt(m.t) }));
  }));
  const r = o.resolution;
  return h('div', { class: 'container page' },
    h('nav', { class: 'crumbs' }, h('a', { href: '#/arbiter', text: 'Арбитраж' }), h('span', { text: '/' }), h('b', { text: `Спор по заказу #${o.id}` })),
    h('header', { class: 'ticket-head' },
      h('div', {}, h('h1', { class: 'page-title', text: o.title }),
        h('p', { class: 'muted' }, `${g ? g.name : o.game} · ${o.section} · `, h('a', { href: `index.html#/order/${o.id}`, text: `заказ #${o.id}` }))),
      arbStatus(o)),
    h('div', { class: 'arb-grid' },
      h('section', { class: 'card-box arb-case' },
        h('h3', { text: 'Жалоба покупателя' }),
        h('p', {}, h('b', { text: d.reason })),
        h('p', { class: 'arb-text', text: d.text }),
        h('small', { class: 'muted', text: `Открыт ${dateFmt(d.t)}` + (d.image ? ' · скриншот приложен' : '') }),
        h('dl', { class: 'om-info' },
          h('div', {}, h('dt', { text: 'Сумма' }), h('dd', { class: 'mono', text: money(o.total) })),
          h('div', {}, h('dt', { text: 'Покупатель' }), h('dd', { text: o.buyer })),
          h('div', {}, h('dt', { text: 'Продавец' }), h('dd', { text: o.seller + (o.sellerDemo ? ' (демо)' : '') })),
          h('div', {}, h('dt', { text: 'Оплачен' }), h('dd', { class: 'mono', text: dateFmt(o.created) })),
          h('div', {}, h('dt', { text: 'Продавец отметил передачу' }), h('dd', { text: delivered ? 'да' : 'нет' })),
          h('div', {}, h('dt', { text: 'Предупреждения фильтра' }), h('dd', { text: flagged ? `${flagged} сообщ.` : 'нет' }))),
        o.status === 'dispute'
          ? h('div', { class: 'arb-decide' },
            h('h3', { text: 'Решение' }),
            h('p', { class: 'muted small', text: 'Если продавец не доказал, что передал товар, или просил оплату вне Floe, деньги возвращаются покупателю. Если товар передан и соответствует описанию, деньги получает продавец.' }),
            note,
            h('div', { class: 'hero-actions' },
              h('button', { class: 'btn primary', onclick: () => decide('buyer') }, 'Вернуть деньги покупателю'),
              h('button', { class: 'btn ghost', onclick: () => decide('seller') }, 'Отдать деньги продавцу')))
          : h('div', { class: 'arb-decide' },
            h('h3', { text: 'Решение' }),
            h('p', {}, h('b', { text: r?.winner === 'seller' ? 'В пользу продавца: сделка завершена, деньги ушли продавцу.' : 'В пользу покупателя: деньги вернулись на его баланс.' })),
            r?.note && h('p', { class: 'muted', text: `Комментарий: ${r.note}` }),
            r && h('small', { class: 'muted mono', text: dateFmt(r.t) }))),
      h('section', { class: 'card-box chat' }, h('h3', { text: 'Переписка в заказе' }), chat)));
}

function needLoginView(text) {
  return h('div', { class: 'container page center' },
    h('h1', { text: 'Нужно войти' }),
    h('p', { class: 'muted', text }),
    h('a', { class: 'btn primary lg', href: 'index.html#/login' }, 'Войти на Floe'));
}

function agentReply(t) {
  const u = db.users[t.owner.toLowerCase()];
  const name = u ? u.username : '';
  const firstReply = !t.messages.some(m => m.from === 'agent');
  if (!firstReply) return 'Спасибо за подробности! Уже разбираюсь — вернусь с ответом в этой заявке.';
  const hello = `Здравствуйте, ${name}! Меня зовут ${t.agent}, я займусь вашим вопросом.`;
  return hello + ' ' + {
    order: t.orderId ? `Заказ #${t.orderId} у меня перед глазами: деньги сейчас в сейфе Floe, продавцу они не ушли. Опишите, что именно не так, — и приложите скриншоты, если есть.` : 'Подскажите номер заказа — так я быстрее разберусь.',
    payment: 'В демо-режиме пополнения и выводы проходят за пару секунд. Если сумма не отобразилась, напишите сумму и время операции — проверю.',
    account: 'Если есть подозрение, что кто-то получил доступ, смените пароль и включите 2FA в разделе «Безопасность». Мы со своей стороны проверим входы.',
    other: 'Спасибо, что написали! Разберусь и отвечу здесь же.',
  }[t.category];
}

setInterval(() => {
  let changed = false;
  for (const t of db.tickets) {
    const last = t.messages.at(-1);
    if (t.status === 'waiting' && !t.manual && last.from === 'user' && Date.now() - last.t > 4000) {
      t.messages.push({ from: 'agent', name: t.agent, text: agentReply(t), t: Date.now(), demo: true });
      t.status = 'answered'; t.updated = Date.now(); t.seen = false;
      changed = true;
      if (location.hash !== `#/t/${t.id}`) toast('Поддержка ответила на заявку', 'info', { title: `#${t.id}` });
    }
  }
  if (changed) {
    saveDb();
    const typingNow = document.activeElement?.closest('form') && document.activeElement.value;
    if (!typingNow) sRender(); else sHeader();
  }
}, 1000);

restoreSession().catch(() => false).then(sRender);

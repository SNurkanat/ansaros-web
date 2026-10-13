"use strict";
// ================= ВХОД, СЕАНС, АДМИНКА СОБСТВЕННИКА =================
// Браузер получает только то, что разрешил сервер. Здесь — экран входа, смена пароля,
// хранение сеанса и страницы «Пользователи» / «Журнал» для собственника.
const CFG = window.ANSAROS_CONFIG;
const SESS_KEY = 'ansaros.session';
const Store = {
  mem: null,
  get() { try { const v = localStorage.getItem(SESS_KEY); return v ? JSON.parse(v) : this.mem; } catch (e) { return this.mem; } },
  set(s) { this.mem = s; try { s ? localStorage.setItem(SESS_KEY, JSON.stringify(s)) : localStorage.removeItem(SESS_KEY); } catch (e) {} },
};

class ApiError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }

const API = {
  async refresh() {
    const s = Store.get(); if (!s || !s.refresh_token) return false;
    try {
      const r = await fetch(CFG.supabase + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.publishableKey },
        body: JSON.stringify({ refresh_token: s.refresh_token }),
      });
      if (!r.ok) return false;
      const j = await r.json();
      Store.set({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at });
      return true;
    } catch (e) { return false; }
  },
  async call(path, { method = 'GET', body, auth = true, retry = true } = {}) {
    let s = Store.get();
    if (auth && s && s.expires_at && s.expires_at * 1000 - Date.now() < 60e3) { await API.refresh(); s = Store.get(); }
    const headers = { 'Content-Type': 'application/json' };
    if (auth && s) headers.Authorization = 'Bearer ' + s.access_token;
    let r;
    try { r = await fetch(CFG.api + '/' + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); }
    catch (e) { throw new ApiError(0, 'network', 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.'); }
    if (r.status === 401 && auth && retry && await API.refresh()) return API.call(path, { method, body, auth, retry: false });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401 && auth) { Store.set(null); Auth.showLogin('Сеанс завершён — войдите снова.'); }
      throw new ApiError(r.status, j.error || 'error', j.message || ('Ошибка ' + r.status));
    }
    return j;
  },
  data(code) { return API.call('data/' + code); },
};

// ---------- стили экранов входа и админки ----------
(function () {
  const st = document.createElement('style');
  st.textContent = `
  html.auth-lock .top,html.auth-lock .ctx,html.auth-lock main,html.auth-lock .wrap,html.auth-lock #layer{visibility:hidden}
  #auth{position:fixed;inset:0;z-index:200;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:calc(24px + env(safe-area-inset-top,0px)) 16px calc(24px + env(safe-area-inset-bottom,0px));overflow:auto}
  #auth form{width:min(360px,100%);background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:24px 22px;display:flex;flex-direction:column;gap:12px}
  #auth .lg{font-weight:800;font-size:24px;letter-spacing:-.02em;color:var(--ink)} #auth .lg i{font-style:normal;color:var(--muted);font-weight:500}
  #auth h1{font-size:17px;margin:0;color:var(--ink)} #auth p{margin:0;font-size:13px;color:var(--muted)}
  #auth label{display:flex;flex-direction:column;gap:5px;font-size:12.5px;color:var(--ink-2);font-weight:500}
  #auth input{border:1px solid var(--line-2);background:var(--surface);color:var(--ink);border-radius:10px;padding:10px 12px;font:inherit;font-size:16px}
  #auth input:focus{outline:2px solid var(--brand-2);outline-offset:1px}
  #auth button[type=submit]{border:0;background:var(--brand);color:var(--brand-ink);border-radius:10px;padding:11px;font-weight:700;font-size:15px}
  #auth button[type=submit]:disabled{opacity:.6}
  #auth .err{min-height:18px;font-size:13px;color:var(--bad)}
  .who{display:flex;align-items:center;gap:8px;color:#fff;font-size:12.5px;white-space:nowrap}
  .who b{font-weight:600;max-width:160px;overflow:hidden;text-overflow:ellipsis}
  .adm-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0 0 6px}
  .adm-form label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--ink-2);font-weight:500}
  .adm-form input,.adm-form select{border:1px solid var(--line-2);background:var(--surface);color:var(--ink);border-radius:8px;padding:7px 9px;font:inherit;font-size:14px;min-width:0}
  .adm-form .full{grid-column:1/-1}
  .adm-acts{display:flex;flex-wrap:wrap;gap:6px}
  .adm-acts button{border:1px solid var(--line-2);background:var(--surface);border-radius:7px;padding:3px 8px;font-size:12px;color:var(--brand)}
  .adm-msg{min-height:18px;font-size:13px;margin:6px 0}
  .adm-msg.bad{color:var(--bad)} .adm-msg.ok{color:var(--good)}
  @media (max-width:560px){.adm-form{grid-template-columns:1fr}.who b{display:none}}`;
  document.head.appendChild(st);
})();

const DIR_NAMES = { access: 'Ансар Аксес', techno: 'Ансар Техно', bijou: 'Ансар Бижутерия' };
const ROLE_NAMES = { owner: 'Собственник', manager: 'Управляющий', employee: 'Сотрудник' };
const EVENT_NAMES = {
  login_ok: 'Вход', login_fail: 'Неверный пароль', login_locked: 'Вход заблокирован (5 ошибок)', login_blocked: 'Вход заблокированного',
  logout: 'Выход', password_changed: 'Сменил пароль', data_read: 'Открыл данные', denied: 'Отказ в доступе',
  admin_create_user: 'Создал пользователя', admin_update_user: 'Изменил пользователя', admin_reset_password: 'Сбросил пароль',
  admin_logout_all: 'Завершил сеансы', admin_plan: 'Изменил план', unlock: 'Разблокировал вход',
  ingest_ok: 'Загрузка данных', ingest_denied: 'Отказ загрузки данных',
};
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtAt = (iso) => { if (!iso) return '—'; try { return new Date(iso).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } };

const Auth = {
  box: null,
  overlay(html) {
    document.documentElement.classList.add('auth-lock');
    if (!this.box) { this.box = document.createElement('div'); this.box.id = 'auth'; this.box.setAttribute('role', 'dialog'); this.box.setAttribute('aria-modal', 'true'); document.body.appendChild(this.box); }
    this.box.hidden = false; this.box.innerHTML = html;
    const f = this.box.querySelector('input'); if (f) f.focus();
  },
  close() { if (this.box) { this.box.hidden = true; this.box.innerHTML = ''; } document.documentElement.classList.remove('auth-lock'); },

  showLogin(msg = '') {
    this.overlay(`<form id="login-form" novalidate>
      <div class="lg">Ansar<i>OS</i></div><h1>Вход</h1><p>Логин и пароль выдаёт собственник.</p>
      <label>Логин<input name="login" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
      <label>Пароль<input name="password" type="password" autocomplete="current-password" required></label>
      <div class="err" role="alert">${h(msg)}</div>
      <button type="submit">Войти</button></form>`);
    const form = this.box.querySelector('form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form), btn = form.querySelector('button'), err = form.querySelector('.err');
      if (!fd.get('login') || !fd.get('password')) { err.textContent = 'Введите логин и пароль'; return; }
      btn.disabled = true; err.textContent = '';
      try {
        const r = await API.call('login', { method: 'POST', auth: false, body: { login: fd.get('login'), password: fd.get('password') } });
        Store.set(r.session);
        await Auth.boot();
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    });
  },

  showChangePassword(first) {
    this.overlay(`<form id="pw-form" novalidate>
      <div class="lg">Ansar<i>OS</i></div><h1>${first ? 'Придумайте свой пароль' : 'Смена пароля'}</h1>
      <p>${first ? 'Вы вошли с временным паролем. Задайте свой — не короче 10 символов.' : 'Не короче 10 символов.'}</p>
      <label>Новый пароль<input name="p1" type="password" autocomplete="new-password" minlength="10" required></label>
      <label>Повторите пароль<input name="p2" type="password" autocomplete="new-password" minlength="10" required></label>
      <div class="err" role="alert"></div>
      <button type="submit">Сохранить</button></form>`);
    const form = this.box.querySelector('form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form), btn = form.querySelector('button'), err = form.querySelector('.err');
      const p1 = String(fd.get('p1') || ''), p2 = String(fd.get('p2') || '');
      if (p1.length < 10) { err.textContent = 'Пароль — не короче 10 символов'; return; }
      if (p1 !== p2) { err.textContent = 'Пароли не совпадают'; return; }
      btn.disabled = true; err.textContent = '';
      try {
        const r = await API.call('password', { method: 'POST', body: { new_password: p1 } });
        if (r.session) Store.set(r.session);
        await Auth.boot();
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    });
  },

  async boot() {
    if (!Store.get()) return this.showLogin();
    let me;
    try { me = await API.call('me'); }
    catch (ex) { if (ex.status === 401) return; return this.showLogin(ex.message); }
    ME = { ...me, group: !!me.group, dirs: (me.directions || []).map((d) => d.code) };
    if (me.must_change_password) return this.showChangePassword(true);
    this.close();
    this.header();
    if (!Auth.started) { Auth.started = true; await startApp(); }
    else render();
  },

  header() {
    const t = document.querySelector('.tctl'); if (!t) return;
    let w = document.getElementById('who');
    if (!w) { w = document.createElement('div'); w.id = 'who'; w.className = 'who'; t.appendChild(w); }
    w.innerHTML = `<b title="${h(ROLE_NAMES[ME.role] || '')}">${h(ME.full_name)}</b>`
      + (ME.role === 'owner' ? '<button class="tbtn" type="button" id="btn-users">Пользователи</button><button class="tbtn" type="button" id="btn-log">Журнал</button>' : '')
      + '<button class="tbtn" type="button" id="btn-out">Выйти</button>';
    w.querySelector('#btn-out').onclick = () => Auth.logout();
    if (ME.role === 'owner') {
      w.querySelector('#btn-users').onclick = () => Admin.users();
      w.querySelector('#btn-log').onclick = () => Admin.log();
    }
    if (typeof LANG !== 'undefined' && LANG === 'kk' && typeof trNode === 'function') trNode(w);
  },

  async logout() {
    try { await API.call('logout', { method: 'POST', retry: false }); } catch (e) {}
    Store.set(null); location.reload();
  },
};

// ---------- админка собственника ----------
const Admin = {
  open(title, body) { drawer(`<div class="eyebrow">Собственник</div><h2>${title}</h2>`, body); },
  msg(text, ok) { const m = document.getElementById('adm-msg'); if (m) { m.textContent = text; m.className = 'adm-msg ' + (ok ? 'ok' : 'bad'); } },

  async users() {
    this.open('Пользователи', '<p class="note">Загружаю…</p>');
    let list;
    try { list = await API.call('admin/users'); } catch (e) { return this.open('Пользователи', `<div class="empty">${h(e.message)}</div>`); }
    const rows = list.map((u) => `<tr data-uid="${h(u.user_id)}" data-login="${h(u.login)}">
      <td class="l">${h(u.full_name)}<span class="sm">${h(u.login)}</span></td>
      <td class="l">${h(ROLE_NAMES[u.role] || u.role)}<span class="sm">${u.role === 'owner' ? 'все направления' : h((u.directions || []).map((d) => DIR_NAMES[d] || d).join(', ') || '—')}</span></td>
      <td class="l">${u.active ? '<span class="pill g">активен</span>' : '<span class="pill r">заблокирован</span>'}${u.must_change_password ? '<span class="sm">временный пароль</span>' : ''}</td>
      <td class="n">${fmtAt(u.last_login)}</td>
      <td class="l"><div class="adm-acts">
        <button type="button" data-act="password">Новый пароль</button>
        ${u.login === ME.login ? '' : `<button type="button" data-act="${u.active ? 'block' : 'unblock'}">${u.active ? 'Заблокировать' : 'Разблокировать'}</button>`}
        <button type="button" data-act="logout">Завершить сеансы</button>
        <button type="button" data-act="unlock">Снять блок. входа</button>
      </div></td></tr>`).join('');
    this.open('Пользователи', `
      <div class="panel" style="margin-bottom:12px"><h3>Новый пользователь</h3><p class="sub">Логин — латиница, цифры, точка, дефис. Временный пароль — не короче 10 символов; при первом входе человек сменит его на свой.</p>
      <form class="adm-form" id="adm-new" novalidate autocomplete="off">
        <label>Имя<input name="full_name" placeholder="Дастан"></label>
        <label>Логин<input name="login" placeholder="dastan" autocapitalize="none" spellcheck="false"></label>
        <label>Роль<select name="role"><option value="manager">Управляющий</option><option value="owner">Собственник</option></select></label>
        <label>Направление<select name="direction"><option value="access">Ансар Аксес</option><option value="bijou">Ансар Бижутерия</option><option value="techno">Ансар Техно</option></select></label>
        <label class="full">Временный пароль<input name="password" autocomplete="off" spellcheck="false"></label>
        <div class="full"><button class="btn p" type="submit">Создать</button></div>
      </form><div class="adm-msg" id="adm-msg" role="status"></div></div>
      <div class="tw"><table><thead><tr><th class="l">Имя</th><th class="l">Роль / направление</th><th class="l">Статус</th><th>Последний вход</th><th class="l">Действия</th></tr></thead><tbody id="adm-users">${rows || '<tr><td class="l note" colspan="5">Пользователей нет</td></tr>'}</tbody></table></div>`);
    const pane = document.querySelector('#layer .pane');
    const form = pane.querySelector('#adm-new');
    form.querySelector('[name=password]').value = Admin.genPassword();
    form.role.addEventListener('change', () => { form.direction.disabled = form.role.value === 'owner'; });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form); const role = fd.get('role');
      const body = { full_name: fd.get('full_name'), login: fd.get('login'), role, password: fd.get('password'), directions: role === 'owner' ? [] : [fd.get('direction')] };
      try {
        await API.call('admin/users', { method: 'POST', body });
        const pw = body.password;
        await Admin.users();
        Admin.msg(`Создан: логин «${body.login}», временный пароль «${pw}». Передайте их лично; при первом входе пароль нужно сменить.`, true);
      } catch (ex) { Admin.msg(ex.message, false); }
    });
    pane.querySelector('#adm-users').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const tr = b.closest('tr'); const id = tr.dataset.uid, lg = tr.dataset.login, a = b.dataset.act;
      try {
        if (a === 'password') {
          const pw = Admin.genPassword();
          if (!confirm(`Выдать «${lg}» новый временный пароль? Текущие сеансы будут завершены.`)) return;
          await API.call(`admin/users/${id}/password`, { method: 'POST', body: { password: pw } });
          await Admin.users(); Admin.msg(`Новый временный пароль для «${lg}»: ${pw}`, true);
        } else if (a === 'block' || a === 'unblock') {
          if (a === 'block' && !confirm(`Заблокировать «${lg}»? Доступ пропадёт сразу на всех устройствах.`)) return;
          await API.call(`admin/users/${id}/update`, { method: 'POST', body: { active: a === 'unblock' } });
          await Admin.users(); Admin.msg(a === 'block' ? `«${lg}» заблокирован` : `«${lg}» разблокирован`, true);
        } else if (a === 'logout') {
          await API.call(`admin/users/${id}/logout`, { method: 'POST' });
          Admin.msg(`Сеансы «${lg}» завершены`, true);
        } else if (a === 'unlock') {
          await API.call(`admin/users/${id}/unlock`, { method: 'POST' });
          Admin.msg(`Блокировка входа для «${lg}» снята`, true);
        }
      } catch (ex) { Admin.msg(ex.message, false); }
    });
  },

  genPassword() {
    const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const r = crypto.getRandomValues(new Uint32Array(12));
    return Array.from(r, (x) => a[x % a.length]).join('');
  },

  async log() {
    this.open('Журнал доступа', '<p class="note">Загружаю…</p>');
    let rows;
    try { rows = await API.call('admin/log?limit=300'); } catch (e) { return this.open('Журнал доступа', `<div class="empty">${h(e.message)}</div>`); }
    const body = rows.map((r) => {
      const d = r.detail || {};
      const who = d.login || '—';
      const extra = d.target ? 'кого: ' + d.target : d.path ? 'куда: ' + d.path : '';
      const bad = ['login_fail', 'login_locked', 'denied', 'login_blocked', 'ingest_denied'].includes(r.event);
      return `<tr><td class="n">${fmtAt(r.at)}</td><td class="l">${h(who)}</td><td class="l">${bad ? '<span class="dn">' : ''}${h(EVENT_NAMES[r.event] || r.event)}${bad ? '</span>' : ''}<span class="sm">${h(extra)}</span></td><td class="l">${h(DIR_NAMES[r.direction] || r.direction || '')}</td><td class="l"><span class="sm">${h(d.ip || '')}</span></td></tr>`;
    }).join('');
    this.open('Журнал доступа', `<p class="note">Последние 300 событий, время — Алматы. Красным — неудачные попытки и отказы.</p>
      <div class="tw"><table><thead><tr><th>Когда</th><th class="l">Кто</th><th class="l">Событие</th><th class="l">Направление</th><th class="l">IP</th></tr></thead><tbody>${body || '<tr><td class="l note" colspan="5">Событий нет</td></tr>'}</tbody></table></div>`);
  },
};

Auth.boot();

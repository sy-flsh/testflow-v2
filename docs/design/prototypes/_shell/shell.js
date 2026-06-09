/* ════════════════════════════════════════════════════════════════════
   TMS Prototype Shell loader
   - <header class="app-header"> 에 header.html inject
   - <aside class="app-sidebar"> 에 sidebar.html inject
   - #app-shell 의 data-* 속성으로 active 메뉴 / workspace 모드 제어
   사용: README 참조
   ════════════════════════════════════════════════════════════════════ */

(async function loadPubShell() {
  // 인증 전 화면 (S-AUTH-*) 공통 헤더 inject
  const pub = document.getElementById('pub-shell');
  if (!pub) return;
  const pubHost = pub.querySelector('.pub-header');
  if (!pubHost) {
    console.warn('[pub-shell] .pub-header missing inside #pub-shell');
    return;
  }
  try {
    const html = await fetch('_shell/pub-header.html').then(r => r.text());
    pubHost.innerHTML = html;
  } catch (err) {
    console.error('[pub-shell] partial fetch failed — 로컬 서버 실행 필요', err);
    return;
  }
  // active action (login / signup) 표시
  const active = pub.dataset.pubActive;
  if (active) {
    const link = pubHost.querySelector(`[data-pub-action="${active}"]`);
    if (link) link.setAttribute('aria-current', 'page');
  }
})();

(async function loadShell() {
  const shell = document.getElementById('app-shell');
  if (!shell) {
    // 인증 후 shell 미사용 페이지 — 정상. pub-shell 만 동작.
    return;
  }
  const headerHost = shell.querySelector('.app-header');
  const sidebarHost = shell.querySelector('.app-sidebar');
  if (!headerHost || !sidebarHost) {
    console.warn('[shell] .app-header / .app-sidebar missing inside #app-shell');
    return;
  }

  // 상대 경로 — 현 페이지(_shell의 부모 디렉터리) 기준
  const base = '_shell/';

  try {
    const [headerHtml, sidebarHtml] = await Promise.all([
      fetch(base + 'header.html').then(r => r.text()),
      fetch(base + 'sidebar.html').then(r => r.text()),
    ]);
    headerHost.innerHTML = headerHtml;
    sidebarHost.innerHTML = sidebarHtml;
  } catch (err) {
    console.error('[shell] partial fetch failed — 로컬 서버로 실행했는지 확인 (file:// 직접 열기 불가)', err);
    return;
  }

  // 1) Top nav active
  const topNav = shell.dataset.topNav;
  if (topNav) {
    const link = headerHost.querySelector(`.topbar-nav-link[data-nav="${topNav}"]`);
    if (link) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  }

  // 2) Sidebar menu active
  const activeMenu = shell.dataset.activeMenu;
  if (activeMenu) {
    const item = sidebarHost.querySelector(`.nav-item[data-menu="${activeMenu}"]`);
    if (item) {
      item.classList.add('is-active');
      item.setAttribute('aria-current', 'page');
    }
  }

  // 3) Workspace 모드 slot 주입
  const wsName = shell.dataset.workspaceName;
  if (wsName) {
    const logoSlot = headerHost.querySelector('[data-slot="logo-text"]');
    if (logoSlot) logoSlot.textContent = wsName;
    const wsSlot = sidebarHost.querySelector('[data-slot="ws-name"]');
    if (wsSlot) wsSlot.textContent = wsName;
  }

  // 4) 사용자 슬롯 (avatar 글자 / aria-label)
  const userInitial = shell.dataset.userInitial;
  const userName = shell.dataset.userName;
  if (userInitial || userName) {
    const avatar = headerHost.querySelector('[data-slot="avatar"]');
    if (avatar) {
      if (userInitial) avatar.textContent = userInitial;
      if (userName) avatar.setAttribute('aria-label', userName);
    }
  }

  // 5) Toast / Notification 인프라
  initToastAndNotifications(headerHost);
})();

/* ════════════════════════════════════════════════════════════════════
   Toast + Notification
   - window.tmsToast({ variant, title, desc, duration })
     · variant: 'success' | 'error' | 'info'  (기본 success)
     · duration ms (기본 4000, 0 이면 영구)
   - window.tmsNotify({ type, title, desc, ts? })
     · localStorage 'tms.notifications' 에 push (FIFO, 최대 50)
     · 종 버튼 unread 배지 갱신
   - 두 API는 독립. 동일 이벤트에 양쪽 호출하여 토스트 + 알림센터 동기화.
   ════════════════════════════════════════════════════════════════════ */
const NOTIF_STORE_KEY = 'tms.notifications';
const NOTIF_MAX = 50;

const SVG_CHECK    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const SVG_ALERT    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16.5" x2="12" y2="16.5"/></svg>';
const SVG_INFO     = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="7.5" x2="12" y2="7.5"/></svg>';
const SVG_CLOSE    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';

function variantIcon(v) {
  if (v === 'error') return SVG_ALERT;
  if (v === 'info')  return SVG_INFO;
  return SVG_CHECK;
}

function readNotifs() {
  try {
    const raw = localStorage.getItem(NOTIF_STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) { return []; }
}
function writeNotifs(arr) {
  try { localStorage.setItem(NOTIF_STORE_KEY, JSON.stringify(arr.slice(-NOTIF_MAX))); }
  catch (_) { /* quota / private mode */ }
}
function unreadCount(arr) { return arr.filter(n => !n.read).length; }

function formatTs(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return Math.floor(diff / 60) + '분 전';
  if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
  const days = Math.floor(diff / 86400);
  if (days < 7) return days + '일 전';
  return d.toLocaleDateString('ko-KR');
}

function initToastAndNotifications(headerHost) {
  // ─── Toast container (body 직속) ───
  let toastContainer = document.querySelector('.tms-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'tms-toast-container';
    toastContainer.setAttribute('role', 'region');
    toastContainer.setAttribute('aria-label', '알림 메시지');
    toastContainer.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastContainer);
  }

  window.tmsToast = function tmsToast(opts) {
    opts = opts || {};
    const variant = opts.variant || 'success';
    const duration = opts.duration == null ? 4000 : opts.duration;
    const toast = document.createElement('div');
    toast.className = 'tms-toast';
    toast.setAttribute('data-variant', variant);
    toast.setAttribute('role', 'status');
    toast.innerHTML =
      '<span class="tms-toast-icon" aria-hidden="true">' + variantIcon(variant) + '</span>' +
      '<div class="tms-toast-body">' +
        '<p class="tms-toast-title"></p>' +
        '<p class="tms-toast-desc"></p>' +
      '</div>' +
      '<button class="tms-toast-close" type="button" aria-label="닫기">' + SVG_CLOSE + '</button>';
    toast.querySelector('.tms-toast-title').textContent = opts.title || '';
    const descEl = toast.querySelector('.tms-toast-desc');
    if (opts.desc) { descEl.textContent = opts.desc; } else { descEl.remove(); }
    function dismiss() {
      if (toast.classList.contains('is-leaving')) return;
      toast.classList.add('is-leaving');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }
    toast.querySelector('.tms-toast-close').addEventListener('click', dismiss);
    toastContainer.appendChild(toast);
    if (duration > 0) setTimeout(dismiss, duration);
    return { dismiss };
  };

  // ─── Notification (헤더 종 버튼) ───
  const wrap     = headerHost.querySelector('[data-slot="notif-wrap"]');
  const trigger  = headerHost.querySelector('[data-slot="notif-trigger"]');
  const dropdown = headerHost.querySelector('[data-slot="notif-dropdown"]');
  const badge    = headerHost.querySelector('[data-slot="notif-badge"]');
  const listEl   = headerHost.querySelector('[data-slot="notif-list"]');
  const emptyEl  = headerHost.querySelector('[data-slot="notif-empty"]');
  const markAll  = headerHost.querySelector('[data-slot="notif-mark-all"]');

  function renderBadge() {
    const n = unreadCount(readNotifs());
    if (n <= 0) { badge.classList.remove('is-visible'); badge.textContent = '0'; }
    else { badge.classList.add('is-visible'); badge.textContent = n > 99 ? '99+' : String(n); }
  }
  function renderList() {
    const items = readNotifs().slice().reverse();
    listEl.innerHTML = '';
    if (items.length === 0) { listEl.appendChild(emptyEl); return; }
    items.forEach(n => {
      const item = document.createElement('div');
      item.className = 'tms-notif-item';
      item.setAttribute('data-type', n.type || 'success');
      item.setAttribute('data-read', String(!!n.read));
      item.innerHTML =
        '<span class="tms-notif-item-dot" aria-hidden="true">' + variantIcon(n.type === 'error' ? 'error' : n.type === 'info' ? 'info' : 'success') + '</span>' +
        '<div class="tms-notif-item-body">' +
          '<p class="tms-notif-item-title"></p>' +
          '<p class="tms-notif-item-desc"></p>' +
          '<span class="tms-notif-item-ts"></span>' +
        '</div>';
      item.querySelector('.tms-notif-item-title').textContent = n.title || '';
      const desc = item.querySelector('.tms-notif-item-desc');
      if (n.desc) desc.textContent = n.desc; else desc.remove();
      item.querySelector('.tms-notif-item-ts').textContent = formatTs(n.ts);
      listEl.appendChild(item);
    });
  }
  function openDropdown() {
    dropdown.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    renderList();
  }
  function closeDropdown() {
    dropdown.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
  }
  function toggleDropdown() {
    if (dropdown.classList.contains('is-open')) closeDropdown(); else openDropdown();
  }
  trigger.addEventListener('click', e => { e.stopPropagation(); toggleDropdown(); });
  document.addEventListener('click', e => {
    if (!wrap.contains(e.target)) closeDropdown();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && dropdown.classList.contains('is-open')) closeDropdown();
  });
  markAll.addEventListener('click', () => {
    const arr = readNotifs().map(n => ({ ...n, read: true }));
    writeNotifs(arr);
    renderBadge(); renderList();
  });

  window.tmsNotify = function tmsNotify(payload) {
    payload = payload || {};
    const entry = {
      id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      type:  payload.type  || 'success',
      title: payload.title || '',
      desc:  payload.desc  || '',
      ts:    payload.ts    || Date.now(),
      read:  false,
    };
    const arr = readNotifs();
    arr.push(entry);
    writeNotifs(arr);
    renderBadge();
    if (dropdown.classList.contains('is-open')) renderList();
    return entry;
  };

  renderBadge();
}

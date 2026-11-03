'use strict';
/* 한 페이지 구성의 동작 — 등장 모션, 상단 바 색, 점 표시, 메뉴 전환.
 * 검사 로직과는 관계가 없다(그쪽은 rules.js / app.js). */
(function () {

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

const PANELS = ['check', 'usage', 'guide', 'prompts'];
const workspace = $('#workspace');

/* ── 메뉴 전환 ── */
function openPanel(id, scroll) {
  if (!PANELS.includes(id)) return;
  PANELS.forEach((p) => $('#panel-' + p).classList.toggle('hidden', p !== id));
  $$('#op-tabs button').forEach((b) => {
    const on = b.dataset.open === id;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  if (id === 'guide') {
    const f = $('#guide-frame');
    if (!f.getAttribute('src')) f.setAttribute('src', f.dataset.src); // 처음 열 때만 불러온다(원문이 커서)
  }
  try { history.replaceState(null, '', '#' + id); } catch (e) { /* file:// 등 */ }
  if (scroll) workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
$$('[data-open]').forEach((el) => el.addEventListener('click', () => openPanel(el.dataset.open, true)));

function openFromHash() {
  const h = location.hash.slice(1);
  if (PANELS.includes(h)) openPanel(h, true);
}
window.addEventListener('hashchange', openFromHash);
if (PANELS.includes(location.hash.slice(1))) {
  // 레이아웃이 잡힌 뒤에 이동한다
  window.addEventListener('load', () => setTimeout(openFromHash, 50));
}

/* 기재요령 검색(iframe)은 안쪽 높이를 알려 주면 그만큼 늘린다 — 바깥 화면 하나로 스크롤되게 한다. */
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || !e.data || e.data.type !== 'guide-height') return;
  const h = Number(e.data.height);
  if (h > 200) $('#guide-frame').style.height = Math.ceil(h) + 'px';
});

/* ── 등장 모션: 화면에 들어올 때마다 다시 재생 ── */
const reveals = $$('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => en.target.classList.toggle('in', en.isIntersecting));
  }, { threshold: 0.2 });
  reveals.forEach((el) => io.observe(el));
} else {
  reveals.forEach((el) => el.classList.add('in'));
}

/* ── 상단 바 색 / 오른쪽 점: 화면 한가운데 선에 걸린 구역이 현재 구역 ── */
const top = $('#op-top');
const dots = $$('.op-dots a');
if ('IntersectionObserver' in window) {
  const cur = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const id = en.target.id;
      dots.forEach((d) => d.classList.toggle('is-active', d.dataset.for === id));
      top.classList.toggle('on-dark', id === 'hero');
    });
  }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
  ['hero', 'menu', 'workspace'].forEach((id) => cur.observe(document.getElementById(id)));
} else {
  top.classList.add('on-dark');
}

/* ── 첫 화면이 위로 밀려 나갈 때 살짝 작아지며 흐려진다 ── */
const heroInner = $('.op-hero-inner');
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const p = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
    heroInner.style.transform = `translateY(${-p * 48}px) scale(${1 - p * 0.05})`;
    heroInner.style.opacity = String(1 - p * 0.85);
    ticking = false;
  });
}
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ── 휠 한 번에 다음 화면으로 ──
 * css 스냅만으로는 휠 몇 칸을 굴려도 화면 절반을 못 넘으면 제자리로 튕겨 돌아온다.
 * 소개·메뉴 화면에서는 휠이 한 번 오면 다음/이전 화면으로 넘기고, 넘어가는 동안(잠금)에는
 * 이어서 들어오는 휠(트랙패드 관성 포함)을 무시한다. 내용 화면 안에서는 평소처럼 스크롤된다.
 * 키보드·터치는 css 스냅이 맡는다. */
const stops = ['hero', 'menu', 'workspace'].map((id) => document.getElementById(id));
let locked = false;
let lastScrollAt = 0;
window.addEventListener('scroll', () => { lastScrollAt = performance.now(); }, { passive: true });

function goTo(el) {
  locked = true;
  window.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
  setTimeout(() => { locked = false; }, 900);
}

window.addEventListener('wheel', (e) => {
  if (e.ctrlKey || Math.abs(e.deltaY) < 4) return;               // 확대 제스처·미세한 흔들림
  if ($('#settings-modal') && !$('#settings-modal').classList.contains('hidden')) return;
  if (locked) { e.preventDefault(); return; }
  const y = window.scrollY;
  const tops = stops.map((el) => el.offsetTop);
  // 가장 가까운 구역
  let i = 0;
  tops.forEach((t, k) => { if (Math.abs(t - y) < Math.abs(tops[i] - y)) i = k; });
  const atStop = Math.abs(tops[i] - y) < 6;
  if (e.deltaY > 0) {
    if (i < 2 && atStop) { e.preventDefault(); goTo(stops[i + 1]); }
  } else if (i > 0 && atStop && performance.now() - lastScrollAt > 250) {
    // 내용 화면 맨 위에서 더 올리면 메뉴로. 막 스크롤하던 관성은 제외한다.
    e.preventDefault(); goTo(stops[i - 1]);
  }
}, { passive: false });

})();

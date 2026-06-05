/* assets/journey.js — 互動改造(零打包,單一 IIFE) */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;

  root.classList.add('js-journey');
  if (reduceMotion) root.classList.add('reduced-motion');

  // ---- 平滑捲動(Lenis) ----
  let lenis = null;
  if (!reduceMotion && window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
  }

  // ---- GSAP + ScrollTrigger,並用 gsap.ticker 驅動 Lenis(官方建議模式) ----
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    if (lenis) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    }
  } else if (lenis) {
    // 沒有 GSAP 時自行 rAF 驅動
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  // ---- 頁內 anchor 接管(用 Lenis 平滑捲動,蓋過既有 window.scrollTo) ----
  // capture phase 以搶在既有 inline handler 之前;用 stopPropagation(非 immediate)
  // 才不會擋掉日後其他 capture-phase 監聽器(如分析追蹤)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (!id || id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    if (lenis) lenis.scrollTo(target, { offset: -80, duration: 1.1 });
    else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }, true);

  // === 模組掛載點(後續 Task 在此之前 append 函式呼叫) ===
  // INIT_HOOK

  // 對外暴露(供後續模組使用)
  window.__journey = { lenis, reduceMotion, isTouch };
})();

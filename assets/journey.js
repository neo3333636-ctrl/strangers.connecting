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

  // === 模組 ===

  // Hero:穿門推進 + 標題遮罩揭示
  function initHero() {
    const hero = document.querySelector('[data-journey-hero]');
    if (!hero || !window.gsap) return;

    // 標題遮罩(SplitType 切字),載入即播
    const title = hero.querySelector('.hero-title');
    if (title && window.SplitType && !reduceMotion) {
      const split = new SplitType(title, { types: 'chars', tagName: 'span' });
      gsap.from(split.chars, {
        yPercent: 120, opacity: 0, duration: 0.85, ease: 'power3.out',
        stagger: 0.03, delay: 0.25,
      });
    }

    if (reduceMotion) return; // 不做穿門,維持靜態

    const photo = hero.querySelector('.hero-photo');
    const frame = hero.querySelector('.hero-frame');
    const content = hero.querySelector('.hero-content');

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero, start: 'top top', end: '+=120%',
        scrub: 1, pin: true, anticipatePin: 1,
      },
    });
    // 照片放大=往房間裡走;門框放更快並淡出=穿過門;內容淡出上移
    tl.to(photo,   { scale: 1.6, ease: 'none' }, 0)
      .to(frame,   { scale: 2.8, opacity: 0, ease: 'none' }, 0)
      .to(content, { opacity: 0, y: -40, ease: 'none' }, 0);
  }
  initHero();

  // INIT_HOOK

  // 對外暴露(供後續模組使用)
  window.__journey = { lenis, reduceMotion, isTouch };
})();

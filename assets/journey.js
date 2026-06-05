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
      // GSAP 接管標題進場:關掉既有 heroEnter/softFloat/softGlow CSS 動畫
      // (它們會延遲到 0.7s 並持續干擾逐字遮罩),改由 GSAP 自己揭示。
      // 只在這條 GSAP 路徑關;reduced-motion / 無 SplitType 的後備仍走原本 CSS 進場。
      title.style.animation = 'none';
      title.style.opacity = '1';
      const split = new SplitType(title, { types: 'chars', tagName: 'span' });
      gsap.from(split.chars, {
        yPercent: 120, opacity: 0, duration: 0.85, ease: 'power3.out',
        stagger: 0.03, delay: 0.25,
      });
    }

    if (reduceMotion) return; // 不做穿門,維持靜態
    // 手機:略過 pin/縮放穿門(效能/暈眩),標題遮罩仍保留
    if (window.matchMedia('(max-width: 640px)').matches) return;

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

  // 輕量視差:zone 進場時,標題群緩緩上浮一點,製造「往裡走一階」的層次
  function initParallax() {
    if (reduceMotion || !window.gsap) return;
    if (window.matchMedia('(max-width: 640px)').matches) return; // 手機不跑視差
    document.querySelectorAll('[data-parallax-zone]').forEach((zone) => {
      const head = zone.querySelector('.chapter-title');
      if (!head) return;
      gsap.fromTo(head, { y: 40 }, {
        y: -20, ease: 'none',
        // 'top 80%' 而非 'top bottom':等既有 .reveal 進場 transition 先落定,
        // 才開始視差 scrub,避免父層 .chapter-head 與子層標題的位移短暫疊加
        scrollTrigger: { trigger: zone, start: 'top 80%', end: 'top center', scrub: 1 },
      });
    });
  }
  initParallax();

  // 跨頁穿門轉場
  function initDoor() {
    if (reduceMotion) return;
    const overlay = document.createElement('div');
    overlay.className = 'door-transition';
    overlay.innerHTML = '<div class="door-transition__panel"></div>';
    document.body.appendChild(overlay);

    // 進場:若是從站內 door 連結過來,先蓋住再收回
    if (sessionStorage.getItem('door') === '1') {
      sessionStorage.removeItem('door');
      root.classList.add('door-entering');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        root.classList.remove('door-entering');
        root.classList.add('door-open');
      }));
    }

    // 離場:點 data-door 連結 → 蓋住 → 導航
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-door]');
      if (!a) return;
      const url = a.href;
      if (!url || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      sessionStorage.setItem('door', '1');
      root.classList.remove('door-open');
      root.classList.add('door-closing');
      setTimeout(() => { window.location.href = url; }, 620);
    });
  }
  initDoor();

  // 區塊揭示:[data-reveal] 進視窗才淡入上移(子頁用;首頁沿用既有 .reveal,互不干擾)
  function initReveal() {
    const els = document.querySelectorAll('[data-reveal]');
    if (!els.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-revealed'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach((el) => io.observe(el));
  }
  initReveal();

  // 磁吸按鈕:游標靠近時被吸引,離開彈性回位(桌機 hover 才啟用)
  function initMagnetic() {
    if (isTouch || reduceMotion || !window.gsap) return;
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      const strength = parseFloat(el.getAttribute('data-magnetic')) || 0.35;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        gsap.to(el, {
          x: (e.clientX - (r.left + r.width / 2)) * strength,
          y: (e.clientY - (r.top + r.height / 2)) * strength,
          duration: 0.4, ease: 'power3.out',
        });
      });
      el.addEventListener('pointerleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
      });
    });
  }
  initMagnetic();

  // 游標暖光:互動元素附近浮一個燭光小點
  function initCursor() {
    if (isTouch || reduceMotion) return;
    const dot = document.createElement('div');
    dot.className = 'journey-cursor';
    document.body.appendChild(dot);
    let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
    addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; });
    const loop = () => { x += (tx - x) * 0.18; y += (ty - y) * 0.18;
      dot.style.transform = `translate(${x}px, ${y}px)`; requestAnimationFrame(loop); };
    loop();
    const hot = 'a, button, [data-magnetic], .reveal a';
    document.addEventListener('pointerover', (e) => {
      if (e.target.closest(hot)) dot.classList.add('is-hot');
    });
    document.addEventListener('pointerout', (e) => {
      if (e.target.closest(hot)) dot.classList.remove('is-hot');
    });
  }
  initCursor();

  // INIT_HOOK

  // 對外暴露(供後續模組使用)
  window.__journey = { lenis, reduceMotion, isTouch };
})();

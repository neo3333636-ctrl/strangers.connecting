/* Shared JS for sub-pages — hamburger menu toggle */
(function () {
  const toggle = document.getElementById('menuToggle');
  const menu = document.getElementById('mobileMenu');
  if (!toggle || !menu) return;

  function openMenu() {
    menu.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      menu.classList.add('open');
    }));
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', '關閉選單');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    menu.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', '開啟選單');
    document.body.style.overflow = '';
    setTimeout(() => { menu.hidden = true; }, 280);
  }
  function toggleMenu() {
    if (menu.classList.contains('open')) closeMenu(); else openMenu();
  }

  toggle.addEventListener('click', toggleMenu);

  menu.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => {
      if (menu.classList.contains('open')) closeMenu();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('open')) closeMenu();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 880 && menu.classList.contains('open')) closeMenu();
  });
})();

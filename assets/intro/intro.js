/* Intro animation controller — chrome black overlay with two walkers morphing
 * to the brand logo, then handing off to the hero.
 *
 * Future Lottie swap: change INTRO_MODE to 'lottie' and supply a .json. The
 * surrounding sessionStorage / reduced-motion / event plumbing stays.
 */
(function () {
  'use strict';

  const INTRO_MODE = 'svg'; // 'svg' | 'lottie'
  const STORAGE_KEY = 'intro-seen';
  const SAFETY_MS = 3500;
  const PHASES = {
    walk:   { start:    0, end: 1400 },
    meet:   { start: 1400, end: 1800 },
    morph:  { start: 1800, end: 2200 },
    settle: { start: 2200, end: 2400 },
  };

  const body = document.body;
  const overlay = document.getElementById('introOverlay');

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function shouldSkip() {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === '1') return true;
    } catch (e) { /* private mode, no-op */ }
    if (window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return true;
    }
    return false;
  }

  function markSeen() {
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
  }

  function endIntro() {
    if (!overlay || body.classList.contains('intro-done')) return;
    overlay.classList.add('is-fading');
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      body.classList.remove('intro-playing');
      body.classList.add('intro-done');
    }, 400);
    markSeen();
  }

  function skipImmediately() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    body.classList.add('intro-done');
    markSeen();
  }

  // ── SVG mode animation ────────────────────────────────────────────────
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function runSvgAnimation() {
    const left = document.getElementById('leftWalker');
    const right = document.getElementById('rightWalker');
    const stream = document.getElementById('introStream');
    const target = document.getElementById('logoTarget');
    if (!left || !right || !stream || !target) {
      // markup missing — fail safe
      skipImmediately();
      return;
    }

    // Start positions baked into the SVG: cx=120 (left) and cx=680 (right).
    // Centre = 400. Walkers need to end at cx≈360 and cx≈440 (touching, but
    // not overlapping — leaves room for the morph to spread into the logo
    // silhouettes which span x=320..600).
    const LEFT_END_DX = 360 - 120;   // +240
    const RIGHT_END_DX = 440 - 680;  // -240

    const t0 = performance.now();
    let safetyFired = false;

    function frame(now) {
      const t = now - t0;

      // Phase A: walk
      if (t < PHASES.walk.end) {
        const p = easeOut(t / PHASES.walk.end);
        left.setAttribute('transform',  'translate(' + (LEFT_END_DX * p)  + ' 0)');
        right.setAttribute('transform', 'translate(' + (RIGHT_END_DX * p) + ' 0)');
        // stream fades in from 70% of walk onward
        if (p > 0.7) {
          stream.setAttribute('opacity', String((p - 0.7) / 0.3 * 0.5));
        }
      }
      // Phase B: meet + pulse
      else if (t < PHASES.meet.end) {
        const p = (t - PHASES.meet.start) / (PHASES.meet.end - PHASES.meet.start);
        const pulse = 1 + Math.sin(p * Math.PI) * 0.15;
        left.setAttribute('transform',
          'translate(' + LEFT_END_DX + ' 0) scale(' + pulse + ')');
        right.setAttribute('transform',
          'translate(' + RIGHT_END_DX + ' 0) scale(' + pulse + ')');
        stream.setAttribute('opacity', '0.7');
      }
      // Phase C: morph (crossfade walkers → logo target)
      else if (t < PHASES.morph.end) {
        const p = easeInOut(
          (t - PHASES.morph.start) / (PHASES.morph.end - PHASES.morph.start));
        left.setAttribute('opacity',  String(1 - p));
        right.setAttribute('opacity', String(1 - p));
        target.setAttribute('opacity', String(p));
        stream.setAttribute('opacity', String(0.7 * (1 - p)));
      }
      // Phase D: settle — logo at full opacity, brief hold
      else if (t < PHASES.settle.end) {
        left.setAttribute('opacity', '0');
        right.setAttribute('opacity', '0');
        target.setAttribute('opacity', '1');
      }
      // Done
      else {
        endIntro();
        return;
      }

      if (!safetyFired) requestAnimationFrame(frame);
    }

    // Safety net: if frames stop firing (background tab), force end.
    setTimeout(function () {
      safetyFired = true;
      endIntro();
    }, SAFETY_MS);

    requestAnimationFrame(frame);
  }

  function runLottieAnimation() {
    // Reserved for future. When you have a .json:
    //   1. Add <script src="https://cdn.jsdelivr.net/npm/lottie-web@5/build/player/lottie_light.min.js"></script>
    //   2. Replace runSvgAnimation with lottie.loadAnimation(...)
    //   3. On 'complete' event call endIntro()
    runSvgAnimation();
  }

  ready(function () {
    if (!overlay) return;

    if (shouldSkip()) {
      skipImmediately();
      return;
    }

    body.classList.add('intro-playing');
    if (INTRO_MODE === 'lottie') runLottieAnimation();
    else runSvgAnimation();
  });
})();

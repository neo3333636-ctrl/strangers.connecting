# 官網「走進餐廳」互動改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `strangers.connecting` 靜態官網改造成「走進一間有氛圍的餐廳」的互動體驗——捲動=往店裡深處走、點擊=穿門進到下一個空間——同時保留既有暖色品牌。

**Architecture:** 零打包、純 CDN。Lenis 提供慣性平滑捲動;GSAP + ScrollTrigger 驅動 hero 的「穿門推進」;沿用既有 `.reveal` IntersectionObserver 做區塊揭示;手寫 vanilla JS 做磁吸按鈕、游標暖光、跨頁穿門轉場。所有新動畫的程式抽到 `assets/journey.css` / `assets/journey.js`,不再塞進 145KB 的 `index.html`。全程 `prefers-reduced-motion` 與手機降級。

**Tech Stack:** Vanilla HTML/CSS/JS(無 build step / GitHub Pages)、Lenis、GSAP 3.12.5 + ScrollTrigger、SplitType 0.3.4。

---

## 測試方式說明(重要)

這是純靜態、無 build/test 框架的視覺網站。動畫屬於視覺整合,沒有有意義的自動化單元測試,**強行架設 headless 測試框架違反 YAGNI**。因此本計畫的「驗證」= **本機起站 + 瀏覽器實際觀察(必要時截圖)對照明確的預期行為**,並頻繁 commit。

每個任務的驗證都用同一個本機伺服器:

```bash
cd /Users/neoyang/strangers.connecting
python3 -m http.server 8080
# 開 http://localhost:8080/ 觀察;改完檔案重新整理即可
```

**Task 3(hero 穿門)完成後是驗證關卡 ——** 停下來請使用者親自滑一遍 hero,確認「對不對味」再繼續 Task 4+。

---

## File Structure

- **Create** `assets/journey.css` — 平滑捲動容器、hero 深度層、穿門轉場 overlay、磁吸/游標樣式、reduced-motion 與手機降級。
- **Create** `assets/journey.js` — Lenis 初始化、GSAP/ScrollTrigger 同步、anchor 平滑捲動、hero 穿門推進、磁吸按鈕、游標暖光、跨頁穿門轉場。單一 IIFE,各功能為獨立模組函式。
- **Modify** `index.html` — head 加 Lenis CSS + journey.css;body 結尾加 4 支 CDN JS + journey.js;hero 區塊改為深度層結構;nav/子頁連結標 `data-door`;CTA/nav 標 `data-magnetic`。
- **Modify** `about.html` / `faq.html` / `how-to-join.html` / `rules.html` — 引入 journey 資產、標 `data-door`、內容區塊沿用 `.reveal`(輕量)。
- **Modify** `privacy.html` / `terms.html` — 只引入 journey 資產(平滑捲動 + 穿門轉場),不加揭示編排。

> 注:既有 inline `<script>`(`index.html` ~line 5031)維持不動;既有 `.reveal` IntersectionObserver 繼續運作(Lenis 1.x 使用原生捲動位置,IntersectionObserver 不受影響)。

---

## Task 1: 基礎層 — CDN 載入 + journey.css/js 骨架 + Lenis 平滑捲動 + anchor 接管

**Files:**
- Create: `assets/journey.css`
- Create: `assets/journey.js`
- Modify: `index.html`(head 一處、body 結尾一處)

- [ ] **Step 1: 建立 `assets/journey.css`(基礎)**

```css
/* assets/journey.css — 互動改造樣式(零打包) */

/* Lenis 平滑捲動需要的基礎 */
html.lenis, html.lenis body { height: auto; }
.lenis.lenis-smooth { scroll-behavior: auto !important; }
.lenis.lenis-stopped { overflow: hidden; }

/* 進場前先隱藏要揭示的元素(避免閃現),JS 接管後再顯示。
   無 JS 時 .no-js 後備:全部顯示 */
html.js-journey [data-reveal] { opacity: 0; }
html.reduced-motion [data-reveal] { opacity: 1 !important; transform: none !important; }
```

- [ ] **Step 2: 建立 `assets/journey.js`(基礎:reduced-motion 旗標、Lenis、GSAP 同步、anchor 接管)**

```js
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
  // capture phase + stopImmediatePropagation 以搶在既有 inline handler 之前
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (!id || id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (lenis) lenis.scrollTo(target, { offset: -80, duration: 1.1 });
    else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }, true);

  // === 模組掛載點(後續 Task 在此之前 append 函式呼叫) ===
  // INIT_HOOK

  // 對外暴露(供後續模組使用)
  window.__journey = { lenis, reduceMotion, isTouch };
})();
```

- [ ] **Step 3: 在 `index.html` <head> 載入 Lenis CSS + journey.css**

在既有 Google Fonts `<link ... Fraunces ...>` 之後、`<style>` 之前,插入:

```html
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lenis@1/dist/lenis.css" />
  <link rel="stylesheet" href="assets/journey.css" />
```

- [ ] **Step 4: 在 `index.html` body 結尾載入 CDN JS + journey.js**

在檔案末端 `</body>` 之前(既有 inline `<script>` 之後)插入:

```html
  <script src="https://cdn.jsdelivr.net/npm/lenis@1/dist/lenis.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/split-type@0.3.4/umd/index.min.js"></script>
  <script src="assets/journey.js"></script>
```

- [ ] **Step 5: 驗證(本機起站)**

Run:
```bash
cd /Users/neoyang/strangers.connecting && python3 -m http.server 8080
```
開 `http://localhost:8080/`,預期:
- 滑鼠滾輪 / 觸控板捲動有「慣性、緩衝」感(不是系統預設硬捲)。
- 點 hero 的「Scroll」往下走,平滑捲到 `#opening`,**只捲一次、不會抖**(代表 anchor 接管成功、沒和既有 handler 打架)。
- DevTools Console 無紅色錯誤;`document.documentElement.classList` 含 `js-journey`。
- 在系統開啟「減少動態效果」後重新整理,頁面用原生捲動、內容完整可讀。

- [ ] **Step 6: Commit**

```bash
git add assets/journey.css assets/journey.js index.html
git commit -m "feat(journey): add Lenis smooth scroll + GSAP foundation"
```

---

## Task 2: Hero 深度層 — 改 markup + 靜態樣式(尚未加動畫)

把 hero 從單張 `hero-cover.jpg` 換成 `how-doorway.jpg`,並加一層「門框暈影」overlay。本任務只做**靜態**版面,確認構圖對位;動畫在 Task 3。

**Files:**
- Modify: `index.html`(hero-media 區塊,line ~4546-4557)
- Modify: `assets/journey.css`(append hero 樣式)

- [ ] **Step 1: 改 `index.html` 的 hero-media 與 section 標記**

把這段(line ~4539 與 ~4546-4557):

```html
        <section class="hero" id="top">
```
改為(在 section 加 `data-journey-hero`):
```html
        <section class="hero" id="top" data-journey-hero>
```

並把 `.hero-media` 內容:
```html
         <div class="hero-media" aria-hidden="true">
  <div class="hero-poster"></div>

<img
  class="hero-video"
  id="heroImage"
  src="assets/images/hero-cover.jpg"
  alt="陌生連結所背景圖片"
/>
</div>
```
改為:
```html
         <div class="hero-media" aria-hidden="true">
  <div class="hero-poster"></div>
  <img
    class="hero-photo"
    id="heroImage"
    src="images/how-doorway.jpg"
    alt="推開門，走進一間溫暖的餐廳"
  />
  <div class="hero-frame" aria-hidden="true"></div>
</div>
```

- [ ] **Step 2: append hero 樣式到 `assets/journey.css`**

```css
/* ---- Hero 深度層(穿門推進) ---- */
[data-journey-hero] .hero-media { position: absolute; inset: 0; overflow: hidden; }
[data-journey-hero] .hero-photo {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; object-position: 58% 42%;
  transform-origin: 58% 42%; will-change: transform;
}
/* 門框暈影:把暖光房間「框」在中央,捲動時這層放更快+淡出=穿過門 */
[data-journey-hero] .hero-frame {
  position: absolute; inset: 0; pointer-events: none;
  transform-origin: 58% 42%; will-change: transform, opacity;
  background: radial-gradient(120% 120% at 58% 42%,
    rgba(15,14,13,0) 28%, rgba(15,14,13,0.15) 46%,
    rgba(15,14,13,0.6) 74%, rgba(15,14,13,0.92) 100%);
}
```

- [ ] **Step 3: 驗證**

重新整理 `http://localhost:8080/`,預期:
- Hero 背景變成 `how-doorway.jpg`(推門進餐廳那張),中央暖光房間清楚、四周被暈影壓暗成「門框」感。
- 標題「把生活圈,重新打開。」與品牌字仍清楚可讀(暈影沒蓋掉文字)。
- 若文字被壓太暗:微調 `.hero-frame` 的暗度或既有 `.hero-overlay`。

- [ ] **Step 4: Commit**

```bash
git add index.html assets/journey.css
git commit -m "feat(journey): restructure hero into doorway depth layers (static)"
```

---

## Task 3: Hero 穿門推進 + 標題遮罩揭示(★ 驗證關卡)

**Files:**
- Modify: `assets/journey.js`(在 `// INIT_HOOK` 處 append hero 模組)
- Modify: `assets/journey.css`(標題遮罩樣式)

- [ ] **Step 1: 標題遮罩需要的 CSS(append `assets/journey.css`)**

```css
/* 標題逐字遮罩:單行裁切,字從線下被抬出來 */
[data-journey-hero] .hero-title-line { display: inline-block; overflow: hidden; }
[data-journey-hero] .hero-title .char { display: inline-block; will-change: transform; }
```

- [ ] **Step 2: 在 `assets/journey.js` 的 `// INIT_HOOK` 上方插入 hero 模組與呼叫**

把:
```js
  // === 模組掛載點(後續 Task 在此之前 append 函式呼叫) ===
  // INIT_HOOK
```
改為:
```js
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
```

- [ ] **Step 3: 驗證(★ 對不對味關卡)**

重新整理 `http://localhost:8080/`,預期:
- 載入時標題「把生活圈,重新打開。」**逐字從下方被抬出來**(有時間差)。
- 開始往下捲時,hero **被釘住(pin)**,畫面**放大鑽進中央暖光房間**、門框暈影向外擴張並淡開——主觀像「推開門走進去」;同時 hero 文字淡出。
- 穿過後接到 `#opening` 區塊,後續捲動正常。
- 手機尺寸(DevTools 切 responsive)不會破版;開 reduced-motion 時 hero 靜態、標題直接顯示。

⚠️ **停在這裡,請使用者親自滑一遍 hero 確認感覺。** 需要時調整 `scale`(1.6 / 2.8)、`end`('+=120%')、`transform-origin`(58% 42%)對準門內房間的消失點。確認後再繼續。

- [ ] **Step 4: Commit**

```bash
git add assets/journey.js assets/journey.css
git commit -m "feat(journey): hero push-through-doorway scroll + masked title reveal"
```

---

## Task 4: 首頁區塊揭示連貫性 + events 前的輕量門檻

確認既有 `.reveal` 在 Lenis 下仍正常,補上缺揭示的區塊,並在進入 `#events`(一桌一個故事)前加一個**輕量**視差門檻當第二個「走進去」節點。

**Files:**
- Modify: `index.html`(替關鍵區塊補 `.reveal`;在 `#events` 加視差屬性)
- Modify: `assets/journey.js`(append 輕量視差模組)
- Modify: `assets/journey.css`(視差樣式)

- [ ] **Step 1: 確認既有 `.reveal` 在 Lenis 下運作**

捲動首頁,觀察 About / Past Moments / Voices / How / Rules 等含 `.reveal` 的元素是否仍**進入視窗才淡入**。預期:正常(Lenis 用原生捲動位置,IntersectionObserver 不受影響)。若某區塊本來就沒有 `.reveal` 又希望它揭示,於該元素 class 加上 `reveal`。

- [ ] **Step 2: 在 `#events` section 加視差標記(`index.html` line ~4697)**

把:
```html
        <section class="section-light" id="events">
```
改為:
```html
        <section class="section-light" id="events" data-parallax-zone>
```

- [ ] **Step 3: append 視差模組到 `assets/journey.js`(在 `// INIT_HOOK` 上方)**

```js
  // 輕量視差:zone 進場時,標題群緩緩上浮一點,製造「往裡走一階」的層次
  function initParallax() {
    if (reduceMotion || !window.gsap) return;
    document.querySelectorAll('[data-parallax-zone]').forEach((zone) => {
      const head = zone.querySelector('.chapter-title');
      if (!head) return;
      gsap.fromTo(head, { y: 40 }, {
        y: -20, ease: 'none',
        scrollTrigger: { trigger: zone, start: 'top bottom', end: 'top center', scrub: 1 },
      });
    });
  }
  initParallax();

```
(插在 `initHero();` 之後、`// INIT_HOOK` 之前。)

- [ ] **Step 4: 驗證**

重新整理,捲到「Open Events」前,預期該區的章節標題隨捲動有**輕微上浮位移**(細緻、不誇張),營造再往裡走一層的感覺;其餘 `.reveal` 區塊淡入正常;reduced-motion 下無位移。

- [ ] **Step 5: Commit**

```bash
git add index.html assets/journey.js assets/journey.css
git commit -m "feat(journey): reuse .reveal under Lenis + light parallax threshold before events"
```

---

## Task 5: 跨頁穿門轉場(iris 光圈)

點到別頁時,從畫面中央(門的方向)擴張一個暖色光圈蓋住 → 換頁 → 新頁載入時光圈收回。只在**站內頁間**觸發(用 sessionStorage 旗標),直接載入首頁不會有 intro 蓋幕。

**Files:**
- Modify: `assets/journey.css`(append door 樣式)
- Modify: `assets/journey.js`(append door 模組)
- Modify: `index.html`(把指向 `.html` 別頁的連結標 `data-door`)

- [ ] **Step 1: append door 樣式到 `assets/journey.css`**

```css
/* ---- 跨頁穿門轉場(iris 光圈) ---- */
.door-transition { position: fixed; inset: 0; z-index: 9999; pointer-events: none; overflow: hidden; }
.door-transition__panel {
  position: absolute; left: 50%; top: 50%;
  width: 300vmax; height: 300vmax; margin: -150vmax 0 0 -150vmax;
  border-radius: 50%; transform: scale(0); transform-origin: center;
  background: radial-gradient(circle at 50% 50%, #2a2118 0%, #0f0e0d 70%);
  transition: transform .6s cubic-bezier(.76, 0, .24, 1);
}
html.door-closing .door-transition__panel { transform: scale(1); }   /* 蓋上 */
html.door-entering .door-transition__panel { transform: scale(1); transition: none; } /* 載入瞬間已蓋住 */
html.door-open .door-transition__panel { transform: scale(0); }      /* 收回露出新頁 */
html.reduced-motion .door-transition { display: none; }
```

- [ ] **Step 2: append door 模組到 `assets/journey.js`(在 `// INIT_HOOK` 上方)**

```js
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

```

- [ ] **Step 3: 在 `index.html` 把指向別頁的連結標 `data-door`**

找出 nav 與頁內所有指向站內 `.html` 別頁的 `<a href="about.html">`、`href="faq.html"`、`href="how-to-join.html"`、`href="rules.html"`(以及 footer 內的),於每個加上 `data-door` 屬性。例如:
```html
<a href="faq.html" data-door>常見問題</a>
```
(只標**站內頁面**;外部連結、`mailto:`、`#anchor`、LINE 連結**不要**標。)

- [ ] **Step 4: 驗證**

`http://localhost:8080/`,點任一個標了 `data-door` 的別頁連結,預期:暖色光圈從中央擴張蓋住畫面 → 跳到該頁 → 光圈收回露出新頁,**像穿過一道門走進下一間**。直接重新整理首頁則**不會**有蓋幕。reduced-motion 下為一般跳轉。

- [ ] **Step 5: Commit**

```bash
git add index.html assets/journey.css assets/journey.js
git commit -m "feat(journey): cross-page iris door transition between internal pages"
```

---

## Task 6: 子頁接上互動(輕量)+ 法律頁(只平滑捲動+轉場)

**Files:**
- Modify: `about.html`, `faq.html`, `how-to-join.html`, `rules.html`
- Modify: `privacy.html`, `terms.html`

- [ ] **Step 1: 六個子頁都引入 journey 資產**

每個檔案 <head>(既有字型 `<link>` 後)加:
```html
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lenis@1/dist/lenis.css" />
  <link rel="stylesheet" href="assets/journey.css" />
```
每個檔案 `</body>` 前加:
```html
  <script src="https://cdn.jsdelivr.net/npm/lenis@1/dist/lenis.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>
  <script src="assets/journey.js"></script>
```
(子頁的 hero 標題遮罩非必要,故**不**載入 SplitType;`initHero` 在找不到 `[data-journey-hero]` 時會自行 return。)

- [ ] **Step 2: 內容頁(about/faq/how-to-join/rules)標 `data-door` 與 `.reveal`**

- 把這四頁 nav / footer 指向其他站內 `.html` 的連結加 `data-door`(同 Task 5 規則)。
- 主要內容區塊(段落卡、標題群)的 class 加 `reveal`,做輕量依序淡入。**長文 FAQ / 規則條列以閱讀為先**,只在「區塊層級」加 `.reveal`,不要逐行、不要 scroll-jack。

- [ ] **Step 3: 法律頁(privacy/terms)只保留平滑捲動+轉場**

- 這兩頁**只**做 Step 1 的資產引入 + nav/footer 連結標 `data-door`。
- **不**加任何 `.reveal` 或 `data-parallax-zone`。

- [ ] **Step 4: 驗證**

逐一開 `http://localhost:8080/about.html`、`faq.html`、`how-to-join.html`、`rules.html`、`privacy.html`、`terms.html`,預期:
- 全部都有慣性平滑捲動;頁間互點有穿門光圈轉場。
- 內容頁:區塊進視窗輕量淡入,長文閱讀順暢不被打斷。
- 法律頁:只有平滑捲動 + 轉場,無花俏動畫。
- Console 無錯誤。

- [ ] **Step 5: Commit**

```bash
git add about.html faq.html how-to-join.html rules.html privacy.html terms.html
git commit -m "feat(journey): wire subpages (light reveals) + legal pages (scroll+transition only)"
```

---

## Task 7: 磁吸按鈕 + 游標暖光(桌機 hover 才有)

**Files:**
- Modify: `assets/journey.js`(append 模組)
- Modify: `assets/journey.css`(游標樣式)
- Modify: `index.html`(主要 CTA / nav 藥丸標 `data-magnetic`)

- [ ] **Step 1: append 模組到 `assets/journey.js`(在 `// INIT_HOOK` 上方)**

```js
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

```

- [ ] **Step 2: append 游標樣式到 `assets/journey.css`**

```css
/* ---- 游標暖光(桌機) ---- */
@media (hover: hover) {
  .journey-cursor {
    position: fixed; top: 0; left: 0; z-index: 9998; pointer-events: none;
    width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%;
    background: var(--accent-light, #e8c99a); mix-blend-mode: screen;
    box-shadow: 0 0 14px 4px rgba(232, 201, 154, 0.5);
    transition: width .25s, height .25s, margin .25s, background .25s;
  }
  .journey-cursor.is-hot {
    width: 34px; height: 34px; margin: -17px 0 0 -17px;
    background: var(--accent, #c17f4a);
  }
}
html.reduced-motion .journey-cursor { display: none; }
```

- [ ] **Step 3: 在 `index.html` 主要按鈕加 `data-magnetic`**

替 hero 的 `.hero-scroll-cue`、報名/LINE CTA、以及 nav 主要連結加 `data-magnetic`(預設強度,或 `data-magnetic="0.4"`)。例:
```html
<a class="hero-scroll-cue" href="#opening" aria-label="往下閱讀" data-magnetic>
```

- [ ] **Step 4: 驗證**

桌機 `http://localhost:8080/`,預期:游標跟著一個燭光小點(平滑跟隨);移到連結/按鈕上小點放大並轉成 `--accent` 暖橘;標了 `data-magnetic` 的按鈕在游標靠近時被輕輕吸過去、離開彈回。觸控裝置(DevTools 模擬)與 reduced-motion 下**完全不出現**這些效果。

- [ ] **Step 5: Commit**

```bash
git add index.html assets/journey.js assets/journey.css
git commit -m "feat(journey): magnetic buttons + warm cursor glow (desktop hover only)"
```

---

## Task 8: 降級 / 手機 / 效能 QA + 收尾

**Files:**
- Modify: `assets/journey.css`(手機降級)
- Modify: `index.html` 及子頁(圖片 `loading="lazy"`、必要的壓縮)

- [ ] **Step 1: 手機降級 — hero 穿門簡化、視差關閉(append `assets/journey.css`)**

```css
/* 手機:關掉重的捲動驅動變形,改成單純呈現(避免效能/暈眩問題) */
@media (max-width: 640px) {
  [data-journey-hero] .hero-photo { transform: none !important; }
  [data-journey-hero] .hero-frame { opacity: 1 !important; transform: none !important; }
}
```
並在 `assets/journey.js` 的 `initHero` 與 `initParallax` 開頭各加一道手機判斷(在 `if (reduceMotion ...)` 那行同層):
```js
    if (window.matchMedia('(max-width: 640px)').matches) return;
```
（hero 的標題遮罩可保留;只跳過 pin/scale 與視差。確切插入點:`initHero` 內 `if (reduceMotion) return;` 之後、取 `photo/frame/content` 之前;`initParallax` 內最前面。)

- [ ] **Step 2: 圖片 lazy-load**

替首頁與子頁**首屏以下**的 `<img>` 加 `loading="lazy"`(hero 首屏圖**不要**加)。確認大圖(`room-*`、`about-strip-*`、`epigraph-bg` 等)都有。

- [ ] **Step 3: 效能檢查**

DevTools → Lighthouse(行動裝置)跑首頁。預期 Performance 沒有因動畫大幅崩壞;若 hero 圖過大拖慢 LCP,壓縮 `images/how-doorway.jpg`(目標 < 600KB,維持視覺):
```bash
# 任一可用工具,例如 sips（macOS 內建)重壓
sips -s formatOptions 70 images/how-doorway.jpg --out images/how-doorway.jpg
```

- [ ] **Step 4: 全面回歸驗證**

- 桌機 / 手機(DevTools)各跑一次首頁完整捲動 + 點兩個子頁。
- 開系統 reduced-motion 再跑一次:**內容全可讀、無 pin、無穿門蓋幕、無游標點、無磁吸**。
- Console 全程無錯誤。

- [ ] **Step 5: Commit**

```bash
git add assets/journey.css assets/journey.js index.html about.html faq.html how-to-join.html rules.html privacy.html terms.html
git commit -m "feat(journey): mobile fallback, reduced-motion QA, lazy-load + perf pass"
```

---

## 完成後

- 全部任務完成且驗證通過後,用 superpowers:finishing-a-development-branch 決定如何整合(此 repo 由 main 部署 GitHub Pages,合併到 main 即上線——合併前務必確認 live 站效果)。
- 後續可選升級(非本計畫範圍,spec 已記):補拍「往前走」walkthrough 影片 → hero 升級為方法 B 影片擦洗;追加具縱深照片豐富子頁穿門門檻。

---

## Self-Review 對照

- **Spec 涵蓋度**:平滑捲動(T1)✓、hero 穿門用 how-doorway(T2–3)✓、標題遮罩(T3)✓、區塊揭示沿用 `.reveal`(T4)✓、第二門檻視差(T4)✓、跨頁穿門轉場(T5)✓、子頁輕量+法律頁(T6)✓、磁吸+游標暖光+主色啟動(T7,主色用既有 `--accent`)✓、reduced-motion/手機/效能(T8)✓、誠實限制(on rails、克制穿門、降級)已落實。
- **Placeholder 掃描**:無 TBD/TODO;每個改碼步驟均含實際程式或實際 Edit 內容。
- **型別/命名一致**:`data-journey-hero`、`.hero-photo`、`.hero-frame`、`data-door`、`data-magnetic`、`data-parallax-zone`、`.journey-cursor`、sessionStorage key `'door'`、class 旗標 `js-journey/reduced-motion/door-*` 全文一致;`initHero/initParallax/initDoor/initMagnetic/initCursor` 命名一致。
- **驗證方式**:全程瀏覽器觀察(已於頂部說明為何不架自動化測試);Task 3 後設使用者驗證關卡。

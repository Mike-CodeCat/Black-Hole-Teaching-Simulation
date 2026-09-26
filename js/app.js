/* 应用框架：路由、章节注册、页面构建器、生命周期管理 */
(function () {
  'use strict';
  const chapters = [];
  const pages = {};
  let current = null; // 当前页面上下文

  const PARTS = [
    { key: 'A', name: '第一部分 · 基础铺垫', desc: '从牛顿引力出发，理解光速与时空' },
    { key: 'B', name: '第二部分 · 走近黑洞', desc: '黑洞的结构，以及它如何扭曲光、时间与物质' },
    { key: 'C', name: '第三部分 · 观测与前沿', desc: '吸积盘、黑洞照片、霍金辐射与引力波' },
  ];

  /* ---------- 页面上下文：负责清理动画、监听器、WebGL ---------- */
  class PageCtx {
    constructor(root) {
      this.root = root;
      this.cleanups = [];
      this.loops = [];
      this.alive = true;
      let last = performance.now();
      const tick = (now) => {
        if (!this.alive) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        for (const L of this.loops) if (L.visible && !document.hidden) L.fn(dt, now / 1000);
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }
    onCleanup(fn) { this.cleanups.push(fn); }
    /** 注册动画循环；el 离开视口时自动暂停 */
    loop(fn, el) {
      const L = { fn, visible: true };
      if (el && 'IntersectionObserver' in window) {
        const io = new IntersectionObserver((es) => { L.visible = es[0].isIntersecting; }, { rootMargin: '100px' });
        io.observe(el);
        this.onCleanup(() => io.disconnect());
      }
      this.loops.push(L);
      return L;
    }
    listen(target, ev, fn, opt) {
      target.addEventListener(ev, fn, opt);
      this.onCleanup(() => target.removeEventListener(ev, fn, opt));
    }
    destroy() {
      this.alive = false;
      cancelAnimationFrame(this.raf);
      this.cleanups.forEach((f) => { try { f(); } catch (e) { console.warn(e); } });
    }

    /* ---- 内容构建 ---- */
    add(node) { this.root.appendChild(node); return node; }
    /** 文字讲解卡片 */
    section(title, html, opts = {}) {
      const s = U.el('section', { class: 'card prose' + (opts.class ? ' ' + opts.class : ''), id: opts.id || null });
      if (title) s.appendChild(U.el('h2', { html: title }));
      if (html) s.appendChild(U.el('div', { html }));
      return this.add(s);
    }
    /** 提示框：type = tip | think | fact | warn */
    callout(type, html, title) {
      const names = { tip: '💡 小提示', think: '🤔 想一想', fact: '✨ 趣闻', warn: '⚠️ 注意', key: '🔑 核心结论' };
      return this.add(U.el('div', { class: 'callout ' + type }, U.el('div', { class: 'callout-title', html: title || names[type] }), U.el('div', { html })));
    }
    /** 公式展示 */
    eq(html, caption) {
      return this.add(U.el('div', { class: 'eq-block' }, U.el('div', { class: 'eq', html }), caption ? U.el('div', { class: 'eq-cap', html: caption }) : null));
    }
    /** 仿真实验面板 */
    sim(o) {
      const stage = U.el('div', { class: 'sim-stage' });
      const panel = U.el('div', { class: 'sim-panel' });
      const box = U.el('section', { class: 'sim' + (o.wide ? ' wide' : '') + (o.class ? ' ' + o.class : '') },
        U.el('div', { class: 'sim-head' },
          U.el('span', { class: 'sim-tag', text: o.tag || '仿真实验' }),
          U.el('h3', { html: o.title }),
          o.desc ? U.el('p', { class: 'sim-desc', html: o.desc }) : null),
        U.el('div', { class: 'sim-body' + (o.noPanel ? ' no-panel' : '') }, stage, o.noPanel ? null : panel));
      this.add(box);
      return { box, stage, panel };
    }
    /** 思考题（可展开答案） */
    think(q, a) {
      const d = U.el('details', { class: 'think' }, U.el('summary', { html: '<b>思考题</b> ' + q }), U.el('div', { class: 'think-a', html: a }));
      return this.add(d);
    }
  }

  /* ---------- 注册 ---------- */
  const App = {
    PARTS,
    chapters,
    chapter(def) { chapters.push(def); chapters.sort((a, b) => a.num - b.num); },
    page(route, def) { pages[route] = def; },
    getChapter(id) { return chapters.find((c) => c.id === id); },
    visited() { try { return JSON.parse(localStorage.getItem('bh-visited') || '[]'); } catch (e) { return []; } },
    markVisited(id) {
      try {
        const v = App.visited();
        if (!v.includes(id)) { v.push(id); localStorage.setItem('bh-visited', JSON.stringify(v)); }
      } catch (e) { /* 忽略 */ }
      updateProgress();
    },
    go(hash) { location.hash = hash; },
  };

  /* ---------- 章节页渲染 ---------- */
  function renderChapter(ch, view) {
    const wrap = U.el('div', { class: 'chapter' });
    view.appendChild(wrap);
    const part = PARTS.find((p) => p.key === ch.part);
    const hero = U.el('header', { class: 'chapter-hero' },
      U.el('div', { class: 'chapter-kicker', html: `${part ? part.name : ''} <span>·</span> 第 ${ch.num} 章` }),
      U.el('h1', { html: ch.title }),
      U.el('p', { class: 'chapter-sub', html: ch.subtitle }),
      ch.goals ? U.el('div', { class: 'goals' }, U.el('span', { class: 'goals-label', text: '学完本章你将知道' }), ...ch.goals.map((g) => U.el('span', { class: 'goal', html: g }))) : null);
    wrap.appendChild(hero);
    const body = U.el('div', { class: 'chapter-body' });
    wrap.appendChild(body);
    const ctx = new PageCtx(body);
    try { ch.build(ctx); } catch (e) { console.error(e); body.appendChild(U.el('div', { class: 'callout warn', html: '本章加载出错：' + e.message })); }

    // 上一章 / 下一章
    const idx = chapters.indexOf(ch);
    const prev = chapters[idx - 1], next = chapters[idx + 1];
    wrap.appendChild(U.el('nav', { class: 'chapter-nav' },
      prev ? U.el('a', { class: 'cn prev', href: '#/ch/' + prev.id, html: `<small>← 上一章</small><b>${prev.title}</b>` }) : U.el('a', { class: 'cn prev', href: '#/', html: '<small>← 返回</small><b>首页</b>' }),
      next ? U.el('a', { class: 'cn next', href: '#/ch/' + next.id, html: `<small>下一章 →</small><b>${next.title}</b>` }) : U.el('a', { class: 'cn next', href: '#/quiz', html: '<small>全部学完 →</small><b>去做知识测验</b>' })));
    App.markVisited(ch.id);
    return ctx;
  }

  /* ---------- 路由 ---------- */
  function route() {
    const view = U.$('#view');
    if (current) { current.destroy(); current = null; }
    view.innerHTML = '';
    document.body.classList.remove('fullscreen-page', 'home-page');
    closeDrawer();
    const h = location.hash.replace(/^#/, '').split('?')[0] || '/';
    const parts = h.split('/').filter(Boolean);
    let title = '视界之旅 · 黑洞教学仿真平台';
    if (parts[0] === 'ch' && App.getChapter(parts[1])) {
      const ch = App.getChapter(parts[1]);
      current = renderChapter(ch, view);
      title = `第${ch.num}章 ${ch.title.replace(/<[^>]+>/g, '')} · 视界之旅`;
    } else {
      const key = parts[0] || 'home';
      const def = pages[key] || pages.home;
      const root = U.el('div', { class: 'page page-' + key });
      view.appendChild(root);
      current = new PageCtx(root);
      if (def.bodyClass) document.body.classList.add(def.bodyClass);
      def.build(current);
      if (def.title) title = def.title + ' · 视界之旅';
    }
    document.title = title;
    U.$$('.topnav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#/' + (parts[0] || '')));
    U.$$('.drawer a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + h));
    window.scrollTo(0, 0);
  }

  /* ---------- 侧边抽屉（章节目录） ---------- */
  function buildDrawer() {
    const d = U.$('#drawer');
    const inner = U.el('div', { class: 'drawer-inner' });
    inner.appendChild(U.el('div', { class: 'drawer-head' }, U.el('b', { text: '课程目录' }), U.el('span', { id: 'progress-text' })));
    inner.appendChild(U.el('div', { class: 'progress' }, U.el('div', { class: 'progress-bar', id: 'progress-bar' })));
    PARTS.forEach((p) => {
      inner.appendChild(U.el('div', { class: 'drawer-part', text: p.name }));
      chapters.filter((c) => c.part === p.key).forEach((c) => {
        inner.appendChild(U.el('a', { href: '#/ch/' + c.id, 'data-id': c.id, html: `<span class="dn">${String(c.num).padStart(2, '0')}</span><span class="dt">${c.title}</span><span class="dv">✓</span>` }));
      });
    });
    inner.appendChild(U.el('div', { class: 'drawer-part', text: '拓展' }));
    inner.appendChild(U.el('a', { href: '#/explore', html: '<span class="dn">✦</span><span class="dt">沉浸漫游：坠入黑洞</span>' }));
    inner.appendChild(U.el('a', { href: '#/quiz', html: '<span class="dn">？</span><span class="dt">知识测验</span>' }));
    inner.appendChild(U.el('a', { href: '#/glossary', html: '<span class="dn">≡</span><span class="dt">术语表与参考资料</span>' }));
    d.appendChild(inner);
    updateProgress();
  }
  function updateProgress() {
    const v = App.visited();
    const n = chapters.filter((c) => v.includes(c.id)).length;
    const t = U.$('#progress-text');
    if (t) t.textContent = `已学 ${n}/${chapters.length}`;
    const b = U.$('#progress-bar');
    if (b) b.style.width = (n / Math.max(1, chapters.length)) * 100 + '%';
    U.$$('.drawer a[data-id]').forEach((a) => a.classList.toggle('visited', v.includes(a.dataset.id)));
  }
  function openDrawer() { document.body.classList.add('drawer-open'); }
  function closeDrawer() { document.body.classList.remove('drawer-open'); }

  /* ---------- 背景星空（静态，一次绘制） ---------- */
  function drawBackdrop() {
    const c = U.$('#backdrop');
    const ctx = c.getContext('2d');
    const draw = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      c.width = innerWidth * dpr; c.height = innerHeight * dpr;
      const rnd = U.rng(7);
      const n = Math.round((innerWidth * innerHeight) / 2600);
      for (let i = 0; i < n; i++) {
        const x = rnd() * c.width, y = rnd() * c.height;
        const m = Math.pow(rnd(), 6);
        const r = (0.4 + m * 1.4) * dpr;
        const col = U.blackbody(3000 + rnd() * 9000);
        ctx.fillStyle = U.rgb(col, 0.25 + m * 0.75);
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    };
    draw();
    let tm;
    addEventListener('resize', () => { clearTimeout(tm); tm = setTimeout(draw, 200); });
  }

  App.start = function () {
    buildDrawer();
    drawBackdrop();
    U.$('#menu-btn').addEventListener('click', () => document.body.classList.toggle('drawer-open'));
    U.$('#drawer-mask').addEventListener('click', closeDrawer);
    addEventListener('hashchange', route);
    addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
    route();
  };

  window.App = App;
  document.addEventListener('DOMContentLoaded', () => App.start());
})();

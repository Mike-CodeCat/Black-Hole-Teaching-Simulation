/* 首页 + 学习路径 */
(function () {
  'use strict';

  function chapterGrid(ctx, root) {
    const visited = App.visited();
    App.PARTS.forEach((p) => {
      const block = U.el('div', { class: 'part-block' },
        U.el('div', { class: 'part-head' }, U.el('h3', { text: p.name }), U.el('span', { text: p.desc })));
      const grid = U.el('div', { class: 'ch-grid' });
      App.chapters.filter((c) => c.part === p.key).forEach((c) => {
        grid.appendChild(U.el('a', { class: 'ch-card', href: '#/ch/' + c.id },
          U.el('span', { class: 'ch-num', text: String(c.num).padStart(2, '0') }),
          visited.includes(c.id) ? U.el('span', { class: 'ch-done', text: '✓ 已学习' }) : null,
          U.el('h4', { html: c.title }),
          U.el('p', { html: c.summary || c.subtitle }),
          c.sims ? U.el('span', { class: 'ch-sims', html: '▶ ' + c.sims.join(' · ') }) : null));
      });
      block.appendChild(grid);
      root.appendChild(block);
    });
  }

  App.page('home', {
    title: '首页',
    build(ctx) {
      const root = ctx.root;
      const hero = U.el('section', { class: 'home-hero' });
      root.appendChild(hero);
      const r = BHRenderer.mount(hero, {
        camera: { yaw: 1.2, pitch: 0.075, dist: 21, fov: 52, roll: -0.12, shiftX: innerWidth > 900 ? 0.45 : 0, shiftY: innerWidth > 900 ? 0.08 : 0.25 },
        autoRotate: 0.025,
        params: { diskOut: 15 },
      });
      ctx.onCleanup(() => r.destroy());
      hero.appendChild(U.el('div', { class: 'hero-overlay' },
        U.el('div', { class: 'hero-kicker', text: 'BLACK HOLE · TEACHING SIMULATION' }),
        U.el('h1', { class: 'hero-title', text: '视界之旅' }),
        U.el('p', { class: 'hero-sub', html: '零基础也能看懂的黑洞课。从“扔石头”讲起，一步步走到广义相对论。<br>每个知识点都配有可以亲手操作的物理仿真。' }),
        U.el('div', { class: 'hero-actions' },
          U.el('a', { class: 'btn primary', href: '#/ch/' + (App.chapters[0] ? App.chapters[0].id : ''), text: '开始学习 →' }),
          U.el('a', { class: 'btn', href: '#/explore', text: '✦ 沉浸漫游：坠入黑洞' }),
          U.el('a', { class: 'btn', href: '#/learn', text: '查看课程目录' }),
          U.el('a', { class: 'btn btn-invasion', href: '#/invasion', text: '☄ 黑洞入侵太阳系' }))),
        U.el('div', { class: 'hero-hint', text: '↻ 拖动旋转视角 · 滚轮缩放 · 这是实时光线追踪的画面，不是视频' }));

      root.appendChild(U.el('div', { class: 'section-title' },
        U.el('h2', { text: '你眼前的这个黑洞，是“算”出来的' }),
        U.el('p', { text: '上面的每一个像素，都是让一束光在弯曲时空中逆向飞行、实时计算出来的' })));
      const feats = [
        ['🌀', '光线弯曲', '黑洞背后的吸积盘被引力“掰”到了头顶和脚下——所以你能同时看到盘的正面和背面。'],
        ['🔥', '多普勒增亮', '吸积盘以接近光速旋转，朝你运动的一侧更亮、更蓝，远离你的一侧更暗、更红。'],
        ['⏳', '引力红移', '越靠近黑洞，时间流逝越慢，发出的光也被“拉长”变红。'],
        ['⚫', '黑洞阴影', '中央的黑影直径约为视界的 2.6 倍——这正是 EHT 拍到的“甜甜圈”中间那块黑。'],
      ];
      const fg = U.el('div', { class: 'feature-grid' });
      feats.forEach(([i, t, d]) => fg.appendChild(U.el('div', { class: 'feature' }, U.el('div', { class: 'fi', text: i }), U.el('h4', { text: t }), U.el('p', { text: d }))));
      root.appendChild(fg);

      root.appendChild(U.el('div', { class: 'section-title' },
        U.el('h2', { text: '学习路径' }),
        U.el('p', { text: '11 章 · 20+ 个交互仿真 · 从高中物理出发，不需要任何黑洞基础' })));
      chapterGrid(ctx, root);

      root.appendChild(U.el('div', { class: 'section-title' }, U.el('h2', { text: '几个会让你震撼的数字' })));
      root.appendChild(U.el('div', { class: 'stat-row', html: `
        <div class="stat"><b>8.9 mm</b><span>把地球压成黑洞，<br>只有弹珠那么大</span></div>
        <div class="stat"><b>65 亿</b><span>M87* 黑洞的质量<br>是太阳的 65 亿倍</span></div>
        <div class="stat"><b>10<sup>−18</sup> m</b><span>LIGO 测到的引力波形变，<br>质子直径的千分之一</span></div>
        <div class="stat"><b>10<sup>67</sup> 年</b><span>太阳质量黑洞<br>靠霍金辐射蒸发完所需时间</span></div>`}));

      root.appendChild(U.el('div', { class: 'footer', html: '视界之旅 · 大学物理实践作业 · 黑洞教学仿真平台<br>所有仿真均在浏览器本地实时计算，无需联网' }));
    },
  });

  App.page('learn', {
    title: '学习路径',
    build(ctx) {
      const root = ctx.root;
      root.appendChild(U.el('header', { class: 'chapter-hero' },
        U.el('div', { class: 'chapter-kicker', text: 'LEARNING PATH' }),
        U.el('h1', { text: '学习路径' }),
        U.el('p', { class: 'chapter-sub', html: '建议按顺序学习：前 3 章打基础（引力、光速、时空），第 4–8 章深入黑洞本身，最后 3 章看真实宇宙中的黑洞。每章约 15–25 分钟。' })));
      chapterGrid(ctx, root);
      root.appendChild(U.el('div', { class: 'ch-grid' },
        U.el('a', { class: 'ch-card', href: '#/explore' }, U.el('span', { class: 'ch-num', text: '✦' }), U.el('h4', { text: '沉浸漫游：坠入黑洞' }), U.el('p', { text: '自由驾驶飞船环绕黑洞，或者一路坠入事件视界。' })),
        U.el('a', { class: 'ch-card', href: '#/quiz' }, U.el('span', { class: 'ch-num', text: '?' }), U.el('h4', { text: '知识测验' }), U.el('p', { text: '15 道题检验学习成果，每题附详细解析。' })),
        U.el('a', { class: 'ch-card', href: '#/glossary' }, U.el('span', { class: 'ch-num', text: '≡' }), U.el('h4', { text: '术语表与参考资料' }), U.el('p', { text: '忘了某个名词？来这里查。' }))));
    },
  });
})();

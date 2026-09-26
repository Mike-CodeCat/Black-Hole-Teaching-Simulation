/* 第 4 章：黑洞的结构 */
(function () {
  'use strict';
  const P = U.PHYS;

  const PRESETS = [
    { n: '你自己（60 kg）', M: 60 },
    { n: '珠穆朗玛峰', M: 8.1e14 },
    { n: '月球', M: 7.35e22 },
    { n: '地球', M: P.Mearth },
    { n: '太阳', M: P.Msun },
    { n: '天鹅座 X-1（21 M☉）', M: 21 * P.Msun },
    { n: 'GW150914 并合产物（62 M☉）', M: 62 * P.Msun },
    { n: '人马座 A*（银河系中心）', M: 4.3e6 * P.Msun },
    { n: 'M87*（第一张黑洞照片）', M: 6.5e9 * P.Msun },
    { n: 'TON 618（已知最重之一）', M: 4.07e10 * P.Msun },
  ];
  const REFS = [
    ['一个质子', 1.7e-15], ['一个原子', 1e-10], ['一个细菌', 2e-6], ['一根头发的直径', 8e-5], ['一颗弹珠', 0.015], ['一个人的身高', 1.7],
    ['一个足球场', 105], ['珠穆朗玛峰的高度', 8848], ['一座城市（约 40 km）', 4e4], ['北京到上海的距离', 1.07e6], ['地球直径', 1.2742e7],
    ['地月距离', 3.844e8], ['太阳直径', 1.39e9], ['日地距离（1 天文单位）', P.AU], ['海王星轨道直径', 9e12], ['1 光年', P.ly],
  ];

  function calculator(ctx) {
    const s = ctx.sim({
      title: '黑洞尺寸计算器：任何东西都能变成黑洞吗？',
      desc: '原则上，任何质量只要被压缩到它的史瓦西半径以内，就会成为黑洞。拖动滑块改变质量，看看对应的黑洞有多大、有多“密”。',
    });
    const cv = U.canvas(s.stage, { aspect: 16 / 9, maxHeight: 460 });
    let M = P.Msun;
    const ro = U.readouts(s.panel, [
      { key: 'M', label: '质量', wide: true },
      { key: 'rs', label: '史瓦西半径 r<sub>s</sub>', wide: true },
      { key: 'cmp', label: '视界直径相当于', wide: true },
      { key: 'rho', label: '“平均密度” M / (4πr<sub>s</sub>³/3)', wide: true },
      { key: 'shadow', label: '阴影直径（≈ 5.2 r<sub>s</sub>）', wide: true },
    ]);
    const sl = U.slider(s.panel, {
      label: '质量（对数刻度）', min: 10, max: 1e41, value: M, log: true,
      format: (v) => U.sci(v, 2) + ' kg',
      onInput: (v) => { M = v; },
    });
    const sel = U.select(s.panel, {
      label: '常见天体', value: '4',
      options: PRESETS.map((p, i) => ({ value: String(i), label: p.n })),
      onChange: (v) => { sl.set(PRESETS[+v].M); },
    });
    void sel;
    ctx.loop((dt, t) => {
      const rs = U.rs(M);
      const d = 2 * rs;
      ro.set('M', U.sci(M, 3) + ' kg = ' + U.sci(M / P.Msun, 3) + ' M☉');
      ro.set('rs', U.length(rs));
      let best = REFS[0];
      for (const r of REFS) if (r[1] <= d) best = r;
      ro.set('cmp', `${U.sci(d / best[1], 3)} 个${best[0]}`);
      const rho = M / ((4 / 3) * Math.PI * rs ** 3);
      ro.set('rho', U.sci(rho, 3) + ' kg/m³ ' + (rho < 1000 ? '<span style="color:#4ade80">（比水还稀！）</span>' : `（水的 ${U.sci(rho / 1000, 2)} 倍）`));
      ro.set('shadow', U.length(5.196 * rs));

      const { ctx: g, w, h } = cv;
      g.fillStyle = '#020308'; g.fillRect(0, 0, w, h);
      // 对比图：左边参照物，右边黑洞，按真实比例
      const maxPix = h * 0.62;
      const big = Math.max(d, best[1]);
      const k = maxPix / big;
      const bhR = Math.max(1.5, (d * k) / 2);
      const refS = Math.max(1.5, best[1] * k);
      const cy = h * 0.5;
      const bx = w * 0.66, rx = w * 0.26;
      U.drawBH(g, bx, cy, bhR, t);
      g.strokeStyle = 'rgba(255,160,80,0.9)'; g.lineWidth = 1.5; g.setLineDash([4, 4]);
      g.beginPath(); g.arc(bx, cy, bhR, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      U.text(g, '事件视界', bx, Math.min(cy + Math.max(bhR * 2.2, 20) + 6, h - 34), { align: 'center', size: 13, color: '#ffb454' });
      // 参照物（用条形尺表示）
      g.fillStyle = 'rgba(92,200,255,0.25)'; g.strokeStyle = '#5cc8ff'; g.lineWidth = 1.5;
      g.beginPath(); g.rect(rx - refS / 2, cy - refS / 2, refS, refS); g.fill(); g.stroke();
      U.text(g, best[0], rx, cy + Math.max(refS / 2, 10) + 22, { align: 'center', size: 13, color: '#5cc8ff' });
      U.text(g, U.plain(U.length(best[1])), rx, cy + Math.max(refS / 2, 10) + 40, { align: 'center', size: 12, color: 'rgba(255,255,255,0.5)' });
      U.text(g, '直径 ' + U.plain(U.length(d)), bx, Math.min(cy + Math.max(bhR * 2.2, 20) + 26, h - 14), { align: 'center', size: 12, color: 'rgba(255,255,255,0.5)' });
      U.text(g, '按真实比例绘制', 12, 18, { size: 12, color: 'rgba(255,255,255,0.45)' });
    }, s.box);
  }

  function anatomy(ctx) {
    const s = ctx.sim({
      title: '黑洞解剖图：从外到内的四个关键半径',
      desc: '把鼠标移到（或手指点击）图中的不同区域，查看每一层的含义。图中橙色小点是吸积盘中的物质，白色小点是光子。',
    });
    const cv = U.canvas(s.stage, { aspect: 1.25, maxHeight: 620 });
    const info = U.el('div', { class: 'status', html: '将鼠标移到图中查看说明' });
    const ZONES = [
      { key: 'sing', r: 0.12, name: '奇点', col: '#ffffff', txt: '<b>奇点（r = 0）</b><br>广义相对论预言：落入黑洞的物质最终会被压缩到一个密度无穷大的点。这意味着理论在这里“失效”了——需要尚未建立的量子引力理论来描述。' },
      { key: 'hor', r: 1, name: '事件视界 r = r<sub>s</sub>', col: '#ff6b3d', txt: '<b>事件视界（r = r<sub>s</sub> = 2GM/c²）</b><br>黑洞的“边界”，一个<b>单向膜</b>：外面的东西可以进去，里面的任何东西（包括光）都出不来。视界处<b>没有实体表面</b>，自由下落的宇航员穿过时不会感到任何特别之处。' },
      { key: 'ph', r: 1.5, name: '光子球 r = 1.5 r<sub>s</sub>', col: '#ffe066', txt: '<b>光子球（r = 1.5 r<sub>s</sub>）</b><br>在这里，光可以沿圆形轨道绕黑洞转圈！但这种轨道是<b>不稳定</b>的，就像把铅笔立在笔尖上：稍有扰动，光子就会要么掉进黑洞，要么飞向远方。黑洞照片中的亮环就与光子球密切相关。' },
      { key: 'isco', r: 3, name: '最内稳定圆轨道 ISCO r = 3 r<sub>s</sub>', col: '#5cc8ff', txt: '<b>最内稳定圆轨道 ISCO（r = 3 r<sub>s</sub>）</b><br>有质量的物体能稳定绕黑洞转圈的最小半径。在牛顿引力中，任何半径都有稳定圆轨道；但在广义相对论中，进入 3 r<sub>s</sub> 以内的物质会迅速<b>螺旋坠入</b>黑洞。因此吸积盘的内边缘通常就在 ISCO。' },
      { key: 'disk', r: 7, name: '吸积盘', col: '#ffb454', txt: '<b>吸积盘（r &gt; 3 r<sub>s</sub>）</b><br>被黑洞吸引的气体因为有角动量，不会直接掉进去，而是形成一个高速旋转的盘。摩擦让盘加热到数百万度，发出强烈的 X 射线。这是我们“看见”黑洞的主要途径（第 9 章）。' },
    ];
    let hover = null;
    s.panel.appendChild(U.el('div', { class: 'panel-title', text: '图例（点击查看）' }));
    ZONES.forEach((z) => {
      const b = U.el('button', { class: 'btn small', html: `<span style="color:${z.col}">●</span> ${z.name}`, on: { click: () => { hover = z; show(); } } });
      b.style.textAlign = 'left';
      s.panel.appendChild(b);
    });
    s.panel.appendChild(info);
    function show() { info.innerHTML = hover ? hover.txt : '将鼠标移到图中查看说明'; }
    const pick = (e) => {
      const p = U.pointer(e, cv.canvas);
      const sc = scale();
      const r = Math.hypot(p.x - cv.w / 2, p.y - cv.h / 2) / sc;
      hover = r < 0.25 ? ZONES[0] : r < 1.08 ? ZONES[1] : r < 2.0 ? ZONES[2] : r < 3.4 ? ZONES[3] : r < 8.2 ? ZONES[4] : null;
      show();
    };
    cv.canvas.addEventListener('pointermove', pick);
    cv.canvas.addEventListener('pointerdown', pick);
    const scale = () => Math.min(cv.w, cv.h) / 17.5;

    const disk = Array.from({ length: 420 }, () => { const r = 3 + Math.pow(Math.random(), 1.4) * 5.2; return { r, a: Math.random() * 6.283, s: 0.8 + Math.random() * 0.6 }; });
    const photons = Array.from({ length: 10 }, (_, i) => ({ a: (i / 10) * 6.283, r: 1.5, v: 0, life: Math.random() * 8 }));
    const plunge = [];
    let tAcc = 0;
    ctx.loop((dt, t) => {
      const { ctx: g, w, h } = cv;
      const sc = scale(), cx = w / 2, cy = h / 2;
      g.fillStyle = '#020308'; g.fillRect(0, 0, w, h);
      // 吸积盘粒子
      for (const p of disk) {
        p.a += dt * 3.2 * Math.pow(p.r, -1.5);
        const x = cx + Math.cos(p.a) * p.r * sc, y = cy + Math.sin(p.a) * p.r * sc;
        const T = 9000 * Math.pow(3 / p.r, 0.75);
        g.fillStyle = U.rgb(U.blackbody(T), 0.55 * p.s);
        g.fillRect(x - 1, y - 1, 2, 2);
      }
      // ISCO 内的螺旋坠落物质
      tAcc += dt;
      if (tAcc > 0.25) { tAcc = 0; plunge.push({ r: 3, a: Math.random() * 6.283 }); }
      for (let i = plunge.length - 1; i >= 0; i--) {
        const p = plunge[i];
        p.a += dt * 3.2 * Math.pow(p.r, -1.5) * 1.1;
        p.r -= dt * 0.35 * (3.1 - p.r + 0.08) * 3;
        if (p.r < 1) { plunge.splice(i, 1); continue; }
        U.glowCircle(g, cx + Math.cos(p.a) * p.r * sc, cy + Math.sin(p.a) * p.r * sc, 1.6, '#ffcf8a', 6);
      }
      // 圆环
      const ring = (r, col, dash, lw = 1.5, glow = 0) => {
        g.save(); g.strokeStyle = col; g.lineWidth = lw; if (dash) g.setLineDash(dash); if (glow) { g.shadowColor = col; g.shadowBlur = glow; }
        g.beginPath(); g.arc(cx, cy, r * sc, 0, Math.PI * 2); g.stroke(); g.restore();
      };
      const hl = (k) => hover && hover.key === k;
      ring(3, hl('isco') ? '#5cc8ff' : 'rgba(92,200,255,0.55)', [6, 5], hl('isco') ? 3 : 1.5, hl('isco') ? 14 : 0);
      ring(1.5, hl('ph') ? '#ffe066' : 'rgba(255,224,102,0.55)', [3, 4], hl('ph') ? 3 : 1.5, hl('ph') ? 14 : 0);
      if (hl('disk')) { ring(8.2, 'rgba(255,180,84,0.6)', [2, 6]); }
      // 视界
      const gr = g.createRadialGradient(cx, cy, sc * 0.9, cx, cy, sc * 1.25);
      gr.addColorStop(0, 'rgba(255,107,61,0.9)'); gr.addColorStop(1, 'rgba(255,107,61,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, sc * 1.25, 0, 6.283); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, sc, 0, 6.283); g.fill();
      if (hl('hor')) ring(1, '#ff6b3d', null, 3, 18);
      // 奇点
      U.glowCircle(g, cx, cy, hl('sing') ? 4 : 2.5, '#fff', hl('sing') ? 20 : 8);
      // 光子球上的光子（不稳定）
      for (const p of photons) {
        p.life += dt;
        if (p.life > 6 && p.v === 0) p.v = Math.random() < 0.5 ? -1 : 1;
        p.a += dt * 1.6 / p.r;
        if (p.v) { p.r += p.v * dt * (0.2 + Math.abs(p.r - 1.5) * 2); }
        if (p.r < 1 || p.r > 9) { p.r = 1.5; p.v = 0; p.life = Math.random() * 4; }
        const x = cx + Math.cos(p.a) * p.r * sc, y = cy + Math.sin(p.a) * p.r * sc;
        U.glowCircle(g, x, y, 2.2, '#fffbe0', 10);
      }
      // 标注
      const lab = (r, ang, txt, col) => {
        const x = cx + Math.cos(ang) * r * sc, y = cy + Math.sin(ang) * r * sc;
        g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30, y - 24); g.lineTo(x + 40, y - 24); g.stroke();
        U.text(g, txt, x + 44, y - 24, { size: 12, color: col, shadow: true });
      };
      lab(1, -0.5, '事件视界 1 rₛ', '#ff9a6b');
      lab(1.5, -0.95, '光子球 1.5 rₛ', '#ffe066');
      lab(3, -1.15, 'ISCO 3 rₛ', '#5cc8ff');
      lab(6.5, -0.3, '吸积盘', '#ffb454');
      void t;
    }, s.box);
  }

  App.chapter({
    id: 'anatomy', num: 4, part: 'B',
    title: '黑洞的结构',
    subtitle: '黑洞不是宇宙中的“吸尘器”，而是一个有清晰结构的时空区域。它有多大？里面有什么？',
    summary: '史瓦西半径、事件视界、光子球、最内稳定圆轨道与奇点。',
    sims: ['黑洞尺寸计算器', '黑洞解剖图'],
    goals: ['史瓦西半径 rₛ = 2GM/c²', '事件视界是单向膜', '光子球与 ISCO', '黑洞“无毛”', '旋转黑洞'],
    build(ctx) {
      ctx.section('黑洞到底是什么？', `
        <p>用一句话定义：<b>黑洞是时空中的一个区域，其中的引力强到任何东西——包括光——都无法逃脱。</b>这个区域的边界叫做<span class="hl">事件视界</span>（event horizon）。</p>
        <p>对于不旋转的黑洞，事件视界是一个球面，半径就是史瓦西半径：</p>`);
      ctx.eq(`r<sub>s</sub> = ${U.frac('2GM', 'c<sup>2</sup>')} ≈ 2.95 km × ${U.frac('M', 'M<sub>☉</sub>')}`, 'M☉ 表示太阳质量（约 2×10³⁰ kg）。黑洞的大小与质量成正比');
      calculator(ctx);
      ctx.callout('fact', '<p>注意“平均密度”那一栏：因为 r<sub>s</sub> ∝ M，体积 ∝ M³，所以密度 ∝ 1/M²。<b>越大的黑洞反而越“稀”</b>——M87* 的平均密度还不到空气的万分之一！这说明形成黑洞不一定需要极端高的密度，只要物质足够<b>多</b>。</p>');
      ctx.section('黑洞的“解剖”', `<p>虽然黑洞本身是“黑”的，但它周围的时空有几个具有特殊物理意义的半径。它们都只由质量决定，用 r<sub>s</sub> 表示非常简洁：</p>`);
      anatomy(ctx);
      ctx.section('事件视界：宇宙中的“单向门”', `
        <p>事件视界并不是一个实体表面——那里没有墙，也没有任何“东西”。它只是一个<b>数学上的边界</b>：在它之内，所有未来的路径（无论朝哪个方向、以什么速度）都指向黑洞中心。</p>
        <p>一个形象的比喻是<b>瀑布上游的鱼</b>：离瀑布越近，水流越快。在某个位置，水流速度恰好等于鱼能游的最快速度——越过这条线的鱼，无论怎么努力，都只能被冲下瀑布。对于黑洞，“水流”就是时空本身向内的流动，而鱼的最快速度就是光速。</p>`);
      ctx.section('奇点：理论失效之处', `
        <p>根据广义相对论，一旦越过事件视界，物质将不可避免地坠向中心，最终被压缩到一个体积为零、密度无穷大的点——<span class="hl">奇点</span>。</p>
        <p>但物理学家普遍认为，“无穷大”说明理论在这里已经不适用了。在极小的尺度上，量子效应必须被考虑。如何把广义相对论和量子力学统一起来，是当今物理学最大的难题之一。</p>
        <p>值得一提的是，由于事件视界的存在，奇点被“藏”了起来，外面的观察者永远看不到它——这被称为<b>宇宙监督假设</b>。</p>`);
      ctx.section('黑洞没有“毛发”', `
        <p>一颗恒星有温度、成分、磁场、自转、表面的斑点……但当它坍缩成黑洞后，几乎所有这些细节都消失了。物理学家惠勒戏称：<b>“黑洞没有毛发”</b>。</p>
        <p><span class="hl">无毛定理</span>指出：一个稳定的黑洞只需要三个数就能完全描述——</p>
        <ul>
          <li><b>质量</b> M —— 决定大小；</li>
          <li><b>角动量</b> J —— 决定自转快慢；</li>
          <li><b>电荷</b> Q —— 天体物理中的黑洞几乎呈电中性，通常可忽略。</li>
        </ul>
        <p>本章讨论的是最简单的不转动黑洞（史瓦西黑洞）。现实中的黑洞通常都在高速旋转，由 1963 年<b>克尔</b>发现的<span class="hl">克尔解</span>描述。旋转黑洞会拖着周围的时空一起转（“参考系拖拽”），视界之外还有一个<b>能层</b>：在那里任何东西都不可能保持静止。旋转越快，ISCO 越靠近黑洞（顺向最快可达 0.5 r<sub>s</sub>），吸积盘也就能释放更多能量。</p>`);
      ctx.callout('key', '<p>① r<sub>s</sub> = 2GM/c²，太阳质量黑洞约 3 km；② 事件视界是单向边界，不是实体表面；③ 1.5 r<sub>s</sub> 处光可以绕圈（光子球），3 r<sub>s</sub> 以内物质无法稳定绕行（ISCO）；④ 黑洞只由质量、自转、电荷描述。</p>');
      ctx.think('如果太阳突然变成一个同质量的黑洞，地球会被吸进去吗？',
        '<b>不会</b>。在黑洞外部远处，引力和原来同质量的恒星<b>完全一样</b>（都是 GM/r²）。地球会继续在原轨道上运行，只是会失去光和热，大约 8 分 20 秒后天空变黑。黑洞只有在离它非常近（几个 r<sub>s</sub> 以内）时才显示出与普通天体不同的特性。');
      ctx.think('一个太阳质量的黑洞与一个 10 亿太阳质量的黑洞，哪个视界处的引力（逃逸速度）更大？',
        '两者视界处的逃逸速度<b>都恰好等于光速</b>——这正是视界的定义。但它们在视界处的<b>潮汐力</b>差别巨大：小黑洞的潮汐力强得多（第 8 章详解）。');
    },
  });
})();

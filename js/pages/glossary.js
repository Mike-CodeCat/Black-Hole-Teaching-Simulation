/* 术语表与参考资料 */
(function () {
  'use strict';
  const TERMS = [
    ['逃逸速度', 'Escape velocity', '物体摆脱天体引力、飞到无穷远所需的最小初速度，v = √(2GM/R)。', 'escape'],
    ['光速不变原理', 'Constancy of the speed of light', '真空中的光速对所有惯性观察者都相同，约 3×10⁸ m/s，是狭义相对论的基本假设。', 'special-relativity'],
    ['洛伦兹因子 γ', 'Lorentz factor', 'γ = 1/√(1 − v²/c²)，描述运动带来的时间膨胀和长度收缩的程度。', 'special-relativity'],
    ['等效原理', 'Equivalence principle', '在足够小的区域内，引力效应与加速运动效应无法区分。广义相对论的出发点。', 'spacetime'],
    ['时空', 'Spacetime', '把三维空间和一维时间统一起来的四维整体。质量和能量会使其弯曲。', 'spacetime'],
    ['测地线', 'Geodesic', '弯曲时空中“最直”的路径。不受其他力的物体和光都沿测地线运动。', 'spacetime'],
    ['史瓦西半径', 'Schwarzschild radius', 'r<sub>s</sub> = 2GM/c²，不旋转黑洞的事件视界半径。太阳质量对应约 3 km。', 'anatomy'],
    ['事件视界', 'Event horizon', '黑洞的边界。视界内的任何信号都无法传到外部，是一个单向膜。', 'anatomy'],
    ['奇点', 'Singularity', '广义相对论预言的黑洞中心密度无穷大之处，标志着理论的失效。', 'anatomy'],
    ['光子球', 'Photon sphere', 'r = 1.5 r<sub>s</sub> 处，光可以沿不稳定的圆轨道绕黑洞运动。', 'anatomy'],
    ['最内稳定圆轨道（ISCO）', 'Innermost stable circular orbit', '有质量粒子能稳定绕行的最小半径，不旋转黑洞为 3 r<sub>s</sub>，是吸积盘的内边缘。', 'orbits'],
    ['无毛定理', 'No-hair theorem', '稳定黑洞只由质量、角动量、电荷三个量完全决定。', 'anatomy'],
    ['克尔黑洞', 'Kerr black hole', '旋转黑洞，由克尔于 1963 年求得的解描述，周围存在拖拽时空的“能层”。', 'anatomy'],
    ['碰撞参数', 'Impact parameter', '粒子或光线若沿直线运动时与中心的最近距离，记为 b。', 'lensing'],
    ['引力透镜', 'Gravitational lensing', '大质量天体弯曲背景光源的光线，产生放大、扭曲、多重像或爱因斯坦环。', 'lensing'],
    ['黑洞阴影', 'Black hole shadow', '观察者看到的黑洞中央暗区，半径约 2.6 r<sub>s</sub>，大于视界。', 'lensing'],
    ['有效势能', 'Effective potential', '把轨道运动化简为一维问题时使用的等效势能，可用来判断轨道类型。', 'orbits'],
    ['近日点进动', 'Perihelion precession', '椭圆轨道的近心点在每圈后向前移动的现象，广义相对论的经典检验之一。', 'orbits'],
    ['引力时间膨胀', 'Gravitational time dilation', '处在引力场深处的时钟走得更慢：Δt<sub>近</sub> = Δt<sub>远</sub>√(1 − r<sub>s</sub>/r)。', 'time'],
    ['引力红移', 'Gravitational redshift', '光从引力场深处传出时频率降低、波长变长。', 'time'],
    ['潮汐力', 'Tidal force', '引力在物体不同部位大小不同造成的拉伸与挤压效应，∝ M/r³。', 'tidal'],
    ['意面化', 'Spaghettification', '物体被黑洞的潮汐力沿径向拉长、横向压缩成面条状的过程。', 'tidal'],
    ['潮汐瓦解事件（TDE）', 'Tidal disruption event', '恒星进入黑洞的潮汐半径后被撕碎，部分物质落入黑洞产生耀发。', 'tidal'],
    ['吸积盘', 'Accretion disk', '围绕黑洞旋转、因摩擦加热而发光的气体盘。', 'accretion'],
    ['多普勒集束', 'Doppler beaming', '接近光速运动的光源，朝观察者运动时显著增亮、蓝移。', 'accretion'],
    ['甚长基线干涉测量（VLBI）', 'Very long baseline interferometry', '把相距遥远的射电望远镜组合成等效口径巨大的虚拟望远镜的技术，EHT 的核心。', 'accretion'],
    ['钱德拉塞卡极限', 'Chandrasekhar limit', '白矮星能被电子简并压力支撑的最大质量，约 1.4 倍太阳质量。', 'lifecycle'],
    ['霍金辐射', 'Hawking radiation', '由于视界附近的量子效应，黑洞以温度 T ∝ 1/M 向外辐射，并逐渐蒸发。', 'lifecycle'],
    ['信息悖论', 'Information paradox', '落入黑洞的信息在黑洞蒸发后是否丢失的难题，涉及量子力学与引力的统一。', 'lifecycle'],
    ['引力波', 'Gravitational wave', '加速运动的质量在时空中激起、以光速传播的涟漪。', 'gravitational-waves'],
    ['啁啾信号', 'Chirp', '双星旋近并合时，引力波频率和振幅同时迅速上升的特征信号。', 'gravitational-waves'],
    ['铃宕', 'Ringdown', '黑洞并合后，新黑洞通过阻尼振荡辐射引力波、恢复稳态的阶段。', 'gravitational-waves'],
  ];
  const REFS = [
    ['史蒂芬·霍金《时间简史》', '经典科普，第 6、7 章专讲黑洞与霍金辐射。'],
    ['基普·索恩《黑洞与时间弯曲》', '诺贝尔奖得主写的黑洞研究史，通俗而深刻。'],
    ['基普·索恩《星际穿越》（The Science of Interstellar）', '讲解电影背后的真实物理，包括卡冈图雅的渲染。'],
    ['James O. et al. (2015) Gravitational lensing by spinning black holes in astrophysics, and in the movie Interstellar. Class. Quantum Grav. 32, 065001', '电影黑洞渲染方法的学术论文。'],
    ['Luminet J.-P. (1979) Image of a spherical black hole with thin accretion disk. A&A 75, 228', '第一张黑洞模拟图像。'],
    ['Event Horizon Telescope Collaboration (2019) First M87 Event Horizon Telescope Results. ApJL 875, L1', '第一张黑洞照片的论文。'],
    ['LIGO Scientific Collaboration (2016) Observation of Gravitational Waves from a Binary Black Hole Merger. PRL 116, 061102', '首次直接探测引力波。'],
    ['赵峥《黑洞与弯曲的时空》', '国内经典的广义相对论与黑洞入门读物。'],
  ];

  App.page('glossary', {
    title: '术语表',
    build(ctx) {
      const root = ctx.root;
      root.appendChild(U.el('header', { class: 'chapter-hero' },
        U.el('div', { class: 'chapter-kicker', text: 'GLOSSARY' }),
        U.el('h1', { text: '术语表与参考资料' }),
        U.el('p', { class: 'chapter-sub', text: '学习中遇到不熟悉的名词，可以在这里快速查找。点击“去学习”跳转到对应章节。' })));
      const search = U.el('input', { type: 'search', placeholder: '搜索术语，例如：视界、红移……', style: { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--line2)', background: 'rgba(255,255,255,0.04)', color: 'var(--text)', fontSize: '16px', fontFamily: 'var(--font)', marginBottom: '18px' } });
      root.appendChild(search);
      const grid = U.el('div', { class: 'gloss' });
      root.appendChild(grid);
      const items = TERMS.map(([zh, en, d, ch]) => {
        const c = App.getChapter(ch);
        const el = U.el('div', { class: 'gloss-item', html: `<b>${zh}</b><i>${en}</i><p>${d}</p>${c ? `<a href="#/ch/${c.id}">去学习：第 ${c.num} 章 ${c.title} →</a>` : ''}` });
        grid.appendChild(el);
        return { el, text: (zh + en + d).toLowerCase() };
      });
      search.addEventListener('input', () => { const q = search.value.trim().toLowerCase(); items.forEach((it) => { it.el.style.display = !q || it.text.includes(q) ? '' : 'none'; }); });
      const ref = U.el('section', { class: 'card prose', style: { marginTop: '30px' } });
      ref.innerHTML = '<h2>参考资料与延伸阅读</h2><ol>' + REFS.map(([t, d]) => `<li><b>${t}</b><br><span style="color:var(--muted);font-size:14px">${d}</span></li>`).join('') + '</ol>';
      root.appendChild(ref);
      const about = U.el('section', { class: 'card prose', style: { marginTop: '22px' } });
      about.innerHTML = `<h2>关于本平台</h2>
        <p>“视界之旅”是一个大学物理实践作业项目，目标是让没有任何相对论基础的同学也能理解黑洞。平台中的所有仿真都在浏览器中实时计算：</p>
        <ul>
          <li><b>3D 黑洞渲染</b>：GPU 片元着色器对每个像素逆向追踪光线，数值积分史瓦西时空中的光子轨道方程，并计入多普勒集束与引力红移；</li>
          <li><b>光线与轨道</b>：四阶龙格–库塔 / 蛙跳积分求解测地线方程；</li>
          <li><b>坠落视角</b>：由径向测地线的解析解（摆线参数化）与乌龟坐标计算光信号的到达时间与红移；</li>
          <li><b>引力波</b>：采用四极辐射公式（Peters 公式）描述旋近，唯象的准正则模描述铃宕。</li>
        </ul>
        <p style="color:var(--muted)">说明：为便于教学，部分仿真做了简化（如不旋转黑洞、夸张的振幅与颜色），相关之处均已在页面中注明。</p>`;
      root.appendChild(about);
    },
  });
})();

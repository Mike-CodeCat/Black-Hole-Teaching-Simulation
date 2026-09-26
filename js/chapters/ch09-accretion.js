/* 第 9 章：吸积盘与黑洞照片 */
(function () {
  'use strict';

  function studio(ctx) {
    const s = ctx.sim({
      title: '黑洞影像工作室：亲手“拍”一张黑洞照片',
      desc: '这是一个实时的广义相对论光线追踪器：每个像素都对应一条从相机出发、在弯曲时空中逆向追踪的光线。打开或关闭各项物理效应，看看每一种效应对黑洞外观的贡献。拖动画面旋转，滚轮缩放。',
      wide: true,
    });
    const box = U.el('div', { class: 'bh-embed' });
    s.stage.appendChild(box);
    const r = BHRenderer.mount(box, {
      camera: { yaw: 0.4, pitch: 0.1, dist: 24, fov: 50 },
      autoRotate: 0.02,
    });
    ctx.onCleanup(() => r.destroy());
    if (!r.ok) return;
    const P = r.params;
    const toggles = {};
    const g1 = U.el('div', { class: 'ctrl' }); s.panel.appendChild(g1);
    g1.appendChild(U.el('div', { class: 'panel-title', text: '物理效应开关' }));
    toggles.lensing = U.toggle(g1, { label: '引力透镜（光线弯曲）', value: true, onChange: (v) => { P.lensing = v; } });
    toggles.doppler = U.toggle(g1, { label: '多普勒效应（集束增亮）', value: true, onChange: (v) => { P.doppler = v; } });
    toggles.grav = U.toggle(g1, { label: '引力红移', value: true, onChange: (v) => { P.grav = v; } });
    toggles.disk = U.toggle(g1, { label: '吸积盘', value: true, onChange: (v) => { P.disk = v; } });
    toggles.eht = U.toggle(g1, { label: 'EHT 望远镜模拟（模糊 + 伪彩色）', value: false, onChange: (v) => { P.eht = v; } });

    const g2 = U.el('div', { class: 'ctrl' }); s.panel.appendChild(g2);
    const incl = U.slider(g2, { label: '观察倾角（0° = 从盘面侧看）', min: -80, max: 85, step: 0.5, value: 5.7, format: (v) => v.toFixed(1) + '°', onInput: (v) => { r.target.pitch = (v * Math.PI) / 180; } });
    const dist = U.slider(g2, { label: '相机距离', min: 6, max: 50, step: 0.1, value: 24, format: (v) => v.toFixed(1) + ' r<sub>s</sub>', onInput: (v) => { r.target.dist = v; } });
    U.slider(g2, { label: '自动旋转速度', min: 0, max: 0.3, step: 0.005, value: 0.02, format: (v) => v.toFixed(3), onInput: (v) => { r.autoRotate = v; } });

    const g3 = U.el('div', { class: 'ctrl' }); s.panel.appendChild(g3);
    U.slider(g3, { label: '盘内缘温度（示意）', min: 2500, max: 20000, step: 50, value: P.diskTemp, format: (v) => Math.round(v) + ' K', onInput: (v) => { P.diskTemp = v; } });
    U.slider(g3, { label: '盘外半径', min: 5, max: 25, step: 0.1, value: P.diskOut, format: (v) => v.toFixed(1) + ' r<sub>s</sub>', onInput: (v) => { P.diskOut = v; } });
    U.slider(g3, { label: '盘内半径', min: 1.2, max: 6, step: 0.05, value: P.diskIn, format: (v) => v.toFixed(2) + ' r<sub>s</sub>', onInput: (v) => { P.diskIn = v; }, hint: '真实情况下内缘在 ISCO = 3 r<sub>s</sub>（不旋转黑洞）' });
    U.slider(g3, { label: '曝光', min: 0.2, max: 3, step: 0.01, value: 1, format: (v) => v.toFixed(2), onInput: (v) => { P.exposure = v; } });

    const g4 = U.el('div', { class: 'ctrl' }); s.panel.appendChild(g4);
    g4.appendChild(U.el('div', { class: 'panel-title', text: '一键预设' }));
    const set = (o) => {
      for (const k of ['lensing', 'doppler', 'grav', 'disk', 'eht']) if (k in o) toggles[k].set(o[k]);
      if ('pitch' in o) incl.set(o.pitch);
      if ('dist' in o) dist.set(o.dist);
    };
    U.buttons(g4, [
      { label: '真实物理', primary: true, onClick: () => set({ lensing: true, doppler: true, grav: true, disk: true, eht: false, pitch: 5.7, dist: 24 }) },
      { label: '《星际穿越》风格', onClick: () => set({ lensing: true, doppler: false, grav: false, disk: true, eht: false, pitch: 3, dist: 22 }) },
      { label: '俯视（正对盘面）', onClick: () => set({ lensing: true, doppler: true, grav: true, disk: true, eht: false, pitch: 80, dist: 24 }) },
      { label: 'M87* 视角 + EHT', onClick: () => set({ lensing: true, doppler: true, grav: true, disk: true, eht: true, pitch: 73, dist: 30 }) },
      { label: '没有相对论', onClick: () => set({ lensing: false, doppler: false, grav: false, disk: true, eht: false, pitch: 5.7 }) },
    ]);
    U.select(g4, {
      label: '渲染质量', value: r.quality,
      options: [{ value: 'low', label: '流畅（低）' }, { value: 'medium', label: '标准（中）' }, { value: 'high', label: '精细（高，需要好显卡）' }],
      onChange: (v) => r.setQuality(v),
    });
    const fps = U.el('div', { class: 'ctrl-hint' });
    g4.appendChild(fps);
    let acc = 0, n = 0;
    r.onFrame = (dt) => { acc += dt; n++; if (acc > 1) { fps.textContent = `帧率 ${Math.round(n / acc)} FPS · 渲染分辨率 ${Math.round(r.renderScale * 100)}%`; acc = 0; n = 0; } };
  }

  App.chapter({
    id: 'accretion', num: 9, part: 'C',
    title: '吸积盘与黑洞照片',
    subtitle: '黑洞本身不发光，那我们是怎么“看见”它的？答案是它周围那圈炽热、高速旋转、被引力扭曲的气体。',
    summary: '吸积盘的发光机制、多普勒集束、引力透镜造成的“光晕”，以及 EHT 拍摄黑洞照片的原理。',
    sims: ['实时黑洞光线追踪工作室'],
    goals: ['吸积盘为什么发光', '为什么一侧亮一侧暗', '为什么能看到盘的背面', '黑洞阴影与光子环', 'EHT 如何拍到黑洞'],
    build(ctx) {
      ctx.section('吸积盘：宇宙中效率最高的“发动机”', `
        <p>当气体被黑洞吸引时，由于或多或少带有旋转（角动量），它们不会直接掉进去，而是像水流进下水道时形成漩涡一样，在黑洞周围形成一个扁平的旋转盘——<span class="hl">吸积盘</span>。</p>
        <p>盘中不同半径的气体转速不同（越往里越快），相互摩擦产生巨大的热量，内区温度可达<b>数千万度</b>，发出强烈的 X 射线。气体在摩擦中慢慢损失角动量，一圈圈向内螺旋，最终在 ISCO 处坠入黑洞。</p>
        <p>下落过程中，物质可以把 <b>6%</b>（不转黑洞）到 <b>42%</b>（极限旋转黑洞）的静质量能量 mc² 释放出来——作为对比，核聚变只有 0.7%。这就是为什么宇宙中最亮的天体<b>类星体</b>，都是由正在“进食”的超大质量黑洞驱动的。</p>`);
      studio(ctx);
      ctx.section('读懂黑洞的样子', `
        <p>上面的图像看起来像一个“土星”被扭曲了，其中每个特征都有明确的物理来源。建议对照着开关逐项观察：</p>
        <h3>① 盘的“背面”翻到了头顶上</h3>
        <p>关闭“引力透镜”，你会看到一个普通的扁盘和一个小黑球。打开后，位于黑洞<b>正后方</b>的那部分盘发出的光，从黑洞上方绕过来到达相机，于是背面的盘看起来像一道拱在黑洞头顶的光弧。同理，光还可以从下方绕过来，形成黑洞底部的一道细弧——那是盘的<b>下表面</b>。</p>
        <h3>② 一边亮、一边暗：多普勒集束</h3>
        <p>吸积盘内缘的转速接近<b>光速的一半</b>。朝我们运动的一侧，光被“压缩”成更高频率（更蓝），而且由于相对论性集束效应，亮度大大增强（∝ δ<sup>3~4</sup>）；远离我们的一侧则变红、变暗。关掉“多普勒效应”就能看到一个左右对称的盘。</p>
        <h3>③ 越靠近黑洞越暗红：引力红移</h3>
        <p>从盘的最内缘爬出引力场的光会损失能量（第 7 章）。它和多普勒效应一起，决定了我们实际看到的颜色和亮度。</p>
        <h3>④ 阴影与光子环</h3>
        <p>中央的黑色区域是黑洞的<b>阴影</b>，半径约 2.6 r<sub>s</sub>（第 5 章）。阴影边缘有一道极细的亮环，由在光子球附近绕了一圈或多圈才逃出来的光组成，叫做<b>光子环</b>。理论上它由无数层越来越细的子环叠加而成。</p>`);
      ctx.callout('fact', `<p><b>电影《星际穿越》（2014）的黑洞“卡冈图雅”</b>是由物理学家基普·索恩与视效公司 Double Negative 合作，用广义相对论光线追踪算出来的——这也是本页渲染器所用的同一类方法。团队为此还发表了学术论文。</p>
        <p>不过导演诺兰要求去掉了多普勒效应：真实的黑洞一边亮一边暗、颜色偏蓝，观众可能会看不懂。点击“《星际穿越》风格”预设，你就能看到电影里那个左右对称的金色光环。</p>
        <p>而历史上第一张“黑洞模拟图”是法国天文学家让-皮埃尔·卢米涅在 1979 年用 IBM 7040 计算机算出数据、再<b>用墨水手工点</b>出来的。</p>`);
      ctx.section('事件视界望远镜：给黑洞拍照', `
        <p>黑洞的阴影非常小。M87* 距离我们 5500 万光年，阴影的视角大小只有约 <b>42 微角秒</b>——相当于在地球上看清月球表面的一个橙子。</p>
        <p>望远镜的分辨率 ≈ 波长 / 口径。要达到这种分辨率，需要一台<b>口径和地球一样大</b>的射电望远镜！<span class="hl">事件视界望远镜（EHT）</span>的做法是：把分布在南极、夏威夷、智利、西班牙、墨西哥等地的 8 台射电望远镜，在同一时间对准同一目标，用原子钟精确记录信号，再用超级计算机合成——这种技术叫<b>甚长基线干涉测量（VLBI）</b>。</p>
        <ul>
          <li><b>2019 年 4 月 10 日</b>：人类第一张黑洞照片——M87 星系中心的 M87*，质量 65 亿倍太阳质量。</li>
          <li><b>2021 年</b>：M87* 的偏振图像，揭示了黑洞周围的磁场结构。</li>
          <li><b>2022 年 5 月 12 日</b>：银河系中心黑洞人马座 A* 的照片。</li>
        </ul>
        <p>在工作室中点击“M87* 视角 + EHT”预设：我们几乎是沿着 M87 喷流的方向（倾角约 17°）俯视吸积盘，再用望远镜有限的分辨率模糊处理，就得到了那个著名的、下方更亮的“橙色甜甜圈”。它下方更亮，正是因为那一侧的物质在朝我们运动（多普勒集束）。</p>`);
      ctx.callout('fact', '<p><b>相对论性喷流</b>：许多黑洞会沿自转轴方向喷射出两束速度接近光速的等离子体喷流，长度可达数十万光年（M87 的喷流长约 5000 光年，早在 1918 年就被观测到）。目前主流理论认为，喷流由旋转黑洞拖拽的磁场提供能量（布兰福德–日纳杰机制）。</p>');
      ctx.callout('key', '<p>① 吸积盘通过摩擦加热发光，是最高效的能量转换装置；② 多普勒集束使朝向我们的一侧更亮；③ 引力透镜把盘的背面“折”到头顶和脚下；④ 黑洞阴影半径约 2.6 r<sub>s</sub>，EHT 通过地球尺度的干涉阵列拍到了它。</p>');
      ctx.think('如果从正上方（倾角 90°）俯视吸积盘，还会看到“一边亮一边暗”吗？',
        '<b>基本不会</b>。多普勒效应只取决于物质运动方向在视线方向上的分量。正对盘面观察时，盘的旋转方向都垂直于视线，没有“朝向”或“远离”我们的运动，所以亮度对称（只剩下很小的横向多普勒红移和引力红移）。试着把倾角拉到 85° 验证一下。');
      ctx.think('为什么 EHT 选择在 1.3 毫米的射电波段观测，而不是可见光？',
        '① 黑洞周围的气体和尘埃对可见光不透明，而毫米波可以穿透；② 地球大气在可见光波段抖动严重，无法实现洲际干涉；③ 在 1.3 mm 波段，M87* 附近的等离子体恰好是“透明”的，能看到最靠近黑洞的区域。');
    },
  });
})();

/* 第 10 章：黑洞的一生——诞生与蒸发 */
(function () {
  'use strict';
  const P = U.PHYS;

  function stellarFate(ctx) {
    const s = ctx.sim({
      title: '恒星的归宿：什么样的恒星会变成黑洞？',
      desc: '恒星一生都在与引力对抗：核聚变产生的压力向外撑，引力向内压。燃料耗尽后，结局取决于它的质量。选择恒星的初始质量，然后播放它的一生。',
    });
    const cv = U.canvas(s.stage, { aspect: 16 / 9, maxHeight: 520 });
    let M = 30, t = 0, playing = true;
    const ro = U.readouts(s.panel, [
      { key: 'life', label: '主序星寿命' },
      { key: 'end', label: '最终归宿' },
      { key: 'stage', label: '当前阶段', wide: true },
    ]);
    U.slider(s.panel, { label: '恒星初始质量', min: 0.5, max: 80, value: M, log: true, format: (v) => v.toFixed(v < 10 ? 1 : 0) + ' M☉', onInput: (v) => { M = v; t = 0; playing = true; init(); } });
    U.buttons(s.panel, [
      { label: '太阳 (1)', onClick: () => pick(1) },
      { label: '15 M☉', onClick: () => pick(15) },
      { label: '40 M☉', onClick: () => pick(40) },
      { label: '▶ 重播', primary: true, onClick: () => { t = 0; playing = true; init(); } },
    ]);
    const sl = s.panel.querySelector('input[type=range]');
    function pick(m) { sl.value = Math.log10(m); sl.dispatchEvent(new Event('input')); }
    s.panel.appendChild(U.el('div', { class: 'ctrl-hint', html: '质量分界线是近似值：实际还受金属丰度、自转、双星相互作用等影响。' }));
    const fate = () => (M < 8 ? 'wd' : M < 25 ? 'ns' : 'bh');
    let debris = [];
    function init() {
      debris = [];
      const rnd = U.rng(5);
      for (let i = 0; i < 700; i++) { const a = rnd() * 6.283, v = 0.3 + rnd() * 1; debris.push({ a, v, c: rnd() }); }
    }
    init();
    ctx.loop((dt, now) => {
      if (playing) t += dt;
      const { ctx: g, w, h } = cv;
      g.fillStyle = '#020308'; g.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const f = fate();
      const life = 1e10 * Math.pow(M, -2.5);
      ro.set('life', U.sci(life, 2) + ' 年');
      ro.set('end', f === 'wd' ? '白矮星' : f === 'ns' ? '中子星' : '<span style="color:#ff9a52">黑洞</span>');
      const baseR = 18 + 14 * Math.log10(M + 1);
      const mainCol = U.blackbody(3500 + 6000 * Math.pow(M, 0.55));
      const T1 = 3, T2 = 5.5, T3 = 6.2;
      let stage;
      if (t < T1) {
        stage = '主序星：氢聚变成氦，稳定燃烧';
        const R = baseR * (1 + 0.03 * Math.sin(now * 3));
        glowStar(g, cx, cy, R, mainCol);
      } else if (t < T2) {
        const k = (t - T1) / (T2 - T1);
        stage = f === 'wd' ? '红巨星：核心收缩，外层膨胀' : '红超巨星：核心依次聚变出更重的元素，直至铁';
        const R = baseR * (1 + k * (f === 'wd' ? 3 : 4.5));
        const col = mainCol.map((c, i) => U.lerp(c, [1, 0.45, 0.2][i], k));
        glowStar(g, cx, cy, R, col);
        if (f !== 'wd') { // 洋葱结构
          const layers = ['#ffffff', '#ffd27a', '#ff9a52', '#c04b2b', '#7a7a90'];
          layers.forEach((c, i) => { g.fillStyle = c; g.globalAlpha = 0.25 + 0.15 * k; g.beginPath(); g.arc(cx, cy, R * 0.28 * (1 - i * 0.18), 0, 6.283); g.fill(); });
          g.globalAlpha = 1;
          U.text(g, '铁核', cx, cy, { align: 'center', size: 10, color: '#000' });
        }
      } else {
        const k = Math.min(1, (t - T2) / (T3 - T2));
        const e = t - T2;
        if (f === 'wd') {
          stage = e < 2 ? '外层被缓缓抛出，形成行星状星云' : '白矮星：地球大小、一勺重数吨，靠电子简并压力支撑';
          // 行星状星云
          for (let i = 0; i < 3; i++) {
            g.strokeStyle = `hsla(${180 + i * 40},80%,60%,${0.35 * Math.max(0, 1 - e / 8)})`;
            g.lineWidth = 6 + i * 4;
            g.beginPath(); g.ellipse(cx, cy, (40 + e * 30 + i * 12) * 1.2, 40 + e * 30 + i * 12, 0.4, 0, 6.283); g.stroke();
          }
          glowStar(g, cx, cy, 5, [0.85, 0.9, 1]);
        } else {
          stage = e < 0.8 ? '铁核在不到一秒内坍缩 → 超新星爆发！' : f === 'ns' ? '中子星：直径约 20 km，一勺重 10 亿吨，快速自转形成脉冲星' : '核心坍缩成黑洞';
          // 爆炸闪光
          if (e < 1.2) { const fl = Math.max(0, 1 - e / 1.2); g.fillStyle = `rgba(255,250,230,${fl})`; g.beginPath(); g.arc(cx, cy, 30 + e * 400, 0, 6.283); g.fill(); }
          // 抛射物
          g.save(); g.globalCompositeOperation = 'lighter';
          for (const d of debris) {
            const rr = e * d.v * 170;
            if (rr > Math.max(w, h)) continue;
            const alpha = Math.max(0, 1 - e / 7);
            g.fillStyle = `hsla(${10 + d.c * 50},100%,${55 + d.c * 25}%,${alpha})`;
            g.fillRect(cx + Math.cos(d.a) * rr, cy + Math.sin(d.a) * rr, 2, 2);
          }
          g.restore();
          if (f === 'ns') {
            const ang = now * 6;
            g.save(); g.globalCompositeOperation = 'lighter';
            for (const sgn of [1, -1]) {
              const gr = g.createLinearGradient(cx, cy, cx + Math.cos(ang) * 200 * sgn, cy + Math.sin(ang) * 200 * sgn);
              gr.addColorStop(0, 'rgba(140,200,255,0.7)'); gr.addColorStop(1, 'rgba(140,200,255,0)');
              g.strokeStyle = gr; g.lineWidth = 4;
              g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(ang) * 200 * sgn, cy + Math.sin(ang) * 200 * sgn); g.stroke();
            }
            g.restore();
            glowStar(g, cx, cy, 5, [0.75, 0.85, 1]);
          } else {
            const R = 12 * k + 2;
            U.drawBH(g, cx, cy, R, 0, true);
          }
        }
      }
      ro.set('stage', stage);
      U.text(g, `初始质量 ${M.toFixed(M < 10 ? 1 : 0)} M☉`, 12, 18, { size: 12, color: 'rgba(255,255,255,0.6)' });
    }, s.box);
    function glowStar(g, x, y, R, col) {
      const gr = g.createRadialGradient(x, y, R * 0.2, x, y, R * 1.8);
      gr.addColorStop(0, U.rgb(col, 1)); gr.addColorStop(0.5, U.rgb(col, 0.9)); gr.addColorStop(0.56, U.rgb(col, 0.35)); gr.addColorStop(1, U.rgb(col, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, R * 1.8, 0, 6.283); g.fill();
    }
  }

  function hawking(ctx) {
    const s = ctx.sim({
      title: '霍金辐射计算器：黑洞也会“蒸发”',
      desc: '黑洞质量越小，温度越高、辐射越强、蒸发越快。拖动滑块，从小行星质量的微型黑洞一直调到超大质量黑洞。',
      wide: true,
    });
    const cv = U.canvas(s.stage, { aspect: 16 / 7, maxHeight: 460 });
    let M = P.Msun;
    const ro = U.readouts(s.panel, [
      { key: 'rs', label: '视界半径' },
      { key: 'T', label: '霍金温度' },
      { key: 'lam', label: '辐射峰值波长' },
      { key: 'P', label: '辐射功率' },
      { key: 'life', label: '蒸发寿命', wide: true },
      { key: 'cmb', label: '与宇宙微波背景（2.725 K）比较', wide: true },
    ]);
    const sl = U.slider(s.panel, { label: '黑洞质量', min: 1e5, max: 1e41, value: M, log: true, format: (v) => U.sci(v, 2) + ' kg', onInput: (v) => { M = v; } });
    const box = U.el('div'); s.panel.appendChild(box);
    U.buttons(box, [
      { label: '一座山（10¹² kg）', onClick: () => sl.set(1e12) },
      { label: '月球质量', onClick: () => sl.set(7.35e22) },
      { label: '太阳质量', onClick: () => sl.set(P.Msun) },
      { label: '人马座 A*', onClick: () => sl.set(4.3e6 * P.Msun) },
    ]);
    const hbar = P.hbar, c = P.c, G = P.G, kB = P.kB;
    const TH = (m) => (hbar * c ** 3) / (8 * Math.PI * G * m * kB);
    const life = (m) => (5120 * Math.PI * G * G * m ** 3) / (hbar * c ** 4);
    const power = (m) => (hbar * c ** 6) / (15360 * Math.PI * G * G * m * m);
    const band = (l) => (l < 1e-11 ? 'γ 射线' : l < 1e-8 ? 'X 射线' : l < 3.8e-7 ? '紫外线' : l < 7.8e-7 ? '可见光' : l < 1e-3 ? '红外线' : l < 1 ? '微波' : '无线电波');
    const pairs = [];
    let spawn = 0;
    ctx.loop((dt) => {
      const T = TH(M), lam = 2.898e-3 / T, L = life(M);
      ro.set('rs', U.length(U.rs(M)));
      ro.set('T', U.sci(T, 3) + ' K');
      ro.set('lam', U.length(lam) + '（' + band(lam) + '）');
      ro.set('P', U.sci(power(M), 3) + ' W');
      const yrs = L / P.year;
      ro.set('life', L < P.year ? U.duration(L) : U.sci(yrs, 3) + ' 年 ' + (yrs < P.ageUniverse ? '<span style="color:#4ade80">（比宇宙年龄短！）</span>' : `（宇宙年龄的 ${U.sci(yrs / P.ageUniverse, 2)} 倍）`));
      ro.set('cmb', T > 2.725 ? '<span style="color:#ffb454">比背景热：净向外辐射，正在变小</span>' : '比背景冷：吸收的比辐射的多，目前反而在变大');

      const { ctx: g, w, h } = cv;
      g.fillStyle = '#020308'; g.fillRect(0, 0, w, h);
      // 左：视界附近的“虚粒子对”示意
      const lw = w * 0.42, cx = lw / 2, cy = h / 2, R = Math.min(lw, h) * 0.22;
      const heat = U.clamp((Math.log10(T) + 8) / 20, 0, 1); // 1e-8 K → 0, 1e12 K → 1
      spawn += dt * (2 + 60 * heat);
      while (spawn > 1) {
        spawn -= 1;
        const a = Math.random() * 6.283;
        pairs.push({ a, t: 0, out: Math.random() < 0.5 });
        if (pairs.length > 200) pairs.shift();
      }
      const col = U.blackbody(1500 + 30000 * heat);
      for (let i = pairs.length - 1; i >= 0; i--) {
        const p = pairs[i];
        p.t += dt;
        const r0 = R * 1.12;
        const sep = Math.min(p.t * 40, 12);
        const rin = r0 - sep - Math.max(0, p.t - 0.3) * 80;
        const rout = r0 + sep + Math.max(0, p.t - 0.3) * (60 + 200 * heat);
        const tx = -Math.sin(p.a), ty = Math.cos(p.a);
        if (rin > R * 0.5) { g.fillStyle = 'rgba(160,160,200,0.6)'; g.beginPath(); g.arc(cx + Math.cos(p.a) * rin + tx * 2, cy + Math.sin(p.a) * rin + ty * 2, 1.6, 0, 6.283); g.fill(); }
        if (rout < lw * 0.7) { U.glowCircle(g, cx + Math.cos(p.a) * rout - tx * 2, cy + Math.sin(p.a) * rout - ty * 2, 2, U.rgb(col), 8); }
        if (p.t > 3) pairs.splice(i, 1);
      }
      g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, R, 0, 6.283); g.fill();
      g.strokeStyle = U.rgb(col, 0.7); g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, R, 0, 6.283); g.stroke();
      U.text(g, '视界附近的量子涨落（示意）', 12, 18, { size: 12, color: 'rgba(255,255,255,0.6)' });
      U.text(g, '一个粒子落入，另一个逃逸 → 黑洞损失能量', 12, h - 14, { size: 11, color: 'rgba(255,255,255,0.45)' });
      // 右：温度-质量关系图（对数）
      const px = lw + 50, pw = w - lw - 80, py = 30, ph = h - 70;
      const lmMin = 5, lmMax = 41, ltMin = -19, ltMax = 19;
      const X = (lm) => px + ((lm - lmMin) / (lmMax - lmMin)) * pw;
      const Y = (lt) => py + ph - ((lt - ltMin) / (ltMax - ltMin)) * ph;
      U.plotFrame(g, { x: px, y: py, w: pw, h: ph }, { xlabel: '质量 (kg)', ylabel: '温度 (K)' });
      for (let e = 5; e <= 35; e += 5) U.text(g, '10' + U.plain(`<sup>${e}</sup>`), X(e), py + ph + 14, { align: 'center', size: 10, color: 'rgba(255,255,255,0.4)' });
      for (let e = -15; e <= 15; e += 5) U.text(g, '10' + U.plain(`<sup>${e}</sup>`), px - 6, Y(e), { align: 'right', size: 10, color: 'rgba(255,255,255,0.4)' });
      // CMB 线
      g.strokeStyle = 'rgba(92,200,255,0.6)'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(px, Y(Math.log10(2.725))); g.lineTo(px + pw, Y(Math.log10(2.725))); g.stroke(); g.setLineDash([]);
      U.text(g, '宇宙微波背景 2.7 K', px + pw - 4, Y(Math.log10(2.725)) - 9, { align: 'right', size: 11, color: '#5cc8ff' });
      // 宇宙年龄内蒸发完的质量界限
      const mEvap = Math.cbrt((P.ageUniverse * P.year * hbar * c ** 4) / (5120 * Math.PI * G * G));
      g.fillStyle = 'rgba(74,222,128,0.08)'; g.fillRect(px, py, X(Math.log10(mEvap)) - px, ph);
      U.text(g, '已蒸发完', px + 6, py + 12, { size: 11, color: 'rgba(74,222,128,0.8)' });
      // 曲线
      g.strokeStyle = '#ffb454'; g.lineWidth = 2; g.beginPath();
      for (let lm = lmMin; lm <= lmMax; lm += 0.2) { const lt = Math.log10(TH(Math.pow(10, lm))); lm === lmMin ? g.moveTo(X(lm), Y(lt)) : g.lineTo(X(lm), Y(lt)); }
      g.stroke();
      U.glowCircle(g, X(Math.log10(M)), Y(Math.log10(T)), 6, '#fff', 14);
      // 太阳质量标注
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(X(Math.log10(P.Msun)) - 0.5, py + ph - 6, 1, 6);
      U.text(g, 'M☉', X(Math.log10(P.Msun)), py + ph - 12, { align: 'center', size: 10, color: 'rgba(255,255,255,0.5)' });
    }, s.box);
  }

  App.chapter({
    id: 'lifecycle', num: 10, part: 'C',
    title: '黑洞的一生：诞生与蒸发',
    subtitle: '大质量恒星在超新星爆发中诞生黑洞；而霍金告诉我们，黑洞并不是永恒的——它会极其缓慢地“蒸发”。',
    summary: '恒星演化与引力坍缩、超大质量黑洞的来源，以及霍金辐射与黑洞热力学。',
    sims: ['恒星的归宿', '霍金辐射计算器'],
    goals: ['恒星如何坍缩成黑洞', '三类黑洞：恒星级、中等质量、超大质量', '霍金辐射', '黑洞的温度与寿命', '信息悖论'],
    build(ctx) {
      ctx.section('恒星：引力与压力的一生之战', `
        <p>恒星是一个巨大的气体球。引力试图把它压缩，核心的核聚变产生的热压力则向外支撑。只要燃料还在，两者就保持平衡。燃料耗尽后，引力终将获胜——问题只是它能把恒星压到什么程度：</p>
        <ul>
          <li><b>白矮星</b>：由<b>电子简并压力</b>支撑（泡利不相容原理：电子不能挤在同一个状态）。钱德拉塞卡在 1930 年发现，这种压力最多只能撑住约 <b>1.4 倍太阳质量</b>（钱德拉塞卡极限）。</li>
          <li><b>中子星</b>：超过这个极限，电子被压进原子核，与质子结合成中子，由<b>中子简并压力</b>支撑。上限约为 2–3 倍太阳质量（TOV 极限）。</li>
          <li><b>黑洞</b>：再往上，已知的任何力都无法阻止坍缩。核心将一直塌缩下去，形成黑洞。</li>
        </ul>`);
      stellarFate(ctx);
      ctx.section('三类黑洞', `
        <table>
          <tr><th>类型</th><th>质量</th><th>形成方式</th><th>代表</th></tr>
          <tr><td>恒星级黑洞</td><td>约 3–100 M☉</td><td>大质量恒星坍缩；中子星/黑洞并合</td><td>天鹅座 X-1（首个被确认的黑洞，1970s）</td></tr>
          <tr><td>中等质量黑洞</td><td>10²–10⁵ M☉</td><td>尚不清楚，可能由星团中的并合形成</td><td>GW190521 并合产物（142 M☉）</td></tr>
          <tr><td>超大质量黑洞</td><td>10⁵–10¹⁰ M☉</td><td>位于几乎每个大星系的中心，起源仍是前沿课题</td><td>人马座 A*、M87*</td></tr>
        </table>
        <p>超大质量黑洞与其宿主星系似乎在“协同演化”：黑洞质量约为星系核球质量的千分之一。更令人困惑的是，詹姆斯·韦布太空望远镜在宇宙诞生后不到 5 亿年就发现了百万倍太阳质量的黑洞——它们是怎么这么快长大的？这是当今天文学的热门问题。</p>`);
      ctx.section('霍金辐射：黑洞不是完全“黑”的', `
        <p>1974 年，史蒂芬·霍金把量子力学应用到黑洞视界附近，得出了一个震惊物理界的结论：<b>黑洞会像一个热物体一样向外辐射</b>，其温度与质量成反比：</p>`);
      ctx.eq(`T<sub>H</sub> = ${U.frac('ħc<sup>3</sup>', '8πGMk<sub>B</sub>')} ≈ 6×10<sup>−8</sup> K × ${U.frac('M<sub>☉</sub>', 'M')}`, 'ħ 为约化普朗克常数，k<sub>B</sub> 为玻尔兹曼常数——这个公式同时包含了量子力学、相对论、引力和热力学');
      ctx.section(null, `
        <p>一个通俗（但不完全准确）的图像是：真空中不断有“虚粒子对”凭空产生又湮灭。如果一对粒子恰好在视界边缘产生，其中一个掉进黑洞，另一个就可能逃到远处，成为真实的辐射。逃走的粒子带走了正能量，掉进去的带负能量，于是黑洞的质量慢慢减少——<b>黑洞在“蒸发”</b>。</p>`);
      hawking(ctx);
      ctx.callout('fact', `<p>一个太阳质量的黑洞温度只有 6×10<sup>−8</sup> K，比宇宙微波背景（2.7 K）冷得多，所以目前它吸收的背景辐射比发出的还多，完全观测不到霍金辐射。它要等到宇宙冷却到比它更冷之后才开始净蒸发，所需时间约 <b>10<sup>67</sup> 年</b>——是宇宙当前年龄的 10<sup>57</sup> 倍。</p>
        <p>但如果宇宙早期形成过质量约 10<sup>11</sup>–10<sup>12</sup> kg 的<b>原初黑洞</b>，它们应该正好在今天蒸发完毕，并在最后一刻以一次伽马射线暴的形式结束生命。天文学家至今仍在寻找这种信号。</p>`);
      ctx.section('黑洞热力学与信息悖论', `
        <p>霍金辐射揭示了黑洞与热力学的深刻联系。贝肯斯坦和霍金发现，黑洞有<b>熵</b>，并且熵正比于视界的<b>面积</b>（而不是体积）：</p>`);
      ctx.eq(`S = ${U.frac('k<sub>B</sub>c<sup>3</sup>A', '4Għ')}`, '霍金希望这个公式刻在他的墓碑上。一个太阳质量黑洞的熵约为 10<sup>77</sup> k<sub>B</sub>，远超形成它的恒星');
      ctx.section(null, `
        <p>这引出了现代物理学最著名的谜题之一——<span class="hl">黑洞信息悖论</span>：量子力学认为信息永远不会丢失，但如果一本书掉进黑洞，而黑洞最终蒸发成完全随机的热辐射，书里的信息去哪儿了？</p>
        <p>这个问题困扰了物理学家近 50 年，推动了“全息原理”等深刻思想的诞生。霍金本人在 2004 年公开承认输掉了与普雷斯基尔的赌约，认为信息最终会以某种方式从辐射中“泄露”出来。近年的研究（“岛屿”公式、佩奇曲线）让人们看到了曙光，但完整答案仍需要量子引力理论。</p>`);
      ctx.callout('key', '<p>① 质量超过约 25 M☉ 的恒星最终可能坍缩成黑洞；② 黑洞分为恒星级、中等质量和超大质量三类；③ 黑洞有温度 T ∝ 1/M，会通过霍金辐射蒸发，寿命 ∝ M³；④ 黑洞熵正比于视界面积，信息悖论仍是前沿难题。</p>');
      ctx.think('一个黑洞在蒸发过程中，温度会怎样变化？最后阶段会发生什么？',
        '质量减小 → 温度升高 → 辐射更强 → 质量减小得更快。这是一个<b>正反馈</b>过程：黑洞越来越热、越来越亮，最后在极短时间内以剧烈爆发的形式释放剩余能量（最后一秒释放约 2×10<sup>22</sup> J 的能量，相当于数百万颗百万吨级氢弹）。');
      ctx.think('粒子加速器（如 LHC）会不会制造出吞噬地球的微型黑洞？',
        '不会。① 在标准物理下，LHC 的能量远不足以产生黑洞；② 即使在某些额外维度理论中能产生，这种微型黑洞质量极小，霍金温度极高，会在约 10<sup>−27</sup> 秒内蒸发；③ 宇宙射线以比 LHC 高得多的能量撞击地球、月球、中子星已经几十亿年，它们依然安然无恙。');
    },
  });
})();

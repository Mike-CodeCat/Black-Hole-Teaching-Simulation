/* 知识测验 */
(function () {
  'use strict';
  const QS = [
    { q: '逃逸速度的大小取决于什么？', o: ['被抛物体的质量', '星球的质量和半径', '发射的方向', '星球的自转速度'], a: 1, e: 'v<sub>esc</sub> = √(2GM/R)，只与星球质量 M 和半径 R 有关，与物体质量、发射方向无关（第 1 章）。', ch: 'escape' },
    { q: '把地球压缩成黑洞，它的史瓦西半径大约是？', o: ['9 米', '9 厘米', '9 毫米', '9 微米'], a: 2, e: 'r<sub>s</sub> = 2GM/c² ≈ 8.9 mm，大约一颗弹珠大小（第 4 章）。', ch: 'anatomy' },
    { q: '一艘飞船以 0.8c 飞行（γ ≈ 1.67）。地球上过了 10 年，飞船上过了多久？', o: ['16.7 年', '10 年', '6 年', '2 年'], a: 2, e: 'Δt<sub>飞船</sub> = Δt<sub>地球</sub> / γ = 10 / 1.67 ≈ 6 年（第 2 章）。', ch: 'special-relativity' },
    { q: '根据等效原理，下面哪种说法是正确的？', o: ['引力场中光一定沿直线传播', '在封闭电梯中无法区分引力和加速', '只有有质量的物体才受引力影响', '自由下落的人会感到更重'], a: 1, e: '等效原理：局部无法区分引力和加速运动。由此可推出光在引力场中也会弯曲（第 3 章）。', ch: 'spacetime' },
    { q: '“事件视界”最准确的描述是？', o: ['黑洞坚硬的外壳', '光和物质只能进不能出的边界', '黑洞吸积盘的外边缘', '黑洞中心的奇点'], a: 1, e: '事件视界不是实体表面，而是一个单向的时空边界（第 4 章）。', ch: 'anatomy' },
    { q: '光可以绕黑洞做圆周运动的“光子球”位于？', o: ['1 r<sub>s</sub>', '1.5 r<sub>s</sub>', '2.6 r<sub>s</sub>', '3 r<sub>s</sub>'], a: 1, e: '光子球在 r = 1.5 r<sub>s</sub> = 3GM/c²，这种圆轨道是不稳定的（第 4、5 章）。', ch: 'anatomy' },
    { q: '为什么黑洞“阴影”的半径（约 2.6 r<sub>s</sub>）比事件视界大？', o: ['因为吸积盘挡住了光', '因为引力透镜使碰撞参数小于 2.6 r<sub>s</sub> 的光线都被吞噬', '因为望远镜分辨率不够', '因为黑洞在旋转'], a: 1, e: '临界碰撞参数 b<sub>c</sub> = (3√3/2) r<sub>s</sub> ≈ 2.6 r<sub>s</sub>，瞄准这个范围内的光线都会掉进黑洞（第 5 章）。', ch: 'lensing' },
    { q: '不旋转黑洞的“最内稳定圆轨道”（ISCO）在哪里？', o: ['1 r<sub>s</sub>', '1.5 r<sub>s</sub>', '3 r<sub>s</sub>', '不存在，任何半径都可以稳定绕行'], a: 2, e: 'ISCO = 3 r<sub>s</sub>，这也是吸积盘的内边缘（第 6 章）。', ch: 'orbits' },
    { q: '水星近日点进动中，牛顿理论无法解释、而被广义相对论完美解释的部分是每世纪多少？', o: ['1.75 角秒', '43 角秒', '574 角秒', '1 度'], a: 1, e: '43″/世纪。1.75″ 是太阳边缘星光的偏折角（第 3、6 章）。', ch: 'orbits' },
    { q: 'GPS 卫星上的原子钟（综合考虑两种相对论效应）每天比地面钟？', o: ['快约 38 微秒', '慢约 38 微秒', '快约 7 微秒', '完全一样'], a: 0, e: '引力更弱使钟快 45 μs，高速运动使钟慢 7 μs，合计快约 38 μs/天（第 7 章）。', ch: 'time' },
    { q: '远方的观察者看一个宇航员落向黑洞，他会看到？', o: ['宇航员加速穿过视界并消失', '宇航员越来越慢、越来越红、越来越暗，永远停在视界之外', '宇航员被弹回来', '宇航员变成蓝色'], a: 1, e: '由于引力时间膨胀和红移，远方观察者永远看不到物体穿过视界（第 7 章）。', ch: 'time' },
    { q: '哪种黑洞的视界处潮汐力更小，宇航员能活着穿过视界？', o: ['10 倍太阳质量的黑洞', '超大质量黑洞', '两者一样', '都不可能活着到达视界'], a: 1, e: '视界处潮汐力 ∝ 1/M²，越大的黑洞在视界处越“温柔”（第 8 章）。', ch: 'tidal' },
    { q: '吸积盘朝向我们运动的一侧看起来更亮，主要原因是？', o: ['那一侧温度本来就更高', '相对论性多普勒集束效应', '那一侧离我们更近', '引力透镜只作用于一侧'], a: 1, e: '朝向观察者运动的发光物质，辐射被“集中”并蓝移，亮度大大增强（第 9 章）。', ch: 'accretion' },
    { q: '事件视界望远镜（EHT）是如何达到拍摄黑洞所需的极高分辨率的？', o: ['建造一台直径 1 km 的望远镜', '把分布在全球的射电望远镜组成地球大小的干涉阵列', '把望远镜发射到黑洞附近', '使用 X 射线望远镜'], a: 1, e: '甚长基线干涉测量（VLBI）让望远镜的等效口径接近地球直径（第 9 章）。', ch: 'accretion' },
    { q: '关于霍金辐射，下列说法正确的是？', o: ['黑洞质量越大，温度越高', '黑洞质量越小，温度越高、蒸发越快', '太阳质量的黑洞正在迅速蒸发', '霍金辐射已被天文观测直接证实'], a: 1, e: 'T<sub>H</sub> ∝ 1/M，寿命 ∝ M³。太阳质量黑洞比宇宙背景还冷，目前无法观测到其霍金辐射（第 10 章）。', ch: 'lifecycle' },
    { q: 'GW150914 事件中，两个黑洞（36 + 29 M☉）并合为 62 M☉。“少掉”的 3 M☉ 去哪儿了？', o: ['被吸积盘带走', '转化为引力波能量辐射出去', '形成了一颗新恒星', '测量误差'], a: 1, e: '根据 E = mc²，约 3 倍太阳质量的能量在 0.2 秒内以引力波的形式辐射出去（第 11 章）。', ch: 'gravitational-waves' },
  ];

  App.page('quiz', {
    title: '知识测验',
    build(ctx) {
      const root = ctx.root;
      root.appendChild(U.el('header', { class: 'chapter-hero' },
        U.el('div', { class: 'chapter-kicker', text: 'QUIZ' }),
        U.el('h1', { text: '知识测验' }),
        U.el('p', { class: 'chapter-sub', text: `共 ${QS.length} 题，覆盖全部 11 章。每题作答后立即显示解析，答错的题可以点击链接回到对应章节复习。` })));
      const body = U.el('div', { class: 'chapter-body' });
      root.appendChild(body);
      let answered = 0, correct = 0;
      const scoreBox = U.el('section', { class: 'card score-box' });
      const updateScore = () => {
        scoreBox.innerHTML = answered < QS.length
          ? `<p>已答 ${answered} / ${QS.length} 题，答对 <b style="font-size:inherit">${correct}</b> 题</p>`
          : `<b>${Math.round((correct / QS.length) * 100)}</b><span style="color:var(--muted)"> 分</span><p>${correct === QS.length ? '🎉 满分！你已经是黑洞小专家了！' : correct >= QS.length * 0.8 ? '👏 非常棒！再看看答错的题的解析吧。' : correct >= QS.length * 0.6 ? '🙂 及格啦！建议回到答错题对应的章节复习一下。' : '💪 别灰心，按照学习路径再学一遍，你一定能掌握！'}</p>`;
      };
      QS.forEach((item, i) => {
        const card = U.el('section', { class: 'card quiz-q' });
        card.appendChild(U.el('h3', { html: `<span class="qn">${i + 1}.</span>${item.q}` }));
        const opts = U.el('div', { class: 'quiz-opts' });
        const btns = item.o.map((o, j) => {
          const b = U.el('button', { class: 'quiz-opt', html: `${'ABCD'[j]}. ${o}` });
          b.addEventListener('click', () => {
            btns.forEach((x) => (x.disabled = true));
            btns[item.a].classList.add('correct');
            if (j !== item.a) b.classList.add('wrong'); else correct++;
            answered++;
            const ch = App.getChapter(item.ch);
            card.appendChild(U.el('div', { class: 'quiz-exp', html: (j === item.a ? '✅ 回答正确！' : '❌ 回答错误。') + item.e + (ch && j !== item.a ? ` <a href="#/ch/${ch.id}">→ 复习第 ${ch.num} 章</a>` : '') }));
            updateScore();
          });
          opts.appendChild(b);
          return b;
        });
        card.appendChild(opts);
        body.appendChild(card);
      });
      updateScore();
      body.appendChild(scoreBox);
      U.buttons(body, [{ label: '↺ 重新测验', onClick: () => { location.hash = '#/quiz?' + Date.now(); } }]);
    },
  });
})();

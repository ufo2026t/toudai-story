/* 第一部『灯の生まれる夜』で加わったミニゲーム：レンズの環を合わせる・秘密箱を開ける・導きの灯（ふたつの灯を重ねて暗礁を抜ける） */
(function () {
  'use strict';
  const { el } = U;
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };
  function skipper(host, api, after) {
    let fails = 0, shown = false;
    const box = el('div', { class: 'game-note' });
    host.appendChild(box);
    const show = () => {
      if (shown) return; shown = true;
      box.appendChild(el('button', {
        class: 'btn ghost small', type: 'button',
        onclick: () => { if (confirm('このゲームを飛ばして先へ進みますか？')) api.done(true); }
      }, 'うまくいかない時は：先へ進む'));
    };
    const timer = setTimeout(show, (after || 90) * 1000);
    return { fail() { if (++fails >= 4) show(); }, stop() { clearTimeout(timer); box.remove(); } };
  }

  /* ---------- レンズの環：硝子の環を回して、光の窓をすべて海の側にそろえる ----------
     環をひとつ回すと、歯車でつながった外側の環も一緒に回る。 */
  Games.rings = function (host, cfg, api) {
    const N = cfg.rings || 4, S = cfg.steps || 6, W = 320, C = W / 2;
    const radii = Array.from({ length: N }, (_, i) => 38 + i * (108 / Math.max(1, N - 1)));
    const turns = Array(N).fill(0);
    const mod = i => ((turns[i] % S) + S) % S;
    const press = i => { turns[i]++; if (cfg.couple !== false && i + 1 < N) turns[i + 1]++; };
    const solved = () => turns.every((_, i) => mod(i) === 0);
    let guard = 0;
    do {
      turns.fill(0);
      for (let n = 0; n < N * 3; n++) press(Math.floor(Math.random() * N));
    } while ((turns.filter((_, i) => mod(i) === 0).length > 1 || solved()) && guard++ < 60);

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${W}`, class: 'rings-view', role: 'img', 'aria-label': 'レンズの環' });
    svg.appendChild(svgEl('rect', { width: W, height: W, rx: 8, fill: '#0b0f16' }));
    const beam = svgEl('polygon', { points: '', fill: '#ffe6a8', opacity: 0.0, class: 'rings-beam' });
    svg.appendChild(beam);
    const sea = svgEl('text', { x: W - 8, y: 18, fill: '#8fb0c8', 'font-size': 12, 'text-anchor': 'end' });
    sea.textContent = cfg.seaLabel || '海（東）は右 →';
    svg.appendChild(sea);
    const groups = radii.map((r, i) => {
      const g = svgEl('g', { class: 'ring', tabindex: 0, 'data-i': i });
      g.style.transformOrigin = `${C}px ${C}px`;
      g.appendChild(svgEl('circle', { cx: C, cy: C, r, fill: 'none', stroke: '#2b3a4c', 'stroke-width': 17 }));
      for (let a = 0; a < 360; a += 15) {
        const rad = a * Math.PI / 180;
        g.appendChild(svgEl('line', {
          x1: (C + (r - 7) * Math.cos(rad)).toFixed(1), y1: (C + (r - 7) * Math.sin(rad)).toFixed(1),
          x2: (C + (r + 7) * Math.cos(rad)).toFixed(1), y2: (C + (r + 7) * Math.sin(rad)).toFixed(1),
          stroke: '#3c5068', 'stroke-width': 1
        }));
      }
      const half = 18 * Math.PI / 180;
      const p1 = [C + r * Math.cos(-half), C + r * Math.sin(-half)], p2 = [C + r * Math.cos(half), C + r * Math.sin(half)];
      g.appendChild(svgEl('path', { d: `M${p1[0].toFixed(1)} ${p1[1].toFixed(1)} A${r} ${r} 0 0 1 ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`, class: 'ring-win', fill: 'none', 'stroke-width': 15, 'stroke-linecap': 'round' }));
      g.appendChild(svgEl('circle', { cx: C, cy: C, r, fill: 'none', stroke: 'transparent', 'stroke-width': 26, 'pointer-events': 'stroke' }));
      g.addEventListener('click', () => turn(i));
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); turn(i); } });
      svg.appendChild(g);
      return g;
    });
    svg.appendChild(svgEl('circle', { cx: C, cy: C, r: 18, fill: '#ffcf7a', class: 'rings-lamp' }));
    const info = el('div', { class: 'game-note' });
    const fb = el('div', { class: 'feedback' });
    const row = el('div', { class: 'row' });
    radii.forEach((_, i) => row.appendChild(el('button', { class: 'btn ghost small', type: 'button', onclick: () => turn(i) }, (cfg.ringNames && cfg.ringNames[i]) || ('内から' + (i + 1) + '番目'))));
    const sk = skipper(host, api, 120);
    let finished = false;
    function draw() {
      let reach = radii[N - 1] + 14, ok = 0;
      for (let i = 0; i < N; i++) {
        groups[i].style.transform = `rotate(${turns[i] * 360 / S}deg)`;
        const aligned = mod(i) === 0;
        groups[i].classList.toggle('aligned', aligned);
        if (aligned) ok++;
      }
      for (let i = 0; i < N; i++) if (mod(i) !== 0) { reach = radii[i] - 9; break; }
      const full = ok === N;
      const x2 = full ? W : C + reach, spread = full ? 46 : 10;
      beam.setAttribute('points', `${C},${C - 10} ${x2},${C - spread} ${x2},${C + spread} ${C},${C + 10}`);
      beam.setAttribute('opacity', full ? 0.55 : 0.25);
      info.textContent = `光の窓がそろった環：${ok} / ${N}`;
    }
    function turn(i) {
      if (finished) return;
      press(i); Sound.click(); draw();
      if (solved()) {
        finished = true; sk.stop(); Sound.good();
        svg.classList.add('done');
        fb.className = 'feedback good'; fb.textContent = cfg.doneText || '光が、ひとすじの束になって海へ伸びた。';
        setTimeout(() => api.done(), 1100);
      } else if (cfg.couple !== false && i + 1 < N) {
        fb.className = 'feedback'; fb.textContent = cfg.coupleText || '歯車が噛んで、外側の環も一緒に回った。';
      } else {
        fb.className = 'feedback'; fb.textContent = '';
      }
    }
    host.appendChild(el('div', { class: 'game-area' },
      el('div', { class: 'game-note' }, cfg.note || '環をクリックすると、一段ずつ回ります。金色の光の窓を、すべて海の側（右）にそろえよう。'),
      svg, info, row, fb));
    draw();
    return () => sk.stop();
  };

  /* ---------- 秘密箱：板を決まった順に動かして開ける。順を誤ると、板はもとに戻る ---------- */
  Games.himitsu = function (host, cfg, api) {
    const order = cfg.order, panels = cfg.panels;
    let step = 0, finished = false;
    const fb = el('div', { class: 'feedback' });
    const sk = skipper(host, api, 120);
    const grid = el('div', { class: 'himitsu' });
    const box = el('div', { class: 'himitsu-box', html: `<svg viewBox="0 0 120 90" aria-hidden="true">
      <defs><pattern id="yosegi" width="12" height="12" patternUnits="userSpaceOnUse">
        <rect width="12" height="12" fill="#b98a52"/><path d="M0 6 L6 0 L12 6 L6 12 Z" fill="#8a5a2e"/><path d="M6 0 L6 12 M0 6 L12 6" stroke="#e0c08a" stroke-width=".8"/>
      </pattern></defs>
      <path class="lid" d="M10 30 L60 12 L110 30 L60 48 Z" fill="url(#yosegi)" stroke="#5a3a1a"/>
      <path d="M10 30 L60 48 L60 84 L10 66 Z" fill="#9a6a3a" stroke="#5a3a1a"/>
      <path d="M60 48 L110 30 L110 66 L60 84 Z" fill="#7a5028" stroke="#5a3a1a"/>
      <path d="M14 40 L56 55 M14 52 L56 67 M64 55 L106 40 M64 67 L106 52" stroke="#e0c08a" stroke-width="1" opacity=".6"/>
    </svg>` });
    const btns = {};
    panels.forEach(p => {
      const b = el('button', { class: 'himitsu-panel', type: 'button', style: { gridArea: p.area } }, p.label);
      b.addEventListener('click', () => pick(p.id, b));
      btns[p.id] = b;
      grid.appendChild(b);
    });
    box.style.gridArea = 'box';
    grid.appendChild(box);
    const progress = el('div', { class: 'pips' });
    order.forEach(() => progress.appendChild(el('i')));
    function pick(id, b) {
      if (finished) return;
      if (b.classList.contains('moved')) { fb.className = 'feedback'; fb.textContent = 'その板は、もう動かしてある。'; return; }
      if (id === order[step]) {
        b.classList.add('moved'); progress.children[step].classList.add('on'); step++;
        Sound.tone(260 + step * 60, 0.08, 'triangle', 0.07);
        fb.className = 'feedback good'; fb.textContent = (cfg.stepTexts && cfg.stepTexts[step - 1]) || 'コトッ、と板が動いた。';
        if (step >= order.length) {
          finished = true; sk.stop(); Sound.good();
          box.classList.add('open');
          fb.textContent = cfg.doneText || 'カチリ、と箱の中で何かが外れた。';
          setTimeout(() => api.done(), 1000);
        }
      } else {
        Sound.bad(); sk.fail();
        step = 0;
        Object.values(btns).forEach(x => x.classList.remove('moved'));
        Array.from(progress.children).forEach(x => x.classList.remove('on'));
        grid.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 240 });
        fb.className = 'feedback bad'; fb.textContent = cfg.wrongText || 'びくともしない。――カタカタと、動かした板がみな元に戻った。';
      }
    }
    host.appendChild(el('div', { class: 'game-area' },
      el('div', { class: 'game-note' }, cfg.note || '動かす板をクリックしよう。順番を誤ると、板はすべて元に戻る。'),
      grid, progress, fb));
    return () => sk.stop();
  };

  /* ---------- 導きの灯：前の低い火と、後ろの高い灯が縦に重なるよう舵を取り、暗礁のすき間を抜ける ---------- */
  Games.leading = function (host, cfg, api) {
    const W = 480, H = 280, HZ = 150, CX = W / 2;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'leading-view', role: 'img', 'aria-label': '船の舳先から見た岬' });
    const defs = svgEl('defs', {});
    defs.innerHTML = '<linearGradient id="ldsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05080e"/><stop offset="1" stop-color="#161e2a"/></linearGradient>' +
      '<radialGradient id="ldglow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff4d0"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="ldfire" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd08a"/><stop offset="1" stop-color="#e0602a" stop-opacity="0"/></radialGradient>';
    svg.appendChild(defs);
    svg.appendChild(svgEl('rect', { width: W, height: HZ, fill: 'url(#ldsky)' }));
    svg.appendChild(svgEl('rect', { y: HZ, width: W, height: H - HZ, fill: '#0a131c' }));
    const cape = svgEl('path', { fill: '#1a1d1f' }); svg.appendChild(cape);
    const tower = svgEl('rect', { width: 8, height: 46, fill: '#4a4e52' }); svg.appendChild(tower);
    const rearGlow = svgEl('circle', { r: 26, fill: 'url(#ldglow)' }); svg.appendChild(rearGlow);
    const rearCore = svgEl('circle', { r: 3.4, fill: '#fff6dc' }); svg.appendChild(rearCore);
    const rock = svgEl('path', { fill: '#121416' }); svg.appendChild(rock);
    const fireGlow = svgEl('circle', { r: 18, fill: 'url(#ldfire)' }); svg.appendChild(fireGlow);
    const fireCore = svgEl('circle', { r: 3, fill: '#ffcf8a' }); svg.appendChild(fireCore);
    const reefL = svgEl('g', {}), reefR = svgEl('g', {});
    const reefShape = '<path d="M-34 8 L-22 -6 L-12 2 L-2 -10 L10 0 L22 -4 L34 8 Z" fill="#0d0f10"/><path d="M-40 9 Q-20 2 0 9 T40 9" stroke="#dfe8ee" stroke-width="2.4" fill="none" opacity=".75"/>';
    reefL.innerHTML = reefShape; reefR.innerHTML = reefShape;
    svg.append(reefL, reefR);
    const waves = svgEl('g', { stroke: '#2e4a60', 'stroke-width': 1.4, fill: 'none', opacity: 0.8 }); svg.appendChild(waves);
    const waveLines = Array.from({ length: 7 }, () => { const p = svgEl('path', {}); waves.appendChild(p); return p; });
    const rain = svgEl('g', { stroke: '#9fb4c8', 'stroke-width': 0.8, opacity: 0.35 }); svg.appendChild(rain);
    const drops = Array.from({ length: 46 }, () => {
      const l = svgEl('line', {}); rain.appendChild(l);
      return { l, x: Math.random() * W, y: Math.random() * H, s: 260 + Math.random() * 180 };
    });
    svg.appendChild(svgEl('path', { d: `M${CX - 120} ${H} L${CX - 14} ${H - 52} L${CX} ${H - 60} L${CX + 14} ${H - 52} L${CX + 120} ${H} Z`, fill: '#1c1612', stroke: '#3a2c20', 'stroke-width': 2 }));
    svg.appendChild(svgEl('line', { x1: CX, y1: H - 60, x2: CX, y2: H, stroke: '#3a2c20', 'stroke-width': 2 }));

    const rudder = el('input', { type: 'range', min: -100, max: 100, value: 0, 'aria-label': '舵' });
    const bar = el('i');
    const fb = el('div', { class: 'feedback' });
    const mark = el('div', { class: 'game-note leading-mark' });
    const sk = skipper(host, api, 110);
    const tol = cfg.tol || 0.12, need = cfg.hold || 7000, turnK = cfg.turn || 0.6, driftK = cfg.drift || 1;
    const period = (cfg.period || 4) * 1000;
    let off = cfg.start != null ? cfg.start : 0.55, prog = 0, last = performance.now(), t0 = last, raf = 0, over = false, markIdx = 0;
    const keyh = e => {
      if (e.target && /input|textarea/i.test(e.target.tagName) && e.target !== rudder) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); rudder.value = Math.max(-100, +rudder.value - 12); }
      if (e.key === 'ArrowRight') { e.preventDefault(); rudder.value = Math.min(100, +rudder.value + 12); }
    };
    document.addEventListener('keydown', keyh);
    function frame(now) {
      if (over) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = (now - t0) / 1000;
      const drift = driftK * (0.26 * Math.sin(t * 0.52) + 0.16 * Math.sin(t * 1.31 + 1.1) + 0.08 * Math.sin(t * 3.7));
      off += ((+rudder.value / 100) * turnK + drift) * dt;
      off = Math.max(-1.3, Math.min(1.3, off));
      const rx = CX - off * 55, fx = CX - off * 175, capeX = CX - off * 40;
      cape.setAttribute('d', `M${capeX - 200} ${HZ} L${capeX - 120} ${HZ - 18} L${capeX - 40} ${HZ - 44} L${capeX + 20} ${HZ - 54} L${capeX + 90} ${HZ - 30} L${capeX + 180} ${HZ - 8} L${capeX + 240} ${HZ} Z`);
      tower.setAttribute('x', (rx - 4).toFixed(1)); tower.setAttribute('y', HZ - 96);
      const ph = (now - t0) % period;
      const flash = ph < 260 || (ph > 560 && ph < 820);
      rearGlow.setAttribute('cx', rx.toFixed(1)); rearGlow.setAttribute('cy', HZ - 100);
      rearCore.setAttribute('cx', rx.toFixed(1)); rearCore.setAttribute('cy', HZ - 100);
      rearGlow.setAttribute('opacity', flash ? 1 : 0.18); rearCore.setAttribute('opacity', flash ? 1 : 0.55);
      rock.setAttribute('d', `M${fx - 26} ${HZ + 8} L${fx - 12} ${HZ - 4} L${fx + 10} ${HZ - 6} L${fx + 28} ${HZ + 8} Z`);
      const fl = 1 + 0.18 * Math.sin(t * 17) + 0.1 * Math.sin(t * 29);
      fireGlow.setAttribute('cx', fx.toFixed(1)); fireGlow.setAttribute('cy', HZ - 12); fireGlow.setAttribute('r', (18 * fl).toFixed(1));
      fireCore.setAttribute('cx', fx.toFixed(1)); fireCore.setAttribute('cy', HZ - 12);
      const near = Math.min(1, prog / need);
      reefL.setAttribute('transform', `translate(${(60 + Math.max(0, -off) * 110 + near * 30).toFixed(1)} ${HZ + 30 + near * 40}) scale(${(1 + near * 0.8).toFixed(2)})`);
      reefR.setAttribute('transform', `translate(${(W - 60 - Math.max(0, off) * 110 - near * 30).toFixed(1)} ${HZ + 30 + near * 40}) scale(${(1 + near * 0.8).toFixed(2)})`);
      waveLines.forEach((p, i) => {
        const y = HZ + ((t * 34 + i * 19) % (H - HZ));
        const amp = 2 + (y - HZ) / 30;
        p.setAttribute('d', `M0 ${y.toFixed(1)} Q${W * 0.25} ${(y - amp).toFixed(1)} ${W / 2} ${y.toFixed(1)} T${W} ${y.toFixed(1)}`);
      });
      drops.forEach(d => {
        d.y += d.s * dt; d.x -= d.s * dt * 0.3;
        if (d.y > H) { d.y = -10; d.x = Math.random() * (W + 60); }
        d.l.setAttribute('x1', d.x.toFixed(1)); d.l.setAttribute('y1', d.y.toFixed(1));
        d.l.setAttribute('x2', (d.x + 4).toFixed(1)); d.l.setAttribute('y2', (d.y - 13).toFixed(1));
      });
      const a = Math.abs(off);
      if (a < tol) {
        prog += dt * 1000;
        fb.className = 'feedback good'; fb.textContent = cfg.holdText || 'ふたつの灯が、縦に一本に重なっている。――そのまま。';
      } else {
        prog = Math.max(0, prog - dt * 1000 * (a > 1 ? 1.2 : 0.35));
        fb.className = 'feedback' + (a > 1 ? ' bad' : '');
        const side = fx < rx ? '左' : '右';
        fb.textContent = (a > 1 ? (cfg.dangerText || '鬼の歯の牙が迫る！ ') : '') + `前の低い火が、後ろの灯より${side}にずれている。――${side}へ舵を。`;
      }
      bar.style.width = Math.min(100, prog / need * 100) + '%';
      const marks = cfg.marks || [];
      while (markIdx < marks.length && prog / need >= marks[markIdx].at) { mark.textContent = marks[markIdx].text; markIdx++; }
      if (prog >= need) {
        over = true; sk.stop(); Sound.good();
        fb.className = 'feedback good'; fb.textContent = cfg.doneText || '鬼の喉を、抜けた。';
        document.removeEventListener('keydown', keyh);
        setTimeout(() => api.done(), 900);
        return;
      }
      raf = requestAnimationFrame(frame);
    }
    host.appendChild(el('div', { class: 'game-area' },
      el('div', { class: 'game-note' }, cfg.note || '舵のつまみで船を左右に寄せ、前の低い火と後ろの高い灯を縦に重ねたまま進もう。前の火がずれた方へ舵を切るのがこつ（キーボードの ← → でも操作できます）。'),
      svg,
      el('div', { class: 'radio-meter', style: { width: 'min(440px,100%)' } }, bar),
      el('div', { class: 'leading-ctl' }, el('span', null, '取舵（左）'), rudder, el('span', null, '面舵（右）')),
      mark, fb));
    raf = requestAnimationFrame(frame);
    return () => { over = true; cancelAnimationFrame(raf); document.removeEventListener('keydown', keyh); sk.stop(); };
  };
})();

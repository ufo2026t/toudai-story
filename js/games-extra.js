/* 第二部で加わったミニゲーム：星をつなぐ・照準を合わせる・波形を合わせる */
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
  function starfield(svg, w, h, n, seed) {
    let s = seed || 7;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) {
      svg.appendChild(svgEl('circle', { cx: (rnd() * w).toFixed(1), cy: (rnd() * h).toFixed(1), r: (0.4 + rnd() * 1.1).toFixed(2), fill: '#cfd8ff', opacity: (0.25 + rnd() * 0.6).toFixed(2) }));
    }
  }

  /* ---------- 星をつなぐ：決められた線をすべて引く ---------- */
  Games.stars = function (host, cfg, api) {
    const W = cfg.w || 480, H = cfg.h || 300;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'star-sky', role: 'img', 'aria-label': '星空' });
    svg.appendChild(svgEl('rect', { width: W, height: H, fill: '#050a18', rx: 6 }));
    starfield(svg, W, H, 120, cfg.seed);
    const lines = svgEl('g', {}); svg.appendChild(lines);
    const key = (a, b) => a < b ? a + '-' + b : b + '-' + a;
    const need = new Set(cfg.edges.map(([a, b]) => key(a, b)));
    const drawn = new Set();
    let cur = -1, finished = false;
    const fb = el('div', { class: 'feedback' });
    const sk = skipper(host, api, 100);
    const nodes = cfg.stars.map((st, i) => {
      const g = svgEl('g', { class: 'star-node', tabindex: 0 });
      g.appendChild(svgEl('circle', { cx: st.x, cy: st.y, r: 16, fill: 'transparent' }));
      g.appendChild(svgEl('circle', { cx: st.x, cy: st.y, r: st.r || 3.6, fill: '#fff8dc', class: 'core' }));
      if (st.name && cfg.labels !== false) {
        const t = svgEl('text', { x: st.x + 8, y: st.y - 8, fill: '#a9b4d0', 'font-size': 11 });
        t.textContent = st.name; g.appendChild(t);
      }
      g.addEventListener('click', () => pick(i));
      svg.appendChild(g);
      return g;
    });
    function pick(i) {
      if (finished) return;
      Sound.tone(880 + i * 40, 0.08, 'sine', 0.05);
      nodes.forEach(n => n.classList.remove('sel'));
      if (cur < 0 || cur === i) { cur = i; nodes[i].classList.add('sel'); return; }
      const k = key(cur, i);
      if (need.has(k)) {
        if (!drawn.has(k)) {
          drawn.add(k);
          const a = cfg.stars[cur], b = cfg.stars[i];
          lines.appendChild(svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'star-line' }));
        }
        fb.className = 'feedback good'; fb.textContent = cfg.goodLine || '星と星が、光の糸でつながった。';
        if (drawn.size === need.size) {
          finished = true; sk.stop(); Sound.good();
          fb.textContent = cfg.doneText || '形ができた。';
          svg.classList.add('done');
          setTimeout(() => api.done(), 900);
          return;
        }
      } else {
        sk.fail(); Sound.bad();
        fb.className = 'feedback bad'; fb.textContent = cfg.badLine || 'その二つの星は、つながらない。';
      }
      cur = i; nodes[i].classList.add('sel');
    }
    host.appendChild(el('div', { class: 'game-area' },
      el('div', { class: 'game-note' }, cfg.note || '星をひとつずつクリックして、線でつなごう。'), svg, fb));
    return () => sk.stop();
  };

  /* ---------- 照準：漂う目標に十字線を重ね、しばらく保つ ---------- */
  const SHAPES = {
    pod: '<ellipse rx="16" ry="10" fill="#c9ced8" stroke="#7f8796"/><ellipse rx="7" ry="5" fill="#7fd0ff" opacity=".8"/><rect x="-22" y="-2" width="6" height="4" fill="#7f8796"/>',
    ship: '<path d="M-26 0 L-10 -9 L18 -7 L28 0 L18 7 L-10 9 Z" fill="#d8dbe2" stroke="#8a90a0"/><circle cx="12" r="3" fill="#ffd27a"/><path d="M-26 -4 L-34 0 L-26 4" fill="#ff9a5a"/>'
  };
  Games.dock = function (host, cfg, api) {
    const W = 480, H = 280;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'dock-view', role: 'img', 'aria-label': '照準画面' });
    svg.appendChild(svgEl('rect', { width: W, height: H, fill: '#040814', rx: 6 }));
    starfield(svg, W, H, 90, 31);
    const tgt = svgEl('g', {}); tgt.innerHTML = SHAPES[cfg.target || 'pod']; svg.appendChild(tgt);
    const ring = svgEl('circle', { r: cfg.radius || 26, fill: 'none', stroke: '#8fd19e', 'stroke-width': 2, 'stroke-dasharray': '4 4', opacity: 0 });
    svg.appendChild(ring);
    const cross = svgEl('g', { class: 'crosshair' });
    cross.innerHTML = '<circle r="20" fill="none" stroke="#f0c06a" stroke-width="1.5"/><path d="M-30 0 H-8 M8 0 H30 M0 -30 V-8 M0 8 V30" stroke="#f0c06a" stroke-width="1.5"/>';
    svg.appendChild(cross);
    const bar = el('i');
    const fb = el('div', { class: 'feedback' });
    const sx = el('input', { type: 'range', min: 0, max: 100, value: 15, 'aria-label': cfg.xLabel || '左右' });
    const sy = el('input', { type: 'range', min: 0, max: 100, value: 85, 'aria-label': cfg.yLabel || '上下' });
    const sk = skipper(host, api, 100);
    const t0 = performance.now();
    let hold = 0, last = t0, raf = 0, over = false;
    const R = cfg.radius || 26, need = cfg.hold || 1600, sp = cfg.speed || 1;
    function frame(now) {
      if (over) return;
      const t = (now - t0) / 1000 * sp;
      const px = W / 2 + (W * 0.32) * Math.sin(t * 0.45) + 18 * Math.sin(t * 1.7);
      const py = H / 2 + (H * 0.28) * Math.sin(t * 0.33 + 1.2) + 10 * Math.cos(t * 1.3);
      tgt.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${(Math.sin(t * 0.4) * 25).toFixed(1)})`);
      ring.setAttribute('cx', px.toFixed(1)); ring.setAttribute('cy', py.toFixed(1));
      const cx = 30 + (W - 60) * sx.value / 100, cy = 20 + (H - 40) * (100 - sy.value) / 100;
      cross.setAttribute('transform', `translate(${cx.toFixed(1)} ${cy.toFixed(1)})`);
      const dt = now - last; last = now;
      const inside = Math.hypot(px - cx, py - cy) < R;
      ring.setAttribute('opacity', inside ? 1 : 0);
      hold = inside ? hold + dt : Math.max(0, hold - dt * 1.5);
      bar.style.width = Math.min(100, hold / need * 100) + '%';
      fb.className = 'feedback ' + (inside ? 'good' : '');
      fb.textContent = inside ? (cfg.holdText || '捕捉中……そのまま保て') : (hold > 0 ? (cfg.lostText || '外れた！') : '');
      if (hold >= need) {
        over = true; sk.stop(); Sound.good();
        fb.textContent = cfg.doneText || '捕捉した。';
        setTimeout(() => api.done(), 700);
        return;
      }
      raf = requestAnimationFrame(frame);
    }
    host.appendChild(el('div', { class: 'game-area' },
      el('div', { class: 'game-note' }, cfg.note || '二本のつまみで十字線を動かし、目標に重ねたまま保とう。'),
      svg,
      el('div', { class: 'radio-meter', style: { width: 'min(440px,100%)' } }, bar),
      el('div', { class: 'dock-ctl' }, el('label', null, cfg.xLabel || '左右', sx), el('label', null, cfg.yLabel || '上下', sy)),
      fb));
    raf = requestAnimationFrame(frame);
    return () => { over = true; cancelAnimationFrame(raf); sk.stop(); };
  };

  /* ---------- 波形合わせ：周波数と振幅を目標の波に重ねる ---------- */
  Games.wave = function (host, cfg, api) {
    const W = 440, H = 150, MID = H / 2;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'wave-view', role: 'img', 'aria-label': '波形' });
    svg.appendChild(svgEl('rect', { width: W, height: H, fill: '#06110c', rx: 6 }));
    for (let x = 0; x <= W; x += 44) svg.appendChild(svgEl('line', { x1: x, y1: 0, x2: x, y2: H, stroke: '#123222' }));
    svg.appendChild(svgEl('line', { x1: 0, y1: MID, x2: W, y2: MID, stroke: '#1d4a33' }));
    const target = svgEl('path', { fill: 'none', stroke: '#f0c06a', 'stroke-width': 2, 'stroke-dasharray': '6 5' });
    const live = svgEl('path', { fill: 'none', stroke: '#7ff0a8', 'stroke-width': 2.5 });
    svg.append(target, live);
    const path = (f, a, ph) => {
      let d = '';
      for (let x = 0; x <= W; x += 4) d += (x ? 'L' : 'M') + x + ' ' + (MID - a * 0.6 * Math.sin(2 * Math.PI * f * x / W + ph)).toFixed(1);
      return d;
    };
    target.setAttribute('d', path(cfg.f, cfg.a, 0));
    const fMin = cfg.fMin || 1, fMax = cfg.fMax || 12;
    const sf = el('input', { type: 'range', min: fMin * 10, max: fMax * 10, value: (cfg.fStart || fMin) * 10, 'aria-label': cfg.fLabel || '周波数' });
    const sa = el('input', { type: 'range', min: 5, max: 100, value: cfg.aStart || 20, 'aria-label': cfg.aLabel || '振幅' });
    const meter = el('div', { class: 'game-note' });
    const fb = el('div', { class: 'feedback' });
    const sk = skipper(host, api, 100);
    let raf = 0, over = false;
    const match = () => {
      const df = Math.abs(sf.value / 10 - cfg.f) / (fMax - fMin), da = Math.abs(sa.value - cfg.a) / 95;
      return Math.max(0, 1 - (df * 4 + da * 2.5));
    };
    function frame() {
      if (over) return;
      live.setAttribute('d', path(sf.value / 10, +sa.value, 0));
      const m = match();
      meter.textContent = (cfg.meterLabel || '一致率') + '　' + Math.round(m * 100) + '%';
      raf = requestAnimationFrame(frame);
    }
    const go = el('button', { class: 'btn', type: 'button' }, cfg.button || '合わせる');
    go.addEventListener('click', () => {
      if (match() >= (cfg.need || 0.9)) {
        over = true; sk.stop(); Sound.good(); go.disabled = true; sf.disabled = true; sa.disabled = true;
        live.setAttribute('d', path(cfg.f, cfg.a, 0));
        fb.className = 'feedback good'; fb.textContent = cfg.doneText || '波が重なった。';
        setTimeout(() => api.done(), 900);
      } else {
        sk.fail(); Sound.bad();
        fb.className = 'feedback bad'; fb.textContent = cfg.badText || 'まだずれている。点線の波と、山の数と高さを合わせよう。';
      }
    });
    host.appendChild(el('div', { class: 'game-area' },
      el('div', { class: 'game-note' }, cfg.note || 'つまみを動かして、緑の波を点線の波に重ねよう。'), svg, meter,
      el('div', { class: 'dock-ctl' }, el('label', null, cfg.fLabel || '周波数', sf), el('label', null, cfg.aLabel || '振幅', sa)),
      go, fb));
    raf = requestAnimationFrame(frame);
    return () => { over = true; cancelAnimationFrame(raf); sk.stop(); };
  };
})();

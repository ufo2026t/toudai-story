/* ミニゲーム群。各ゲームは Games[kind](host, cfg, api) で起動し、
   クリアしたら api.done() を呼ぶ。戻り値は後片付け用の関数（任意）。 */
(function () {
  'use strict';
  const { el } = U;
  const Games = window.Games = {};

  /* 何度か失敗したら「先へ進む」を出す（行き詰まり防止） */
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
    return {
      fail() { if (++fails >= 4) show(); },
      stop() { clearTimeout(timer); box.remove(); }
    };
  }

  /* ---------- 配線パズル：タイルを回して電気を通す ---------- */
  const PIPE = { '─': 10, '│': 5, '└': 3, '┌': 6, '┐': 12, '┘': 9, '├': 7, '┤': 13, '┬': 14, '┴': 11, '┼': 15 };
  const rotm = m => ((m << 1) | (m >> 3)) & 15;
  const DIRS = [[1, -1, 0, 4], [2, 0, 1, 8], [4, 1, 0, 1], [8, 0, -1, 2]];
  Games.pipes = function (host, cfg, api) {
    const rows = cfg.layout.map(r => Array.from(r));
    const R = rows.length, C = rows[0].length;
    const cells = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const base = PIPE[rows[r][c]] || 0;
      cells.push({ base, k: base ? Math.floor(Math.random() * 4) : 0 });
    }
    const mask = cell => { let m = cell.base; for (let i = 0; i < cell.k % 4; i++) m = rotm(m); return m; };
    const [sr, sc] = cfg.src, [dr, dc] = cfg.dst;
    const litSet = () => {
      const seen = new Set(), q = [];
      if (mask(cells[sr * C + sc]) & 8) { seen.add(sr * C + sc); q.push([sr, sc]); }
      while (q.length) {
        const [r, c] = q.shift(), m = mask(cells[r * C + c]);
        for (const [bit, rr, cc, opp] of DIRS) {
          const nr = r + rr, nc = c + cc;
          if (!(m & bit) || nr < 0 || nc < 0 || nr >= R || nc >= C) continue;
          const id = nr * C + nc;
          if (seen.has(id) || !(mask(cells[id]) & opp)) continue;
          seen.add(id); q.push([nr, nc]);
        }
      }
      return seen;
    };
    const solved = s => s.has(dr * C + dc) && (mask(cells[dr * C + dc]) & 2);
    let guard = 0;
    while (solved(litSet()) && guard++ < 50) cells[sr * C + sc].k++;

    const grid = el('div', { class: 'pipes', style: { gridTemplateColumns: `28px repeat(${C}, auto) 28px` } });
    const btns = [];
    const svgFor = base => {
      let p = '';
      if (base & 1) p += 'M30 30V0'; if (base & 2) p += 'M30 30H60';
      if (base & 4) p += 'M30 30V60'; if (base & 8) p += 'M30 30H0';
      return `<svg viewBox="0 0 60 60"><path class="w" d="${p}"/><circle cx="30" cy="30" r="5" fill="#2a3a50"/></svg>`;
    };
    for (let r = 0; r < R; r++) {
      grid.appendChild(el('div', { class: 'game-note', style: { alignSelf: 'center' } }, r === sr ? '⚡' : ''));
      for (let c = 0; c < C; c++) {
        const i = r * C + c, cell = cells[i];
        const b = el('button', { class: 'pipe' + (cell.base ? '' : ' fixed'), type: 'button', 'aria-label': 'タイル', html: cell.base ? svgFor(cell.base) : '' });
        if (cell.base) b.addEventListener('click', () => { if (finished) return; cell.k++; Sound.click(); update(); });
        btns.push(b); grid.appendChild(b);
      }
      grid.appendChild(el('div', { class: 'game-note', style: { alignSelf: 'center' } }, r === dr ? '💡' : ''));
    }
    let finished = false;
    function update() {
      const s = litSet();
      cells.forEach((cell, i) => {
        const svg = btns[i].firstChild;
        if (svg) svg.style.transform = `rotate(${cell.k * 90}deg)`;
        btns[i].classList.toggle('lit', s.has(i));
      });
      if (solved(s)) { finished = true; sk.stop(); Sound.good(); setTimeout(() => api.done(), 700); }
    }
    host.appendChild(el('div', { class: 'game-area' },
      el('div', { class: 'game-note' }, cfg.note || 'タイルをクリックすると回転します。⚡から💡まで線をつなげてください。'), grid));
    const sk = skipper(host, api, 120);
    update();
    return () => sk.stop();
  };

  /* ---------- ピント合わせ：写真機 ---------- */
  Games.focus = function (host, cfg, api) {
    const target = cfg.target != null ? cfg.target : 63, tol = cfg.tol || 4;
    const frame = el('div', { class: 'focus-frame', html: cfg.svg }, cfg.reticle === false ? null : el('div', { class: 'reticle' }));
    const svg = frame.querySelector('svg');
    const range = el('input', { type: 'range', min: 0, max: 100, value: cfg.start || 8, 'aria-label': cfg.ringLabel || 'ピントリング' });
    const fb = el('div', { class: 'feedback' });
    const blur = () => { svg.style.filter = `blur(${(Math.abs(range.value - target) * 0.22).toFixed(2)}px)`; };
    range.addEventListener('input', blur);
    const sk = skipper(host, api, 90);
    const shot = el('button', { class: 'btn', type: 'button' }, cfg.button || 'シャッターを切る');
    shot.addEventListener('click', () => {
      if (Math.abs(range.value - target) <= tol) {
        if (cfg.flash !== false) frame.classList.add('flash');
        Sound.tone(1200, 0.05, 'square', 0.05);
        range.disabled = true; shot.disabled = true; sk.stop();
        fb.className = 'feedback good'; fb.textContent = cfg.okText || 'カシャッ。――写った。';
        setTimeout(() => api.done(), 900);
      } else {
        Sound.bad(); sk.fail();
        fb.className = 'feedback bad'; fb.textContent = cfg.badText || 'まだぼやけている。ピントリングを回して、文字がくっきり読めるところを探そう。';
      }
    });
    host.appendChild(el('div', { class: 'game-area' }, frame,
      el('div', { class: 'game-note' }, cfg.note || 'ピントリング（つまみ）を動かして'), range, shot, fb));
    blur();
    return () => sk.stop();
  };

  /* ---------- ラジオ選局：周波数を合わせて声を拾う ---------- */
  Games.radio = function (host, cfg, api) {
    const min = cfg.min, max = cfg.max, target = cfg.target, width = cfg.width || 40;
    const scale = el('div', { class: 'radio-scale' }, el('div', { class: 'ticks' }));
    for (let i = 0; i <= 4; i++) {
      const f = Math.round(min + (max - min) * i / 4);
      const edge = i === 0 ? { left: '4px', transform: 'none' } : i === 4 ? { left: 'auto', right: '4px', transform: 'none' } : { left: (i * 25) + '%' };
      scale.appendChild(el('span', { class: 'lbl', style: edge }, String(f)));
    }
    const needle = el('div', { class: 'needle' }); scale.appendChild(needle);
    const meter = el('i'); const out = el('div', { class: 'radio-out' }, '……ザーーー……');
    const range = el('input', { type: 'range', min, max, value: cfg.start || min, step: 1, 'aria-label': '選局ダイヤル' });
    const sk = skipper(host, api, 100);
    const junk = '・ーｻﾞｻﾞ…＃ｼ ｶﾞｰ';
    let locked = false, hold = 0, timer = null;
    const garble = (s, k) => Array.from(s).map(ch => Math.random() < k * k ? ch : junk[Math.floor(Math.random() * junk.length)]).join('');
    const strength = () => Math.max(0, 1 - Math.abs(range.value - target) / width);
    function tick() {
      if (locked) return;
      const s = strength();
      needle.style.left = ((range.value - min) / (max - min) * 100) + '%';
      meter.style.width = (s * 100) + '%';
      Sound.noise(1 - s * 0.85);
      out.textContent = s < 0.15 ? '……ザーーー……' : garble(cfg.lines[0], s);
      if (s > 0.9) { if (++hold > 6) lock(); } else hold = 0;
    }
    async function lock() {
      locked = true; range.disabled = true; sk.stop();
      Sound.noise(0.12); out.textContent = '';
      for (const line of cfg.lines) {
        for (const ch of Array.from(line)) { out.textContent += ch; await U.sleep(38); }
        out.textContent += '\n'; await U.sleep(500);
      }
      Sound.stopNoise();
      api.done();
    }
    range.addEventListener('input', tick);
    timer = setInterval(tick, 140);
    host.appendChild(el('div', { class: 'game-area' },
      el('div', { class: 'radio-box' }, scale, el('div', { class: 'radio-meter' }, meter), out),
      el('div', { class: 'game-note' }, cfg.note || 'ダイヤルを回して、雑音の奥の声を探してください。'), range));
    tick();
    return () => { clearInterval(timer); Sound.stopNoise(); sk.stop(); };
  };

  /* ---------- 神経衰弱 ---------- */
  Games.memory = function (host, cfg, api) {
    const deck = U.shuffle(cfg.symbols.concat(cfg.symbols));
    const grid = el('div', { class: 'memory' });
    let open = [], pairs = 0, busy = false, turns = 0;
    const info = el('div', { class: 'game-note' }, 'めくった回数：0');
    deck.forEach(sym => {
      const card = el('button', { class: 'mcard', type: 'button', 'aria-label': 'カード' }, sym);
      card.addEventListener('click', () => {
        if (busy || card.classList.contains('open') || card.classList.contains('done')) return;
        card.classList.add('open'); Sound.click(); open.push(card);
        if (open.length < 2) return;
        turns++; info.textContent = 'めくった回数：' + turns;
        const [a, b] = open;
        if (a.textContent === b.textContent) {
          a.classList.add('done'); b.classList.add('done'); open = []; pairs++; Sound.good();
          if (pairs === cfg.symbols.length) setTimeout(() => api.done(), 600);
        } else {
          busy = true;
          setTimeout(() => { a.classList.remove('open'); b.classList.remove('open'); open = []; busy = false; }, 800);
        }
      });
      grid.appendChild(card);
    });
    host.appendChild(el('div', { class: 'game-area' }, grid, info));
  };

  /* ---------- モールス信号を送る ---------- */
  const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..' };
  const pretty = c => c.replace(/\./g, '・').replace(/-/g, '－');
  Games.morse = function (host, cfg, api) {
    const word = cfg.word.toUpperCase();
    let idx = 0, cur = '', busy = false;
    const lamp = el('div', { class: 'morse-lamp' });
    const code = el('div', { class: 'morse-code' });
    const fb = el('div', { class: 'feedback' });
    const table = el('div', { class: 'morse-table' });
    const draw = () => {
      table.innerHTML = '';
      Array.from(word).forEach((ch, i) => {
        table.appendChild(el('span', { style: { opacity: i < idx ? .4 : 1, textDecoration: i === idx ? 'underline' : 'none' } },
          el('b', null, ch), ' ', pretty(MORSE[ch])));
      });
      code.textContent = pretty(cur) || '　';
    };
    const sk = skipper(host, api, 120);
    const flash = ms => new Promise(res => {
      lamp.classList.add('on'); Sound.tone(700, ms / 1000, 'sine', 0.06);
      setTimeout(() => { lamp.classList.remove('on'); setTimeout(res, 110); }, ms);
    });
    async function press(sym) {
      if (busy || idx >= word.length) return;
      busy = true;
      cur += sym; draw();
      await flash(sym === '.' ? 140 : 420);
      const exp = MORSE[word[idx]];
      if (cur === exp) {
        idx++; cur = ''; fb.className = 'feedback good'; fb.textContent = '「' + word[idx - 1] + '」を送った。';
        draw();
        if (idx >= word.length) {
          sk.stop(); fb.textContent = '送信完了。沖の闇を見つめる――';
          await U.sleep(900);
          for (const ch of (cfg.reply || '')) {
            for (const s of MORSE[ch]) await flash(s === '.' ? 140 : 420);
            await U.sleep(300);
          }
          fb.textContent = cfg.replyText || '応答があった。';
          await U.sleep(700);
          api.done(); return;
        }
      } else if (!exp.startsWith(cur)) {
        Sound.bad(); sk.fail(); cur = ''; draw();
        fb.className = 'feedback bad'; fb.textContent = '符号が違う。この文字をもう一度、はじめから。';
      }
      busy = false;
    }
    const keyh = e => {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      if (e.key === '.' || e.key === 'j') { e.preventDefault(); press('.'); }
      if (e.key === '-' || e.key === 'k') { e.preventDefault(); press('-'); }
    };
    document.addEventListener('keydown', keyh);
    host.appendChild(el('div', { class: 'game-area' }, lamp, table, code,
      el('div', { class: 'row' },
        el('button', { class: 'btn', type: 'button', onclick: () => press('.') }, '・ 短く光らせる'),
        el('button', { class: 'btn', type: 'button', onclick: () => press('-') }, '－ 長く光らせる')),
      el('div', { class: 'game-note' }, 'キーボードの「.」「-」でも送れます。'), fb));
    draw();
    return () => { document.removeEventListener('keydown', keyh); sk.stop(); };
  };

  /* ---------- 拓本：こすって刻まれた文字を浮かび上がらせる ---------- */
  Games.scratch = function (host, cfg, api) {
    const wrap = el('div', { class: 'scratch-wrap' },
      el('div', { class: 'under', html: U.fmt(cfg.text) }), el('canvas'));
    const cv = wrap.querySelector('canvas');
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    let drawing = false, last = null, done = false, timer = null;
    host.appendChild(el('div', { class: 'game-area' }, wrap,
      el('div', { class: 'game-note' }, cfg.note || '紙の上をなぞる（ドラッグする）と、墨がのって文字が浮かびます。')));
    const sk = skipper(host, api, 90);
    requestAnimationFrame(() => {
      const r = wrap.getBoundingClientRect(), d = window.devicePixelRatio || 1;
      cv.width = Math.max(1, r.width * d); cv.height = Math.max(1, r.height * d);
      ctx.scale(d, d);
      ctx.fillStyle = '#ebe5d6'; ctx.fillRect(0, 0, r.width, r.height);
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = `rgba(120,110,90,${Math.random() * 0.12})`;
        ctx.fillRect(Math.random() * r.width, Math.random() * r.height, 1.5, 1.5);
      }
      ctx.fillStyle = 'rgba(90,80,60,.35)'; ctx.font = '14px ' + getComputedStyle(document.body).fontFamily;
      ctx.fillText('（和紙）', 12, 22);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 34;
    });
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', e => {
      drawing = true; last = pos(e);
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* キャプチャ不可でも描画は続ける */ }
      rub(e);
    });
    cv.addEventListener('pointermove', e => { if (drawing) rub(e); });
    cv.addEventListener('pointerup', () => { drawing = false; last = null; });
    function rub(e) {
      const p = pos(e);
      ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
      last = p;
    }
    timer = setInterval(() => {
      if (done || !cv.width) return;
      const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let clear = 0, n = 0;
      for (let i = 3; i < data.length; i += 4 * 16) { n++; if (data[i] < 40) clear++; }
      if (clear / n > (cfg.threshold || 0.6)) {
        done = true; clearInterval(timer); sk.stop();
        cv.style.transition = 'opacity 1.2s'; cv.style.opacity = 0; Sound.good();
        setTimeout(() => api.done(), 1300);
      }
    }, 400);
    return () => { clearInterval(timer); sk.stop(); };
  };

  /* ---------- ダイヤル錠 ---------- */
  Games.lock = function (host, cfg, api) {
    const n = cfg.code.length, vals = Array(n).fill(0);
    const nums = [];
    const lock = el('div', { class: 'lock' });
    for (let i = 0; i < n; i++) {
      const num = el('div', { class: 'num' }, '0'); nums.push(num);
      const turn = d => { vals[i] = (vals[i] + d + 10) % 10; num.textContent = vals[i]; Sound.click(); };
      lock.appendChild(el('div', { class: 'dial' },
        el('button', { type: 'button', 'aria-label': '上げる', onclick: () => turn(1) }, '▲'), num,
        el('button', { type: 'button', 'aria-label': '下げる', onclick: () => turn(-1) }, '▼')));
    }
    const fb = el('div', { class: 'feedback' });
    const open = el('button', { class: 'btn', type: 'button' }, cfg.button || '開ける');
    open.addEventListener('click', () => {
      if (vals.join('') === cfg.code) {
        Sound.tone(300, 0.08, 'square', 0.06); Sound.good();
        open.disabled = true; fb.className = 'feedback good'; fb.textContent = 'カチリ、と錠が外れた。';
        setTimeout(() => api.done(), 800);
      } else {
        Sound.bad(); fb.className = 'feedback bad'; fb.textContent = cfg.wrong || '開かない。';
        lock.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 240 });
      }
    });
    host.appendChild(el('div', { class: 'game-area' }, lock, open, fb));
  };

  /* ---------- タイミング：目盛りが緑の範囲に来たら押す ---------- */
  Games.timing = function (host, cfg, api) {
    const rounds = cfg.rounds || 5;
    let hits = 0, speed = cfg.speed || 0.55, zoneW = cfg.zone || 0.2, zoneX = 0, t0 = performance.now(), raf = 0, over = false;
    const bar = el('div', { class: 'timing' }), zone = el('div', { class: 'zone' }), cur = el('div', { class: 'cursor' });
    bar.append(zone, cur);
    const pips = el('div', { class: 'pips' }); for (let i = 0; i < rounds; i++) pips.appendChild(el('i'));
    const fb = el('div', { class: 'feedback' });
    const placeZone = () => {
      zoneX = 0.05 + Math.random() * (0.9 - zoneW);
      zone.style.left = (zoneX * 100) + '%'; zone.style.width = (zoneW * 100) + '%';
    };
    const pos = () => { const t = ((performance.now() - t0) / 1000) * speed % 2; return t < 1 ? t : 2 - t; };
    const loop = () => { cur.style.left = (pos() * 100) + '%'; if (!over) raf = requestAnimationFrame(loop); };
    const sk = skipper(host, api, 100);
    const act = () => {
      if (over) return;
      const p = pos();
      if (p >= zoneX && p <= zoneX + zoneW) {
        pips.children[hits].classList.add('on'); hits++;
        Sound.tone(300 + hits * 80, 0.15, 'triangle', 0.07);
        fb.className = 'feedback good'; fb.textContent = (cfg.goodTexts && cfg.goodTexts[hits - 1]) || 'よし。';
        if (hits >= rounds) { over = true; sk.stop(); cancelAnimationFrame(raf); setTimeout(() => api.done(), 700); return; }
        speed *= cfg.accel || 1.12; zoneW = Math.max(0.1, zoneW * 0.92); placeZone();
      } else {
        Sound.bad(); sk.fail();
        fb.className = 'feedback bad'; fb.textContent = cfg.missText || '空回りした。もう一度。';
      }
    };
    const keyh = e => { if (e.code === 'Space' && !/input|textarea|button/i.test(e.target.tagName)) { e.preventDefault(); act(); } };
    document.addEventListener('keydown', keyh);
    host.appendChild(el('div', { class: 'game-area' }, bar, pips,
      el('button', { class: 'btn', type: 'button', onclick: act }, cfg.button || '今だ'),
      el('div', { class: 'game-note' }, cfg.note || '光る目盛りが緑の範囲に入った瞬間に押してください（スペースキーでも可）。'), fb));
    placeZone(); loop();
    return () => { over = true; cancelAnimationFrame(raf); document.removeEventListener('keydown', keyh); sk.stop(); };
  };

  /* ---------- 並べ替え ---------- */
  Games.order = function (host, cfg, api) {
    const correct = cfg.items.slice();
    let cur = U.shuffle(correct);
    while (cur.join('|') === correct.join('|')) cur = U.shuffle(correct);
    let sel = -1, tries = 0, finished = false;
    const list = el('ol', { class: 'order' });
    const fb = el('div', { class: 'feedback' });
    const swap = (a, b) => { if (b < 0 || b >= cur.length) return; [cur[a], cur[b]] = [cur[b], cur[a]]; Sound.click(); draw(); };
    function draw() {
      list.innerHTML = '';
      cur.forEach((txt, i) => {
        const li = el('li', { class: (cfg.paper ? 'paper' : '') + (i === sel ? ' sel' : '') },
          el('span', { class: 'idx' }, String(i + 1)),
          el('span', { class: 'txt', html: U.fmt(txt) }),
          el('button', { type: 'button', 'aria-label': '上へ', onclick: e => { e.stopPropagation(); if (!finished) swap(i, i - 1); } }, '▲'),
          el('button', { type: 'button', 'aria-label': '下へ', onclick: e => { e.stopPropagation(); if (!finished) swap(i, i + 1); } }, '▼'));
        li.addEventListener('click', () => {
          if (finished) return;
          if (sel < 0) { sel = i; draw(); } else { const a = sel; sel = -1; if (a !== i) swap(a, i); else draw(); }
        });
        list.appendChild(li);
      });
    }
    const check = el('button', { class: 'btn', type: 'button' }, cfg.button || '確かめる');
    check.addEventListener('click', () => {
      const ok = cur.filter((x, i) => x === correct[i]).length;
      if (ok === correct.length) {
        finished = true; check.disabled = true; Sound.good();
        fb.className = 'feedback good'; fb.textContent = cfg.goodText || '正しい順番になった。';
        setTimeout(() => api.done(), 800);
      } else {
        tries++; Sound.bad();
        fb.className = 'feedback bad';
        fb.textContent = `正しい位置にあるのは ${ok} / ${correct.length}。` + (tries >= 3 && cfg.assist ? '（ヒント：先頭は「' + correct[0].slice(0, 12) + '…」）' : '');
      }
    });
    host.appendChild(el('div', { class: 'game-area' },
      el('div', { class: 'game-note' }, cfg.note || '項目をクリックして二つを入れ替えるか、▲▼で動かしてください。'), list, check, fb));
    draw();
  };

  /* ---------- 探し物：絵の中から見つける ---------- */
  Games.seek = function (host, cfg, api) {
    const box = el('div', { class: 'seek', html: cfg.svg });
    const svg = box.querySelector('svg');
    const found = new Set();
    const info = el('div', { class: 'game-note' }, `見つけた数：0 / ${cfg.spots.length}`);
    const fb = el('div', { class: 'feedback' });
    const sk = skipper(host, api, 120);
    svg.addEventListener('click', e => {
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      const hit = cfg.spots.findIndex((s, i) => !found.has(i) && Math.hypot(s.x - p.x, s.y - p.y) <= (s.r || 16));
      if (hit < 0) { sk.fail(); fb.className = 'feedback bad'; fb.textContent = cfg.missText || 'そこには何もない。'; return; }
      found.add(hit); Sound.good();
      const s = cfg.spots[hit];
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', s.x); ring.setAttribute('cy', s.y); ring.setAttribute('r', (s.r || 16) + 2); ring.setAttribute('class', 'found-ring');
      svg.appendChild(ring);
      info.textContent = `見つけた数：${found.size} / ${cfg.spots.length}`;
      fb.className = 'feedback good'; fb.textContent = (cfg.foundTexts && cfg.foundTexts[found.size - 1]) || 'あった！';
      if (found.size === cfg.spots.length) { sk.stop(); setTimeout(() => api.done(), 800); }
    });
    host.appendChild(el('div', { class: 'game-area' }, box, info, fb));
    return () => sk.stop();
  };

  /* ---------- 暗号解読（灯台暗号：二桁の数字で一文字） ---------- */
  const KANA = ['アイウエオ', 'カキクケコ', 'サシスセソ', 'タチツテト', 'ナニヌネノ', 'ハヒフヘホ', 'マミムメモ', 'ヤ・ユ・ヨ', 'ラリルレロ'];
  Games.kanaTable = function () {
    const t = el('table', { class: 'kana-grid' });
    const head = el('tr', null, el('th', null, ''));
    KANA.forEach((_, i) => head.appendChild(el('th', null, String(i + 1))));
    t.appendChild(head);
    for (let d = 0; d < 5; d++) {
      const tr = el('tr', null, el('th', null, String(d + 1)));
      KANA.forEach(row => tr.appendChild(el('td', null, row[d] === '・' ? '' : row[d])));
      t.appendChild(tr);
    }
    return t;
  };
  const IROHA = 'いろはにほへとちりぬるをわかよたれそつねならむうゐのおくやまけふこえてあさきゆめみしゑひもせすん';
  Games.irohaTable = function () {
    const t = el('table', { class: 'kana-grid iroha' });
    const chars = Array.from(IROHA);
    for (let r = 0; r < chars.length; r += 12) {
      const nums = el('tr'), kana = el('tr');
      chars.slice(r, r + 12).forEach((ch, i) => {
        nums.appendChild(el('th', null, String(r + i + 1)));
        kana.appendChild(el('td', null, ch));
      });
      t.append(nums, kana);
    }
    return t;
  };
  Games.cipher = function (host, cfg, api) {
    const fb = el('div', { class: 'feedback' });
    const input = el('input', { class: 'cipher-in', type: 'text', placeholder: 'ひらがな・カタカナで入力', 'aria-label': '解読した文' });
    const tableBox = el('div', { class: 'hidden' });
    const has = !cfg.tableClue || State.hasClue(cfg.tableClue);
    const tbtn = el('button', { class: 'btn ghost small', type: 'button' }, has ? (cfg.tableLabel || '灯台暗号の表を見る') : '暗号表を持っていない…');
    tbtn.addEventListener('click', () => {
      if (!has) { fb.className = 'feedback bad'; fb.textContent = cfg.noTable || 'この暗号の読み方は、誰かの章に書かれていたはずだ。'; return; }
      tableBox.classList.toggle('hidden');
    });
    if (cfg.table === 'iroha') tableBox.append(el('div', { class: 'game-note' }, cfg.tableNote || 'いろは歌の順番（数字は何番目か）'), Games.irohaTable());
    else tableBox.append(el('div', { class: 'game-note' }, '横の数字＝行（ア行・カ行…）、縦の数字＝段（ア段・イ段…）'), Games.kanaTable());
    const go = () => {
      const v = U.normKana(input.value);
      if (cfg.answers.some(a => U.normKana(a) === v)) {
        Sound.reveal(); input.disabled = true; btn.disabled = true;
        fb.className = 'feedback good'; fb.textContent = cfg.goodText || '読めた。';
        setTimeout(() => api.done(), 900);
      } else {
        Sound.bad(); fb.className = 'feedback bad';
        fb.textContent = v ? 'その読み方では意味が通らないようだ。数字をひとつずつ表と照らし合わせよう。' : '解読した文を入力してください。';
      }
    };
    const btn = el('button', { class: 'btn', type: 'button', onclick: go }, '解読する');
    input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    host.appendChild(el('div', { class: 'game-area' },
      el('div', { class: 'morse-code', style: { fontSize: '20px', textAlign: 'center' } }, cfg.code),
      tbtn, tableBox, input, btn, fb));
  };
})();

/* 灯の還る夜 ― 画面と読書エンジン */
(function () {
  'use strict';
  const { el, fmt } = U;
  const app = document.getElementById('app');
  const CH = id => STORY.charMap[id];
  let cleanups = [];
  let viewToken = 0;

  function clearApp() {
    cleanups.forEach(f => { try { f(); } catch (e) { /* 片付け失敗は無視 */ } });
    cleanups = [];
    Sound.stopNoise();
    viewToken++;
    app.innerHTML = '';
    window.scrollTo(0, 0);
  }

  /* ---------- 手がかりの索引（作品ごと） ---------- */
  let CLUES = {};
  function buildIndex() {
    CLUES = {};
    Object.values(STORY.chapters).forEach(ch => indexBlocks(ch.blocks, ch.stage, ch.who));
    Object.values(STORY.interludes).forEach(it => indexBlocks(it.blocks, it.stage, null));
  }
  function indexBlocks(blocks, stage, who) {
    for (const b of blocks || []) {
      if (!b || typeof b !== 'object') continue;
      if (b.t === 'clue') CLUES[b.id] = { text: b.note || b.text, stage, who };
      ['success', 'then', 'else'].forEach(k => b[k] && indexBlocks(b[k], stage, who));
      if (b.options) b.options.forEach(o => o.reply && indexBlocks(o.reply, stage, who));
    }
  }
  function updateBadge() {
    const n = State.d ? State.d.clues.filter(id => CLUES[id]).length : 0;
    document.getElementById('note-count').textContent = n ? String(n) : '';
  }

  function crest(c, big, forceTrue) {
    const t = forceTrue || State.isRevealed(c.id);
    return el('div', { class: 'crest' + (big ? ' big' : '') + (t ? ' true' : ''), style: '--c:' + c.color, 'aria-hidden': 'true' }, t ? c.trueCrest : c.crest);
  }

  /* ---------- オーバーレイ ---------- */
  const ov = document.getElementById('overlay'), ovBody = document.getElementById('overlay-body');
  let ovResolve = null;
  function openOverlay(node) {
    ovBody.innerHTML = '';
    ovBody.appendChild(node);
    ov.classList.remove('hidden');
    ov.querySelector('.sheet').scrollTop = 0;
    return new Promise(res => { ovResolve = res; });
  }
  function closeOverlay() {
    ov.classList.add('hidden');
    ovBody.innerHTML = '';
    if (ovResolve) { const r = ovResolve; ovResolve = null; r(); }
  }
  document.getElementById('overlay-close').addEventListener('click', closeOverlay);
  ov.addEventListener('click', e => { if (e.target === ov) closeOverlay(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !ov.classList.contains('hidden')) closeOverlay(); });

  /* ---------- ブロック描画 ---------- */
  function put(host, node, ctx) {
    host.appendChild(node);
    if (ctx.live) node.classList.add('appear');
    if (ctx.gentle && !ctx.fast) node.classList.add('slow');
    if (ctx.scrollNext) {
      ctx.scrollNext = false;
      setTimeout(() => node.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    }
    return node;
  }
  function para(s, cls) {
    const dlg = /^[「『（]/.test(s);
    return el('p', { class: cls || (dlg ? 'dlg' : null), html: fmt(s) });
  }
  function gateBox(label, prompt, ctx, id) {
    return el('div', { class: 'gate', style: '--c:' + ctx.color, 'data-id': id || null },
      el('div', { class: 'gate-label' }, label),
      prompt ? el('div', { class: 'prompt', html: fmt(prompt) }) : null);
  }
  function hintsUI(box, hints) {
    if (!hints || !hints.length) return { auto() {} };
    let i = 0;
    const area = el('div');
    const btn = el('button', { class: 'btn ghost small', type: 'button' }, 'ヒントを見る');
    const show = () => {
      if (i >= hints.length) return;
      area.appendChild(el('div', { class: 'hint', html: fmt(hints[i++]) }));
      if (i >= hints.length) btn.remove();
    };
    btn.addEventListener('click', show);
    box.append(el('div', { style: 'margin-top:10px' }, btn), area);
    return { auto: show };
  }

  const TEXT_BLOCKS = ['line', 'h', 'scene', 'diary', 'doc', 'letter', 'clue'];
  function textLength(b) {
    if (typeof b === 'string') return b.length;
    if (b.lines) return b.lines.join('').length;
    return String(b.text || '').length;
  }
  async function renderBlocks(blocks, host, ctx) {
    for (const b of blocks || []) {
      if (ctx.token !== viewToken) return;
      await renderBlock(b, host, ctx);
      if (ctx.gentle && !ctx.fast && (typeof b === 'string' || TEXT_BLOCKS.includes(b.t))) {
        await U.sleep(Math.min(1600, 300 + textLength(b) * 14));
      }
    }
  }

  /* 章ごとの描画状態。「ひと段落ずつ」なら初読時に文章を少しずつ浮かべる */
  function makeCtx(color, reread, page) {
    const ctx = { color, live: false, scrollNext: false, reread, token: viewToken, gentle: false, fast: false };
    if (State.settings.pace === 'gentle' && !reread) {
      ctx.gentle = true; ctx.live = true;
      page.appendChild(el('div', { class: 'pace-note' }, '文章がひと段落ずつ現れます。画面をクリックすると、残りをすぐに表示します。'));
      page.addEventListener('click', e => { if (!e.target.closest('button, input, a, .gate')) ctx.fast = true; });
    }
    return ctx;
  }

  async function renderBlock(b, host, ctx) {
    if (typeof b === 'string') { put(host, para(b), ctx); return; }
    switch (b.t) {
      case 'line': put(host, para(b.text, 'line'), ctx); break;
      case 'sep': put(host, el('div', { class: 'sep' }, '＊＊＊'), ctx); break;
      case 'h': put(host, el('h3', { html: fmt(b.text) }), ctx); break;
      case 'scene': put(host, el('div', { class: 'scene-title', html: fmt(b.text) }), ctx); break;
      case 'diary':
        put(host, el('div', { class: 'diary' },
          b.date ? el('div', { class: 'date' }, b.date) : null,
          ...b.lines.map(s => el('p', { html: fmt(s) || '&nbsp;' }))), ctx);
        break;
      case 'doc':
        put(host, el('div', { class: 'doc' },
          b.title ? el('div', { class: 'doc-title', html: fmt(b.title) }) : null,
          ...b.lines.map(s => el('p', { html: fmt(s) || '&nbsp;' }))), ctx);
        break;
      case 'letter':
        put(host, el('div', { class: 'letter' },
          ...b.lines.map(s => el('p', { html: fmt(s) || '&nbsp;' })),
          b.sign ? el('p', { class: 'sign', html: fmt(b.sign) }) : null), ctx);
        break;
      case 'clue': {
        put(host, el('div', { class: 'clue' }, el('p', { html: fmt(b.text) })), ctx);
        if (State.addClue(b.id)) { U.toast('手がかり帳に記録しました'); updateBadge(); }
        break;
      }
      case 'fig':
        put(host, el('div', { class: 'figure' }, el('div', { html: b.svg }), b.cap ? el('div', { class: 'cap', html: fmt(b.cap) }) : null), ctx);
        break;
      case 'fx':
        if (b.beam === false) document.body.classList.add('beam-off');
        if (b.beam === true) document.body.classList.remove('beam-off');
        if (b.calm) document.body.classList.add('calm');
        if (b.sound === 'bell') Sound.bell();
        break;
      case 'cond': {
        const ok = typeof b.test === 'function' ? b.test(State) : State.choice(b.choice) === b.eq;
        await renderBlocks(ok ? b.then : (b.else || []), host, ctx);
        break;
      }
      case 'reveal': await doReveal(b, host, ctx); break;
      case 'choice': await doChoice(b, host, ctx); break;
      case 'quiz': await doQuiz(b, host, ctx); break;
      case 'game': await doGame(b, host, ctx); break;
      case 'next': await doNext(b, host, ctx); break;
      case 'credits': put(host, credits(), ctx); break;
      default: console.warn('未知のブロック', b);
    }
  }

  async function doNext(b, host, ctx) {
    if (ctx.reread) return;
    const btn = el('button', { class: 'btn ghost', type: 'button' }, b.label || '続ける');
    const row = put(host, el('div', { class: 'btn-row' }, btn), ctx);
    await new Promise(res => btn.addEventListener('click', res, { once: true }));
    row.remove();
    ctx.live = true; ctx.scrollNext = true;
  }

  async function doChoice(b, host, ctx) {
    const box = put(host, gateBox(b.label || '選択', b.prompt, ctx, b.id), ctx);
    const opts = el('div', { class: 'opts' });
    box.appendChild(opts);
    const btns = b.options.map((o, i) => el('button', { class: 'opt', type: 'button', html: fmt(o.label) }));
    btns.forEach(x => opts.appendChild(x));
    let idx = State.choice(b.id);
    if (idx == null) {
      idx = await new Promise(res => btns.forEach((x, i) => x.addEventListener('click', () => res(i))));
      State.setChoice(b.id, idx);
      Sound.click();
      ctx.live = true; ctx.scrollNext = true;
    }
    btns.forEach((x, i) => { x.disabled = true; if (i === idx) x.classList.add('picked'); else x.style.opacity = .45; });
    box.classList.add('solved');
    await renderBlocks(b.options[idx].reply || [], host, ctx);
  }

  async function doQuiz(b, host, ctx) {
    const box = put(host, gateBox(b.label || '問い', b.prompt, ctx, b.id), ctx);
    if (b.fig) box.appendChild(el('div', { class: 'figure', html: b.fig }));
    const answers = Array.isArray(b.answer) ? b.answer : [b.answer];
    const opts = el('div', { class: 'opts' });
    const btns = b.options.map(o => el('button', { class: 'opt', type: 'button', html: fmt(o) }));
    btns.forEach(x => opts.appendChild(x));
    const fb = el('div', { class: 'feedback' });
    box.append(opts, fb);
    if (State.gateDone(b.id)) {
      btns.forEach((x, i) => { x.disabled = true; if (answers.includes(i)) x.classList.add('picked'); else x.style.opacity = .4; });
      box.classList.add('solved');
      box.appendChild(el('div', { class: 'solved-mark' }, '✓ 解決済み'));
    } else {
      const hints = hintsUI(box, b.hints);
      let wrongs = 0;
      await new Promise(res => btns.forEach((x, i) => x.addEventListener('click', () => {
        if (x.disabled) return;
        if (answers.includes(i)) {
          Sound.good();
          btns.forEach(y => { y.disabled = true; });
          x.classList.add('picked');
          fb.className = 'feedback good'; fb.innerHTML = fmt(b.goodText || 'その通りだ。');
          res();
        } else {
          Sound.bad(); wrongs++;
          x.disabled = true; x.classList.add('wrong');
          fb.className = 'feedback bad'; fb.innerHTML = fmt((b.wrong && b.wrong[i]) || '違うようだ。手がかりを見直そう。');
          if (wrongs === 2) hints.auto();
        }
      })));
      State.setGate(b.id);
      box.classList.add('solved');
      ctx.live = true; ctx.scrollNext = true;
    }
    await renderBlocks(b.success || [], host, ctx);
  }

  async function doGame(b, host, ctx) {
    const box = put(host, gateBox(b.label || 'ゲーム', b.prompt, ctx, b.id), ctx);
    const area = el('div');
    box.appendChild(area);
    const run = () => new Promise(res => {
      let fin = false, cleanup = null;
      const api = { done(skipped) { if (fin) return; fin = true; if (cleanup) cleanup(); res(!!skipped); } };
      cleanup = Games[b.kind](area, b.cfg || {}, api);
      if (cleanup) cleanups.push(cleanup);
    });
    if (State.gateDone(b.id)) {
      box.classList.add('solved');
      const replay = el('button', { class: 'btn ghost small', type: 'button' }, 'もう一度遊ぶ');
      replay.addEventListener('click', async () => { replay.remove(); area.innerHTML = ''; await run(); });
      box.append(el('div', { class: 'solved-mark' }, '✓ ' + (b.doneText || '達成済み')), replay);
    } else {
      hintsUI(box, b.hints);
      await run();
      State.setGate(b.id);
      box.classList.add('solved');
      box.appendChild(el('div', { class: 'solved-mark' }, '✓ ' + (b.doneText || '達成')));
      ctx.live = true; ctx.scrollNext = true;
    }
    await renderBlocks(b.success || [], host, ctx);
  }

  function revealCard(c, anim) {
    return el('div', { class: 'reveal-card', style: '--c:' + c.color },
      el('div', { class: 'stamp' }, '正体判明'),
      el('div', null, el('div', { class: anim ? 'flip' : '' }, crest(c, true, true))),
      el('div', { class: 'was' }, c.name.replace(/\{([^|{}]+)\|[^{}]+\}/g, '$1') + '　―　' + c.role),
      el('h3', { html: fmt(c.trueName) }),
      el('div', { class: 'is' }, c.trueRole),
      el('p', { class: 'desc', html: fmt(c.trueDesc) }));
  }
  async function doReveal(b, host, ctx) {
    const c = CH(b.who);
    const isNew = State.reveal(b.who);
    put(host, el('div', { class: 'reveal-inline' }, revealCard(c, false)), ctx);
    if (isNew) {
      Sound.reveal();
      await openOverlay(el('div', null, revealCard(c, true),
        el('div', { class: 'btn-row' }, el('button', { class: 'btn', type: 'button', onclick: closeOverlay }, '物語に戻る'))));
    }
  }

  /* ---------- タイトル ---------- */
  const LIGHTHOUSE = `<svg class="lighthouse" viewBox="0 0 120 200" aria-hidden="true">
    <defs><radialGradient id="lg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#f0c06a" stop-opacity="0"/></radialGradient></defs>
    <circle cx="60" cy="38" r="34" fill="url(#lg)"/>
    <path d="M44 60 L76 60 L84 186 L36 186 Z" fill="#d9d2c2"/>
    <path d="M41 100 L79 100 L80.8 120 L39.2 120 Z M38.4 140 L81.6 140 L83.2 160 L36.8 160 Z" fill="#8a3a32"/>
    <rect x="40" y="54" width="40" height="7" fill="#3a3f48"/>
    <rect x="47" y="30" width="26" height="24" fill="#f6dc94" stroke="#3a3f48" stroke-width="3"/>
    <path d="M44 30 L60 16 L76 30 Z" fill="#3a3f48"/>
    <rect x="56" y="150" width="8" height="14" fill="#3a3f48"/>
    <path d="M20 186 H100" stroke="#3a3f48" stroke-width="4"/>
  </svg>`;

  /* ---------- 作品一覧（シリーズ） ---------- */
  const THEMES = ['space', 'past'];
  function setTheme() {
    const inLib = document.body.classList.contains('in-library');
    THEMES.forEach(t => document.body.classList.toggle('theme-' + t, !inLib && !!window.STORY && STORY.theme === t));
  }
  /* 作品一覧は時代の古い順（過去・現在・未来）に並べる */
  function byEpoch() {
    return SERIES.order.slice().sort((a, b) => (SERIES.stories[a].epochOrder || 0) - (SERIES.stories[b].epochOrder || 0));
  }
  function setBrand(text) { document.getElementById('btn-home').textContent = text; }

  function openStory(id) {
    SERIES.use(id);
    State.settings.lastStory = id; State.saveSettings();
    buildIndex(); updateBadge();
    document.body.classList.remove('in-library');
    setTheme(); setBrand(STORY.title);
  }

  function storyProgress(id) {
    const s = SERIES.stories[id], d = State.peek(id);
    const total = s.characters.length * s.stages.length;
    const read = Object.keys(d.read).length;
    return { pct: Math.round(read / Math.max(1, total) * 100), done: !!d.finale, started: !!d.started };
  }

  function library() {
    clearApp();
    document.body.classList.remove('beam-off', 'calm', ...THEMES.map(t => 'theme-' + t));
    document.body.classList.add('in-library');
    setBrand(SERIES.title);
    document.getElementById('note-count').textContent = '';
    const ids = byEpoch();
    const list = el('section', { class: 'library' });
    ids.forEach(id => {
      const s = SERIES.stories[id], p = storyProgress(id);
      list.appendChild(el('article', { class: 'work' + (THEMES.includes(s.theme) ? ' ' + s.theme : '') },
        el('div', { class: 'work-cover', html: s.cover || LIGHTHOUSE }),
        el('div', { class: 'work-body' },
          el('div', { class: 'work-part' }, s.epoch ? el('span', { class: 'work-epoch' }, s.epoch) : null, s.part + '　' + (s.era || '')),
          el('h2', null, s.title),
          el('p', { class: 'work-tag' }, s.tagline),
          el('p', { class: 'work-blurb', html: fmt(s.blurb || '') }),
          el('div', { class: 'progress-line' },
            el('span', null, p.done ? '読了' : p.started ? `進行 ${p.pct}%` : '未読'),
            el('div', { class: 'bar' }, el('i', { style: { width: (p.done ? 100 : p.pct) + '%' } }))),
          s.note ? el('p', { class: 'work-note' }, s.note) : null,
          el('div', { class: 'btn-row', style: { justifyContent: 'flex-start' } },
            el('button', { class: 'btn', type: 'button', onclick: () => { openStory(id); title(); } }, p.started ? 'つづきを読む' : 'この作品を読む')))));
    });
    const epochs = el('ol', { class: 'epoch-line', 'aria-label': '三つの時代' });
    ids.forEach(id => {
      const s = SERIES.stories[id];
      epochs.appendChild(el('li', null, el('b', null, s.epoch || s.part), el('small', null, s.epochEra || s.era || ''), el('span', null, '『' + s.title + '』')));
    });
    app.append(
      el('section', { class: 'library-head' },
        el('h1', null, SERIES.title),
        el('p', null, '灯を守る者たちの、過去・現在・未来。三つの作品は、それぞれ六人の視点から読み解く四つの幕と終章でできています。'),
        epochs),
      el('section', { class: 'library-style' },
        el('h2', null, '今夜の読み心地'),
        el('p', null, '読む気分に合わせて、表示スタイルを選べます。書体・行間・文章の現れ方・背景の演出は、右上の「設定」から。'),
        stylePicker(true)),
      list,
      el('p', { class: 'library-foot' }, 'この作品は外部と一切通信しません。進行状況は作品ごとに、このブラウザの中だけに保存されます。'));
  }

  function title() {
    clearApp();
    document.body.classList.remove('beam-off', 'calm', 'in-library');
    setTheme(); setBrand(STORY.title);
    const started = State.d.started;
    const screen = el('section', { class: 'title-screen' },
      el('div', { html: STORY.cover || LIGHTHOUSE }),
      el('div', { class: 'title-part' }, SERIES.title + '　' + (STORY.part || '') + (STORY.epoch ? '・' + STORY.epoch : '')),
      el('h1', null, STORY.title),
      el('p', { class: 'sub' }, STORY.tagline),
      el('p', { class: 'lead', html: fmt(STORY.lead || '') }),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn', type: 'button', onclick: () => { State.d.started = true; State.save(); hub(); } }, started ? 'つづきから読む' : '物語をはじめる'),
        started ? el('button', { class: 'btn ghost', type: 'button', onclick: () => {
          if (confirm('この作品の進行状況をすべて消して、最初から読みますか？')) { State.reset(); updateBadge(); State.d.started = true; State.save(); hub(1); }
        } }, '最初から読み直す') : null,
        el('button', { class: 'btn ghost', type: 'button', onclick: library }, '作品一覧へ')),
      el('ul', { class: 'howto' },
        el('li', null, '物語は四つの「幕」と終章からなります。各幕には六人それぞれの視点の章があり、好きな順に読めます。'),
        el('li', null, '六人全員の章を読み終えると「幕間の謎」が現れます。複数の視点を照らし合わせて解くと、次の幕へ進めます。'),
        el('li', null, '章の途中には、選択・問い・小さなゲームがあります。重要な記述は「手がかり帳」に自動で記録されます。'),
        el('li', null, '登場人物の本当の身分は、はじめは伏せられています。読み進めるうちに「人物ファイル」が書き換わっていきます。'),
        el('li', null, '進行状況はこのブラウザの中だけに保存されます。外部との通信は一切行いません。')));
    app.appendChild(screen);
  }

  /* ---------- 幕の一覧（ハブ） ---------- */
  function currentStage() {
    for (let n = 1; n <= STORY.stages.length; n++) if (!State.interludeSolved(n)) return n;
    return STORY.stages.length;
  }

  function hub(n) {
    clearApp();
    document.body.classList.remove('beam-off', 'calm', 'in-library');
    setTheme();
    n = n || State.d.lastStage || currentStage();
    if (!State.stageUnlocked(n)) n = currentStage();
    State.d.lastStage = n; State.save();
    const st = STORY.stages[n - 1];

    const tabs = el('div', { class: 'stage-tabs', role: 'tablist' });
    STORY.stages.forEach(s => {
      const open = State.stageUnlocked(s.n);
      tabs.appendChild(el('button', {
        class: 'stage-tab' + (s.n === n ? ' current' : '') + (open ? '' : ' locked') + (State.interludeSolved(s.n) ? ' cleared' : ''),
        type: 'button', role: 'tab', 'aria-selected': s.n === n ? 'true' : 'false',
        onclick: () => open ? hub(s.n) : U.toast('前の幕の謎を解くと開きます')
      }, open ? s.title : '🔒 ' + s.title, el('small', null, open ? s.sub : '？？？')));
    });
    const fOpen = State.finaleUnlocked();
    tabs.appendChild(el('button', {
      class: 'stage-tab' + (fOpen ? '' : ' locked') + (State.d.finale ? ' cleared' : ''), type: 'button',
      onclick: () => fOpen ? finale() : U.toast('第四幕の謎を解くと開きます')
    }, fOpen ? '終章' : '🔒 終章', el('small', null, fOpen ? STORY.finale.sub : '？？？')));

    const count = State.stageReadCount(n), total = STORY.characters.length;
    const head = el('section', { class: 'stage-head' },
      el('h2', null, st.title + '　' + st.sub, el('small', null, st.day)),
      el('p', { html: fmt(st.intro) }),
      el('div', { class: 'progress-line' }, el('span', null, `読了 ${count} / ${total}`),
        el('div', { class: 'bar' }, el('i', { style: { width: (count / total * 100) + '%' } }))));

    const cast = el('section', { class: 'cast' });
    STORY.characters.forEach(c => {
      const ch = STORY.chapter(n, c.id);
      const read = State.isRead(n, c.id);
      const card = el('button', { class: 'card' + (read ? ' read' : ''), type: 'button', style: '--c:' + c.color },
        crest(c),
        el('div', { class: 'meta' },
          el('div', { class: 'name', html: fmt(c.name) }),
          el('div', { class: 'role' }, c.role),
          State.isRevealed(c.id) ? el('div', { class: 'truth' }, '正体：' + c.trueRole) : null,
          el('div', { class: 'ch-title' }, ch ? '「' + ch.title + '」' : '（準備中）')),
        el('span', { class: 'state ' + (read ? 'done' : 'new') }, read ? '読了' : '未読'));
      if (ch) card.addEventListener('click', () => reader(n, c.id));
      cast.appendChild(card);
    });

    const it = STORY.interludes[n];
    let box;
    if (State.interludeSolved(n)) {
      const nextBtn = n < STORY.stages.length
        ? el('button', { class: 'btn', type: 'button', onclick: () => hub(n + 1) }, STORY.stages[n].title + 'へ進む')
        : el('button', { class: 'btn', type: 'button', onclick: finale }, '終章へ');
      box = el('section', { class: 'interlude-box' },
        el('h3', null, '幕間の謎「' + it.title + '」 ― 解決済み'),
        el('div', { class: 'btn-row' }, el('button', { class: 'btn ghost', type: 'button', onclick: () => interlude(n) }, 'もう一度読む'), nextBtn));
    } else if (State.stageAllRead(n)) {
      box = el('section', { class: 'interlude-box' },
        el('h3', null, '幕間の謎「' + it.title + '」'),
        el('p', null, '六人すべての視点を読み終えた。それぞれの章に散らばった手がかりを照らし合わせれば、見えてくるものがある。'),
        el('button', { class: 'btn', type: 'button', onclick: () => interlude(n) }, '謎に挑む'));
    } else {
      box = el('section', { class: 'interlude-box', style: { opacity: .6 } },
        el('h3', null, '幕間の謎'),
        el('p', { style: { margin: 0 } }, `六人全員の章を読み終えると、幕間の謎に挑めます（あと ${total - count} 人）。`));
    }
    app.append(tabs, head, cast, box);
  }

  /* ---------- 章を読む ---------- */
  function chapterHead(c, label, titleText, when, color) {
    return el('header', { class: 'reader-head' },
      c ? crest(c) : el('div', { class: 'crest', style: '--c:' + color }, '謎'),
      el('div', null,
        el('div', { class: 'who' }, label),
        el('h2', { html: fmt(titleText) }),
        el('div', { class: 'when' }, when)));
  }

  function backRow(n) {
    return el('div', { class: 'btn-row', style: { justifyContent: 'flex-start', margin: '0 0 12px' } },
      el('button', { class: 'btn ghost small', type: 'button', onclick: () => hub(n) }, '← ' + STORY.stages[n - 1].title + 'の一覧へ'));
  }

  function reader(n, who) {
    clearApp();
    const c = CH(who), ch = STORY.chapter(n, who), st = STORY.stages[n - 1];
    const wrap = el('article', { class: 'reader', style: '--c:' + c.color });
    const page = el('div', { class: 'page' });
    wrap.append(backRow(n), chapterHead(c, c.plain + 'の視点', ch.title, st.title + '「' + st.sub + '」　' + ch.time), page);
    app.appendChild(wrap);
    const ctx = makeCtx(c.color, State.isRead(n, who), page);
    renderBlocks(ch.blocks, page, ctx).then(() => {
      if (ctx.token !== viewToken) return;
      const wasAll = State.stageAllRead(n);
      State.markRead(n, who);
      const nowAll = State.stageAllRead(n);
      const end = el('div', { class: 'chapter-end' }, el('div', { class: 'fin' }, '― 了 ―'));
      if (!wasAll && nowAll) end.appendChild(el('p', { style: { color: 'var(--amber)' } }, '六人全員の章を読み終えた。幕間の謎に挑めるようになった。'));
      else if (!nowAll) end.appendChild(el('p', { style: { color: 'var(--ink-dim)', fontSize: '14px' } }, `この幕で未読の視点：あと ${STORY.characters.length - State.stageReadCount(n)} 人`));
      end.appendChild(el('button', { class: 'btn', type: 'button', onclick: () => hub(n) }, '一覧へ戻る'));
      put(page, end, ctx);
    });
  }

  function interlude(n) {
    clearApp();
    const it = STORY.interludes[n], st = STORY.stages[n - 1];
    const wrap = el('article', { class: 'reader', style: '--c:var(--amber)' });
    const page = el('div', { class: 'page' });
    wrap.append(backRow(n), chapterHead(null, '幕間の謎', it.title, st.title + '「' + st.sub + '」の終わりに', 'var(--amber)'), page);
    app.appendChild(wrap);
    const ctx = makeCtx('var(--amber)', State.interludeSolved(n), page);
    renderBlocks(it.blocks, page, ctx).then(() => {
      if (ctx.token !== viewToken) return;
      State.solveInterlude(n);
      const last = n === STORY.stages.length;
      put(page, el('div', { class: 'chapter-end' },
        el('div', { class: 'fin' }, '― 幕 ―'),
        el('p', { style: { color: 'var(--amber)' } }, last ? '終章が開かれた。' : STORY.stages[n].title + '「' + STORY.stages[n].sub + '」が開かれた。'),
        last ? el('button', { class: 'btn', type: 'button', onclick: finale }, '終章へ')
          : el('button', { class: 'btn', type: 'button', onclick: () => hub(n + 1) }, STORY.stages[n].title + 'へ進む')), ctx);
    });
  }

  function finale() {
    clearApp();
    const f = STORY.finale;
    const wrap = el('article', { class: 'reader finale', style: '--c:var(--amber)' });
    const page = el('div', { class: 'page' });
    wrap.append(el('div', { class: 'btn-row', style: { justifyContent: 'flex-start', margin: '0 0 12px' } },
      el('button', { class: 'btn ghost small', type: 'button', onclick: () => hub(STORY.stages.length) }, '← 第四幕の一覧へ')),
      chapterHead(null, '終章', f.title, f.time, 'var(--amber)'), page);
    wrap.querySelector('.crest').textContent = f.crest || '灯';
    app.appendChild(wrap);
    const ctx = makeCtx('var(--amber)', State.d.finale, page);
    renderBlocks(f.blocks, page, ctx).then(() => {
      if (ctx.token !== viewToken) return;
      State.d.finale = true; State.save();
    });
  }

  function credits() {
    const nextId = SERIES.next(STORY.id), next = nextId && SERIES.stories[nextId];
    return el('div', { class: 'credits' },
      el('div', { class: 'end' }, '完'),
      el('p', { html: fmt('最後まで読んでくださって、ありがとうございました。') }),
      next ? el('p', { class: 'next-work', html: fmt(next.part + '『' + next.title + '』――' + (next.era || '')) }) : null,
      el('div', { class: 'btn-row' },
        next ? el('button', { class: 'btn', type: 'button', onclick: () => { openStory(nextId); title(); } }, '続編を読む') : null,
        el('button', { class: 'btn ghost', type: 'button', onclick: showFiles }, '人物ファイルを見る'),
        el('button', { class: 'btn ghost', type: 'button', onclick: library }, '作品一覧へ')));
  }

  /* ---------- 人物ファイル・手がかり帳・設定 ---------- */
  function showFiles() {
    const box = el('div', null, el('h2', null, '人物ファイル'));
    STORY.characters.forEach(c => {
      const rv = State.isRevealed(c.id);
      box.appendChild(el('div', { class: 'file', style: '--c:' + c.color },
        crest(c),
        el('div', { class: 'body' },
          el('h4', { html: fmt(c.name) }),
          el('div', { style: { fontSize: '12px', color: 'var(--ink-dim)' } }, c.role),
          el('p', { html: fmt(c.desc) }),
          rv ? el('div', { class: 'truth', html: fmt('正体：' + c.trueName + '　―　' + c.trueRole) }) : el('div', { class: 'truth', style: { color: 'var(--ink-faint)' } }, '正体：？？？'),
          rv ? el('p', { html: fmt(c.trueDesc) }) : null,
          c.inherit ? el('p', { class: 'inherit', html: fmt((STORY.inheritLabel || '受け継いだもの') + '：' + c.inherit) }) : null)));
    });
    openOverlay(box);
  }

  function showNotes() {
    const box = el('div', null, el('h2', null, '手がかり帳'));
    const ids = State.d.clues.filter(id => CLUES[id]);
    if (!ids.length) box.appendChild(el('p', { style: { color: 'var(--ink-dim)' } }, 'まだ何も記録されていない。物語の中の「手がかり」は、ここに自動で書き留められる。'));
    STORY.stages.forEach(s => {
      const list = ids.filter(id => CLUES[id].stage === s.n);
      if (!list.length) return;
      const g = el('div', { class: 'note-group' }, el('h4', null, s.title + '「' + s.sub + '」'));
      list.forEach(id => {
        const cl = CLUES[id], c = CH(cl.who);
        g.appendChild(el('div', { class: 'note', style: c ? '--c:' + c.color : '' },
          el('span', { class: 'src' }, c ? c.plain : '幕間'), el('span', { html: fmt(cl.text) })));
      });
      box.appendChild(g);
    });
    openOverlay(box);
  }

  const SIZES = { s: '15px', m: '17px', l: '19px', xl: '21px' };
  /* 表示スタイル：雰囲気と読む気分に合わせて選ぶ。sw は見本の色（地・紙面・文字・灯） */
  const STYLES = [
    { id: 'yotomoshi', name: '夜灯', kana: 'よとぼし', mood: '物語に浸りたい夜に', desc: '夜の海と、灯台の琥珀色の灯。この物語のもとの姿です。', sw: ['#0d1a2e', '#16263f', '#e9e2d2', '#f0c06a'] },
    { id: 'washi', name: '和紙', kana: 'わし', mood: '昼間や明るい場所で', desc: '生成りの紙に墨の文字。まぶしさを抑えた明るい表示で、長く読んでも目が疲れにくい。', sw: ['#f4efe4', '#fffcf6', '#2b2620', '#a8432a'] },
    { id: 'tasogare', name: '黄昏', kana: 'たそがれ', mood: 'しみじみと、懐かしく', desc: '夕暮れの琥珀とセピア。過ぎた日々をふり返るような、あたたかい色合い。', sw: ['#2a1a12', '#3a2418', '#f1e2cf', '#f0a868'] },
    { id: 'shinkai', name: '深海', kana: 'しんかい', mood: '静かに、悲しみに寄り添って', desc: '深い藍と青緑。音のない海の底のように、心を落ち着けて読める。', sw: ['#062030', '#0b2e42', '#dcefee', '#7fd6d0'] },
    { id: 'sumi', name: '墨', kana: 'すみ', mood: '文字をくっきり読みたいときに', desc: '黒地に白い文字。背景の演出を止め、読みやすさを最優先にする。', sw: ['#000000', '#111111', '#ffffff', '#ffd54a'] }
  ];

  function applySettings() {
    const s = State.settings, root = document.documentElement;
    if (!STYLES.some(x => x.id === s.style)) s.style = 'yotomoshi';
    root.style.setProperty('--text-size', SIZES[s.size] || SIZES.m);
    root.dataset.style = s.style;
    root.dataset.font = s.font || 'mincho';
    root.dataset.leading = s.leading || 'normal';
    root.dataset.motion = s.motion || 'on';
    const st = STYLES.find(x => x.id === s.style);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', st.sw[0]);
    U.$$('.style-card').forEach(b => {
      const on = b.dataset.styleId === s.style;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  function stylePicker(compact) {
    const wrap = el('div', { class: 'style-picker' + (compact ? ' compact' : ''), role: 'radiogroup', 'aria-label': '表示スタイル' });
    STYLES.forEach(s => {
      const on = State.settings.style === s.id;
      const b = el('button', { type: 'button', class: 'style-card' + (on ? ' on' : ''), role: 'radio', 'aria-checked': on ? 'true' : 'false', 'data-style-id': s.id, title: s.desc },
        el('span', { class: 'swatch', style: 'background:' + s.sw[0], 'aria-hidden': 'true' },
          el('span', { class: 'sw-panel', style: `background:${s.sw[1]};color:${s.sw[2]}` }, '灯'),
          el('i', { style: 'background:' + s.sw[3] })),
        el('span', { class: 'style-text' },
          el('b', { html: fmt('{' + s.name + '|' + s.kana + '}') }),
          el('small', null, s.mood),
          compact ? null : el('span', { class: 'style-desc' }, s.desc)));
      b.addEventListener('click', () => {
        State.settings.style = s.id;
        State.saveSettings(); applySettings();
        U.toast('表示スタイル「' + s.name + '」');
      });
      wrap.appendChild(b);
    });
    return wrap;
  }
  function showSettings() {
    const seg = (opts, cur, onPick) => {
      const s = el('div', { class: 'seg' });
      opts.forEach(([v, label]) => s.appendChild(el('button', {
        type: 'button', class: v === cur ? 'on' : '',
        onclick: e => { onPick(v); U.$$('button', s).forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); }
      }, label)));
      return s;
    };
    const set = (key, after) => v => { State.settings[key] = v; State.saveSettings(); applySettings(); if (after) after(v); };
    const box = el('div', null, el('h2', null, '設定'),
      el('div', { class: 'set-h' }, '表示スタイル'),
      el('p', { class: 'set-note' }, '物語の雰囲気や、いまの気分に合わせて選べます。選ぶとすぐに切り替わります。'),
      stylePicker(false),
      el('div', { class: 'set-h' }, '読み心地'),
      el('div', { class: 'setting-row' }, el('span', null, '本文の書体'),
        seg([['mincho', '明朝（物語らしく）'], ['gothic', 'ゴシック（読みやすく）']], State.settings.font, set('font'))),
      el('div', { class: 'setting-row' }, el('span', null, '本文の文字の大きさ'),
        seg([['s', '小'], ['m', '中'], ['l', '大'], ['xl', '特大']], State.settings.size, set('size'))),
      el('div', { class: 'setting-row' }, el('span', null, '行間'),
        seg([['normal', '標準'], ['relaxed', 'ゆったり'], ['loose', 'ひろめ']], State.settings.leading, set('leading'))),
      el('div', { class: 'setting-row' }, el('span', null, '文章の現れ方'),
        seg([['instant', 'すぐに表示'], ['gentle', 'ひと段落ずつ']], State.settings.pace, set('pace'))),
      el('p', { class: 'set-note' }, '「ひと段落ずつ」にすると、初めて読む章の文章が、語りかけるように少しずつ浮かびます（画面をクリックすると残りをすぐに表示）。'),
      el('div', { class: 'set-h' }, '演出と音'),
      el('div', { class: 'setting-row' }, el('span', null, '背景の演出（灯の光・雨・星）'),
        seg([['on', 'あり'], ['low', '控えめ'], ['off', 'なし']], State.settings.motion, set('motion'))),
      el('div', { class: 'setting-row' }, el('span', null, 'ゲームの効果音'),
        seg([[true, 'あり'], [false, 'なし']], State.settings.sound, set('sound', v => { if (!v) Sound.stopNoise(); }))),
      State.d && !document.body.classList.contains('in-library') ? el('div', { class: 'setting-row' }, el('span', null, '『' + STORY.title + '』の進行状況'),
        el('button', { class: 'btn ghost small', type: 'button', onclick: () => {
          if (confirm('『' + STORY.title + '』の進行状況（読了・正体・手がかり）をすべて消去しますか？')) { State.reset(); updateBadge(); closeOverlay(); title(); }
        } }, '消去する')) : null,
      el('p', { style: { fontSize: '12px', color: 'var(--ink-dim)', marginTop: '16px' } },
        'この作品は外部と一切通信しません（フォントは端末のシステムフォント、効果音は端末内で合成）。進行状況はこのブラウザの localStorage にのみ保存されます。'));
    openOverlay(box);
  }

  /* ---------- 起動 ---------- */
  function boot() {
    applySettings();
    const first = SERIES.stories[State.settings.lastStory] ? State.settings.lastStory : SERIES.order[0];
    openStory(first);
    const inStory = fn => () => {
      if (document.body.classList.contains('in-library')) { U.toast('作品を選んでください'); return; }
      fn();
    };
    document.getElementById('btn-home').addEventListener('click', library);
    document.getElementById('btn-hub').addEventListener('click', inStory(() => { State.d.started = true; State.save(); hub(); }));
    document.getElementById('btn-files').addEventListener('click', inStory(showFiles));
    document.getElementById('btn-notes').addEventListener('click', inStory(showNotes));
    document.getElementById('btn-settings').addEventListener('click', showSettings);
    library();
  }
  window.Engine = { hub, reader, interlude, finale, title, library, openStory, applySettings };
  boot();
})();

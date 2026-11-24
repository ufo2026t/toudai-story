/* 灯守の物語 ― コア：作品（シリーズ）の登録、進行状況の保存、書式、効果音 */
(function () {
  'use strict';

  /* ---------- 作品の登録口 ----------
     各作品のデータファイルは SERIES.begin(id, meta) のあとに STORY.def○○ で登録する。
     読書中は window.STORY が選択中の作品を指す。 */
  function makeStory(id, meta) {
    return Object.assign({
      id,
      characters: [],
      charMap: {},
      stages: [],
      chapters: {},
      interludes: {},
      finale: null,
      defCharacter(c) { this.characters.push(c); this.charMap[c.id] = c; },
      defStage(s) { this.stages[s.n - 1] = s; },
      defChapter(stage, who, ch) { ch.stage = stage; ch.who = who; this.chapters[stage + ':' + who] = ch; },
      defInterlude(stage, it) { it.stage = stage; this.interludes[stage] = it; },
      defFinale(f) { this.finale = f; },
      chapter(stage, who) { return this.chapters[stage + ':' + who]; }
    }, meta || {});
  }

  const SERIES = window.SERIES = {
    title: '灯守の物語',
    stories: {},
    order: [],
    begin(id, meta) {
      const s = makeStory(id, meta);
      this.stories[id] = s;
      this.order.push(id);
      window.STORY = s;
      return s;
    },
    use(id) {
      window.STORY = this.stories[id];
      State.use(id);
      return window.STORY;
    },
    next(id) {
      const i = this.order.indexOf(id);
      return i >= 0 ? this.order[i + 1] : undefined;
    }
  };

  /* ---------- 小さな道具 ---------- */
  const U = window.U = {
    $(sel, root) { return (root || document).querySelector(sel); },
    $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); },
    el(tag, attrs, ...kids) {
      const n = document.createElement(tag);
      if (attrs) {
        for (const k in attrs) {
          const v = attrs[k];
          if (v == null || v === false) continue;
          if (k === 'class') n.className = v;
          else if (k === 'html') n.innerHTML = v;
          else if (k === 'text') n.textContent = v;
          else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
          else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
          else n.setAttribute(k, v === true ? '' : v);
        }
      }
      for (const kid of kids.flat()) {
        if (kid == null || kid === false) continue;
        n.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
      }
      return n;
    },
    esc(s) {
      return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    /* 書式：{漢字|かな} ルビ、**強調**、__傍点__、改行 */
    fmt(s) {
      return U.esc(s)
        .replace(/\{([^|{}]+)\|([^{}]+)\}/g, '<ruby>$1<rt>$2</rt></ruby>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
    },
    plain(s) { return String(s).replace(/\{([^|{}]+)\|[^{}]+\}/g, '$1'); },
    shuffle(a) {
      a = a.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    sleep(ms) { return new Promise(r => setTimeout(r, ms)); },
    /* カタカナ化・空白除去・小書き文字を大書きに（解答の正規化） */
    normKana(s) {
      const small = { 'ァ': 'ア', 'ィ': 'イ', 'ゥ': 'ウ', 'ェ': 'エ', 'ォ': 'オ', 'ッ': 'ツ', 'ャ': 'ヤ', 'ュ': 'ユ', 'ョ': 'ヨ', 'ヮ': 'ワ' };
      return String(s)
        .replace(/[\u3041-\u3096]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60))
        .replace(/[ァィゥェォッャュョヮ]/g, c => small[c])
        .replace(/[\s\u3000、。・,.\-ー－！!]/g, '');
    },
    toast(msg, ms) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.remove('hidden');
      clearTimeout(U._tt);
      U._tt = setTimeout(() => t.classList.add('hidden'), ms || 2600);
    }
  };

  /* ---------- 進行状況（ブラウザ内の localStorage のみに保存） ----------
     作品ごとに別のキーで保存する。『灯の還る夜』（p1）のキーは公開当初のものをそのまま使う。 */
  const KEYS = { p1: 'tomoshibi-no-kaeru-yoru-v1' };
  const SETTINGS_KEY = 'tomoshibi-settings-v1';
  const keyOf = id => KEYS[id] || ('tomoshibi-' + id + '-v1');
  const readJSON = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できない環境でも読み進められる */ } };

  const State = window.State = {
    id: null,
    d: null,
    settings: null,
    defaults() {
      return { started: false, read: {}, gates: {}, choices: {}, revealed: {}, clues: [], interludes: {}, finale: false, lastStage: 1 };
    },
    loadSettings() {
      const mq = q => !!(window.matchMedia && window.matchMedia(q).matches);
      const def = {
        size: 'm', sound: true, lastStory: null,
        style: mq('(prefers-contrast: more)') ? 'sumi' : 'yotomoshi',
        font: 'mincho', leading: 'normal', pace: 'instant',
        motion: mq('(prefers-reduced-motion: reduce)') ? 'off' : 'on'
      };
      const s = readJSON(SETTINGS_KEY) || (readJSON(keyOf('p1')) || {}).settings || {};
      this.settings = Object.assign(def, s);
      return this.settings;
    },
    saveSettings() { writeJSON(SETTINGS_KEY, this.settings); },
    use(id) { this.id = id; this.load(); },
    peek(id) { return Object.assign(this.defaults(), readJSON(keyOf(id)) || {}); },
    load() {
      this.d = this.peek(this.id);
      delete this.d.settings;
      return this.d;
    },
    save() { if (this.id) writeJSON(keyOf(this.id), this.d); },
    reset() { this.d = this.defaults(); this.save(); },
    isRead(stage, who) { return !!this.d.read[stage + ':' + who]; },
    markRead(stage, who) { this.d.read[stage + ':' + who] = true; this.save(); },
    gateDone(id) { return !!this.d.gates[id]; },
    setGate(id) { this.d.gates[id] = true; this.save(); },
    choice(id) { return this.d.choices[id]; },
    setChoice(id, i) { this.d.choices[id] = i; this.save(); },
    isRevealed(who) { return !!this.d.revealed[who]; },
    reveal(who) {
      if (this.d.revealed[who]) return false;
      this.d.revealed[who] = true; this.save(); return true;
    },
    hasClue(id) { return this.d.clues.includes(id); },
    addClue(id) {
      if (this.hasClue(id)) return false;
      this.d.clues.push(id); this.save(); return true;
    },
    interludeSolved(n) { return !!this.d.interludes[n]; },
    solveInterlude(n) { this.d.interludes[n] = true; this.save(); },
    stageUnlocked(n) { return n === 1 || this.interludeSolved(n - 1); },
    stageReadCount(n) { return STORY.characters.filter(c => this.isRead(n, c.id)).length; },
    stageAllRead(n) { return this.stageReadCount(n) === STORY.characters.length; },
    finaleUnlocked() { return this.interludeSolved(STORY.stages.length); }
  };
  State.loadSettings();

  /* ---------- 効果音（Web Audio で端末内合成。外部ファイルは使わない） ---------- */
  const Sound = window.Sound = {
    ctx: null,
    on() { return State.settings && State.settings.sound; },
    ac() {
      if (!this.on()) return null;
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    tone(freq, dur, type, vol, when) {
      const ac = this.ac(); if (!ac) return;
      const t0 = ac.currentTime + (when || 0);
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol == null ? 0.08 : vol, t0 + 0.01);
      g.gain.setValueAtTime(vol == null ? 0.08 : vol, t0 + Math.max(0.02, dur - 0.03));
      g.gain.linearRampToValueAtTime(0, t0 + dur);
      o.connect(g).connect(ac.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    },
    click() { this.tone(660, 0.05, 'triangle', 0.05); },
    good() { this.tone(523, 0.12, 'sine', 0.07); this.tone(784, 0.25, 'sine', 0.07, 0.11); },
    bad() { this.tone(180, 0.18, 'sawtooth', 0.04); },
    reveal() { [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.05, i * 0.16)); },
    bell() { this.tone(880, 1.4, 'sine', 0.05); this.tone(1320, 1.0, 'sine', 0.02, 0.02); },
    /* ラジオの雑音 */
    noiseNode: null,
    noise(level) {
      const ac = this.ac();
      if (!ac) return;
      if (!this.noiseNode) {
        const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), ch = buf.getChannelData(0);
        for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
        const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
        const g = ac.createGain(); g.gain.value = 0;
        const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.6;
        src.connect(f).connect(g).connect(ac.destination); src.start();
        this.noiseNode = { src, g };
      }
      this.noiseNode.g.gain.setTargetAtTime(Math.max(0, level) * 0.06, ac.currentTime, 0.05);
    },
    stopNoise() {
      if (this.noiseNode) {
        try { this.noiseNode.src.stop(); } catch (e) { /* 既に停止済み */ }
        this.noiseNode = null;
      }
    }
  };
})();

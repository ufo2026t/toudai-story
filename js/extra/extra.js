/* 番外編『灯はひとつ』：定義。各話は ep1〜ep4.js で登録する */
(function () {
  'use strict';

  const COVER = `<svg class="lighthouse" viewBox="0 0 120 200" aria-hidden="true">
    <defs>
      <linearGradient id="exsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0c22"/><stop offset=".55" stop-color="#16263f"/><stop offset="1" stop-color="#2a2018"/></linearGradient>
      <radialGradient id="exstar" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#e6eeff"/><stop offset="1" stop-color="#9fc1ff" stop-opacity="0"/></radialGradient>
      <radialGradient id="exlamp" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#f0c06a" stop-opacity="0"/></radialGradient>
      <radialGradient id="exfire" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd08a"/><stop offset="1" stop-color="#e0702a" stop-opacity="0"/></radialGradient>
    </defs>
    <rect x="6" y="4" width="108" height="192" rx="54" fill="url(#exsky)"/>
    <g fill="#dfe8ff"><circle cx="30" cy="40" r=".9"/><circle cx="88" cy="30" r="1.1"/><circle cx="24" cy="78" r=".7"/><circle cx="96" cy="66" r=".8"/><circle cx="40" cy="20" r=".6"/></g>
    <path d="M60 30 L60 156" stroke="#f0e2b8" stroke-width=".8" stroke-dasharray="2 4" opacity=".6"/>
    <circle cx="60" cy="30" r="12" fill="url(#exstar)"/>
    <path d="M60 22 L62 28 L68 30 L62 32 L60 38 L58 32 L52 30 L58 28 Z" fill="#f4f7ff"/>
    <path d="M104 104 L104 128 L40 128 Q60 112 104 104 Z" fill="#2c2820"/>
    <rect x="56" y="86" width="8" height="34" fill="#e9e2d2"/>
    <rect x="54" y="78" width="12" height="9" rx="1" fill="#fff4d6" stroke="#4a3e30" stroke-width="1.5"/>
    <circle cx="60" cy="82" r="14" fill="url(#exlamp)"/>
    <path d="M14 146 Q30 140 46 146 T78 146 T110 146 L110 170 Q84 196 60 196 Q36 196 10 170 Z" fill="#14202c"/>
    <path d="M48 162 Q60 152 72 162 L74 170 L46 170 Z" fill="#2a2620"/>
    <rect x="57" y="150" width="6" height="8" fill="#7a7062"/>
    <rect x="58" y="152" width="4" height="4" fill="#ffb35a"/>
    <circle cx="60" cy="154" r="10" fill="url(#exfire)"/>
  </svg>`;

  SERIES.defExtra({
    title: '灯はひとつ',
    tagline: '海は暗くも、灯はひとつ。',
    era: '三つの時代の、その後',
    blurb: '三つの物語の、その後。岬に残された唄と記録をたどる、四つの小さな話。読み終えた作品の数だけ、話が開いていきます。',
    lead: '汐見埼の灯は、時代が変わっても、名乗りを変えなかった。\n十秒に二度、白く、二度。\n三つの物語のその後を、岬に残された唄と記録でたどる、四つの小さな話。',
    note: 'それぞれの話は、対応する作品を読み終えると開きます。まだ読んでいない作品の結末に触れないための仕組みです。最後の「結び」は、三つの作品をすべて読み終えると開きます。',
    cover: COVER
  });
})();

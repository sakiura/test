(() => {
  'use strict';

  const STORAGE_KEY = 'training-schedule-v2';
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  // 祝日(2026-2027)。カレンダー表示と、ずらすとき祝日を飛ばす設定の営業日判定に使う
  const HOLIDAY_NAMES = {
    '2026-01-01': '元日', '2026-01-12': '成人の日', '2026-02-11': '建国記念の日', '2026-02-23': '天皇誕生日',
    '2026-03-20': '春分の日', '2026-04-29': '昭和の日', '2026-05-03': '憲法記念日', '2026-05-04': 'みどりの日',
    '2026-05-05': 'こどもの日', '2026-05-06': '振替休日', '2026-07-20': '海の日', '2026-08-11': '山の日',
    '2026-09-21': '敬老の日', '2026-09-22': '国民の休日', '2026-09-23': '秋分の日', '2026-10-12': 'スポーツの日',
    '2026-11-03': '文化の日', '2026-11-23': '勤労感謝の日',
    '2027-01-01': '元日', '2027-01-11': '成人の日', '2027-02-11': '建国記念の日', '2027-02-23': '天皇誕生日',
    '2027-03-21': '春分の日', '2027-03-22': '振替休日', '2027-04-29': '昭和の日', '2027-05-03': '憲法記念日',
    '2027-05-04': 'みどりの日', '2027-05-05': 'こどもの日', '2027-07-19': '海の日', '2027-08-11': '山の日',
    '2027-09-20': '敬老の日', '2027-09-23': '秋分の日', '2027-10-11': 'スポーツの日', '2027-11-03': '文化の日',
    '2027-11-23': '勤労感謝の日',
  };
  const HOLIDAYS = new Set(Object.keys(HOLIDAY_NAMES));
  // 現行シートの「自走＝会社理解、業界理解、…」をそのまま初期ジャンルにした
  const DEFAULT_GENRES = [
    { name: '会社理解', color: '#3b6fe0' }, { name: '業界理解', color: '#0e9aa7' }, { name: '他部署理解', color: '#7a5af8' },
    { name: '法律理解', color: '#d64545' }, { name: '数字理解', color: '#d98a1c' }, { name: '商材理解', color: '#2e9e5b' },
    { name: '顧客理解', color: '#d9479b' }, { name: '自己理解', color: '#8b6f47' }, { name: 'マインドセット', color: '#e0662f' },
    { name: 'キャッチの技術', color: '#5f8f1a' }, { name: '査定の技術', color: '#1f6f8b' }, { name: 'その他', color: '#7b8494' },
  ];
  // 取り込み時、ジャンル列が無いコマはタイトル・目的から推測する(あとで直せる)
  const GENRE_RULES = [
    [/オリエン|レク|朝礼|ランチ|昼食|休憩|振り返り|アンケート|テスト|ロープレ/, 'その他'],
    [/他部署|各部署|部署/, '他部署理解'], [/業界|リユース/, '業界理解'],
    [/コンプラ|法律|法務|契約書|古物|ルール/, '法律理解'], [/数字|KPI|経理|粗利|ロジックツリー/, '数字理解'],
    [/キャッチ/, 'キャッチの技術'], [/査定|ヒアリング|テスクロ|クロージング/, '査定の技術'],
    [/商材|商品|ブランド|貴金属/, '商材理解'], [/顧客|お客様/, '顧客理解'],
    [/マインド|目的意識|キャリア|ビジョン|理念/, 'マインドセット'], [/自己/, '自己理解'], [/会社|経営|社長/, '会社理解'],
  ];
  function guessGenre(title, extra) {
    for (const text of [title, `${title} ${extra || ''}`]) {
      for (const [re, g] of GENRE_RULES) if (re.test(text)) return g;
    }
    return '';
  }
  const SAMPLE_CSV = `,,,,,,,,,,,,,,,
,日程,会場,時間,分,担当,担当者,研修内容,テスト,目的,詳細,資料1,資料2,テスト,進捗,memo
,10/1,本社 会議室A,10:00-10:30,30,人事,担当A,オリエン,,研修全体のイメージを伝達する,研修の目的 スケジュール共有 自己紹介,オリエン.pptx,-,-,完了,
,木,,10:30-11:00,30,人事,担当A,レク,,チームの活性化,アイスブレイク,レク資料,-,-,完了,
,,,11:15-12:55,100,経営企画,担当B,業界理解,,業界知識の習得,市場の構造・成長背景を学ぶ,業界理解.pptx,-,-,完了,
,,,12:55-14:00,60,,,ランチ,,,,,,,,
,,,14:00-15:00,60,人事,担当C,会社理解,,会社と仕事への理解を深める,会社概要・ビジョン,会社理解.pptx,-,-,,
,,,15:15-16:00,45,各部署,担当D,部署紹介,,部署相互理解,各部署の役割,-,-,-,,
,10/2,本社 会議室A,10:00-10:15,15,人事,担当A,朝礼,,体を起こし研修のマインドを整える,挨拶/復習,-,-,-,,
,金,,10:15-11:30,75,営業,担当E,お客様理解,,ターゲット理解,"顧客の特徴、
事例紹介",顧客理解.pptx,,,,
,,,11:45-13:00,75,営業,担当E,ヒアリング講義,,ヒアリングの意図を理解する,講義と練習,,,,,
,10/5,商品部4階 会議室,,,,,,,,,,,,,
,月,,,,,,,,,,,,,,
,営業研修 査定,,,,,,,,,,,,,,
,10/6,本社 会議室A,10:00-10:15,15,人事,担当A,朝礼,,,,,,,,
,火,,10:15-18:00,,,ロープレ,テスト,,,,,,,,
,,,,120,営業オリエン,,テスト,,,,,,,,
,,,,60,ストアコンサル,,商材知識①,,,,,,,,
`;

  const $ = (id) => document.getElementById(id);
  let toastTimer = null;
  function notify(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
  }
  // 公開ページでは confirm() が使えないため、画面内のダイアログで確認する
  function askConfirm(message, okLabel = 'OK') {
    return new Promise((resolve) => {
      const dlg = $('confirmDlg');
      $('confirmMsg').textContent = message;
      $('confirmOk').textContent = okLabel;
      const done = (v) => { dlg.removeEventListener('cancel', onCancel); dlg.close(); resolve(v); };
      const onCancel = () => { dlg.removeEventListener('cancel', onCancel); resolve(false); };
      $('confirmOk').onclick = () => done(true);
      $('confirmCancel').onclick = () => done(false);
      dlg.addEventListener('cancel', onCancel);
      dlg.showModal();
    });
  }
  let view = 'list';      // list | month | year
  let calMonth = null;    // 表示中の月(その月の1日)
  let calFor = null;      // calMonth がどのスケジュール用か

  // ---------- 日付・時刻 ----------
  const pad = (n) => String(n).padStart(2, '0');
  const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fmtMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const ymOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const monthLabel = (ym) => { const [y, m] = ym.split('-'); return `${y}年${Number(m)}月`; };
  const nextYm = (ym) => { const [y, m] = ym.split('-').map(Number); return ymOf(new Date(y, m, 1)); };
  const jpDate = (s) => { const d = parseDate(s); return `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})`; };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const isBiz = (d, skipHol) => d.getDay() !== 0 && d.getDay() !== 6 && !(skipHol && HOLIDAYS.has(fmtDate(d)));
  function addBiz(d, n, skipHol) {
    const step = n < 0 ? -1 : 1;
    let r = new Date(d);
    for (let left = Math.abs(n); left > 0;) { r = addDays(r, step); if (isBiz(r, skipHol)) left--; }
    return r;
  }
  function bizDiff(a, b, skipHol) {
    const target = fmtDate(b), step = b > a ? 1 : -1;
    let r = new Date(a), n = 0;
    for (let guard = 0; fmtDate(r) !== target && guard < 4000; guard++) { r = addDays(r, step); if (isBiz(r, skipHol)) n += step; }
    return n;
  }

  const restLabel = (dateStr) => { const w = parseDate(dateStr).getDay(); return w === 0 ? '日曜' : w === 6 ? '土曜' : ''; };

  // ---------- 資料URL ----------
  const URL_LINE = /^(.*?)\s*(https?:\/\/\S+)\s*$/;
  const cleanTitle = (t) => t.replace(/[|｜:：\-–—]+$/, '').trim();
  const hostOf = (u) => { try { return new URL(u).hostname; } catch (e) { return u; } };
  function parseLinks(text) {
    const links = [], bad = [];
    text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((line) => {
      const m = URL_LINE.exec(line);
      if (!m) { bad.push(line); return; }
      try { links.push({ title: cleanTitle(m[1]), url: new URL(m[2]).href }); } catch (e) { bad.push(line); }
    });
    return { links, bad };
  }
  const linkLines = (links) => (links || []).map((l) => (l.title ? `${l.title} ${l.url}` : l.url));
  const linksHtml = (b) => (b.links && b.links.length
    ? `<div class="blk-links"><span class="lbl">資料</span>${b.links.map((l) =>
      `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.title || hostOf(l.url))}</a>`).join('')}</div>` : '');

  // ---------- データ ----------
  function newSchedule(name) {
    return { id: uid(), name, month: ymOf(new Date()), days: [], backlog: [], skipHolidays: false, defaultStart: '10:00', defaultGap: 15, endLimit: '18:00', history: [] };
  }
  function newBlock(o = {}) {
    return { id: uid(), title: '', minutes: 60, gap: 0, genre: '', dept: '', person: '', purpose: '', detail: '', materials: '', links: [],
      test: '', result: '', done: false, venue: '', memo: '', ...o };
  }
  function loadStore() {
    let st = null;
    try { st = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { /* 初回・破損時は初期化 */ }
    if (!(st && Array.isArray(st.schedules) && st.schedules.length)) {
      const sc = newSchedule('新しい研修スケジュール');
      st = { currentId: sc.id, schedules: [sc] };
    }
    if (!Array.isArray(st.genres)) st.genres = DEFAULT_GENRES.map((g) => ({ ...g }));
    st.schedules.forEach((sc) => {
      sc.history = sc.history || [];
      sc.month = sc.month || (sc.days && sc.days[0] ? sc.days[0].date.slice(0, 7) : ymOf(new Date()));
      if (!st.ver || st.ver < 3) sc.skipHolidays = false; // 祝日も研修を行う
    });
    st.ver = 3;
    return st;
  }
  let store = loadStore();
  const cur = () => store.schedules.find((s) => s.id === store.currentId) || store.schedules[0];
  const sortedSchedules = () => [...store.schedules].sort((a, b) => a.month.localeCompare(b.month) || (a.name || '').localeCompare(b.name || ''));
  const genreColor = (name) => (store.genres.find((g) => g.name === name) || {}).color || '#7b8494';
  let genreFilter = ''; // '' = すべて / '__none' = 未設定
  const matchGenre = (b) => !genreFilter || (genreFilter === '__none' ? !b.genre : b.genre === genreFilter);

  // 保存と変更履歴(変更前の状態を、編集10分ごと・大きな操作の前に残す)
  const CUR_KEY = 'training-schedule-current';
  const DEFAULT_NAME = '新しい研修スケジュール';
  let mode = 'local';   // local = このブラウザに保存 / shared = 共有データベース
  let readOnly = false;
  let flushTimer = null;
  function save() {
    if (mode === 'shared') {
      try { localStorage.setItem(CUR_KEY, store.currentId); } catch (e) { /* なくても動く */ }
      if (!readOnly) { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 250); }
      return;
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); return; } catch (e) {
        // 容量超過のときは古い履歴から減らす
        store.schedules.forEach((sc) => {
          const keep = sc.id === store.currentId ? Math.max(3, 10 - attempt * 4) : Math.max(1, 3 - attempt);
          if (sc.history.length > keep) sc.history = sc.history.slice(-keep);
        });
      }
    }
  }
  const contentOf = (sc) => ({ name: sc.name, month: sc.month, days: sc.days, backlog: sc.backlog,
    skipHolidays: sc.skipHolidays, defaultStart: sc.defaultStart, defaultGap: sc.defaultGap, endLimit: sc.endLimit });
  const contentJson = (sc) => JSON.stringify(contentOf(sc), (k, v) => (k && k[0] === '_' ? undefined : v));
  const lastJson = new Map();
  store.schedules.forEach((sc) => lastJson.set(sc.id, contentJson(sc)));
  const lastSnapT = new Map(), lastSnapJson = new Map();
  function pushSnap(sc, reason, json) {
    if (mode === 'shared') { sharedSnap(sc, reason, json); return; }
    const h = sc.history;
    if (h.length && h[h.length - 1].json === json) return;
    h.push({ t: Date.now(), reason, json });
    while (h.length > 30) h.shift();
  }
  const snap = (reason) => { const sc = cur(); pushSnap(sc, reason, contentJson(sc)); };
  function recordHistory(sc) {
    const json = contentJson(sc), prev = lastJson.get(sc.id);
    if (prev !== undefined && prev !== json) {
      const last = mode === 'shared' ? (lastSnapT.get(sc.id) || 0) : (sc.history.length ? sc.history[sc.history.length - 1].t : 0);
      if (Date.now() - last > 10 * 60 * 1000) pushSnap(sc, '編集前', prev);
    }
    lastJson.set(sc.id, json);
  }

  // 日の中のコマの時刻は「開始時刻 + 長さ + 空き」から毎回計算する(ここが組み直しを楽にする肝)
  function layout(day) {
    let t = toMin(day.start || '10:00');
    return day.blocks.map((b, i) => {
      if (i > 0) t += Math.max(0, Number(b.gap) || 0);
      const s = t;
      t += Math.max(0, Number(b.minutes) || 0);
      return { b, s, e: t };
    });
  }
  const effVenue = (day, b) => b.venue || day.venue || '';
  const sortDays = (s) => s.days.sort((a, b) => a.date.localeCompare(b.date));

  // ---------- 描画 ----------
  function render() {
    const s = cur();
    renderTop(s);
    renderBanner(s);
    $('daysView').innerHTML = s.days.length
      ? s.days.map((d, i) => dayHtml(s, d, i)).join('')
      : '<p class="empty">まだ日程がありません。「＋ 日を追加」か「取り込み」から始めてください。</p>';
    $('backlogList').innerHTML = s.backlog.length
      ? s.backlog.map((b) => backlogHtml(s, b)).join('')
      : '<p class="hint">なし</p>';
    renderSummary(s);
    $('daysView').hidden = view !== 'list';
    $('calView').hidden = view === 'list';
    $('calNav').hidden = view === 'list';
    $('mainLayout').classList.toggle('no-side', view === 'year');
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    if (view !== 'list') renderCal(s);
    document.body.classList.toggle('ro', readOnly);
    if (readOnly) {
      document.querySelectorAll('#daysView input, #daysView select, #daysView textarea, #backlogList input, #backlogList select')
        .forEach((el) => { el.disabled = true; });
    }
    $('schedName').disabled = readOnly;
    renderShareBar();
    if (mode === 'shared') fillNames();
  }

  function fillSchedSelect(s) {
    $('schedSelect').innerHTML = sortedSchedules().map((x) =>
      `<option value="${x.id}"${x.id === s.id ? ' selected' : ''}>${esc(monthLabel(x.month))}　${esc(x.name || '(無題)')}</option>`).join('');
  }
  function renderTop(s) {
    fillSchedSelect(s);
    const list = sortedSchedules(), i = list.findIndex((x) => x.id === s.id);
    $('schedPrev').disabled = i <= 0;
    $('schedNext').disabled = i >= list.length - 1;
    $('schedMonth').value = s.month;
    $('pastTag').hidden = s.month >= ymOf(new Date());
    if (document.activeElement !== $('schedName')) $('schedName').value = s.name;
    $('setSkipHol').checked = !!s.skipHolidays;
    $('setStart').value = s.defaultStart;
    $('setGap').value = s.defaultGap;
    $('setEnd').value = s.endLimit;
    renderGenreBar(s);
  }

  function renderGenreBar(s) {
    const tot = new Map();
    s.days.forEach((d) => d.blocks.forEach((b) => tot.set(b.genre || '', (tot.get(b.genre || '') || 0) + (Number(b.minutes) || 0))));
    const names = [...store.genres.map((g) => g.name), ...[...tot.keys()].filter((k) => k && !store.genres.some((g) => g.name === k)), ''];
    const chip = (key, label, color, mins, pressed) =>
      `<button type="button" class="chip" data-genre="${esc(key)}" style="--g:${color}" aria-pressed="${pressed}">${esc(label)}<small>${(mins / 60).toFixed(1)}h</small></button>`;
    let html = '<span class="hint" style="margin:0">ジャンル:</span>';
    html += names.filter((n) => tot.has(n)).map((n) =>
      chip(n || '__none', n || '未設定', n ? genreColor(n) : '#7b8494', tot.get(n), genreFilter === (n || '__none'))).join('');
    html += `<button type="button" class="small" id="btnGenres">ジャンル設定</button>`;
    if (genreFilter) html += `<button type="button" class="small" data-genre="">絞り込みを解除</button>`;
    $('genreBar').innerHTML = html;
  }

  function renderSummary(s) {
    const blocks = s.days.reduce((n, d) => n + d.blocks.length, 0);
    const mins = s.days.reduce((n, d) => n + d.blocks.reduce((m, b) => m + (Number(b.minutes) || 0), 0), 0);
    const done = s.days.reduce((n, d) => n + d.blocks.filter((b) => b.done).length, 0);
    $('summary').textContent = s.days.length
      ? `${s.days.length}日 / ${blocks}コマ(完了${done}) / 合計${(mins / 60).toFixed(1)}時間 / ${jpDate(s.days[0].date)}〜${jpDate(s.days[s.days.length - 1].date)}`
      : '';
  }

  function renderBanner(s) {
    const msgs = [];
    const seen = new Map();
    s.days.forEach((d) => seen.set(d.date, (seen.get(d.date) || 0) + 1));
    for (const [date, n] of seen) if (n > 1) msgs.push(`${jpDate(date)} が${n}日分重なっています(日付を直すか、内容を統合してください)`);
    s.days.forEach((d) => {
      const r = restLabel(d.date);
      if (r) msgs.push(`${jpDate(d.date)} は${r}です(研修日は基本平日です。意図した日なら、そのままで構いません)`);
    });
    const el = $('banner');
    el.hidden = !msgs.length;
    el.innerHTML = msgs.length ? '<b>⚠ 確認してください</b><ul>' + msgs.map((m) => `<li>${esc(m)}</li>`).join('') + '</ul>' : '';
  }

  function dayHtml(s, d, i) {
    const tl = layout(d);
    const end = tl.length ? tl[tl.length - 1].e : null;
    const over = end !== null && end > toMin(s.endLimit);
    const total = d.blocks.reduce((n, b) => n + (Number(b.minutes) || 0), 0);
    const dow = parseDate(d.date).getDay();
    const sum = tl.length
      ? `${fmtMin(tl[0].s)}–${fmtMin(end)} / ${total}分${over ? ` ⚠ ${s.endLimit}を超過` : ''}`
      : 'コマなし';
    return `<article class="day" data-day="${d.id}">
      <div class="day-head">
        <input type="date" data-f="date" value="${esc(d.date)}" aria-label="日付">
        <span class="dow dow-${dow}">(${DOW[dow]})</span>${HOLIDAY_NAMES[d.date] ? `<span class="hol-tag">${esc(HOLIDAY_NAMES[d.date])}</span>` : ''}
        <input class="section" data-f="section" value="${esc(d.section)}" placeholder="区分(例: 営業研修)" aria-label="区分">
        <label>会場<input class="venue" data-f="venue" value="${esc(d.venue)}" placeholder="例: 本社 会議室A"></label>
        <label>開始<input type="time" data-f="start" value="${esc(d.start)}"></label>
        <span class="by" data-by="${esc(d._by || '')}" data-at="${d._at || ''}"></span>
        <span class="day-sum${over ? ' over' : ''}">${esc(sum)}</span>
        <div class="day-actions">
          <details class="menu"><summary aria-label="この日の操作">⋯</summary>
            <div class="menu-body">
              <button type="button" data-act="day-shift" data-n="1">この日以降を1営業日 後ろへ</button>
              <button type="button" data-act="day-shift" data-n="-1">この日以降を1営業日 前へ</button>
              <button type="button" data-act="day-insert">この日の前に空白日を入れる(以降ずれる)</button>
              <button type="button" data-act="day-up"${i === 0 ? ' disabled' : ''}>内容を前の日と入れ替え</button>
              <button type="button" data-act="day-down"${i === s.days.length - 1 ? ' disabled' : ''}>内容を次の日と入れ替え</button>
              <button type="button" data-act="day-dup">この日を複製(翌営業日)</button>
              <button type="button" class="danger" data-act="day-del">この日を削除</button>
            </div>
          </details>
        </div>
      </div>
      <div class="blocks" data-drop="${d.id}">
        ${tl.map(({ b, s: bs, e: be }, idx) => blockHtml(d, b, bs, be, idx)).join('')}
      </div>
      <div class="day-foot"><button type="button" class="small" data-act="blk-add">＋ コマを追加</button></div>
    </article>`;
  }

  function blockHtml(d, b, bs, be, idx) {
    const v = effVenue(d, b);
    const meta = [b.dept, b.person, b.purpose, v && v !== d.venue ? `📍${v}` : ''].filter(Boolean).join(' / ');
    return `<div class="blk${b.done ? ' done' : ''}${matchGenre(b) ? '' : ' dim'}" data-block="${b.id}"${b.genre ? ` style="--g:${genreColor(b.genre)}"` : ''}>
      <span class="grip" title="ドラッグで移動">⋮⋮</span>
      <input type="checkbox" data-bf="done" ${b.done ? 'checked' : ''} aria-label="完了">
      <div class="blk-time">${fmtMin(bs)}–${fmtMin(be)}
        ${idx > 0 ? `<label class="gap">空き<input type="number" data-bf="gap" min="0" step="5" value="${Number(b.gap) || 0}">分</label>` : ''}
      </div>
      <div>
        <div class="blk-title">${esc(b.title)}${b.genre ? `<span class="tag genre">${esc(b.genre)}</span>` : ''}${b.test ? `<span class="tag test">${esc(b.test)}</span>` : ''}</div>
        ${meta ? `<div class="meta">${esc(meta)}</div>` : ''}
        ${linksHtml(b)}
      </div>
      <label class="mins"><input type="number" data-bf="minutes" min="5" step="5" value="${Number(b.minutes) || 0}">分</label>
      <div class="blk-actions">
        <button type="button" class="small" data-act="blk-up" title="上へ">↑</button>
        <button type="button" class="small" data-act="blk-down" title="下へ">↓</button>
        <button type="button" class="small" data-act="blk-edit">編集</button>
        <button type="button" class="small" data-act="blk-dup">複製</button>
        <button type="button" class="small" data-act="blk-unplace" title="未配置へ移す">外す</button>
        <button type="button" class="small danger" data-act="blk-del">削除</button>
      </div>
    </div>`;
  }

  function backlogHtml(s, b) {
    return `<div class="blk${matchGenre(b) ? '' : ' dim'}" data-block="${b.id}"${b.genre ? ` style="--g:${genreColor(b.genre)}"` : ''}>
      <span class="grip" title="ドラッグで移動">⋮⋮</span>
      <div><div class="blk-title">${esc(b.title)}${b.genre ? `<span class="tag genre">${esc(b.genre)}</span>` : ''}${b.test ? `<span class="tag test">${esc(b.test)}</span>` : ''}</div>
        <div class="meta">${esc([b.dept, b.person].filter(Boolean).join(' / '))}</div>${linksHtml(b)}</div>
      <label class="mins"><input type="number" data-bf="minutes" min="5" step="5" value="${Number(b.minutes) || 0}">分</label>
      <div class="b-sub">
        <select data-act="to-day" aria-label="日へ入れる"><option value="">日へ入れる…</option>
          ${s.days.map((d) => `<option value="${d.id}">${esc(jpDate(d.date))}</option>`).join('')}</select>
        <button type="button" class="small" data-act="blk-edit">編集</button>
        <button type="button" class="small danger" data-act="blk-del">削除</button>
      </div>
    </div>`;
  }


  // ---------- カレンダー ----------
  const WEEK_MON = [1, 2, 3, 4, 5, 6, 0]; // 月曜始まり
  let calWeekend = false;
  function ensureCal(s) {
    if (calFor !== s.id || !calMonth) {
      calFor = s.id;
      const [y, m] = s.month.split('-').map(Number);
      calMonth = new Date(y, m - 1, 1);
    }
  }
  function daysByDate(list) {
    const m = new Map();
    list.forEach((sc) => sc.days.forEach((d) => { if (!m.has(d.date)) m.set(d.date, []); m.get(d.date).push(d); }));
    return m;
  }
  // 表示月に対応する月のスケジュールがあれば、それに切り替える
  function syncScheduleToMonth() {
    const t = sortedSchedules().find((x) => x.month === ymOf(calMonth));
    if (t && t.id !== store.currentId) { store.currentId = t.id; calFor = t.id; }
  }
  function renderCal(s) {
    ensureCal(s);
    $('calWeekend').checked = calWeekend;
    const y = calMonth.getFullYear(), mo = calMonth.getMonth();
    $('calLabel').textContent = view === 'year' ? `${y}年` : `${y}年${mo + 1}月`;
    const pool = view === 'year' ? store.schedules : [s];
    const inRange = pool.flatMap((sc) => sc.days).filter((d) => { const x = parseDate(d.date); return x.getFullYear() === y && (view === 'year' || x.getMonth() === mo); });
    $('calStat').textContent = `研修 ${inRange.length}日 / ${inRange.reduce((n, d) => n + d.blocks.length, 0)}コマ`;
    $('calView').innerHTML = view === 'year' ? yearHtml(y) : monthHtml(s, y, mo);
  }

  function monthHtml(s, y, mo) {
    const by = daysByDate([s]);
    const first = new Date(y, mo, 1), lastD = new Date(y, mo + 1, 0).getDate();
    const hasWeekend = s.days.some((d) => { const x = parseDate(d.date); return x.getFullYear() === y && x.getMonth() === mo && (x.getDay() === 0 || x.getDay() === 6); });
    const cols = calWeekend || hasWeekend ? 7 : 5;
    const lead = (first.getDay() + 6) % 7;
    const weeks = Math.ceil((lead + lastD) / 7);
    const start = addDays(first, -lead);
    const todayKey = fmtDate(new Date());
    let rows = '', any = false;
    for (let w = 0; w < weeks; w++) {
      let row = '', inMonth = false;
      for (let c = 0; c < cols; c++) {
        const d = addDays(start, w * 7 + c), key = fmtDate(d), wd = d.getDay();
        if (d.getMonth() === mo) inMonth = true;
        const days = by.get(key) || [];
        if (days.length && d.getMonth() === mo) any = true;
        const hol = HOLIDAY_NAMES[key] || '';
        const cls = ['cal-cell', d.getMonth() !== mo ? 'out' : '', days.length ? 'has' : '', key === todayKey ? 'today' : ''].filter(Boolean).join(' ');
        const lines = [];
        days.forEach((day) => layout(day).forEach(({ b, s: bs }) => lines.push({ b, bs })));
        const MAX = 5;
        row += `<div class="${cls}" data-caldate="${key}"${days.length ? ` data-calday="${days[0].id}"${readOnly ? '' : ' draggable="true"'} title="クリックで詳細 / ドラッグで日付を移動"` : ''}>
          <div class="cal-top"><span class="cal-num dow-${hol ? 0 : wd}">${d.getDate()}</span>${hol ? `<span class="cal-hol">${esc(hol)}</span>` : ''}
            ${days.length ? '' : `<button type="button" class="cal-add" data-act="cal-add" data-date="${key}" aria-label="${d.getMonth() + 1}月${d.getDate()}日に研修日を追加">＋</button>`}</div>
          ${days.map((day) => `${day.section ? `<div class="cal-sec">${esc(day.section)}</div>` : ''}${day.venue ? `<div class="cal-venue">${esc(day.venue)}</div>` : ''}`).join('')}
          ${lines.slice(0, MAX).map(({ b, bs }) => `<div class="cal-line${b.done ? ' done' : ''}${b.test ? ' test' : ''}${matchGenre(b) ? '' : ' dim'}"${b.genre ? ` style="--g:${genreColor(b.genre)}"` : ''}><span class="dot"></span><span class="t">${fmtMin(bs)}</span> ${esc(b.title)}</div>`).join('')}
          ${lines.length > MAX ? `<div class="cal-more">ほか${lines.length - MAX}件</div>` : ''}
        </div>`;
      }
      if (inMonth) rows += row;
    }
    return `${any ? '' : '<p class="cal-empty">この月の研修日はありません。「＋ 月を追加」で前の月から作成するか、日付にカーソルを合わせて「＋」で追加してください。</p>'}
      <div class="cal-scroll"><div class="cal" style="grid-template-columns:repeat(${cols}, minmax(112px, 1fr)); min-width:${cols * 112}px">` +
      WEEK_MON.slice(0, cols).map((w) => `<div class="cal-dow dow-${w}">${DOW[w]}</div>`).join('') + rows + '</div></div>';
  }

  // 年間は全スケジュール(全月)の研修日をまとめて表示する
  function yearHtml(y) {
    const by = daysByDate(store.schedules);
    const todayKey = fmtDate(new Date());
    let html = '<div class="year">';
    for (let mo = 0; mo < 12; mo++) {
      const first = new Date(y, mo, 1), n = new Date(y, mo + 1, 0).getDate();
      let cells = WEEK_MON.map((w) => `<span class="mh dow-${w}">${DOW[w]}</span>`).join('') + '<span></span>'.repeat((first.getDay() + 6) % 7);
      let count = 0;
      for (let day = 1; day <= n; day++) {
        const d = new Date(y, mo, day), key = fmtDate(d), days = by.get(key) || [];
        const hol = HOLIDAY_NAMES[key];
        if (days.length) count++;
        const tip = days.length
          ? `${jpDate(key)} ${days.map((x) => { const t = layout(x); return `${t.length ? fmtMin(t[0].s) + '–' + fmtMin(t[t.length - 1].e) : ''} ${x.venue || ''} ${x.blocks.length}コマ`; }).join(' / ')}`
          : hol ? `${jpDate(key)} ${hol}` : '';
        cells += `<span class="mc dow-${hol ? 0 : d.getDay()}${days.length ? ' has' : ''}${key === todayKey ? ' today' : ''}"${tip ? ` title="${esc(tip)}"` : ''}>${day}</span>`;
      }
      html += `<button type="button" class="mini" data-month="${mo}"><h4>${mo + 1}月<small>${count ? `研修${count}日` : ''}</small></h4><div class="mini-grid">${cells}</div></button>`;
    }
    return html + '</div>';
  }

  function calNavigate(n) {
    calMonth = view === 'year' ? new Date(calMonth.getFullYear() + n, calMonth.getMonth(), 1) : new Date(calMonth.getFullYear(), calMonth.getMonth() + n, 1);
    if (view === 'month') syncScheduleToMonth();
    render();
  }
  function onCalClick(e) {
    const s = cur();
    const add = e.target.closest('[data-act="cal-add"]');
    if (add) {
      const last = s.days[s.days.length - 1];
      s.days.push({ id: uid(), date: add.dataset.date, venue: last ? last.venue : '', start: s.defaultStart, section: '', blocks: [] });
      sortDays(s);
      return commit();
    }
    const mini = e.target.closest('[data-month]');
    if (mini) { calMonth = new Date(calMonth.getFullYear(), Number(mini.dataset.month), 1); view = 'month'; syncScheduleToMonth(); return render(); }
    const cell = e.target.closest('[data-calday]');
    if (cell) {
      view = 'list';
      render();
      const el = document.querySelector(`[data-day="${cell.dataset.calday}"]`);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600); }
    }
  }

  // ---------- 月の追加 ----------
  function firstBizOfMonth(ym, skipHol) {
    const [y, m] = ym.split('-').map(Number);
    let d = new Date(y, m - 1, 1);
    while (!isBiz(d, skipHol)) d = addDays(d, 1);
    return d;
  }
  // ひな形の日程を、対象月の平日に割り振り直す(日と日の間隔は営業日数で保つ)
  function buildMonthSchedule(src, ym, name) {
    const sc = newSchedule(name);
    sc.month = ym;
    if (!src) return sc;
    Object.assign(sc, { skipHolidays: src.skipHolidays, defaultStart: src.defaultStart, defaultGap: src.defaultGap, endLimit: src.endLimit });
    const fresh = (b) => ({ ...b, id: uid(), done: false, result: '' });
    let prevOld = null, prevNew = null;
    [...src.days].sort((a, b) => a.date.localeCompare(b.date)).forEach((d) => {
      const nd = !prevOld ? firstBizOfMonth(ym, sc.skipHolidays)
        : addBiz(prevNew, Math.max(1, bizDiff(parseDate(prevOld.date), parseDate(d.date), sc.skipHolidays)), sc.skipHolidays);
      sc.days.push({ ...d, id: uid(), date: fmtDate(nd), blocks: d.blocks.map(fresh) });
      prevOld = d; prevNew = nd;
    });
    sc.backlog = src.backlog.map(fresh);
    return sc;
  }
  let nameDirty = false;
  function openMonthDialog() {
    const list = sortedSchedules(), latest = list[list.length - 1];
    $('mMonth').value = latest ? nextYm(latest.month) : ymOf(new Date());
    $('mSource').innerHTML = '<option value="">空のスケジュール</option>' +
      [...list].reverse().map((x) => `<option value="${x.id}">${esc(monthLabel(x.month))}　${esc(x.name || '(無題)')}</option>`).join('');
    $('mSource').value = latest ? latest.id : '';
    nameDirty = false;
    $('mName').value = `${$('mMonth').value.replace('-', '')}スケジュール`;
    updateMonthPreview();
    $('monthDlg').showModal();
  }
  function monthDraft() {
    const ym = $('mMonth').value;
    if (!ym) return null;
    return buildMonthSchedule(store.schedules.find((x) => x.id === $('mSource').value), ym, $('mName').value.trim());
  }
  function updateMonthPreview() {
    const sc = monthDraft(), el = $('mPreview');
    if (!sc) { el.textContent = '対象月を選んでください。'; return; }
    const blocks = sc.days.reduce((n, d) => n + d.blocks.length, 0);
    const spill = sc.days.filter((d) => d.date.slice(0, 7) !== sc.month).length;
    const dup = store.schedules.some((x) => x.month === sc.month);
    el.className = 'preview' + (spill || dup ? ' warn' : '');
    el.textContent = sc.days.length
      ? `${sc.days.length}日 / ${blocks}コマ(${jpDate(sc.days[0].date)}〜${jpDate(sc.days[sc.days.length - 1].date)})`
        + (spill ? ` ※月末を超える日が${spill}日あります。` : '') + (dup ? ` ※${monthLabel(sc.month)}のスケジュールは既にあります(別に追加されます)。` : '')
      : '空のスケジュールを作成します。' + (dup ? ` ※${monthLabel(sc.month)}のスケジュールは既にあります。` : '');
  }

  // ---------- 変更履歴 ----------
  const fmtTime = (t) => { const d = new Date(t); return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  let histItems = [];
  async function loadHistory() {
    const sc = cur();
    if (mode !== 'shared') return [...sc.history].reverse();
    const q = await dbx.collection('history').where('sid', '==', sc.id).orderBy('t', 'desc').limit(30).get();
    return q.docs.map((d) => JSON.parse(JSON.stringify(d.data())));
  }
  async function openHistory() {
    try { histItems = await loadHistory(); } catch (e) { return notify('履歴を読み込めませんでした。'); }
    const ids = [...new Set(histItems.map((x) => x.by).filter(Boolean))];
    const ps = userx && ids.length ? await userx.profiles(ids) : {};
    $('histList').innerHTML = histItems.length ? histItems.map((x, i) => {
      let c; try { c = JSON.parse(x.json); } catch (e) { return ''; }
      const who = x.by ? ` / ${esc((ps[x.by] && ps[x.by].name) || 'メンバー')}` : '';
      return `<li><div><b>${fmtTime(x.t)}</b> ${esc(x.reason)}${who}<div class="meta">${c.days.length}日 / ${c.days.reduce((n, d) => n + d.blocks.length, 0)}コマ / 未配置${c.backlog.length}</div></div>
        <button type="button" class="small" data-hist="${i}">この状態に戻す</button></li>`;
    }).join('') : '<li class="hint">まだ履歴がありません。編集すると、変更前の状態が自動で残ります。</li>';
    $('histDlg').showModal();
  }
  async function restoreSnap(i) {
    const sc = cur(), x = histItems[i];
    if (!x || !(await askConfirm('この時点の状態に戻しますか?(戻す前の状態も履歴に残ります)', '戻す'))) return;
    pushSnap(sc, '復元前', contentJson(sc));
    Object.assign(sc, JSON.parse(x.json));
    lastJson.set(sc.id, contentJson(sc));
    $('histDlg').close();
    save();
    render();
  }

  // ---------- ジャンル設定 ----------
  let genreRows = [];
  function renderGenreRows() {
    $('genreRows').innerHTML = genreRows.map((r, i) => `<div class="genre-row">
      <input type="color" data-gi="${i}" data-gf="color" value="${esc(r.color)}" aria-label="色">
      <input data-gi="${i}" data-gf="name" value="${esc(r.name)}" placeholder="ジャンル名" aria-label="ジャンル名">
      <button type="button" class="small danger" data-gdel="${i}">削除</button></div>`).join('');
  }
  function openGenreDialog() {
    genreRows = store.genres.map((g) => ({ orig: g.name, name: g.name, color: g.color }));
    renderGenreRows();
    $('genreDlg').showModal();
  }
  function saveGenres() {
    const seen = new Set(), rows = [];
    genreRows.forEach((r) => { const name = r.name.trim(); if (name && !seen.has(name)) { seen.add(name); rows.push({ ...r, name }); } });
    const renames = new Map(rows.filter((r) => r.orig && r.orig !== r.name).map((r) => [r.orig, r.name]));
    if (renames.size) {
      store.schedules.forEach((sc) => [...sc.days.flatMap((d) => d.blocks), ...sc.backlog].forEach((b) => { if (renames.has(b.genre)) b.genre = renames.get(b.genre); }));
      if (renames.has(genreFilter)) genreFilter = renames.get(genreFilter);
    }
    store.genres = rows.map((r) => ({ name: r.name, color: r.color }));
    $('genreDlg').close();
    commit();
  }

  // ---------- 操作 ----------
  function findBlock(id) {
    const s = cur();
    for (const d of s.days) { const i = d.blocks.findIndex((b) => b.id === id); if (i >= 0) return { list: d.blocks, i, day: d }; }
    const i = s.backlog.findIndex((b) => b.id === id);
    return i >= 0 ? { list: s.backlog, i, day: null } : null;
  }
  function listOf(target) {
    const s = cur();
    return target === 'backlog' ? s.backlog : (s.days.find((d) => d.id === target) || {}).blocks;
  }
  function moveBlock(id, target, index) {
    const found = findBlock(id), dest = listOf(target);
    if (!found || !dest) return;
    const [blk] = found.list.splice(found.i, 1);
    let idx = index;
    if (found.list === dest && found.i < idx) idx--;
    dest.splice(Math.max(0, Math.min(idx, dest.length)), 0, blk);
  }
  function commit() { if (readOnly) { render(); return; } recordHistory(cur()); save(); render(); }

  function addDay(s) {
    const last = s.days[s.days.length - 1];
    const date = last ? fmtDate(addBiz(parseDate(last.date), 1, s.skipHolidays)) : fmtDate(new Date());
    s.days.push({ id: uid(), date, venue: last ? last.venue : '', start: s.defaultStart, section: '', blocks: [] });
  }
  function shiftDays(s, from, n) {
    for (let i = from; i < s.days.length; i++) s.days[i].date = fmtDate(addBiz(parseDate(s.days[i].date), n, s.skipHolidays));
  }
  function swapDayContents(s, i, j) {
    const a = s.days[i], b = s.days[j];
    if (!a || !b) return;
    ['blocks', 'venue', 'start', 'section'].forEach((k) => { const t = a[k]; a[k] = b[k]; b[k] = t; });
  }
  const stripId = (b) => { const { id, ...rest } = b; return rest; };
  const cloneBlock = (b) => ({ ...b, id: uid(), done: false });

  async function onClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.tagName === 'SELECT') return;
    const s = cur();
    const dayEl = btn.closest('[data-day]');
    const day = dayEl && s.days.find((d) => d.id === dayEl.dataset.day);
    const blkEl = btn.closest('[data-block]');
    const act = btn.dataset.act;
    if (act.startsWith('day-') && day) {
      const i = s.days.indexOf(day);
      snap({ 'day-shift': '日をずらす前', 'day-insert': '空白日を入れる前', 'day-up': '内容の入れ替え前', 'day-down': '内容の入れ替え前', 'day-dup': '日の複製前', 'day-del': '日の削除前' }[act]);
      if (act === 'day-shift') shiftDays(s, i, Number(btn.dataset.n));
      if (act === 'day-insert') {
        s.days.splice(i, 0, { id: uid(), date: day.date, venue: day.venue, start: day.start, section: '', blocks: [] });
        shiftDays(s, i + 1, 1);
      }
      if (act === 'day-up') swapDayContents(s, i, i - 1);
      if (act === 'day-down') swapDayContents(s, i, i + 1);
      if (act === 'day-dup') {
        s.days.splice(i + 1, 0, { ...day, id: uid(), date: fmtDate(addBiz(parseDate(day.date), 1, s.skipHolidays)), blocks: day.blocks.map(cloneBlock) });
      }
      if (act === 'day-del') {
        if (!(await askConfirm(`${jpDate(day.date)} を削除しますか?(コマ${day.blocks.length}件も消えます。変更履歴から戻せます)`, '削除する'))) return;
        s.days.splice(i, 1);
      }
      return commit();
    }
    if (act === 'blk-add' && day) return openBlockDialog(null, day.id);
    if (!blkEl) return;
    const id = blkEl.dataset.block, f = findBlock(id);
    if (!f) return;
    if (act === 'blk-edit') return openBlockDialog(f.list[f.i], f.day ? f.day.id : 'backlog');
    if (act === 'blk-up' && f.i > 0) moveBlock(id, f.day.id, f.i - 1);
    if (act === 'blk-down' && f.i < f.list.length - 1) moveBlock(id, f.day.id, f.i + 2);
    if (act === 'blk-dup') f.list.splice(f.i + 1, 0, cloneBlock(f.list[f.i]));
    if (act === 'blk-unplace' && f.day) moveBlock(id, 'backlog', s.backlog.length);
    if (act === 'blk-del') {
      if (!(await askConfirm(`「${f.list[f.i].title}」を削除しますか?(変更履歴から戻せます)`, '削除する'))) return;
      snap('コマ削除前');
      f.list.splice(f.i, 1);
    }
    commit();
  }

  function onChange(e) {
    const t = e.target, s = cur();
    if (t.matches('select[data-act="to-day"]')) {
      if (!t.value) return;
      const id = t.closest('[data-block]').dataset.block;
      const d = s.days.find((x) => x.id === t.value);
      moveBlock(id, d.id, d.blocks.length);
      return commit();
    }
    const dayEl = t.closest('[data-day]');
    if (t.dataset.f && dayEl) {
      const d = s.days.find((x) => x.id === dayEl.dataset.day);
      if (!d) return;
      if (t.dataset.f === 'date' && !t.value) return render();
      if (t.dataset.f === 'start' && !t.value) return render();
      d[t.dataset.f] = t.value;
      if (t.dataset.f === 'date') sortDays(s);
      return commit();
    }
    const blkEl = t.closest('[data-block]');
    if (t.dataset.bf && blkEl) {
      const f = findBlock(blkEl.dataset.block);
      if (!f) return;
      const b = f.list[f.i];
      if (t.dataset.bf === 'done') b.done = t.checked;
      else b[t.dataset.bf] = Math.max(t.dataset.bf === 'minutes' ? 5 : 0, parseInt(t.value, 10) || 0);
      commit();
    }
  }

  // ---------- ドラッグ&ドロップ ----------
  let dragId = null, dragDay = null;
  function dropOnDate(key) {
    const s = cur(), by = daysByDate(s);
    snap('カレンダーで移動する前');
    if (dragDay) {
      const a = s.days.find((d) => d.id === dragDay), target = by.get(key);
      if (!a || a.date === key) return;
      if (target) { const t = target[0]; [a.date, t.date] = [t.date, a.date]; } else a.date = key;
      sortDays(s);
    } else if (dragId) {
      let day = (by.get(key) || [])[0];
      if (!day) {
        const last = s.days[s.days.length - 1];
        day = { id: uid(), date: key, venue: last ? last.venue : '', start: s.defaultStart, section: '', blocks: [] };
        s.days.push(day);
        sortDays(s);
      }
      moveBlock(dragId, day.id, day.blocks.length);
    }
  }
  function dropIndex(container, y) {
    const kids = [...container.querySelectorAll(':scope > [data-block]')];
    const i = kids.findIndex((k) => { const r = k.getBoundingClientRect(); return y < r.top + r.height / 2; });
    return { kids, index: i < 0 ? kids.length : i };
  }
  function clearDropMarks() {
    document.querySelectorAll('.drop-target,.insert-before,.insert-end,.dragging').forEach((el) =>
      el.classList.remove('drop-target', 'insert-before', 'insert-end', 'dragging'));
  }
  document.addEventListener('mousedown', (e) => {
    const g = e.target.closest && e.target.closest('.grip');
    if (g) g.closest('[data-block]').draggable = true;
  });
  document.addEventListener('dragstart', (e) => {
    const cellEl = e.target.closest && e.target.closest('[data-calday]');
    if (cellEl) {
      dragDay = cellEl.dataset.calday;
      e.dataTransfer.setData('text/plain', dragDay);
      e.dataTransfer.effectAllowed = 'move';
      cellEl.classList.add('dragging');
      return;
    }
    const el = e.target.closest && e.target.closest('[data-block]');
    if (!el || !el.draggable) return;
    dragId = el.dataset.block;
    e.dataTransfer.setData('text/plain', dragId);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
  });
  document.addEventListener('dragend', () => {
    dragId = null; dragDay = null;
    document.querySelectorAll('[data-block]').forEach((el) => { el.draggable = false; });
    clearDropMarks();
  });
  document.addEventListener('dragover', (e) => {
    const cell = (dragId || dragDay) && e.target.closest && e.target.closest('[data-caldate]');
    if (cell) {
      e.preventDefault();
      document.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
      cell.classList.add('drop-target');
      return;
    }
    const box = dragId && e.target.closest && e.target.closest('[data-drop]');
    if (!box) return;
    e.preventDefault();
    document.querySelectorAll('.insert-before,.insert-end').forEach((el) => el.classList.remove('insert-before', 'insert-end'));
    box.classList.add('drop-target');
    const { kids, index } = dropIndex(box, e.clientY);
    (kids[index] || box).classList.add(kids[index] ? 'insert-before' : 'insert-end');
  });
  document.addEventListener('drop', (e) => {
    const cell = (dragId || dragDay) && e.target.closest && e.target.closest('[data-caldate]');
    if (cell) {
      e.preventDefault();
      dropOnDate(cell.dataset.caldate);
      dragId = null; dragDay = null;
      clearDropMarks();
      return commit();
    }
    const box = dragId && e.target.closest && e.target.closest('[data-drop]');
    if (!box) return;
    e.preventDefault();
    moveBlock(dragId, box.dataset.drop, dropIndex(box, e.clientY).index);
    dragId = null;
    clearDropMarks();
    commit();
  });

  // ---------- コマ編集ダイアログ ----------
  let editing = null; // { id|null, target }
  const FIELDS = { eTitle: 'title', eMinutes: 'minutes', eGap: 'gap', eVenue: 'venue', eDept: 'dept', ePerson: 'person',
    eGenre: 'genre', ePurpose: 'purpose', eDetail: 'detail', eMaterials: 'materials', eTest: 'test', eResult: 'result', eMemo: 'memo' };
  function openBlockDialog(block, target) {
    const s = cur();
    const isNew = !block;
    const b = block || newBlock({ gap: s.defaultGap });
    editing = { id: isNew ? null : b.id, target };
    const names = store.genres.map((g) => g.name);
    if (b.genre && !names.includes(b.genre)) names.push(b.genre);
    $('eGenre').innerHTML = '<option value="">(未設定)</option>' + names.map((n) => `<option>${esc(n)}</option>`).join('');
    $('blockDlgTitle').textContent = isNew ? 'コマを追加' : 'コマを編集';
    for (const [id, key] of Object.entries(FIELDS)) $(id).value = b[key] ?? '';
    $('eDone').checked = !!b.done;
    $('eLinks').value = linkLines(b.links).join('\n');
    $('eLinksErr').hidden = true;
    $('blockDlg').showModal();
    $('eTitle').focus();
  }
  $('blockForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {};
    for (const [id, key] of Object.entries(FIELDS)) data[key] = $(id).value.trim();
    data.minutes = Math.max(5, parseInt(data.minutes, 10) || 60);
    data.gap = Math.max(0, parseInt(data.gap, 10) || 0);
    data.done = $('eDone').checked;
    const parsed = parseLinks($('eLinks').value);
    if (parsed.bad.length) {
      $('eLinksErr').textContent = `URLとして読み取れない行があります(http:// または https:// で始まるURLを入れてください): ${parsed.bad[0]}`;
      $('eLinksErr').hidden = false;
      return;
    }
    data.links = parsed.links;
    if (editing.id) {
      const f = findBlock(editing.id);
      if (f) Object.assign(f.list[f.i], data);
    } else {
      const list = listOf(editing.target);
      if (list) list.push(newBlock(data));
    }
    $('blockDlg').close();
    commit();
  });
  $('blockCancel').addEventListener('click', () => $('blockDlg').close());

  // ---------- スプレッドシート互換(取り込み/書き出し) ----------
  function parseDelimited(text, delim) {
    const rows = [];
    let row = [], cell = '', inQ = false;
    text = text.replace(/^\ufeff/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; } else cell += c;
      } else if (c === '"' && cell === '') inQ = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function detectDelim(text) {
    const head = text.split('\n').slice(0, 5).join('\n');
    return (head.match(/\t/g) || []).length > (head.match(/,/g) || []).length ? '\t' : ',';
  }

  // 既存シートの列構成: 日程/会場/時間/分/担当/担当者/研修内容/テスト/目的/詳細/資料1/資料2/テスト(結果)/進捗/memo
  function parseSheetRows(rows, year) {
    const H = { 日程: 1, 会場: 2, 時間: 3, 分: 4, 担当: 5, 担当者: 6, 研修内容: 7, test: 8, 目的: 9, 詳細: 10, 資料1: 11, 資料2: 12, result: 13, 進捗: 14, memo: 15 };
    const hi = rows.findIndex((r) => r.some((c) => c.trim() === '時間') && r.some((c) => c.trim() === '研修内容'));
    if (hi >= 0) {
      let seenTest = false;
      rows[hi].forEach((c, i) => {
        c = c.trim();
        if (!c) return;
        if (c === 'テスト') { if (!seenTest) { H.test = i; seenTest = true; } else H.result = i; } else if (c === 'ジャンル' || c === '分類') H.genre = i; else if (c in H) H[c] = i;
      });
    }
    const g = (r, k) => (r[H[k]] || '').trim();
    const dash = (v) => (v === '-' || v === '－' ? '' : v);
    // 資料セル: URLを含む行は資料URL、それ以外は資料メモにする
    const parseMaterials = (cells) => {
      const texts = [], links = [];
      cells.map(dash).filter(Boolean).forEach((cell) => cell.split(/\n| \/ /).map((x) => x.trim()).filter(Boolean).forEach((seg) => {
        const m = URL_LINE.exec(seg);
        if (m) { try { links.push({ title: cleanTitle(m[1]), url: new URL(m[2]).href }); return; } catch (e) { /* 文字として扱う */ } }
        texts.push(seg);
      }));
      return { materials: texts.join(' / '), links };
    };
    const TIME = /(\d{1,2}):(\d{2})\s*[-–—~〜ー－]\s*(\d{1,2}):(\d{2})/;
    const DATE = /^(?:(\d{4})[/.-])?(\d{1,2})[/.-](\d{1,2})$/;
    const days = [], backlog = [];
    let day = null, section = '';

    rows.slice(hi + 1).forEach((r) => {
      const dcell = g(r, '日程'), tm = TIME.exec(g(r, '時間'));
      const dm = DATE.exec(dcell);
      if (dm) {
        const y = dm[1] ? Number(dm[1]) : year;
        day = { id: uid(), date: `${y}-${pad(dm[2])}-${pad(dm[3])}`, venue: g(r, '会場'), start: '10:00', section, blocks: [] };
        section = '';
        days.push(day);
      } else if (dcell && !/^[日月火水木金土]$/.test(dcell)) {
        section = dcell; // 「各部署研修」などの区分見出し行
      }
      const title = g(r, '研修内容');
      if (tm) {
        const s = toMin(`${tm[1]}:${tm[2]}`), e = toMin(`${tm[3]}:${tm[4]}`);
        const b = newBlock({
          title: title || g(r, '目的') || '(無題)', minutes: Math.max(5, e - s), dept: g(r, '担当'), person: g(r, '担当者'),
          test: dash(g(r, 'test')), purpose: g(r, '目的'), detail: g(r, '詳細'),
          ...parseMaterials([g(r, '資料1'), g(r, '資料2')]),
          result: dash(g(r, 'result')), done: g(r, '進捗') === '完了', memo: g(r, 'memo'),
          genre: g(r, 'genre') || guessGenre(title || g(r, '目的'), g(r, '目的')),
          venue: !dm && g(r, '会場') && day && g(r, '会場') !== day.venue ? g(r, '会場') : '',
        });
        b._s = s; b._e = e;
        if (day) day.blocks.push(b); else backlog.push(b);
      } else if (!dcell && !g(r, '会場') && parseInt(g(r, '分'), 10) > 0) {
        // 時刻の入っていない行 = まだ配置していないコマ
        const mins = parseInt(g(r, '分'), 10);
        const dept = g(r, '担当');
        backlog.push(newBlock({ title: title || dept || '(無題)', dept: title ? dept : '', person: g(r, '担当者'), minutes: mins, test: dash(g(r, 'test')),
          purpose: g(r, '目的'), detail: g(r, '詳細'), memo: g(r, 'memo'), ...parseMaterials([g(r, '資料1'), g(r, '資料2')]),
          genre: g(r, 'genre') || guessGenre(title || dept, g(r, '目的')) }));
      }
    });
    // 時刻 → 「開始時刻 + 長さ + 空き」に変換
    days.forEach((d) => {
      d.blocks.forEach((b, i) => {
        if (i === 0) d.start = fmtMin(b._s);
        else b.gap = Math.max(0, b._s - d.blocks[i - 1]._e);
      });
      d.blocks.forEach((b) => { delete b._s; delete b._e; });
    });
    return { days, backlog };
  }

  const matCell = (b) => [b.materials, ...linkLines(b.links)].filter(Boolean).join('\n');
  function buildRows(s) {
    const rows = [['', '日程', '会場', '時間', '分', '担当', '担当者', '研修内容', 'テスト', '目的', '詳細', '資料1', '資料2', 'テスト', '進捗', 'memo', 'ジャンル']];
    const md = (d) => { const x = parseDate(d); return `${x.getMonth() + 1}/${x.getDate()}`; };
    s.days.forEach((d) => {
      if (d.section) rows.push(['', d.section]);
      const wd = DOW[parseDate(d.date).getDay()];
      const tl = layout(d);
      if (!tl.length) { rows.push(['', md(d.date), d.venue], ['', wd]); return; }
      tl.forEach(({ b, s: bs, e: be }, i) => {
        const v = effVenue(d, b);
        rows.push(['', i === 0 ? md(d.date) : i === 1 ? wd : '', i === 0 ? d.venue : (v !== d.venue ? v : ''),
          `${fmtMin(bs)}-${fmtMin(be)}`, b.minutes, b.dept, b.person, b.title, b.test, b.purpose, b.detail, matCell(b), '', b.result, b.done ? '完了' : '', b.memo, b.genre]);
      });
      if (tl.length === 1) rows.push(['', wd]);
    });
    s.backlog.forEach((b) => rows.push(['', '', '', '', b.minutes, b.dept, b.person, b.title, b.test, b.purpose, b.detail, matCell(b), '', b.result, '', b.memo, b.genre]));
    return rows;
  }
  const toDelimited = (rows, delim) => rows.map((r) => r.map((v) => {
    v = String(v ?? '');
    return /["\n\r\t,]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(delim)).join('\r\n');

  function download(filename, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const baseName = () => (cur().name || '研修スケジュール').replace(/[\\/:*?"<>|]/g, '_');

  function exportIcs() {
    const e2 = (v) => String(v ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const dt = (date, m) => date.replace(/-/g, '') + 'T' + fmtMin(m).replace(':', '') + '00';
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//training-schedule//JA', 'CALSCALE:GREGORIAN'];
    cur().days.forEach((d) => layout(d).forEach(({ b, s, e }) => {
      out.push('BEGIN:VEVENT', `UID:${b.id}@training-schedule`, `DTSTAMP:${now}`, `DTSTART:${dt(d.date, s)}`, `DTEND:${dt(d.date, e)}`, `SUMMARY:${e2(b.title)}`);
      if (effVenue(d, b)) out.push(`LOCATION:${e2(effVenue(d, b))}`);
      const desc = [b.dept && b.person ? `${b.dept} ${b.person}` : b.dept || b.person, b.purpose, b.detail, ...(b.links || []).map((l) => `${l.title || '資料'}: ${l.url}`)].filter(Boolean).join('\n');
      if (desc) out.push(`DESCRIPTION:${e2(desc)}`);
      if (b.genre) out.push(`CATEGORIES:${e2(b.genre)}`);
      if (b.links && b.links[0]) out.push(`URL:${b.links[0].url}`);
      out.push('END:VEVENT');
    }));
    out.push('END:VCALENDAR');
    download(`${baseName()}.ics`, out.join('\r\n'), 'text/calendar;charset=utf-8');
  }

  // 現在のスケジュールが空なら、それを置き換える(空のスケジュールが残らないように)
  function placeImported(sc) {
    const s = cur();
    if (!s.days.length && !s.backlog.length) store.schedules = store.schedules.filter((x) => x.id !== s.id);
    sc.month = sc.month || (sc.days[0] ? sc.days[0].date.slice(0, 7) : ymOf(new Date()));
    sc.history = [];
    // シート側のジャンル名が未登録なら追加する
    [...sc.days.flatMap((d) => d.blocks), ...sc.backlog].forEach((b) => {
      if (b.genre && !store.genres.some((g) => g.name === b.genre)) store.genres.push({ name: b.genre, color: '#7b8494' });
    });
    store.schedules.push(sc);
    store.currentId = sc.id;
  }
  function addImported(parsed) {
    const sc = newSchedule('');
    sc.days = parsed.days;
    sc.backlog = parsed.backlog;
    sc.month = parsed.days[0] ? parsed.days[0].date.slice(0, 7) : ymOf(new Date());
    sc.name = `${sc.month.replace('-', '')}スケジュール`;
    placeImported(sc);
    commit();
  }

  function doImport() {
    const text = $('importText').value;
    if (!text.trim()) return notify('貼り付けるか、ファイルを選んでください。');
    const year = parseInt($('importYear').value, 10) || new Date().getFullYear();
    if (text.trim().startsWith('{')) {
      try {
        const o = JSON.parse(text);
        if (!o || !Array.isArray(o.days)) throw new Error('形式が正しくありません');
        const sc = { ...newSchedule(o.name || '取り込み'), ...o, id: uid(), history: [] };
        sc.days = o.days.map((d) => ({ ...d, id: uid(), blocks: (d.blocks || []).map((b) => newBlock(stripId(b))) }));
        sc.backlog = (o.backlog || []).map((b) => newBlock(stripId(b)));
        placeImported(sc);
        $('importDlg').close();
        return commit();
      } catch (err) { return notify('読み込みに失敗しました: ' + err.message); }
    }
    const parsed = parseSheetRows(parseDelimited(text, detectDelim(text)), year);
    if (!parsed.days.length && !parsed.backlog.length) return notify('日程を読み取れませんでした。見出し行(日程・会場・時間…)を含めてコピーしてください。');
    $('importDlg').close();
    addImported(parsed);
  }


  // ---------- 共有(claude.ai の共有データベース) ----------
  // 文書: schedules/{id}(月ごとの設定) / days/{id}(1日分のコマ) / backlogs/{scheduleId}(未配置) /
  //       meta/genres(ジャンル) / history/{auto}(変更前の状態)。日ごとに分けて、別の日の編集がぶつからないようにする。
  let dbx = null, userx = null, myId = null, placeholder = null;
  let flushing = false, flushAgain = false, needRebuild = false, initialApplied = false;
  const shadow = new Map();   // 文書パス -> こちらが把握しているサーバー側の内容
  const remote = { schedules: new Map(), days: new Map(), backlogs: new Map(), genres: null };
  const loaded = { schedules: false, days: false, backlogs: false, genres: false };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const stable = (v) => JSON.stringify(v, (k, x) => {
    if (k && k[0] === '_') return undefined;
    return x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => { o[kk] = x[kk]; return o; }, {}) : x;
  });
  const normBlock = (b) => ({ ...newBlock(), ...b });
  const canon = {
    schedules: (d) => ({ name: d.name || '', month: d.month || ymOf(new Date()), skipHolidays: !!d.skipHolidays,
      defaultStart: d.defaultStart || '10:00', defaultGap: Number.isFinite(d.defaultGap) ? d.defaultGap : 15, endLimit: d.endLimit || '18:00' }),
    days: (d) => ({ sid: d.sid, date: d.date, venue: d.venue || '', start: d.start || '10:00', section: d.section || '', blocks: (d.blocks || []).map(normBlock) }),
    backlogs: (d) => ({ blocks: (d.blocks || []).map(normBlock) }),
  };
  const isBlankDraft = (sc) => !sc.days.length && !sc.backlog.length && sc.name === DEFAULT_NAME;
  const isTyping = () => { const a = document.activeElement; return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !!a.closest('#daysView, #backlogList'); };

  function setSync(kind, e) {
    const el = $('syncTag');
    el.classList.toggle('err', kind === 'error');
    el.textContent = { loading: '読み込み中…', saving: '保存中…', saved: '共有に保存しました', '': '' }[kind] ?? '';
    if (kind === 'error') {
      el.textContent = e && e.code === 'quota_exceeded' ? '共有の保存容量がいっぱいです。変更はまだ共有されていません。'
        : `共有への保存に失敗しました(${(e && e.code) || 'error'})。変更はまだ共有されていません。`;
      console.warn(e);
    }
  }

  // ローカルの内容とサーバー側(shadow)の差分だけを書き込む
  async function flushOnce() {
    const want = new Map();
    store.schedules.forEach((sc) => {
      if (isBlankDraft(sc)) return;
      want.set(`schedules/${sc.id}`, canon.schedules(sc));
      sc.days.forEach((d) => want.set(`days/${d.id}`, canon.days({ ...d, sid: sc.id })));
      if (sc.backlog.length || shadow.has(`backlogs/${sc.id}`)) want.set(`backlogs/${sc.id}`, canon.backlogs({ blocks: sc.backlog }));
    });
    want.set('meta/genres', { list: store.genres });
    const ops = [];
    for (const [path, data] of want) { const j = stable(data); if (shadow.get(path) !== j) ops.push({ path, j }); }
    for (const path of [...shadow.keys()]) if (!want.has(path)) ops.push({ path, j: null });
    for (const op of ops) {
      const [kind, id] = op.path.split('/');
      const ref = dbx.doc(op.path);
      if (op.j === null) {
        await ref.delete();
        shadow.delete(op.path);
        if (remote[kind] instanceof Map) remote[kind].delete(id);
      } else {
        const data = JSON.parse(op.j), at = Date.now();
        await ref.set({ ...data, by: myId, at });
        shadow.set(op.path, op.j);
        if (kind === 'meta') remote.genres = { data };
        else remote[kind].set(id, { data, by: myId, at });
      }
    }
  }
  async function flush() {
    flushTimer = null;
    if (flushing) { flushAgain = true; return; }
    flushing = true;
    setSync('saving');
    try {
      do { flushAgain = false; await flushOnce(); } while (flushAgain && !flushTimer);
      setSync('saved');
    } catch (e) { setSync('error', e); }
    flushing = false;
    if (needRebuild && !flushTimer) applyRemote();
  }

  // 他の人の変更を取り込む
  function onDocs(kind, snapshot) {
    let changed = false;
    snapshot.docChanges().forEach((ch) => {
      const id = ch.doc.id;
      if (ch.type === 'removed') { if (remote[kind].delete(id)) changed = true; return; }
      const { by, at, ...rest } = clone(ch.doc.data() || {});
      const data = canon[kind](rest), prev = remote[kind].get(id);
      remote[kind].set(id, { data, by, at });
      if (!prev || stable(prev.data) !== stable(data)) changed = true;
    });
    loaded[kind] = true;
    if (changed || !initialApplied) applyRemote();
  }
  function onGenres(snapshot) {
    const prev = remote.genres ? stable(remote.genres.data) : null;
    const { by, at, ...rest } = snapshot.exists ? clone(snapshot.data()) : {};
    remote.genres = snapshot.exists && Array.isArray(rest.list) ? { data: { list: rest.list } } : null;
    loaded.genres = true;
    if ((remote.genres ? stable(remote.genres.data) : null) !== prev || !initialApplied) applyRemote();
  }
  function applyRemote() {
    if (!Object.values(loaded).every(Boolean)) return;
    if (flushTimer || flushing) { needRebuild = true; return; }
    if (isTyping()) { setTimeout(applyRemote, 700); return; }
    needRebuild = false;
    const prevCur = store.currentId;
    const scheds = [...remote.schedules].map(([id, { data }]) => ({ id, ...data, history: [], days: [], backlog: [] }));
    const byId = new Map(scheds.map((x) => [x.id, x]));
    remote.days.forEach(({ data, by, at }, id) => {
      const sc = byId.get(data.sid);
      if (sc) sc.days.push({ id, date: data.date, venue: data.venue, start: data.start, section: data.section, blocks: data.blocks, _by: by, _at: at });
    });
    scheds.forEach((sc) => {
      sc.days.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
      const bl = remote.backlogs.get(sc.id);
      sc.backlog = bl ? bl.data.blocks : [];
    });
    if (remote.genres) store.genres = remote.genres.data.list;
    if (!scheds.length) { placeholder = placeholder || newSchedule(DEFAULT_NAME); scheds.push(placeholder); }
    store.schedules = scheds;
    let saved = prevCur;
    if (!initialApplied) { try { saved = localStorage.getItem(CUR_KEY); } catch (e) { saved = null; } }
    const now = ymOf(new Date());
    store.currentId = (scheds.find((x) => x.id === saved) || scheds.find((x) => x.month === now) || sortedSchedules().slice(-1)[0]).id;
    shadow.clear();
    remote.schedules.forEach(({ data }, id) => shadow.set(`schedules/${id}`, stable(data)));
    remote.days.forEach(({ data }, id) => shadow.set(`days/${id}`, stable(data)));
    remote.backlogs.forEach(({ data }, id) => shadow.set(`backlogs/${id}`, stable(data)));
    if (remote.genres) shadow.set('meta/genres', stable(remote.genres.data));
    store.schedules.forEach((sc) => lastJson.set(sc.id, contentJson(sc)));
    initialApplied = true;
    setSync('');
    render();
  }

  // 変更履歴(共有): 文書 history/{auto}
  async function sharedSnap(sc, reason, json) {
    if (readOnly || !dbx || lastSnapJson.get(sc.id) === json) return;
    lastSnapJson.set(sc.id, json);
    lastSnapT.set(sc.id, Date.now());
    try {
      await dbx.collection('history').add({ sid: sc.id, t: Date.now(), reason, by: myId, json });
      pruneHistory(sc.id, 30);
    } catch (e) { lastSnapJson.delete(sc.id); console.warn(e); }
  }
  async function pruneHistory(sid, keep) {
    try {
      const q = await dbx.collection('history').where('sid', '==', sid).orderBy('t', 'asc').get();
      for (let i = 0; i < q.docs.length - keep; i++) await dbx.doc(`history/${q.docs[i].id}`).delete();
    } catch (e) { console.warn(e); }
  }
  const purgeHistory = (sid) => pruneHistory(sid, 0);

  // 閲覧中の人の名前(更新者の表示)
  async function fillNames() {
    if (!userx) return;
    const els = [...document.querySelectorAll('[data-by]')].filter((e) => e.dataset.by);
    const ids = [...new Set(els.map((e) => e.dataset.by))];
    if (!ids.length) return;
    const ps = await userx.profiles(ids);
    els.forEach((e) => {
      const d = new Date(Number(e.dataset.at));
      e.textContent = `更新: ${(ps[e.dataset.by] && ps[e.dataset.by].name) || 'メンバー'} ${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    });
  }

  function renderShareBar() {
    $('shareBar').hidden = mode !== 'shared';
    if (mode !== 'shared') return;
    $('modeTag').textContent = readOnly ? '共有中・閲覧のみ' : '共有中・変更は全員に反映されます';
    $('modeTag').classList.toggle('ro', readOnly);
    $('btnMigrate').hidden = readOnly || remote.schedules.size > 0 || !localData();
  }
  function localData() {
    try {
      const st = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (st && Array.isArray(st.schedules) && st.schedules.some((sc) => (sc.days && sc.days.length) || (sc.backlog && sc.backlog.length))) return st;
    } catch (e) { /* ローカルデータなし */ }
    return null;
  }
  async function migrateLocal() {
    const st = localData();
    if (!st || !(await askConfirm('このブラウザに保存されているスケジュールを、共有データに移します。\n共有を開いている全員に表示されます。', '共有に移す'))) return;
    store.schedules = st.schedules.map((sc) => ({ ...newSchedule(sc.name || ''), ...sc, history: [] }));
    if (Array.isArray(st.genres)) store.genres = st.genres;
    store.currentId = store.schedules[0].id;
    commit();
    notify('共有に移しました。');
  }

  function startLocal() { mode = 'local'; render(); }
  async function startShared(db, user) {
    mode = 'shared';
    dbx = db;
    userx = user;
    myId = user ? await user.id() : null;
    readOnly = (user ? await user.can('data.write') : null) === false;
    placeholder = newSchedule(DEFAULT_NAME);
    store.schedules = [placeholder];
    store.currentId = placeholder.id;
    store.genres = DEFAULT_GENRES.map((g) => ({ ...g }));
    const fail = (e) => { setSync('error', e); if (e && e.code === 'revoked') { readOnly = true; render(); } };
    db.collection('schedules').onSnapshot((x) => onDocs('schedules', x), fail);
    db.collection('days').onSnapshot((x) => onDocs('days', x), fail);
    db.collection('backlogs').onSnapshot((x) => onDocs('backlogs', x), fail);
    db.doc('meta/genres').onSnapshot(onGenres, fail);
    render();
    setSync('loading');
  }
  async function start() {
    if (!(window.claude && typeof window.claude.use === 'function')) return startLocal();
    $('loading').hidden = false;
    let db = null, user = null;
    try { [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]); } catch (e) { db = null; }
    $('loading').hidden = true;
    return db ? startShared(db, user) : startLocal();
  }

  // ---------- スケジュール管理 ----------
  function init() {
    $('schedSelect').addEventListener('change', (e) => { store.currentId = e.target.value; commit(); });
    const step = (n) => () => {
      const list = sortedSchedules(), i = list.findIndex((x) => x.id === store.currentId) + n;
      if (list[i]) { store.currentId = list[i].id; commit(); }
    };
    $('schedPrev').addEventListener('click', step(-1));
    $('schedNext').addEventListener('click', step(1));
    $('schedMonth').addEventListener('change', (e) => { if (e.target.value) { cur().month = e.target.value; calFor = null; commit(); } });
    $('schedName').addEventListener('input', (e) => { cur().name = e.target.value; save(); fillSchedSelect(cur()); });
    $('btnNewMonth').addEventListener('click', openMonthDialog);
    $('mMonth').addEventListener('change', () => { if (!nameDirty) $('mName').value = `${$('mMonth').value.replace('-', '')}スケジュール`; updateMonthPreview(); });
    $('mName').addEventListener('input', () => { nameDirty = true; });
    $('mSource').addEventListener('change', updateMonthPreview);
    $('monthCancel').addEventListener('click', () => $('monthDlg').close());
    $('monthForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const sc = monthDraft();
      if (!sc) return;
      sc.name = sc.name || `${sc.month.replace('-', '')}スケジュール`;
      store.schedules.push(sc);
      store.currentId = sc.id;
      calFor = null;
      $('monthDlg').close();
      commit();
    });
    $('btnHistory').addEventListener('click', openHistory);
    $('histClose').addEventListener('click', () => $('histDlg').close());
    $('histList').addEventListener('click', (e) => { const b = e.target.closest('[data-hist]'); if (b) restoreSnap(Number(b.dataset.hist)); });
    $('genreBar').addEventListener('click', (e) => {
      if (e.target.closest('#btnGenres')) return openGenreDialog();
      const c = e.target.closest('[data-genre]');
      if (c) { genreFilter = genreFilter === c.dataset.genre ? '' : c.dataset.genre; render(); }
    });
    $('genreRows').addEventListener('input', (e) => { const t = e.target; if (t.dataset.gi) genreRows[t.dataset.gi][t.dataset.gf] = t.value; });
    $('genreRows').addEventListener('click', (e) => { const b = e.target.closest('[data-gdel]'); if (b) { genreRows.splice(Number(b.dataset.gdel), 1); renderGenreRows(); } });
    $('genreAdd').addEventListener('click', () => { genreRows.push({ orig: '', name: '', color: '#7b8494' }); renderGenreRows(); });
    $('genreCancel').addEventListener('click', () => $('genreDlg').close());
    $('genreForm').addEventListener('submit', (e) => { e.preventDefault(); saveGenres(); });
    $('btnDelSched').addEventListener('click', async () => {
      const s = cur();
      if (!(await askConfirm(`「${monthLabel(s.month)} ${s.name || '無題'}」を削除しますか?\n(このスケジュールの変更履歴も消えます)`, '削除する'))) return;
      if (mode === 'shared') purgeHistory(s.id);
      store.schedules = store.schedules.filter((x) => x.id !== s.id);
      if (!store.schedules.length) store.schedules.push(newSchedule('新しい研修スケジュール'));
      store.currentId = sortedSchedules().slice(-1)[0].id;
      calFor = null;
      commit();
    });

    document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => { view = b.dataset.view; render(); }));
    $('calPrev').addEventListener('click', () => calNavigate(-1));
    $('calNext').addEventListener('click', () => calNavigate(1));
    $('calToday').addEventListener('click', () => { const t = new Date(); calMonth = new Date(t.getFullYear(), t.getMonth(), 1); if (view === 'month') syncScheduleToMonth(); render(); });
    $('calWeekend').addEventListener('change', (e) => { calWeekend = e.target.checked; render(); });
    $('calFirst').addEventListener('click', () => { calFor = null; render(); });
    $('calView').addEventListener('click', onCalClick);
    $('btnAddDay').addEventListener('click', () => { addDay(cur()); commit(); });
    $('btnAddBacklog').addEventListener('click', () => openBlockDialog(null, 'backlog'));
    $('daysView').addEventListener('click', onClick);
    $('backlogList').addEventListener('click', onClick);
    $('daysView').addEventListener('change', onChange);
    $('backlogList').addEventListener('change', onChange);

    // 日程の一括変更・設定
    $('btnBulkStart').addEventListener('click', () => {
      const s = cur(), v = $('bulkStart').value;
      if (!v || !s.days.length) return;
      snap('全体をずらす前');
      shiftDays(s, 0, bizDiff(parseDate(s.days[0].date), parseDate(v), s.skipHolidays));
      commit();
    });
    const bulk = (sign) => () => {
      const n = parseInt($('bulkN').value, 10);
      if (!n) return;
      snap('全体をずらす前');
      shiftDays(cur(), 0, sign * Math.abs(n));
      commit();
    };
    $('btnBulkPlus').addEventListener('click', bulk(1));
    $('btnBulkMinus').addEventListener('click', bulk(-1));
    $('setSkipHol').addEventListener('change', (e) => { cur().skipHolidays = e.target.checked; save(); });
    $('setStart').addEventListener('change', (e) => { if (e.target.value) { cur().defaultStart = e.target.value; save(); } });
    $('setEnd').addEventListener('change', (e) => { if (e.target.value) { cur().endLimit = e.target.value; commit(); } });
    $('setGap').addEventListener('change', (e) => { cur().defaultGap = Math.max(0, parseInt(e.target.value, 10) || 0); save(); });

    // 出力・取り込み
    $('btnCsv').addEventListener('click', () => download(`${baseName()}.csv`, '\ufeff' + toDelimited(buildRows(cur()), ','), 'text/csv;charset=utf-8'));
    $('btnIcs').addEventListener('click', exportIcs);
    $('btnJson').addEventListener('click', () => download(`${baseName()}.json`, JSON.stringify(contentOf(cur()), null, 2), 'application/json'));
    $('btnPrint').addEventListener('click', () => window.print());
    $('btnCopy').addEventListener('click', async () => {
      const text = toDelimited(buildRows(cur()), '\t');
      try { await navigator.clipboard.writeText(text); notify('コピーしました。スプレッドシートのセルを選んで貼り付けてください。'); } catch (e) {
        $('copyText').value = text;
        $('copyDlg').showModal();
        $('copyText').select();
      }
    });
    $('copyClose').addEventListener('click', () => $('copyDlg').close());
    $('btnImport').addEventListener('click', () => {
      $('importText').value = ''; $('importFile').value = '';
      $('importYear').value = new Date().getFullYear();
      $('importDlg').showModal();
    });
    $('importFile').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => { $('importText').value = r.result; };
      r.readAsText(f);
    });
    $('importForm').addEventListener('submit', (e) => { e.preventDefault(); doImport(); });
    $('importCancel').addEventListener('click', () => $('importDlg').close());
    $('btnSample').addEventListener('click', () => { $('importText').value = SAMPLE_CSV; $('importYear').value = new Date().getFullYear(); doImport(); });
    $('btnMigrate').addEventListener('click', migrateLocal);
    start();
  }
  init();
})();

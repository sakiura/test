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

  const restLabel = (dateStr) => {
    const h = HOLIDAY_NAMES[dateStr], w = parseDate(dateStr).getDay();
    return h ? `祝日(${h})` : w === 0 ? '日曜' : w === 6 ? '土曜' : '';
  };

  // ---------- データ ----------
  function newSchedule(name) {
    return { id: uid(), name, days: [], backlog: [], skipHolidays: true, defaultStart: '10:00', defaultGap: 15, endLimit: '18:00' };
  }
  function newBlock(o = {}) {
    return { id: uid(), title: '', minutes: 60, gap: 0, dept: '', person: '', purpose: '', detail: '', materials: '',
      test: '', result: '', done: false, venue: '', memo: '', ...o };
  }
  function loadStore() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (s && Array.isArray(s.schedules) && s.schedules.length) return s;
    } catch (e) { /* 初回・破損時は初期化 */ }
    const sc = newSchedule('新しい研修スケジュール');
    return { currentId: sc.id, schedules: [sc] };
  }
  let store = loadStore();
  const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch (e) { /* 保存不可 */ } };
  const cur = () => store.schedules.find((s) => s.id === store.currentId) || store.schedules[0];

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
  }

  function renderTop(s) {
    $('schedSelect').innerHTML = store.schedules.map((x) =>
      `<option value="${x.id}"${x.id === s.id ? ' selected' : ''}>${esc(x.name || '(無題)')}</option>`).join('');
    if (document.activeElement !== $('schedName')) $('schedName').value = s.name;
    $('setSkipHol').checked = !!s.skipHolidays;
    $('setStart').value = s.defaultStart;
    $('setGap').value = s.defaultGap;
    $('setEnd').value = s.endLimit;
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
      if (r) msgs.push(`${jpDate(d.date)} は${r}です(研修が入っています)`);
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
    return `<div class="blk${b.done ? ' done' : ''}" data-block="${b.id}">
      <span class="grip" title="ドラッグで移動">⋮⋮</span>
      <input type="checkbox" data-bf="done" ${b.done ? 'checked' : ''} aria-label="完了">
      <div class="blk-time">${fmtMin(bs)}–${fmtMin(be)}
        ${idx > 0 ? `<label class="gap">空き<input type="number" data-bf="gap" min="0" step="5" value="${Number(b.gap) || 0}">分</label>` : ''}
      </div>
      <div>
        <div class="blk-title">${esc(b.title)}${b.test ? `<span class="tag test">${esc(b.test)}</span>` : ''}</div>
        ${meta ? `<div class="meta">${esc(meta)}</div>` : ''}
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
    return `<div class="blk" data-block="${b.id}">
      <span class="grip" title="ドラッグで移動">⋮⋮</span>
      <div><div class="blk-title">${esc(b.title)}${b.test ? `<span class="tag test">${esc(b.test)}</span>` : ''}</div>
        <div class="meta">${esc([b.dept, b.person].filter(Boolean).join(' / '))}</div></div>
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
  function ensureCal(s) {
    if (calFor !== s.id || !calMonth) {
      calFor = s.id;
      const base = s.days.length ? parseDate(s.days[0].date) : new Date();
      calMonth = new Date(base.getFullYear(), base.getMonth(), 1);
    }
  }
  function daysByDate(s) {
    const m = new Map();
    s.days.forEach((d) => { if (!m.has(d.date)) m.set(d.date, []); m.get(d.date).push(d); });
    return m;
  }
  function renderCal(s) {
    ensureCal(s);
    const y = calMonth.getFullYear(), mo = calMonth.getMonth();
    $('calLabel').textContent = view === 'year' ? `${y}年` : `${y}年${mo + 1}月`;
    const inRange = s.days.filter((d) => { const x = parseDate(d.date); return x.getFullYear() === y && (view === 'year' || x.getMonth() === mo); });
    const blocks = inRange.reduce((n, d) => n + d.blocks.length, 0);
    $('calStat').textContent = `研修 ${inRange.length}日 / ${blocks}コマ`;
    $('calView').innerHTML = view === 'year' ? yearHtml(s, y) : monthHtml(s, y, mo);
  }

  function monthHtml(s, y, mo) {
    const by = daysByDate(s);
    const first = new Date(y, mo, 1);
    const weeks = Math.ceil((first.getDay() + new Date(y, mo + 1, 0).getDate()) / 7);
    const start = addDays(first, -first.getDay());
    const todayKey = fmtDate(new Date());
    let html = '<div class="cal-scroll"><div class="cal">' +
      DOW.map((w, i) => `<div class="cal-dow dow-${i}">${w}</div>`).join('');
    for (let i = 0; i < weeks * 7; i++) {
      const d = addDays(start, i), key = fmtDate(d), w = d.getDay();
      const days = by.get(key) || [];
      const hol = HOLIDAY_NAMES[key] || '';
      const cls = ['cal-cell', d.getMonth() !== mo ? 'out' : '', days.length ? 'has' : '', key === todayKey ? 'today' : ''].filter(Boolean).join(' ');
      const lines = [];
      days.forEach((day) => layout(day).forEach(({ b, s: bs }) => lines.push({ b, bs })));
      const MAX = 5;
      html += `<div class="${cls}" data-caldate="${key}"${days.length ? ` data-calday="${days[0].id}" draggable="true" title="クリックで詳細 / ドラッグで日付を移動"` : ''}>
        <div class="cal-top"><span class="cal-num dow-${hol ? 0 : w}">${d.getDate()}</span>${hol ? `<span class="cal-hol">${esc(hol)}</span>` : ''}
          ${days.length ? '' : `<button type="button" class="cal-add" data-act="cal-add" data-date="${key}" aria-label="${d.getMonth() + 1}月${d.getDate()}日に研修日を追加">＋</button>`}</div>
        ${days.map((day) => `${day.section ? `<div class="cal-sec">${esc(day.section)}</div>` : ''}${day.venue ? `<div class="cal-venue">${esc(day.venue)}</div>` : ''}`).join('')}
        ${lines.slice(0, MAX).map(({ b, bs }) => `<div class="cal-line${b.done ? ' done' : ''}${b.test ? ' test' : ''}"><span class="t">${fmtMin(bs)}</span> ${esc(b.title)}</div>`).join('')}
        ${lines.length > MAX ? `<div class="cal-more">ほか${lines.length - MAX}件</div>` : ''}
      </div>`;
    }
    return html + '</div></div>';
  }

  function yearHtml(s, y) {
    const by = daysByDate(s);
    const todayKey = fmtDate(new Date());
    let html = '<div class="year">';
    for (let mo = 0; mo < 12; mo++) {
      const first = new Date(y, mo, 1), n = new Date(y, mo + 1, 0).getDate();
      let cells = DOW.map((w, i) => `<span class="mh dow-${i}">${w}</span>`).join('') + '<span></span>'.repeat(first.getDay());
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
    if (mini) { calMonth = new Date(calMonth.getFullYear(), Number(mini.dataset.month), 1); view = 'month'; return render(); }
    const cell = e.target.closest('[data-calday]');
    if (cell) {
      view = 'list';
      render();
      const el = document.querySelector(`[data-day="${cell.dataset.calday}"]`);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600); }
    }
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
  function commit() { save(); render(); }

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

  function onClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.tagName === 'SELECT') return;
    const s = cur();
    const dayEl = btn.closest('[data-day]');
    const day = dayEl && s.days.find((d) => d.id === dayEl.dataset.day);
    const blkEl = btn.closest('[data-block]');
    const act = btn.dataset.act;
    if (act.startsWith('day-') && day) {
      const i = s.days.indexOf(day);
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
        if (!confirm(`${jpDate(day.date)} を削除しますか?(コマ${day.blocks.length}件も消えます)`)) return;
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
      if (!confirm(`「${f.list[f.i].title}」を削除しますか?`)) return;
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
    ePurpose: 'purpose', eDetail: 'detail', eMaterials: 'materials', eTest: 'test', eResult: 'result', eMemo: 'memo' };
  function openBlockDialog(block, target) {
    const s = cur();
    const isNew = !block;
    const b = block || newBlock({ gap: s.defaultGap });
    editing = { id: isNew ? null : b.id, target };
    $('blockDlgTitle').textContent = isNew ? 'コマを追加' : 'コマを編集';
    for (const [id, key] of Object.entries(FIELDS)) $(id).value = b[key] ?? '';
    $('eDone').checked = !!b.done;
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
        if (c === 'テスト') { if (!seenTest) { H.test = i; seenTest = true; } else H.result = i; } else if (c in H) H[c] = i;
      });
    }
    const g = (r, k) => (r[H[k]] || '').trim();
    const dash = (v) => (v === '-' || v === '－' ? '' : v);
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
          materials: [dash(g(r, '資料1')), dash(g(r, '資料2'))].filter(Boolean).join(' / '),
          result: dash(g(r, 'result')), done: g(r, '進捗') === '完了', memo: g(r, 'memo'),
          venue: !dm && g(r, '会場') && day && g(r, '会場') !== day.venue ? g(r, '会場') : '',
        });
        b._s = s; b._e = e;
        if (day) day.blocks.push(b); else backlog.push(b);
      } else if (!dcell && !g(r, '会場') && parseInt(g(r, '分'), 10) > 0) {
        // 時刻の入っていない行 = まだ配置していないコマ
        const mins = parseInt(g(r, '分'), 10);
        const dept = g(r, '担当');
        backlog.push(newBlock({ title: title || dept || '(無題)', dept: title ? dept : '', person: g(r, '担当者'), minutes: mins, test: dash(g(r, 'test')),
          purpose: g(r, '目的'), detail: g(r, '詳細'), memo: g(r, 'memo') }));
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

  function buildRows(s) {
    const rows = [['', '日程', '会場', '時間', '分', '担当', '担当者', '研修内容', 'テスト', '目的', '詳細', '資料1', '資料2', 'テスト', '進捗', 'memo']];
    const md = (d) => { const x = parseDate(d); return `${x.getMonth() + 1}/${x.getDate()}`; };
    s.days.forEach((d) => {
      if (d.section) rows.push(['', d.section]);
      const wd = DOW[parseDate(d.date).getDay()];
      const tl = layout(d);
      if (!tl.length) { rows.push(['', md(d.date), d.venue], ['', wd]); return; }
      tl.forEach(({ b, s: bs, e: be }, i) => {
        const v = effVenue(d, b);
        rows.push(['', i === 0 ? md(d.date) : i === 1 ? wd : '', i === 0 ? d.venue : (v !== d.venue ? v : ''),
          `${fmtMin(bs)}-${fmtMin(be)}`, b.minutes, b.dept, b.person, b.title, b.test, b.purpose, b.detail, b.materials, '', b.result, b.done ? '完了' : '', b.memo]);
      });
      if (tl.length === 1) rows.push(['', wd]);
    });
    s.backlog.forEach((b) => rows.push(['', '', '', '', b.minutes, b.dept, b.person, b.title, b.test, b.purpose, b.detail, b.materials, '', b.result, '', b.memo]));
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
      const desc = [b.dept && b.person ? `${b.dept} ${b.person}` : b.dept || b.person, b.purpose, b.detail].filter(Boolean).join('\n');
      if (desc) out.push(`DESCRIPTION:${e2(desc)}`);
      out.push('END:VEVENT');
    }));
    out.push('END:VCALENDAR');
    download(`${baseName()}.ics`, out.join('\r\n'), 'text/calendar;charset=utf-8');
  }

  // 現在のスケジュールが空なら、それを置き換える(空のスケジュールが残らないように)
  function placeImported(sc) {
    const s = cur();
    if (!s.days.length && !s.backlog.length) store.schedules = store.schedules.filter((x) => x.id !== s.id);
    store.schedules.push(sc);
    store.currentId = sc.id;
  }
  function addImported(name, parsed) {
    const sc = newSchedule(name);
    sc.days = parsed.days;
    sc.backlog = parsed.backlog;
    placeImported(sc);
    commit();
  }

  function doImport() {
    const text = $('importText').value;
    if (!text.trim()) return alert('貼り付けるか、ファイルを選んでください。');
    const year = parseInt($('importYear').value, 10) || new Date().getFullYear();
    if (text.trim().startsWith('{')) {
      try {
        const o = JSON.parse(text);
        if (!o || !Array.isArray(o.days)) throw new Error('形式が正しくありません');
        const sc = { ...newSchedule(o.name || '取り込み'), ...o, id: uid() };
        sc.days = o.days.map((d) => ({ ...d, id: uid(), blocks: (d.blocks || []).map((b) => newBlock(stripId(b))) }));
        sc.backlog = (o.backlog || []).map((b) => newBlock(stripId(b)));
        placeImported(sc);
        $('importDlg').close();
        return commit();
      } catch (err) { return alert('読み込みに失敗しました: ' + err.message); }
    }
    const parsed = parseSheetRows(parseDelimited(text, detectDelim(text)), year);
    if (!parsed.days.length && !parsed.backlog.length) return alert('日程を読み取れませんでした。見出し行(日程・会場・時間…)を含めてコピーしてください。');
    $('importDlg').close();
    addImported(`取り込み ${year}/${pad(parsed.days.length ? parseDate(parsed.days[0].date).getMonth() + 1 : 1)}`, parsed);
  }

  // ---------- スケジュール管理 ----------
  function init() {
    $('schedSelect').addEventListener('change', (e) => { store.currentId = e.target.value; commit(); });
    $('schedName').addEventListener('input', (e) => {
      cur().name = e.target.value;
      save();
      const opt = $('schedSelect').selectedOptions[0];
      if (opt) opt.textContent = e.target.value || '(無題)';
    });
    $('btnNewSched').addEventListener('click', () => {
      const sc = newSchedule('新しい研修スケジュール');
      store.schedules.push(sc); store.currentId = sc.id; commit();
    });
    $('btnDupSched').addEventListener('click', () => {
      const s = cur();
      const copy = JSON.parse(JSON.stringify(s));
      copy.id = uid(); copy.name = `${s.name || '無題'} のコピー`;
      copy.days.forEach((d) => { d.id = uid(); d.blocks.forEach((b) => { b.id = uid(); b.done = false; }); });
      copy.backlog.forEach((b) => { b.id = uid(); b.done = false; });
      store.schedules.push(copy); store.currentId = copy.id; commit();
    });
    $('btnDelSched').addEventListener('click', () => {
      const s = cur();
      if (!confirm(`「${s.name || '無題'}」を削除しますか?`)) return;
      store.schedules = store.schedules.filter((x) => x.id !== s.id);
      if (!store.schedules.length) store.schedules.push(newSchedule('新しい研修スケジュール'));
      store.currentId = store.schedules[0].id;
      commit();
    });

    document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => { view = b.dataset.view; render(); }));
    $('calPrev').addEventListener('click', () => calNavigate(-1));
    $('calNext').addEventListener('click', () => calNavigate(1));
    $('calToday').addEventListener('click', () => { const t = new Date(); calMonth = new Date(t.getFullYear(), t.getMonth(), 1); render(); });
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
      shiftDays(s, 0, bizDiff(parseDate(s.days[0].date), parseDate(v), s.skipHolidays));
      commit();
    });
    const bulk = (sign) => () => {
      const n = parseInt($('bulkN').value, 10);
      if (!n) return;
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
    $('btnJson').addEventListener('click', () => download(`${baseName()}.json`, JSON.stringify(cur(), null, 2), 'application/json'));
    $('btnPrint').addEventListener('click', () => window.print());
    $('btnCopy').addEventListener('click', async () => {
      const text = toDelimited(buildRows(cur()), '\t');
      try { await navigator.clipboard.writeText(text); alert('コピーしました。スプレッドシートのセルを選んで貼り付けてください。'); } catch (e) {
        prompt('自動コピーできませんでした。下の内容をコピーしてください', text);
      }
    });
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
    if (window.__DEMO__ && !cur().days.length && !cur().backlog.length) {
      const sample = parseSheetRows(parseDelimited(SAMPLE_CSV, ','), new Date().getFullYear());
      Object.assign(cur(), { name: '新入社員研修(サンプル)', days: sample.days, backlog: sample.backlog });
      save();
    }
    render();
  }
  init();
})();

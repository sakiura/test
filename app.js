(() => {
  'use strict';

  const STORAGE_KEY = 'training-schedule-v1';
  const CATEGORIES = [
    { name: '講義', color: '#2f6fed' },
    { name: '演習', color: '#16a34a' },
    { name: 'グループワーク', color: '#d97706' },
    { name: '実習(OJT)', color: '#9333ea' },
    { name: '試験・発表', color: '#dc2626' },
    { name: '休憩・その他', color: '#64748b' },
  ];
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  const $ = (id) => document.getElementById(id);

  let state = load();
  let weekStart = null; // Date (月曜)

  // ---------- 永続化 ----------
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (s && Array.isArray(s.sessions)) return { name: s.name || '', sessions: s.sessions };
    } catch (e) { /* 保存データなし・破損時は初期化 */ }
    return { name: '', sessions: [] };
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* 保存不可の環境 */ }
  }

  // ---------- 日付・時刻ユーティリティ ----------
  const pad = (n) => String(n).padStart(2, '0');
  function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function fmtDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
  function mins(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
  function mondayOf(d) { return addDays(d, -((d.getDay() + 6) % 7)); }
  function jpDate(s) { const d = parseDate(s); return `${d.getMonth() + 1}月${d.getDate()}日(${DOW[d.getDay()]})`; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function catColor(name) { return (CATEGORIES.find((c) => c.name === name) || CATEGORIES[0]).color; }

  function sorted() {
    return [...state.sessions].sort((a, b) =>
      a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  }

  // ---------- 重複チェック(同日・時間が重なり、講師または場所が同じ) ----------
  function findConflicts() {
    const list = sorted();
    const pairs = [];
    const ids = new Set();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.date !== b.date) break;
        if (mins(b.start) >= mins(a.end)) continue;
        const reasons = [];
        if (a.instructor && a.instructor === b.instructor) reasons.push(`講師「${a.instructor}」`);
        if (a.location && a.location === b.location) reasons.push(`場所「${a.location}」`);
        if (reasons.length) { pairs.push({ a, b, reasons }); ids.add(a.id); ids.add(b.id); }
      }
    }
    return { pairs, ids };
  }

  // ---------- 描画 ----------
  function render() {
    const conflicts = findConflicts();
    renderSummary();
    renderBanner(conflicts);
    renderList(conflicts);
    renderWeek(conflicts);
  }

  function renderSummary() {
    const list = sorted();
    if (!list.length) { $('summary').textContent = ''; return; }
    const days = new Set(list.map((s) => s.date)).size;
    const total = list.reduce((t, s) => t + Math.max(0, mins(s.end) - mins(s.start)), 0);
    $('summary').textContent =
      `${list.length}件 / ${days}日間 / ${jpDate(list[0].date)} 〜 ${jpDate(list[list.length - 1].date)} / 合計${(total / 60).toFixed(1)}時間`;
  }

  function renderBanner({ pairs }) {
    const el = $('conflictBanner');
    if (!pairs.length) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<b>⚠ 重複が${pairs.length}件あります</b><ul>` + pairs.map(({ a, b, reasons }) =>
      `<li>${esc(jpDate(a.date))} 「${esc(a.title)}」(${a.start}-${a.end}) と 「${esc(b.title)}」(${b.start}-${b.end}) … ${esc(reasons.join('・'))}が重複</li>`
    ).join('') + '</ul>';
  }

  function renderList({ ids }) {
    const el = $('listView');
    const list = sorted();
    if (!list.length) {
      el.innerHTML = '<p class="empty">まだ予定がありません。左のフォームから追加するか、「サンプル読込」を試してください。</p>';
      return;
    }
    const byDate = new Map();
    list.forEach((s) => { if (!byDate.has(s.date)) byDate.set(s.date, []); byDate.get(s.date).push(s); });
    let html = '';
    let dayNo = 0;
    for (const [date, items] of byDate) {
      dayNo++;
      const dow = parseDate(date).getDay();
      html += `<div class="day"><h3><span class="dow-${dow}">${esc(jpDate(date))}</span> <small class="meta">Day ${dayNo}</small></h3>`;
      for (const s of items) {
        const bad = ids.has(s.id);
        html += `<div class="item${bad ? ' conflict' : ''}" style="--cat:${catColor(s.category)}">
          <div class="time">${s.start} - ${s.end}</div>
          <div>
            <div class="name"><span class="badge">${esc(s.category)}</span>${bad ? '<span class="badge warn">重複</span>' : ''}${esc(s.title)}</div>
            <div class="meta">${s.instructor ? '講師: ' + esc(s.instructor) : ''}${s.instructor && s.location ? ' / ' : ''}${s.location ? '場所: ' + esc(s.location) : ''}</div>
            ${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}
          </div>
          <div class="item-actions">
            <button class="small" data-act="edit" data-id="${s.id}" type="button">編集</button>
            <button class="small" data-act="dup" data-id="${s.id}" type="button">複製</button>
            <button class="small danger" data-act="del" data-id="${s.id}" type="button">削除</button>
          </div>
        </div>`;
      }
      html += '</div>';
    }
    el.innerHTML = html;
  }

  function renderWeek({ ids }) {
    const el = $('weekView');
    if (el.hidden) return;
    if (!weekStart) weekStart = mondayOf(state.sessions.length ? parseDate(sorted()[0].date) : new Date());
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    $('weekLabel').textContent = `${jpDate(fmtDate(days[0]))} 〜 ${jpDate(fmtDate(days[6]))}`;

    const inWeek = state.sessions.filter((s) => s.date >= fmtDate(days[0]) && s.date <= fmtDate(days[6]));
    let startH = 8, endH = 20;
    inWeek.forEach((s) => {
      startH = Math.min(startH, Math.floor(mins(s.start) / 60));
      endH = Math.max(endH, Math.ceil(mins(s.end) / 60));
    });
    const HOUR_H = 44;
    const total = (endH - startH) * HOUR_H;

    let html = `<div class="week" style="--hour-h:${HOUR_H}px"><div class="head"></div>` +
      days.map((d) => `<div class="head">${DOW[d.getDay()]}<br>${d.getMonth() + 1}/${d.getDate()}</div>`).join('');
    html += `<div class="axis" style="height:${total}px">` +
      Array.from({ length: endH - startH + 1 }, (_, i) => `<span style="top:${i * HOUR_H}px">${startH + i}:00</span>`).join('') + '</div>';
    for (const d of days) {
      const key = fmtDate(d);
      html += `<div class="col" style="height:${total}px">`;
      for (const s of inWeek.filter((x) => x.date === key)) {
        const top = (mins(s.start) - startH * 60) / 60 * HOUR_H;
        const h = Math.max(18, (mins(s.end) - mins(s.start)) / 60 * HOUR_H - 1);
        html += `<button type="button" class="block${ids.has(s.id) ? ' conflict' : ''}" data-act="edit" data-id="${s.id}"
          style="top:${top}px;height:${h}px;--cat:${catColor(s.category)}" title="${esc(s.title)}">
          <b>${esc(s.title)}</b>${s.start}-${s.end}${s.location ? '<br>' + esc(s.location) : ''}</button>`;
      }
      html += '</div>';
    }
    el.innerHTML = html + '</div>';
  }

  // ---------- フォーム ----------
  function fillCategories() {
    $('fCategory').innerHTML = CATEGORIES.map((c) => `<option>${esc(c.name)}</option>`).join('');
  }

  function resetForm(keepDate) {
    const date = keepDate ? $('fDate').value : '';
    $('sessionForm').reset();
    $('editId').value = '';
    $('fDate').value = date;
    $('formTitle').textContent = 'プログラムを追加';
    $('btnSubmit').textContent = '追加';
    $('btnCancel').hidden = true;
    $('repeatBox').hidden = false;
    $('formError').hidden = true;
  }

  function showError(msg) { $('formError').textContent = msg; $('formError').hidden = false; }

  function onSubmit(e) {
    e.preventDefault();
    const data = {
      title: $('fTitle').value.trim(),
      date: $('fDate').value,
      start: $('fStart').value,
      end: $('fEnd').value,
      category: $('fCategory').value,
      instructor: $('fInstructor').value.trim(),
      location: $('fLocation').value.trim(),
      note: $('fNote').value.trim(),
    };
    if (!data.title || !data.date || !data.start || !data.end) return showError('必須項目を入力してください。');
    if (mins(data.end) <= mins(data.start)) return showError('終了時刻は開始時刻より後にしてください。');

    const editId = $('editId').value;
    if (editId) {
      const s = state.sessions.find((x) => x.id === editId);
      if (s) Object.assign(s, data);
    } else {
      const repeat = $('fRepeat').value;
      const count = repeat === 'none' ? 1 : Math.min(60, Math.max(2, parseInt($('fCount').value, 10) || 2));
      let d = parseDate(data.date);
      for (let i = 0; i < count; i++) {
        if (repeat === 'daily') while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
        state.sessions.push({ id: uid(), ...data, date: fmtDate(d) });
        d = addDays(d, repeat === 'weekly' ? 7 : 1);
      }
    }
    save();
    resetForm(true);
    render();
  }

  function startEdit(id) {
    const s = state.sessions.find((x) => x.id === id);
    if (!s) return;
    $('editId').value = s.id;
    $('fTitle').value = s.title;
    $('fDate').value = s.date;
    $('fStart').value = s.start;
    $('fEnd').value = s.end;
    $('fCategory').value = s.category;
    $('fInstructor').value = s.instructor;
    $('fLocation').value = s.location;
    $('fNote').value = s.note;
    $('formTitle').textContent = 'プログラムを編集';
    $('btnSubmit').textContent = '更新';
    $('btnCancel').hidden = false;
    $('repeatBox').hidden = true;
    $('formError').hidden = true;
    $('fTitle').focus();
  }

  function onAction(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const { act, id } = btn.dataset;
    if (act === 'edit') startEdit(id);
    if (act === 'del') {
      const s = state.sessions.find((x) => x.id === id);
      if (s && confirm(`「${s.title}」を削除しますか?`)) {
        state.sessions = state.sessions.filter((x) => x.id !== id);
        if ($('editId').value === id) resetForm();
        save(); render();
      }
    }
    if (act === 'dup') {
      const s = state.sessions.find((x) => x.id === id);
      if (s) { state.sessions.push({ ...s, id: uid(), date: fmtDate(addDays(parseDate(s.date), 1)) }); save(); render(); }
    }
  }

  // ---------- エクスポート / インポート ----------
  function download(filename, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const baseName = () => (state.name || '研修スケジュール').replace(/[\\/:*?"<>|]/g, '_');

  function exportCsv() {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['日付', '曜日', '開始', '終了', '種別', '科目・プログラム名', '講師・担当', '場所', 'メモ']];
    sorted().forEach((s) => rows.push([s.date, DOW[parseDate(s.date).getDay()], s.start, s.end, s.category, s.title, s.instructor, s.location, s.note]));
    download(`${baseName()}.csv`, '\ufeff' + rows.map((r) => r.map(q).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  }

  function exportIcs() {
    const esc2 = (v) => String(v ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const dt = (date, time) => date.replace(/-/g, '') + 'T' + time.replace(':', '') + '00';
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//training-schedule//JA', 'CALSCALE:GREGORIAN'];
    sorted().forEach((s) => {
      lines.push('BEGIN:VEVENT', `UID:${s.id}@training-schedule`, `DTSTAMP:${now}`,
        `DTSTART:${dt(s.date, s.start)}`, `DTEND:${dt(s.date, s.end)}`,
        `SUMMARY:${esc2(s.title)}`);
      if (s.location) lines.push(`LOCATION:${esc2(s.location)}`);
      const desc = [s.category, s.instructor && `講師: ${s.instructor}`, s.note].filter(Boolean).join('\n');
      if (desc) lines.push(`DESCRIPTION:${esc2(desc)}`);
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    download(`${baseName()}.ics`, lines.join('\r\n'), 'text/calendar;charset=utf-8');
  }

  function exportJson() {
    download(`${baseName()}.json`, JSON.stringify(state, null, 2), 'application/json');
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || !Array.isArray(obj.sessions)) throw new Error('形式が正しくありません');
        const ok = obj.sessions.filter((s) => s && s.title && /^\d{4}-\d{2}-\d{2}$/.test(s.date) && /^\d{2}:\d{2}$/.test(s.start) && /^\d{2}:\d{2}$/.test(s.end));
        if (state.sessions.length && !confirm('現在のスケジュールを読み込んだ内容で置き換えます。よろしいですか?')) return;
        state = {
          name: String(obj.name || ''),
          sessions: ok.map((s) => ({
            id: uid(), title: String(s.title), date: s.date, start: s.start, end: s.end,
            category: CATEGORIES.some((c) => c.name === s.category) ? s.category : CATEGORIES[0].name,
            instructor: String(s.instructor || ''), location: String(s.location || ''), note: String(s.note || ''),
          })),
        };
        weekStart = null;
        $('programName').value = state.name;
        save(); render();
      } catch (err) {
        alert('読み込みに失敗しました: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function loadSample() {
    if (state.sessions.length && !confirm('現在のスケジュールをサンプルで置き換えます。よろしいですか?')) return;
    // 次の月曜から1週間
    const mon = mondayOf(addDays(new Date(), 7));
    const plan = [
      [0, '09:30', '10:30', '講義', 'オリエンテーション', '人事 佐藤', '大会議室', '筆記用具をご持参ください'],
      [0, '10:45', '12:00', '講義', '会社概要・事業理解', '経営企画 鈴木', '大会議室', ''],
      [0, '13:00', '17:00', '講義', 'ビジネスマナー', '外部講師 山田', '大会議室', '名刺交換の演習あり'],
      [1, '09:30', '12:00', '講義', 'コンプライアンス・情報セキュリティ', '法務 高橋', '大会議室', ''],
      [1, '13:00', '17:00', '演習', '電話応対ロールプレイ', '人事 佐藤', '研修室B', ''],
      [2, '09:30', '12:00', 'グループワーク', '課題解決ワークショップ', '外部講師 山田', '研修室B', '4人1組'],
      [2, '13:00', '16:00', '演習', 'ビジネス文書の書き方', '総務 伊藤', '研修室A', ''],
      [3, '09:30', '17:00', '実習(OJT)', '配属先見学', '各部署担当', '各部署', '昼休憩 12:00-13:00'],
      [4, '10:00', '12:00', '試験・発表', '研修成果発表会', '人事 佐藤', '大会議室', '全員発表'],
      [4, '13:00', '14:00', '休憩・その他', '振り返り・アンケート', '人事 佐藤', '大会議室', ''],
    ];
    state = {
      name: '新入社員研修(サンプル)',
      sessions: plan.map(([d, start, end, category, title, instructor, location, note]) =>
        ({ id: uid(), title, date: fmtDate(addDays(mon, d)), start, end, category, instructor, location, note })),
    };
    weekStart = null;
    $('programName').value = state.name;
    save(); render();
  }

  // ---------- タブ ----------
  function setTab(week) {
    $('tabList').setAttribute('aria-selected', String(!week));
    $('tabWeek').setAttribute('aria-selected', String(week));
    $('listView').hidden = week;
    $('weekView').hidden = !week;
    $('weekNav').hidden = !week;
    render();
  }
  function shiftWeek(n) { weekStart = addDays(weekStart, n * 7); render(); }

  // ---------- 初期化 ----------
  function init() {
    fillCategories();
    $('programName').value = state.name;
    $('programName').addEventListener('input', (e) => { state.name = e.target.value; save(); });
    $('sessionForm').addEventListener('submit', onSubmit);
    $('btnCancel').addEventListener('click', () => resetForm());
    $('listView').addEventListener('click', onAction);
    $('weekView').addEventListener('click', onAction);
    $('tabList').addEventListener('click', () => setTab(false));
    $('tabWeek').addEventListener('click', () => setTab(true));
    $('prevWeek').addEventListener('click', () => shiftWeek(-1));
    $('nextWeek').addEventListener('click', () => shiftWeek(1));
    $('todayWeek').addEventListener('click', () => { weekStart = null; render(); });
    $('btnCsv').addEventListener('click', exportCsv);
    $('btnIcs').addEventListener('click', exportIcs);
    $('btnJson').addEventListener('click', exportJson);
    $('btnPrint').addEventListener('click', () => window.print());
    $('btnSample').addEventListener('click', loadSample);
    $('fileImport').addEventListener('change', (e) => {
      if (e.target.files[0]) importJson(e.target.files[0]);
      e.target.value = '';
    });
    render();
  }
  init();
})();

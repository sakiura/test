/**
 * 共有サーバー(Google Apps Script + スプレッドシート)への接続
 *
 * app.js が使う「共有データベース」と同じ形(collection / doc / onSnapshot など)で動くようにして、
 * アプリ本体は、保存先がクレードの共有データベースでも、スプレッドシートでも同じコードで動く。
 *
 * - 他の人の変更は、一定間隔(既定15秒。画面が見えているときだけ)で取りに行く
 * - 書き込みは、まとめて1回の通信で送る(1回の通信に約1秒かかるため)
 */
(function () {
  'use strict';

  const CFG_KEY = 'training-schedule-share';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const stable = (o) => JSON.stringify(o);

  // ---------- 設定(接続先・合言葉・表示名) ----------
  const store = {
    read() { try { return JSON.parse(localStorage.getItem(CFG_KEY)) || null; } catch (e) { return null; } },
    write(cfg) { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) { /* 保存できない環境 */ } },
    clear() { try { localStorage.removeItem(CFG_KEY); } catch (e) { /* なし */ } },
  };
  const b64 = {
    enc: (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    dec: (s) => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))),
  };

  // 接続設定を決める。優先順: ① Apps Script が配ったページ ② 共有リンク(#share=…) ③ このブラウザの保存済みの設定
  function readConfig() {
    const saved = store.read() || {};
    if (window.__GAS__ && window.__GAS__.gas) {
      const key = window.__GAS__.key || saved.key || '';
      const cfg = { gas: true, url: window.__GAS__.execUrl, key, name: saved.name || '' };
      if (key) store.write({ ...saved, key, name: cfg.name });
      return cfg;
    }
    const m = /[#&]share=([^&]+)/.exec(location.hash || '');
    if (m) {
      try {
        const link = b64.dec(m[1]);
        const cfg = { url: link.url, key: link.key, name: saved.name || '' };
        store.write(cfg);
        history.replaceState(null, '', location.pathname + location.search);   // 合言葉を履歴・画面のアドレスに残さない
        return cfg;
      } catch (e) { /* 壊れたリンクは無視 */ }
    }
    return saved.url && saved.key ? { url: saved.url, key: saved.key, name: saved.name || '' } : null;
  }

  // 共有リンク。Apps Script が配るページならアドレスに合言葉を付け、他の場所に置いたページなら #share=… を付ける
  function makeLink(cfg, key) {
    if (cfg.gas) return `${cfg.url}?key=${encodeURIComponent(key)}`;
    return `${location.origin}${location.pathname}#share=${b64.enc({ url: cfg.url, key })}`;
  }

  // ---------- 通信 ----------
  function fail(code, message) { const e = new Error(message || code); e.code = code; return e; }

  async function transport(cfg, req) {
    const body = { key: cfg.key, ...req };
    if (cfg.gas && window.google && window.google.script && window.google.script.run) {
      return new Promise((resolve, reject) => {
        window.google.script.run
          .withSuccessHandler((s) => { try { resolve(JSON.parse(s)); } catch (e) { reject(fail('server', '応答を読み取れませんでした')); } })
          .withFailureHandler((e) => reject(fail('network', (e && e.message) || '通信に失敗しました')))
          .api(JSON.stringify(body));
      });
    }
    let res;
    try {
      // Content-Type を指定しない(text/plain)と、ブラウザの事前確認なしで送れる
      res = await fetch(cfg.url, { method: 'POST', body: JSON.stringify(body) });
    } catch (e) { throw fail('network', '共有サーバーにつながりません'); }
    try { return await res.json(); } catch (e) { throw fail('server', '共有サーバーの応答を読み取れませんでした(URLが正しいか確認してください)'); }
  }
  const status = (ok, code, message) => window.dispatchEvent(new CustomEvent('sheetdb-status', { detail: { ok, code, message } }));

  // ---------- 接続 ----------
  async function connect(cfg) {
    const ping = await transport(cfg, { action: 'ping' });
    if (!ping.ok) throw fail(ping.error === 'auth' ? 'auth' : 'server', ping.message || '接続できませんでした');
    let role = ping.role;
    const info = { role, viewKey: ping.viewKey || (role === 'view' ? cfg.key : null), cfg };

    const cache = new Map();          // path -> { data, updatedAt }
    const subs = [];
    let since = 0, busy = false, ready = false, queue = Promise.resolve();

    const colOf = (path) => { const p = path.split('/'); return p.length === 2 ? p[0] : null; };
    const docSnap = (id, data) => ({ id, exists: !!data, data: () => (data ? clone(data) : undefined), metadata: { fromCache: false, hasPendingWrites: false } });

    function deliver(sub) {
      if (sub.doc) {
        const e = cache.get(sub.doc), j = e ? stable(e.data) : '';
        if (sub.first || j !== sub.known) { sub.first = false; sub.known = j; sub.next(docSnap(sub.doc.split('/')[1], e && e.data)); }
        return;
      }
      const rows = [];
      cache.forEach((e, path) => { if (colOf(path) === sub.col) rows.push({ id: path.split('/')[1], data: e.data }); });
      rows.sort((a, b) => (a.id < b.id ? -1 : 1));
      const changes = [], seen = new Set();
      rows.forEach((r, i) => {
        seen.add(r.id);
        const j = stable(r.data), prev = sub.known.get(r.id);
        if (prev === undefined) changes.push({ type: 'added', doc: docSnap(r.id, r.data), oldIndex: -1, newIndex: i });
        else if (prev !== j) changes.push({ type: 'modified', doc: docSnap(r.id, r.data), oldIndex: i, newIndex: i });
        sub.known.set(r.id, j);
      });
      [...sub.known.keys()].forEach((id) => {
        if (!seen.has(id)) { sub.known.delete(id); changes.push({ type: 'removed', doc: docSnap(id, {}), oldIndex: 0, newIndex: -1 }); }
      });
      if (changes.length || sub.first) {
        sub.first = false;
        sub.next({ docs: rows.map((r) => docSnap(r.id, r.data)), size: rows.length, empty: !rows.length, docChanges: () => changes });
      }
    }
    const deliverAll = () => { if (ready) subs.slice().forEach(deliver); };

    function apply(res) {
      if (res.changed === false) return;
      res.docs.forEach((d) => cache.set(d.path, { data: d.data, updatedAt: d.updatedAt }));
      res.deleted.forEach((d) => cache.delete(d.path));
    }
    async function pull() {
      if (busy) return;
      busy = true;
      try {
        const res = await transport(cfg, { action: 'pull', since });
        if (!res.ok) throw fail(res.error === 'auth' ? 'auth' : 'server', res.message);
        apply(res);
        since = Math.max(0, res.now - 5000);   // 取りこぼさないよう、少し前から取り直す(重複は無視される)
        if (res.role && res.role !== role) { role = res.role; info.role = role; }
        ready = true;
        deliverAll();
        status(true);
      } catch (e) {
        status(false, e.code || 'network', e.message);
        if (!ready) throw e;
      } finally { busy = false; }
    }
    await pull();

    // 書き込み(順番に1つずつ。まとめて1回の通信で送る)
    function write(ops) {
      const run = async () => {
        for (let i = 0; i < ops.length; i += 100) {
          const part = ops.slice(i, i + 100);
          const res = await transport(cfg, { action: 'push', ops: part.map((o) => ({ op: o.data === null ? 'delete' : 'set', path: o.path, data: o.data === null ? undefined : o.data })) });
          if (!res.ok) {
            const code = res.error === 'readonly' ? 'permission' : res.error === 'auth' ? 'auth' : 'invalid_argument';
            throw fail(code, res.message || res.error);
          }
          part.forEach((o) => { if (o.data === null) cache.delete(o.path); else cache.set(o.path, { data: clone(o.data), updatedAt: res.now }); });
          deliverAll();
        }
      };
      const p = queue.catch(() => {}).then(run);
      queue = p;
      return p;
    }

    // 文書・集まりの参照(claude の共有データベースと同じ形)
    function query(col, where = [], ord = null, lim = null) {
      const q = {
        where: (f, op, v) => query(col, [...where, [f, op, v]], ord, lim),
        orderBy: (f, dir) => query(col, where, [f, dir || 'asc'], lim),
        limit: (n) => query(col, where, ord, n),
        async get() {
          const res = await transport(cfg, { action: 'query', collection: col, where, orderBy: ord && ord[0], dir: ord && ord[1], limit: lim });
          if (!res.ok) throw fail('server', res.message || res.error);
          return { docs: res.docs.map((d) => docSnap(d.id, d.data)), size: res.docs.length, empty: !res.docs.length };
        },
        onSnapshot(next, error) {
          const sub = { col, next, error, first: true, known: new Map() };
          subs.push(sub);
          if (ready) Promise.resolve().then(() => deliver(sub));
          return () => { const i = subs.indexOf(sub); if (i >= 0) subs.splice(i, 1); };
        },
      };
      return q;
    }
    const randomId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    const db = {
      doc(path) {
        return {
          id: path.split('/')[1], path,
          async get() { const e = cache.get(path); return docSnap(path.split('/')[1], e && e.data); },
          set: (data) => write([{ path, data: clone(data) }]),
          delete: () => write([{ path, data: null }]),
          onSnapshot(next, error) {
            const sub = { doc: path, next, error, first: true, known: '' };
            subs.push(sub);
            if (ready) Promise.resolve().then(() => deliver(sub));
            return () => { const i = subs.indexOf(sub); if (i >= 0) subs.splice(i, 1); };
          },
        };
      },
      collection(col) {
        return Object.assign(query(col), {
          path: col,
          doc: (id) => db.doc(`${col}/${id || randomId()}`),
          add: async (data) => { const ref = db.doc(`${col}/${randomId()}`); await ref.set(data); return ref; },
        });
      },
      // まとめ書き(app.js が、あれば使う): ops = [{ path, data | null }]
      writeBatch: (ops) => write(ops.map((o) => ({ path: o.path, data: o.data === null ? null : clone(o.data) }))),
    };

    // 画面の更新者の記録・権限の判定に使う(Googleのアカウントはないので、表示名を記録する)
    const user = {
      id: async () => cfg.name || 'メンバー',
      can: async (name) => (name === 'data.write' ? role === 'edit' : null),
      canEdit: async () => role === 'edit',
      isOwner: async () => false,
      profiles: async (ids) => Object.fromEntries([].concat(ids).map((id) => [id, { id, name: id, isMe: id === cfg.name }])),
    };

    // 他の人の変更を取りに行く(画面が見えているときだけ)
    const ms = Number(window.__SHEETDB_POLL_MS) || 15000;
    setInterval(() => { if (!document.hidden) pull().catch(() => {}); }, ms);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) pull().catch(() => {}); });
    window.addEventListener('online', () => pull().catch(() => {}));

    return { db, user, info, pullNow: () => pull() };
  }

  window.SheetDB = { connect, readConfig, saveConfig: (cfg) => store.write(cfg), clearConfig: () => store.clear(), makeLink, loadSaved: () => store.read() };
})();

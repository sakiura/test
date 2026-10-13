/**
 * 研修スケジュール管理 — 共有用サーバー(Google Apps Script)
 *
 * このスクリプトを開いたスプレッドシートに、スケジュールのデータを保存します。
 * 使い方は docs/共有のはじめかた.md を見てください。
 *
 * 守りは「合言葉」だけです(Googleアカウントのない人も使えるようにするため)。
 *   編集用の合言葉 … 見る・書く
 *   閲覧用の合言葉 … 見るだけ
 * 合言葉はシート「設定」で確認・変更できます。
 */

var COLLECTIONS = ['schedules', 'days', 'backlogs', 'meta', 'history'];
var NO_PULL = { history: true };      // 一覧の同期には含めない(大きいため。必要なときだけ query で取る)
var HEAD = 3;                          // A: id / B: 更新時刻 / C: 更新者 / D〜: データ(JSON)
var CHUNK = 40000;                     // 1セルの上限(5万文字)を超えないよう分けて保存する
var MAX_CHUNKS = 12;
var SETTINGS = '設定';
var DELETED = '_deleted';
var PATH_RE = /^(schedules|days|backlogs|meta|history)\/[A-Za-z0-9_\-.~:@+]{1,200}$/;

// ---------- 入口 ----------

// ページの配信(アドレスをそのまま開いたとき)。?action=... が付いていれば API として動く
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action) return json_(handle_(p));
  var html = HtmlService.createHtmlOutputFromFile('Index').getContent();
  var cfg = { gas: true, execUrl: ScriptApp.getService().getUrl(), key: p.key || '' };
  html = html.replace('<!--SHARE-CONFIG-->', '<script>window.__GAS__=' + JSON.stringify(cfg).replace(/</g, '\\u003c') + ';</script>');
  return HtmlService.createHtmlOutput(html)
    .setTitle('研修スケジュール管理')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// 他の場所に置いたページからの呼び出し(Content-Type: text/plain の JSON)
function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }
  return json_(handle_(req));
}

// このスクリプトが配信したページからの呼び出し(google.script.run)
function api(reqJson) { return JSON.stringify(handle_(JSON.parse(reqJson))); }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// 最初に1回だけ手で実行する。シートと合言葉を用意し、合言葉を表示する
function setup() {
  var k = keys_();
  Logger.log('編集用の合言葉: ' + k.edit + '\n閲覧用の合言葉: ' + k.view);
  return k;
}

// ---------- API ----------

function handle_(req) {
  try {
    var role = roleOf_(String(req.key || ''));
    if (!role) return { ok: false, error: 'auth' };
    switch (req.action) {
      case 'ping': {
        var out = { ok: true, role: role, now: Date.now() };
        if (role === 'edit') out.viewKey = keys_().view;   // 閲覧用リンクを作れるように、編集権の人には閲覧用の合言葉を返す
        return out;
      }
      case 'pull': return pull_(Number(req.since) || 0, role);
      case 'query': return query_(req);
      case 'push':
        if (role !== 'edit') return { ok: false, error: 'readonly' };
        return push_(req.ops || []);
      default: return { ok: false, error: 'bad_action' };
    }
  } catch (err) {
    return { ok: false, error: 'server', message: String((err && err.message) || err) };
  }
}

// 前回(since)以降に変わった文書と、消えた文書を返す
function pull_(since, role) {
  var now = Date.now();
  if (since > 0 && since >= lastWrite_()) return { ok: true, now: now, role: role, changed: false, docs: [], deleted: [] };
  var docs = [], deleted = [];
  COLLECTIONS.forEach(function (c) {
    if (NO_PULL[c]) return;
    var sh = sheet_(c), n = sh.getLastRow() - 1;
    if (n < 1) return;
    var head = sh.getRange(2, 1, n, 2).getValues(), rows = [];
    for (var i = 0; i < n; i++) if (Number(head[i][1]) > since) rows.push(i + 2);
    if (!rows.length) return;
    var all = rows.length > 30 ? sh.getRange(2, 1, n, HEAD + MAX_CHUNKS).getValues() : null;
    rows.forEach(function (r) {
      var vals = all ? all[r - 2] : sh.getRange(r, 1, 1, HEAD + MAX_CHUNKS).getValues()[0];
      var d = parseRow_(vals);
      if (d) docs.push({ path: c + '/' + d.id, data: d.data, updatedAt: d.updatedAt });
    });
  });
  var ds = sheet_(DELETED), dn = ds.getLastRow() - 1;
  if (dn >= 1) {
    ds.getRange(2, 1, dn, 2).getValues().forEach(function (v) { if (Number(v[1]) > since) deleted.push({ path: String(v[0]), updatedAt: Number(v[1]) }); });
  }
  return { ok: true, now: now, role: role, changed: true, docs: docs, deleted: deleted };
}

// 1つの集まりを条件で絞って返す(変更履歴の取得に使う)。条件は == のみ
function query_(req) {
  var c = String(req.collection || '');
  if (COLLECTIONS.indexOf(c) < 0) return { ok: false, error: 'bad_collection' };
  var sh = sheet_(c), n = sh.getLastRow() - 1, out = [];
  if (n >= 1) {
    sh.getRange(2, 1, n, HEAD + MAX_CHUNKS).getValues().forEach(function (vals) {
      var d = parseRow_(vals);
      if (!d) return;
      var ok = (req.where || []).every(function (w) { return d.data[w[0]] === w[2]; });
      if (ok) out.push({ id: d.id, data: d.data });
    });
  }
  if (req.orderBy) {
    var f = req.orderBy, dir = req.dir === 'desc' ? -1 : 1;
    out.sort(function (a, b) { return (a.data[f] > b.data[f] ? 1 : a.data[f] < b.data[f] ? -1 : 0) * dir; });
  }
  if (req.limit) out = out.slice(0, Number(req.limit));
  return { ok: true, docs: out };
}

// 書き込み(set / delete)をまとめて行う。同時に書かれても壊れないように排他する
function push_(ops) {
  if (ops.length > 200) return { ok: false, error: 'too_many_ops' };
  // 先に全部を検証して、途中まで書かれた状態にならないようにする
  ops.forEach(function (op) {
    var path = String(op.path || '');
    if (!PATH_RE.test(path)) throw new Error('bad_path: ' + path);
    if (op.op === 'set') {
      if (!op.data || typeof op.data !== 'object' || Array.isArray(op.data)) throw new Error('bad_data: ' + path);
      if (JSON.stringify(op.data).length > CHUNK * MAX_CHUNKS) throw new Error('too_large: ' + path);
    } else if (op.op !== 'delete') {
      throw new Error('bad_op: ' + path);
    }
  });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var now = Date.now(), results = [];
    ops.forEach(function (op) {
      var parts = String(op.path).split('/'), c = parts[0], id = parts[1];
      if (op.op === 'delete') { if (deleteDoc_(c, id)) tombstone_(op.path, now); }
      else writeDoc_(c, id, op.data, now);
      results.push({ path: op.path, updatedAt: now });
    });
    PropertiesService.getScriptProperties().setProperty('lastWrite', String(now));
    return { ok: true, now: now, results: results };
  } finally {
    lock.releaseLock();
  }
}

// ---------- シートの読み書き ----------

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name) {
  var s = ss_().getSheetByName(name);
  if (s) return s;
  s = ss_().insertSheet(name);
  if (name === DELETED) s.getRange(1, 1, 1, 2).setValues([['path', 'deletedAt']]);
  else if (name !== SETTINGS) s.getRange(1, 1, 1, HEAD).setValues([['id', 'updatedAt', 'by']]);
  return s;
}

// 1行 = 1文書。JSON は長いとセルに入らないので、複数セルに分けて入れる。
// 数式や数値と解釈されないよう、各断片の先頭に「|」を付ける。
function rowOf_(id, ts, by, data) {
  var json = JSON.stringify(data), row = [id, ts, by];
  for (var i = 0; i < json.length; i += CHUNK) row.push('|' + json.substr(i, CHUNK));
  if (row.length - HEAD > MAX_CHUNKS) throw new Error('too_large');
  while (row.length < HEAD + MAX_CHUNKS) row.push('');
  return row;
}

function parseRow_(vals) {
  if (vals[0] === '' || vals[0] === null) return null;
  var json = '';
  for (var i = HEAD; i < vals.length && vals[i] !== ''; i++) json += String(vals[i]).substr(1);
  if (!json) return null;
  return { id: String(vals[0]), updatedAt: Number(vals[1]), data: JSON.parse(json) };
}

function findRow_(sh, id) {
  var n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  var ids = sh.getRange(2, 1, n, 1).getValues();
  for (var i = 0; i < n; i++) if (String(ids[i][0]) === id) return i + 2;
  return 0;
}

function writeDoc_(c, id, data, ts) {
  var sh = sheet_(c), by = typeof data.by === 'string' ? data.by : '';
  var row = rowOf_(id, ts, by, data), at = findRow_(sh, id) || (sh.getLastRow() + 1);
  sh.getRange(at, 1, 1, row.length).setValues([row]);
}

function deleteDoc_(c, id) {
  var sh = sheet_(c), r = findRow_(sh, id);
  if (!r) return false;
  sh.deleteRow(r);
  return true;
}

// 消した文書を記録して、他の人の画面からも消えるようにする(1週間たったら整理)
function tombstone_(path, ts) {
  var ds = sheet_(DELETED);
  ds.getRange(ds.getLastRow() + 1, 1, 1, 2).setValues([[path, ts]]);
  var n = ds.getLastRow() - 1;
  if (n > 300) {
    var weekAgo = ts - 7 * 24 * 3600 * 1000, vals = ds.getRange(2, 1, n, 2).getValues();
    for (var i = n - 1; i >= 0; i--) if (Number(vals[i][1]) < weekAgo) ds.deleteRow(i + 2);
  }
}

function lastWrite_() {
  return Number(PropertiesService.getScriptProperties().getProperty('lastWrite')) || 0;
}

// ---------- 合言葉 ----------

function keys_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('keys');
  if (hit) return JSON.parse(hit);
  var sh = sheet_(SETTINGS), changed = false;
  var edit = String(sh.getRange(1, 2).getValue() || ''), view = String(sh.getRange(2, 2).getValue() || '');
  if (!edit || !view) {
    if (!edit) edit = newKey_();
    if (!view) view = newKey_();
    sh.getRange(1, 1, 3, 2).setValues([
      ['編集用の合言葉(見る・書く)', edit],
      ['閲覧用の合言葉(見るだけ)', view],
      ['※ 変えたいときは、右の合言葉を書き換えてください(反映まで数分かかることがあります)。このシートは他の人に見せないでください。', ''],
    ]);
    changed = true;
  }
  var k = { edit: edit, view: view };
  cache.put('keys', JSON.stringify(k), changed ? 1 : 120);
  return k;
}

function newKey_() { return Utilities.getUuid().replace(/-/g, '').substr(0, 12); }

function roleOf_(key) {
  if (!key) return null;
  var k = keys_();
  return key === k.edit ? 'edit' : key === k.view ? 'view' : null;
}

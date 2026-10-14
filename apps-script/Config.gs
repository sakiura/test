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
var INDEX_END = '<!--END-OF-INDEX-->';   // Index.html の最後の目印
var PATH_RE = /^(schedules|days|backlogs|meta|history)\/[A-Za-z0-9_\-.~:@+]{1,200}$/;

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

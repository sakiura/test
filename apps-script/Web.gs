// ---------- 入口 ----------

// ページの配信(アドレスをそのまま開いたとき)。?action=... が付いていれば API として動く
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action) return json_(handle_(p));
  var html;
  try { html = page_(); }
  catch (err) { return notice_(err.title, err.detail); }
  // Google Workspace で公開すると、アドレスが /a/macros/ドメイン/ の形になる。これだとログインを求められる
  // ことがあるので、Google アカウントのない人にも配れる /macros/ の形に直して、共有リンクに使う。
  var execUrl = String(ScriptApp.getService().getUrl()).replace(/\/a\/macros\/[^\/]+\//, '/macros/');
  var cfg = { gas: true, execUrl: execUrl, key: p.key || '' };
  html = html.replace('[[SHARE-CONFIG]]', '<script>window.__GAS__=' + JSON.stringify(cfg).replace(/</g, '\\u003c') + ';</script>');
  return HtmlService.createHtmlOutput(html)
    .setTitle('研修スケジュール管理')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// 画面は、Index(骨組み)・Style・Js1〜 のファイルに分けてある。[[PART:名前]] の場所に、そのファイルをはめ込む
function page_() {
  function load(name) {
    var t;
    try { t = HtmlService.createHtmlOutputFromFile(name).getContent(); }
    catch (err) { throw { title: '画面のファイル(' + name + ')が見つかりません', detail: 'Apps Script の左の「ファイル」に、名前が ' + name + ' の HTML ファイルがありますか?(「＋」→「HTML」で、名前を ' + name + ' にして作ります)(読み込み時のエラー: ' + String((err && err.message) || err).replace(/[<>&]/g, '') + ')' }; }
    var mark = '[[END-OF-' + name + ']]';
    var at = t.lastIndexOf(mark);
    if (at < 0) throw { title: '画面のファイル(' + name + ')が最後まで貼り付けられていません', detail: '今は ' + t.length + ' 文字しか入っていません。末尾は「' + t.slice(-30).replace(/[<>&]/g, '') + '」です。' + name + ' の中身をすべて消して、' + name + '.html の全文をコピーし直して貼り付けてください。貼り付けたあと、末尾が ' + mark + ' で終わっていれば全部入っています。' };
    return t.slice(0, at);
  }
  var html = load('Index');
  html = html.replace(/\[\[PART:(\w+)\]\]/g, function (m, name) { return load(name); });
  if (html.indexOf('[[SHARE-CONFIG]]') < 0) throw { title: '画面のファイル(Index)が正しくありません', detail: 'Index の中身をすべて消して、Index.html の全文をコピーし直して貼り付けてください。' };
  return html;
}

// 設定の不備を、画面に分かりやすく出す
function notice_(title, detail) {
  return HtmlService.createHtmlOutput('<div style="font:16px/1.6 sans-serif;max-width:640px;margin:48px auto;padding:0 20px"><h2>' + title + '</h2><p>' + detail + '</p></div>')
    .setTitle('研修スケジュール管理')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
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

// node tools/test-gas.js  — Apps Script 側(apps-script/*.gs)の動作を、模擬環境で確認する
// 各ファイルが単独で構文として正しいことも確かめる(貼り付けが途中で切れたら、そのファイルだけ壊れるため)
for (const f of require('fs').readdirSync(require('path').join(__dirname, '..', 'apps-script')).filter((x) => x.endsWith('.gs'))) {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'apps-script', f), 'utf8');
  new Function(src);
  const n = src.split('\n').length - 1;
  if (n > 80) throw new Error(f + ' が長すぎます(' + n + '行)。80行以内に分けてください');
  console.log('  ' + f + ': ' + n + '行 OK');
}
const fs = require('fs'), path = require('path'), vm = require('vm');
const assert = require('assert');
const { createGas } = require('./gas-mock');

let t = 1000;
const g = createGas({ clock: () => t });
const tick = (n = 1000) => { t += n; };

// 合言葉の用意
const keys = g.ctx.setup();
assert(keys.edit && keys.view && keys.edit !== keys.view, '合言葉が2つできる');
assert.strictEqual(g.sheets.get('設定').rows[0][1], keys.edit, '設定シートに書かれる');
const E = keys.edit, V = keys.view;

// 認証
assert.strictEqual(g.api({ action: 'ping', key: 'wrong' }).error, 'auth');
assert.strictEqual(g.api({ action: 'ping' }).error, 'auth');
const pe = g.api({ action: 'ping', key: E }), pv = g.api({ action: 'ping', key: V });
assert.strictEqual(pe.role, 'edit'); assert.strictEqual(pe.viewKey, V, '編集権の人には閲覧用の合言葉も返す');
assert.strictEqual(pv.role, 'view'); assert.strictEqual(pv.viewKey, undefined, '閲覧の人には返さない');

// 書き込み: 閲覧用は不可
assert.strictEqual(g.api({ action: 'push', key: V, ops: [{ op: 'set', path: 'days/a', data: { x: 1 } }] }).error, 'readonly');

// 追加
tick();
const day = { sid: 's1', date: '2026-11-02', blocks: [{ id: 'b1', title: 'オリエン', minutes: 30 }], by: '田中' };
let r = g.api({ action: 'push', key: E, ops: [
  { op: 'set', path: 'schedules/s1', data: { name: '202611', month: '2026-11' } },
  { op: 'set', path: 'days/d1', data: day },
  { op: 'set', path: 'meta/genres', data: { list: [{ name: '会社理解' }] } },
] });
assert(r.ok && r.results.length === 3);
assert.strictEqual(g.sheets.get('days').rows[1][2], '田中', '更新者の列に by が入る');

// 取得(全部 → 変化なし → 変更だけ)
let p = g.api({ action: 'pull', key: V, since: 0 });
assert(p.ok && p.changed && p.docs.length === 3, '最初は全部');
assert.deepStrictEqual(p.docs.find((d) => d.path === 'days/d1').data, day);
const since = p.now; tick(5000);
p = g.api({ action: 'pull', key: V, since });
assert.strictEqual(p.changed, false, '変化がなければ軽く返す');
tick();
g.api({ action: 'push', key: E, ops: [{ op: 'set', path: 'days/d1', data: { ...day, date: '2026-11-03' } }] });
p = g.api({ action: 'pull', key: V, since });
assert(p.changed && p.docs.length === 1 && p.docs[0].data.date === '2026-11-03', '編集した文書だけ返る');

// 上書き(後勝ち)・行は増えない
g.api({ action: 'push', key: E, ops: [{ op: 'set', path: 'days/d1', data: { ...day, date: '2026-11-04' } }] });
assert.strictEqual(g.sheets.get('days').getLastRow(), 2, '同じ文書は同じ行を上書きする');

// 削除は他の人にも伝わる
tick();
const before = g.api({ action: 'pull', key: V, since: 0 }).now; tick();
g.api({ action: 'push', key: E, ops: [{ op: 'delete', path: 'days/d1' }] });
p = g.api({ action: 'pull', key: V, since: before });
assert.deepStrictEqual(p.deleted.map((d) => d.path), ['days/d1']);
assert.strictEqual(g.sheets.get('days').getLastRow(), 1, '行が消える');
assert.strictEqual(g.api({ action: 'pull', key: V, since: 0 }).docs.some((d) => d.path === 'days/d1'), false);

// 大きい文書(1セルの上限を超える)は分けて保存し、そのまま読み戻せる
tick();
const big = { sid: 's1', blocks: Array.from({ length: 300 }, (_, i) => ({ id: 'b' + i, title: 'コマ' + i, detail: '=SUM(1)'.repeat(60), links: [] })) };
assert(JSON.stringify(big).length > 40000, 'テスト用の文書が大きい');
g.api({ action: 'push', key: E, ops: [{ op: 'set', path: 'days/big', data: big }] });
const bigRow = g.sheets.get('days').rows.find((r) => r[0] === 'big');
assert(bigRow.filter((c, i) => i >= 3 && c !== '').length > 1, '複数のセルに分かれる');
assert(bigRow.slice(3).every((c) => c === '' || String(c).startsWith('|')), '各断片は「|」で始まる(数式と誤解されない)');
assert.deepStrictEqual(g.api({ action: 'pull', key: V, since: 0 }).docs.find((d) => d.path === 'days/big').data, big);
// 小さく書き直すと、余った断片は消える
g.api({ action: 'push', key: E, ops: [{ op: 'set', path: 'days/big', data: { sid: 's1', blocks: [] } }] });
assert.deepStrictEqual(g.api({ action: 'pull', key: V, since: 0 }).docs.find((d) => d.path === 'days/big').data, { sid: 's1', blocks: [] });
// 大きすぎる文書は断る(何も書かれない)
const huge = { s: 'x'.repeat(40000 * 12 + 10) };
r = g.api({ action: 'push', key: E, ops: [{ op: 'set', path: 'days/ok2', data: { a: 1 } }, { op: 'set', path: 'days/huge', data: huge }] });
assert.strictEqual(r.ok, false);
assert(!g.sheets.get('days').rows.some((x) => x[0] === 'ok2'), '1件でも不正なら、全部書かない');

// 不正なパス・操作
for (const bad of ['days', 'days/', 'other/x', 'days/a/b', 'days/a b', '../x']) {
  assert.strictEqual(g.api({ action: 'push', key: E, ops: [{ op: 'set', path: bad, data: { a: 1 } }] }).ok, false, '不正なパス: ' + bad);
}
assert.strictEqual(g.api({ action: 'push', key: E, ops: [{ op: 'set', path: 'days/z', data: [1] }] }).ok, false);
assert.strictEqual(g.api({ action: 'push', key: E, ops: [{ op: 'drop', path: 'days/z' }] }).ok, false);

// 30件を超える変更をまとめて取得できる
tick();
const many = Array.from({ length: 50 }, (_, i) => ({ op: 'set', path: `days/m${i}`, data: { i } }));
assert(g.api({ action: 'push', key: E, ops: many }).ok);
p = g.api({ action: 'pull', key: V, since: 0 });
assert.strictEqual(p.docs.filter((d) => d.path.startsWith('days/m')).length, 50);

// 変更履歴は一覧の同期に含めず、query で取る
tick();
g.api({ action: 'push', key: E, ops: [
  { op: 'set', path: 'history/h1', data: { sid: 's1', t: 100, reason: 'a', json: '{}' } },
  { op: 'set', path: 'history/h2', data: { sid: 's1', t: 300, reason: 'b', json: '{}' } },
  { op: 'set', path: 'history/h3', data: { sid: 's2', t: 200, reason: 'c', json: '{}' } },
  { op: 'set', path: 'history/h4', data: { sid: 's1', t: 200, reason: 'd', json: '{}' } },
] });
assert(!g.api({ action: 'pull', key: V, since: 0 }).docs.some((d) => d.path.startsWith('history/')), 'pull に履歴は含まれない');
let q = g.api({ action: 'query', key: V, collection: 'history', where: [['sid', '==', 's1']], orderBy: 't', dir: 'desc', limit: 2 });
assert.deepStrictEqual(q.docs.map((d) => d.id), ['h2', 'h4'], '条件・並び順・件数');
q = g.api({ action: 'query', key: V, collection: 'history', where: [['sid', '==', 's1']], orderBy: 't', dir: 'asc' });
assert.deepStrictEqual(q.docs.map((d) => d.id), ['h1', 'h4', 'h2']);
assert.strictEqual(g.api({ action: 'query', key: V, collection: 'nope' }).error, 'bad_collection');

// 他の入口(POST / ページ配信)
assert.strictEqual(JSON.parse(g.post(JSON.stringify({ action: 'ping', key: E }))).role, 'edit');
assert.strictEqual(JSON.parse(g.post('not json')).error, 'bad_request');
const page = g.get({ key: 'abc<script>' });
assert(page.html.includes('window.__GAS__={"gas":true'), '配信ページに設定が入る');
assert(page.html.includes('\\u003cscript>') && !page.html.includes('abc<script>'), '合言葉に含まれる < はエスケープされる');
assert.strictEqual(JSON.parse(g.get({ action: 'ping', key: V }).getContent()).role, 'view');

// 合言葉の変更(設定シートを書き換える。キャッシュが切れたあとに反映)
g.sheets.get('設定').rows[1][1] = 'newviewkey';
g.ctx.CacheService.getScriptCache().put('keys', '', 0);
g.ctx.CacheService.getScriptCache = () => ({ get: () => null, put() {} });
assert.strictEqual(g.api({ action: 'ping', key: 'newviewkey' }).role, 'view');
assert.strictEqual(g.api({ action: 'ping', key: V }).error, 'auth', '古い合言葉は使えなくなる');
// Google Workspace の /a/macros/ドメイン/ の形のアドレスは、共有リンクでは /macros/ の形に直す
const gw = createGas({ execUrl: 'https://script.google.com/a/macros/example.co.jp/s/ABC/exec' });
gw.ctx.setup();
assert(gw.get({}).html.includes('"execUrl":"https://script.google.com/macros/s/ABC/exec"'), 'Workspace のアドレスを /macros/ の形に直す');
// 画面のファイルが見つからない・途中で切れているときは、画面で知らせる
const parts = fs.readdirSync(path.join(__dirname, '..', 'apps-script')).filter((f) => /\.html$/.test(f)).map((f) => f.replace('.html', ''));
assert(parts.includes('Index') && parts.includes('Style') && parts.includes('Js1'), '画面のファイルが揃っている');
parts.forEach((n) => {
  const t = fs.readFileSync(path.join(__dirname, '..', 'apps-script', n + '.html'), 'utf8');
  assert(t.length <= 30000, n + ' は30,000文字以内(' + t.length + ')');
  assert(t.endsWith('\n<!--END-OF-' + n + '-->\n'), n + ' の末尾に目印がある');
});
const full = createGas({}).get({}).html;
assert(full.includes('<style>') && full.includes('window.__GAS__') && !full.includes('<!--PART:') && !full.includes('END-OF-'), '部品がつながる');
const jsAll = full.slice(full.lastIndexOf('<script>') + 8, full.lastIndexOf('</script>'));
new vm.Script(jsAll);   // つないだ JS が、構文として正しい
assert(createGas({ files: { Js2: null } }).get({}).html.includes('Js2)が見つかりません'), '部品がないときの案内');
const half = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Js1.html'), 'utf8').slice(0, 5000);
const cutPage = createGas({ files: { Js1: half } }).get({}).html;
assert(cutPage.includes('Js1)が最後まで貼り付けられていません') && cutPage.includes('5000 文字しか入っていません'), '途中で切れているときの案内');
console.log('Apps Script: すべて通りました');

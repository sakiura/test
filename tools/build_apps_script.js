#!/usr/bin/env node
/**
 * index.html / style.css / sync-sheet.js / app.js を 1 つにまとめて、
 * Apps Script に貼り付ける apps-script/Index.html と Part_*.gs を作る。
 *
 *   cd tools && npm install     (最初の1回だけ。terser を入れる)
 *   node tools/build_apps_script.js
 *
 * 貼り付けやすく、壊れにくくするために、できあがりを圧縮している。
 *  - JS: コメントをなくして圧縮する(改行が失われても動く)
 *  - CSS・HTML: 余分な空白と改行をなくす
 * 各ファイル末尾の [[END-OF-名前]] は、貼り付けが途中で切れていないかを Web.gs が確かめる目印。
 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

async function main() {
  let terser;
  try { terser = require('terser'); } catch (e) { terser = require(path.join(__dirname, 'node_modules', 'terser')); }
  const html = read('index.html');
  const marker = '[[SHARE-CONFIG]]', srcMarker = '<!--SHARE-CONFIG-->';
  const body = html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf(srcMarker));

  const js = read('sync-sheet.js') + '\n' + read('app.js');
  const min = await terser.minify(js, { ecma: 2020, compress: { passes: 2 }, mangle: true, format: { comments: false } });
  if (min.error) throw min.error;
  if (/<\/script|<!--/i.test(min.code)) throw new Error('JS の中に </script> があるとページが壊れる');

  const css = read('style.css')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,])\s*/g, '$1')
    .trim();
  const small = body.replace(/\s+/g, ' ').trim();

  // 1ファイルを小さく保つため、画面を「骨組み(Index.html)」と、見た目・動きの部品(.gs)に分ける。
  // Apps Script は HTML ファイルを HTML として検査し、プログラムの中の < を拒否することがあるため、
  // 見た目と動きは .gs の文字列として持たせる。動きの部分は、決まった長さで機械的に切って、Web.gs がつなぎ直す。
  // プログラムが止まったとき、原因を画面の一番上に出す(原因を調べやすくするため)
  const guard = '<script>(function(){function show(m){var d=document.createElement("pre");d.style.cssText="background:#fee;color:#900;padding:8px;margin:0;white-space:pre-wrap;font-size:12px";d.textContent="プログラムが止まりました: "+m;document.body.insertBefore(d,document.body.firstChild);}' +
    'window.addEventListener("error",function(e){show(e.message+" (行 "+e.lineno+" 列 "+e.colno+")");});' +
    'window.addEventListener("unhandledrejection",function(e){show(String(e.reason&&e.reason.stack||e.reason));});})();</script>';
  const SIZE = 20000;
  const jsParts = [];
  for (let i = 0; i < min.code.length; i += SIZE) jsParts.push(min.code.slice(i, i + SIZE));
  const names = jsParts.map((_, i) => 'Js' + (i + 1));
  const end = (n) => '\n[[END-OF-' + n + ']]\n';
  const outDir = path.join(root, 'apps-script');
  fs.readdirSync(outDir).filter((f) => /^(Index|Style|Js\d+|Part_\w+)\.(html|gs)$/.test(f)).forEach((f) => fs.unlinkSync(path.join(outDir, f)));
  const files = {
    'Index.html': '<!DOCTYPE html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<title>研修スケジュール管理</title>\n[[PART:Style]]\n</head>\n<body>\n' + guard + '\n' +
      small + '\n' + marker + '\n<script>' + names.map((n) => '[[PART:' + n + ']]').join('') + '</script>\n</body>\n</html>' + end('Index'),
  };
  const parts = { Style: '<style>' + css + '</style>' };
  names.forEach((n, i) => { parts[n] = jsParts[i]; });
  Object.keys(parts).forEach((n) => {
    files['Part_' + n + '.gs'] = '// 画面の部品(' + n + ')。中身は1行の文字列です。末尾の [[END-OF-' + n + ']] まで入っていれば全部です。\nfunction part_' + n + '() { return ' + JSON.stringify(parts[n] + end(n)) + '; }\n';
  });
  Object.keys(files).forEach((n) => fs.writeFileSync(path.join(outDir, n), files[n]));
  console.log('作りました: ' + Object.keys(files).map((n) => n + '(' + files[n].length.toLocaleString() + '文字)').join(' / '));
}
main().catch((e) => { console.error(e); process.exit(1); });

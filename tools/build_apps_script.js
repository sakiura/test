#!/usr/bin/env node
/**
 * index.html / style.css / sync-sheet.js / app.js を 1 つにまとめて、
 * Apps Script に貼り付ける apps-script/Index.html・Style.html・Js1.html〜 を作る。
 *
 *   cd tools && npm install     (最初の1回だけ。terser を入れる)
 *   node tools/build_apps_script.js
 *
 * 貼り付けやすく、壊れにくくするために、できあがりを圧縮している。
 *  - JS: コメントをなくして圧縮する(改行が失われても動く)
 *  - CSS・HTML: 余分な空白と改行をなくす
 * 各ファイル末尾の <!--END-OF-名前--> は、貼り付けが途中で切れていないかを Web.gs が確かめる目印。
 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

async function main() {
  let terser;
  try { terser = require('terser'); } catch (e) { terser = require(path.join(__dirname, 'node_modules', 'terser')); }
  const html = read('index.html');
  const marker = '<!--SHARE-CONFIG-->';
  const body = html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf(marker));

  const js = read('sync-sheet.js') + '\n' + read('app.js');
  const min = await terser.minify(js, { ecma: 2020, compress: { passes: 2 }, mangle: true, format: { comments: false } });
  if (min.error) throw min.error;
  if (min.code.includes('</script>')) throw new Error('JS の中に </script> があるとページが壊れる');

  const css = read('style.css')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,])\s*/g, '$1')
    .trim();
  const small = body.replace(/\s+/g, ' ').trim();

  // 1ファイルを小さく保つため、画面を「骨組み(Index)・見た目(Style)・動き(Js1〜)」に分ける。
  // 動きの部分は、1つの <script> にするため、決まった長さで機械的に切って、Web.gs がつなぎ直す。
  const SIZE = 24000;
  const jsParts = [];
  for (let i = 0; i < min.code.length; i += SIZE) jsParts.push(min.code.slice(i, i + SIZE));
  const names = jsParts.map((_, i) => 'Js' + (i + 1));
  const end = (n) => '\n<!--END-OF-' + n + '-->\n';
  const outDir = path.join(root, 'apps-script');
  fs.readdirSync(outDir).filter((f) => /^(Index|Style|Js\d+)\.html$/.test(f)).forEach((f) => fs.unlinkSync(path.join(outDir, f)));
  const files = {
    Index: '<!DOCTYPE html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<title>研修スケジュール管理</title>\n<!--PART:Style-->\n</head>\n<body>\n' +
      small + '\n' + marker + '\n<script>' + names.map((n) => '<!--PART:' + n + '-->').join('') + '</script>\n</body>\n</html>' + end('Index'),
    Style: '<style>' + css + '</style>' + end('Style'),
  };
  names.forEach((n, i) => { files[n] = jsParts[i] + end(n); });
  Object.keys(files).forEach((n) => fs.writeFileSync(path.join(outDir, n + '.html'), files[n]));
  console.log('作りました: ' + Object.keys(files).map((n) => n + '.html(' + files[n].length.toLocaleString() + '文字)').join(' / '));
}
main().catch((e) => { console.error(e); process.exit(1); });

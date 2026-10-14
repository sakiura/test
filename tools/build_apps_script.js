#!/usr/bin/env node
/**
 * index.html / style.css / sync-sheet.js / app.js を 1 つにまとめて、
 * Apps Script に貼り付ける apps-script/Index.html を作る。
 *
 *   cd tools && npm install     (最初の1回だけ。terser を入れる)
 *   node tools/build_apps_script.js
 *
 * 貼り付けやすく、壊れにくくするために、できあがりを圧縮している。
 *  - JS: コメントをなくして圧縮する(改行が失われても動く)
 *  - CSS・HTML: 余分な空白と改行をなくす
 * 末尾の <!--END-OF-INDEX--> は、貼り付けが途中で切れていないかを Code.gs が確かめる目印。
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

  const out = '<!DOCTYPE html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<title>研修スケジュール管理</title>\n' +
    '<style>' + css + '</style>\n</head>\n<body>\n' + small + '\n' + marker + '\n<script>' + min.code + '</script>\n</body>\n</html>\n<!--END-OF-INDEX-->\n';
  fs.writeFileSync(path.join(root, 'apps-script', 'Index.html'), out);
  console.log(`apps-script/Index.html を作りました(${out.length.toLocaleString()} 文字, ${out.split('\n').length} 行)`);
}
main().catch((e) => { console.error(e); process.exit(1); });

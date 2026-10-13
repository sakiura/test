#!/usr/bin/env python3
"""index.html / style.css / sync-sheet.js / app.js を 1 つにまとめて、
Apps Script に貼り付ける apps-script/Index.html を作る。

  python3 tools/build_apps_script.py
"""
import pathlib

root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'style.css').read_text(encoding='utf-8')
js = (root / 'sync-sheet.js').read_text(encoding='utf-8') + '\n' + (root / 'app.js').read_text(encoding='utf-8')

marker = '<!--SHARE-CONFIG-->'
body = html[html.index('<body>') + len('<body>'):html.index(marker)]
assert '</script>' not in js, 'JS の中に </script> があるとページが壊れる'

out = (
    '<!DOCTYPE html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<title>研修スケジュール管理</title>\n'
    '<style>\n' + css + '\n</style>\n</head>\n<body>\n' + body +
    marker + '\n<script>\n' + js + '\n</script>\n</body>\n</html>\n'
)
(root / 'apps-script' / 'Index.html').write_text(out, encoding='utf-8')
print(f'apps-script/Index.html を作りました({len(out):,} 文字)')

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

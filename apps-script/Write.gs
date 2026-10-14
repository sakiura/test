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

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

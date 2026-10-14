// Apps Script(apps-script/Code.gs)を、Google に載せずに試すための模擬環境。
// スプレッドシート・排他・キャッシュなどを、メモリ上の簡単な実装で置き換える。
const vm = require('vm');
const fs = require('fs');
const path = require('path');

function createGas(opts = {}) {
  const sheets = new Map();
  let clock = opts.clock || (() => Date.now());
  const logs = [];

  class Sheet {
    constructor(name) { this.name = name; this.rows = []; }
    getLastRow() { return this.rows.length; }
    getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
    deleteRow(r) { this.rows.splice(r - 1, 1); }
  }
  class Range {
    constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
    getValues() {
      const out = [];
      for (let i = 0; i < this.nr; i++) {
        const row = this.sh.rows[this.r - 1 + i] || [];
        out.push(Array.from({ length: this.nc }, (_, j) => (row[this.c - 1 + j] === undefined ? '' : row[this.c - 1 + j])));
      }
      return out;
    }
    getValue() { return this.getValues()[0][0]; }
    setValues(vals) {
      vals.forEach((v, i) => {
        const idx = this.r - 1 + i;
        while (this.sh.rows.length <= idx) this.sh.rows.push([]);
        const row = this.sh.rows[idx];
        v.forEach((x, j) => { row[this.c - 1 + j] = x; });
        for (let j = 0; j < row.length; j++) if (row[j] === undefined) row[j] = '';
      });
      return this;
    }
  }
  const ss = {
    getSheetByName: (n) => sheets.get(n) || null,
    insertSheet: (n) => { const s = new Sheet(n); sheets.set(n, s); return s; },
  };
  const cacheStore = new Map(), props = new Map();
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cacheStore.get(k) ?? null, put: (k, v) => { cacheStore.set(k, v); } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => { props.set(k, String(v)); } }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ getContent: () => s, setMimeType() { return this; } }) },
    Utilities: { getUuid: () => require('crypto').randomUUID() },
    Logger: { log: (m) => logs.push(m) },
    HtmlService: { createHtmlOutputFromFile: () => ({ getContent: () => '<html><!--SHARE-CONFIG--></html>' }),
      createHtmlOutput: (h) => ({ html: h, setTitle() { return this; }, addMetaTag() { return this; }, setXFrameOptionsMode() { return this; } }), XFrameOptionsMode: { ALLOWALL: 1 } },
    ScriptApp: { getService: () => ({ getUrl: () => opts.execUrl || 'https://script.google.com/macros/s/TEST/exec' }) },
    Date: class extends Date { static now() { return clock(); } },
    JSON, Number, String, Array, Object, Error, Math, RegExp,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8'), ctx, { filename: 'Code.gs' });
  return {
    ctx, sheets, logs,
    setClock: (f) => { clock = f; },
    // google.script.run.api と同じ入口
    api: (req) => JSON.parse(ctx.api(JSON.stringify(req))),
    // 他の場所のページからの POST と同じ入口
    post: (body) => ctx.doPost({ postData: { contents: body } }).getContent(),
    get: (parameter) => ctx.doGet({ parameter }),
  };
}
module.exports = { createGas };

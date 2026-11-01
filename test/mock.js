// Giả lập window.claude (db, assets, downloads) để kiểm tra đường lưu trữ đám mây.
(() => {
  const KEY = '__mockdb';
  const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const save = (m) => sessionStorage.setItem(KEY, JSON.stringify(m));
  const snap = (id, data) => ({ id, exists: data !== undefined, data: () => data, metadata: { fromCache: false, hasPendingWrites: false } });
  const delay = () => new Promise(r => setTimeout(r, 15));
  const segs = p => p.split('/');
  const docRef = (path) => {
    if (segs(path).length % 2) throw new TypeError('doc path must be even: ' + path);
    return {
      id: segs(path).pop(), path,
      async get() { await delay(); const m = load(); return snap(segs(path).pop(), m[path]); },
      async set(d) { await delay(); if (typeof d !== 'object' || Array.isArray(d)) throw { code: 'invalid_argument' }; if (JSON.stringify(d).length > 262144) throw { code: 'invalid_argument', message: 'too big' }; if (window.__failWrites) throw { code: 'unavailable', message: 'x' }; const m = load(); m[path] = JSON.parse(JSON.stringify(d)); save(m); window.__writes = (window.__writes || 0) + 1; },
      async delete() { await delay(); const m = load(); delete m[path]; save(m); },
    };
  };
  const colRef = (path) => {
    if (segs(path).length % 2 === 0) throw new TypeError('collection path must be odd: ' + path);
    return {
      path,
      doc: id => docRef(path + '/' + (id || Math.random().toString(36).slice(2))),
      async get() { await delay(); const m = load(); const docs = Object.keys(m).filter(k => k.startsWith(path + '/') && segs(k).length === segs(path).length + 1).sort().map(k => snap(segs(k).pop(), m[k])); return { docs, size: docs.length, empty: !docs.length }; },
    };
  };
  const db = Object.freeze({ doc: docRef, collection: colRef });
  const assets = Object.freeze({
    async upload(blob, opt) { await delay(); const id = Math.random().toString(16).slice(2).padEnd(32, '0').slice(0, 32); (window.__assets ||= {})[id] = URL.createObjectURL(blob); return { id, url: window.__assets[id], sizeBytes: blob.size, contentType: (opt && opt.type) || blob.type }; },
    async delete(id) { return { deleted: true }; },
    async list() { return { assets: [], usage: {} }; },
  });
  const downloads = Object.freeze({
    async save({ filename, data }) {
      const buf = data instanceof Blob ? await data.arrayBuffer() : data;
      const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
      (window.__downloads ||= []).push({ filename, b64: btoa(s), size: b.length });
      return { status: 'saved' };
    },
  });
  const map = { db, assets, downloads };
  window.claude = Object.freeze({ use: async (n) => { await delay(); return map[n] || null; } });
})();
/* kiểm thử: mở sẵn mọi phần thu gọn để các bước bấm nút bên trong vẫn chạy */
window.addEventListener('DOMContentLoaded', () => { try { Object.assign(S.open, { quote: true, pays: true, changes: true, atts: true, notes: true, hist: true, qplan: true, qnotes: true, profit: true, debt: true, 'st-shop': true, 'st-bank': true, 'st-plan': true, 'st-def': true, 'st-data': true, 'st-team': true, 'st-ipad': true, 'st-app': true, ocash: true, 'pl-acc': true }); } catch (e) { /* app chưa tải */ } });

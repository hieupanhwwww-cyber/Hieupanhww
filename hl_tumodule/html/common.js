// Cầu nối HtmlDialog ↔ Ruby: mỗi yêu cầu có số thứ tự (seq) để bỏ phản hồi trễ.
(function () {
  const HL = {
    seq: 0, pending: {}, onpush: null, latest: {},
    req(action, data, channel) {
      return new Promise((resolve) => {
        const s = ++HL.seq;
        HL.pending[s] = { resolve, channel };
        if (channel) HL.latest[channel] = s;
        try {
          sketchup.req(JSON.stringify({ seq: s, action, data: data || {} }));
        } catch (e) {
          delete HL.pending[s];
          resolve({ ok: false, error: 'Không kết nối được SketchUp: ' + e.message });
        }
      });
    },
    reply(m) {
      const p = HL.pending[m.seq];
      delete HL.pending[m.seq];
      if (!p) return;
      if (p.channel && HL.latest[p.channel] !== m.seq) return; // phản hồi cũ, bỏ qua
      p.resolve(m);
    },
    push(m) { if (HL.onpush) HL.onpush(m); },
    esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    toast(msg, bad) {
      let t = document.getElementById('toast');
      if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
      t.textContent = msg; t.className = bad ? 'show bad' : 'show';
      clearTimeout(HL._tt); HL._tt = setTimeout(() => { t.className = ''; }, bad ? 6000 : 3000);
    },
    // Hộp nhập/xác nhận tự vẽ (không phụ thuộc prompt() của trình duyệt nhúng).
    modal(title, opts) {
      return new Promise((resolve) => {
        const bg = document.createElement('div'); bg.className = 'modal-bg';
        const input = opts.input !== undefined ? `<input id="mdl-in" value="${HL.esc(opts.input)}">` : '';
        bg.innerHTML = `<div class="modal"><h3>${HL.esc(title)}</h3>${opts.text ? `<p>${HL.esc(opts.text)}</p>` : ''}${input}
          <div class="row-btn"><button class="ghost" id="mdl-no">Hủy</button><button id="mdl-ok">${HL.esc(opts.ok || 'Đồng ý')}</button></div></div>`;
        document.body.appendChild(bg);
        const inp = bg.querySelector('#mdl-in');
        const done = (v) => { bg.remove(); resolve(v); };
        bg.querySelector('#mdl-no').onclick = () => done(null);
        bg.querySelector('#mdl-ok').onclick = () => done(inp ? inp.value : true);
        bg.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(inp ? inp.value : true); if (e.key === 'Escape') done(null); });
        (inp || bg.querySelector('#mdl-ok')).focus();
        if (inp) inp.select();
      });
    },
    // Ảnh minh họa dựng bằng SVG theo loại hình học (dùng ngoại tuyến).
    thumb(c) {
      const S = (inner) => `<svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="80" fill="#f6efe4"/>${inner}</svg>`;
      const box = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fffaf2" stroke="#7a5230" stroke-width="2"/>`;
      const line = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7a5230" stroke-width="1.5"/>`;
      switch (c.module_type) {
        case 'cuc_tren': return S(box(25, 30, 50, 22) + line(50, 30, 50, 52) + box(25, 52, 50, 22));
        case 'tu_hong': return S(box(18, 14, 34, 60) + box(52, 34, 26, 40) + line(18, 44, 52, 44));
        case 'tu_bep_duoi': return S(box(15, 40, 70, 32) + line(50, 40, 50, 72) + `<rect x="12" y="36" width="76" height="4" fill="#b8865a"/>`);
        case 'tu_bep_tren': return S(box(15, 10, 70, 30) + line(50, 10, 50, 40) + `<rect x="15" y="62" width="70" height="10" fill="#e9dccb"/>`);
        case 'tu_bep_L': return S(`<path d="M15 20 H85 V42 H37 V72 H15 Z" fill="#fffaf2" stroke="#7a5230" stroke-width="2"/>` + line(37, 20, 37, 42));
        case 'tu_L': return S(`<path d="M15 15 H85 V35 H35 V70 H15 Z" fill="#fffaf2" stroke="#7a5230" stroke-width="2"/>`);
        case 'tu_ngan_keo': return S(box(25, 12, 50, 60) + line(25, 32, 75, 32) + line(25, 52, 75, 52) + line(42, 22, 58, 22) + line(42, 42, 58, 42) + line(42, 62, 58, 62));
        case 'thung_ngan_keo': return S(`<path d="M20 35 L45 25 L85 35 L60 47 Z" fill="#fffaf2" stroke="#7a5230" stroke-width="2"/><path d="M20 35 V55 L60 67 V47 M60 67 L85 55 V35" fill="none" stroke="#7a5230" stroke-width="2"/>`);
        case 'tu_bo': return S(`<path d="M25 12 H55 A20 20 0 0 1 75 32 V72 H25 Z" fill="#fffaf2" stroke="#7a5230" stroke-width="2"/>` + line(25, 40, 75, 40));
        default: return S(box(25, 10, 50, 62) + line(50, 10, 50, 72) + line(46, 40, 46, 46) + line(54, 40, 54, 46));
      }
    },
    // Dựng ô nhập theo schema trường.
    fieldHtml(fd, val, err) {
      const id = 'f_' + fd.key.replace(/[^a-zA-Z0-9_]/g, '_');
      const v = val === undefined ? fd.value : val;
      let inp;
      if (fd.type === 'info') return `<div class="field info"><label>${HL.esc(fd.label)}</label><div class="val">${HL.esc(v).replace(/\n/g, '<br>')}</div></div>`;
      if (fd.type === 'enum') {
        inp = `<select id="${id}" data-key="${HL.esc(fd.key)}">` + fd.options.map(o => `<option value="${HL.esc(o[0])}" ${String(o[0]) === String(v) ? 'selected' : ''}>${HL.esc(o[1])}</option>`).join('') + '</select>';
      } else if (fd.type === 'bool') {
        return `<div class="field bool"><label><input type="checkbox" id="${id}" data-key="${HL.esc(fd.key)}" ${v ? 'checked' : ''}> ${HL.esc(fd.label)}</label>${err ? `<div class="err">${HL.esc(err)}</div>` : ''}</div>`;
      } else if (fd.type === 'mm' || fd.type === 'int') {
        inp = `<input id="${id}" data-key="${HL.esc(fd.key)}" inputmode="decimal" value="${HL.esc(v)}">`;
      } else {
        inp = `<input id="${id}" data-key="${HL.esc(fd.key)}" value="${HL.esc(v)}">`;
      }
      const range = (fd.min !== undefined || fd.max !== undefined) ? `<span class="hint">${fd.min !== undefined ? fd.min : ''}–${fd.max !== undefined ? fd.max : ''}</span>` : '';
      return `<div class="field${err ? ' has-err' : ''}"><label for="${id}">${HL.esc(fd.label)} ${range}</label>${inp}${err ? `<div class="err">${HL.esc(err)}</div>` : ''}</div>`;
    },
    readField(el) {
      if (el.type === 'checkbox') return el.checked;
      return el.value;
    }
  };
  window.HL = HL;
  // Phím gõ trong ô nhập không được đẩy sang công cụ vùng vẽ.
  document.addEventListener('keydown', (e) => { if (e.target.matches('input,select,textarea')) e.stopPropagation(); }, true);
})();

/* ============ Aadhaar OCR (offline, Tesseract.js) ============ */
const OCR = {
  worker: null,
  async ensure() {
    if (this.worker) return this.worker;
    if (!window.Tesseract) throw new Error('OCR library not loaded');
    this.worker = await Tesseract.createWorker('eng', 1, {
      workerPath: 'vendor/tesseract/worker.min.js',
      corePath: 'vendor/tesseract/',
      langPath: 'vendor/tesseract/',
      gzip: false,
    });
    return this.worker;
  },

  async scan(imageSource) {
    const w = await this.ensure();
    const { data } = await w.recognize(imageSource);
    return this.parse(data.text || '');
  },

  parse(text) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    return { name: this.name(lines), aadhaar: this.aadhaar(text), address: this.address(text), raw: text };
  },

  aadhaar(text) {
    const m = /\b(\d{4})\s?(\d{4})\s?(\d{4})\b/.exec(text);
    return m ? `${m[1]} ${m[2]} ${m[3]}` : '';
  },

  _stop: ['government', 'india', 'unique', 'identification', 'authority', 'aadhaar', 'aadhar',
    'dob', 'date of birth', 'year of birth', 'yob', 'male', 'female', 'vid', 'address',
    's/o', 'd/o', 'c/o', 'w/o', 'father', 'mother', 'uidai'],

  looksName(s) {
    if (!(s.length >= 2 && s.length <= 40)) return false;
    const low = s.toLowerCase();
    if (this._stop.some((w) => low.includes(w))) return false;
    if (/\d/.test(s)) return false;
    if (s.replace(/[^A-Za-z]/g, '').length < 3) return false;
    const w = s.split(/\s+/); return w.length >= 1 && w.length <= 4;
  },

  name(lines) {
    const mk = ['dob', 'date of birth', 'year of birth', 'yob', 'male', 'female'];
    for (let i = 0; i < lines.length; i++) {
      if (mk.some((m) => lines[i].toLowerCase().includes(m))) {
        for (let j = i - 1; j >= 0; j--) if (this.looksName(lines[j])) return lines[j];
      }
    }
    for (const l of lines) if (this.looksName(l)) return l;
    return '';
  },

  address(text) {
    const low = text.toLowerCase();
    let idx = -1;
    for (const kw of ['address', 's/o', 'd/o', 'c/o', 'w/o']) {
      const p = low.indexOf(kw); if (p !== -1 && (idx === -1 || p < idx)) idx = p;
    }
    if (idx === -1) return '';
    let chunk = text.slice(idx).replace(/^\s*address\s*[:\-]?\s*/i, '');
    chunk = chunk.replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '').replace(/\s+/g, ' ').trim();
    return chunk.slice(0, 200);
  },
};
window.OCR = OCR;

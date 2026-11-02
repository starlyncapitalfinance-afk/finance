/* ============ UI: shell, router, screens, collection report + PDF ============ */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); };

const NAV = [
  { group: 'jlgLoan', items: [['#/jlg/new', 'newJlg'], ['#/jlg/records', 'jlgRecords']] },
  { group: 'center', items: [['#/center/new', 'newCenter'], ['#/center/records', 'centerRecords']] },
];

const UI = {
  mount() {
    document.body.innerHTML =
      `<div id="app"></div><div id="layer"></div><div id="toast"></div>`;
    window.addEventListener('hashchange', () => this.refresh());
    this.refresh();
  },

  syncBadge() {
    const st = Sync.state, p = Sync.pending();
    const label = { local: 'Local', syncing: 'Syncing…', ok: 'Synced', offline: 'Offline', error: 'Sync error', auth: 'Sign in again' }[st] || st;
    return `<span class="badge ${st}">${label}${p ? ' · ' + p : ''}</span>`;
  },

  refresh() {
    if (!Core.Auth.signedIn) return this.renderAuth();
    const app = $('#app');
    const hash = location.hash || '#/jlg/new';
    app.innerHTML = `
      <aside class="side">
        <div class="logo"><img src="icon-192.png" alt="logo"/></div>
        <nav class="nav">${NAV.map((g) => `
          <div class="grp">${t(g.group)}</div>
          ${g.items.map(([h, k]) => `<a href="${h}" class="navlink ${hash.startsWith(h) ? 'active' : ''}">${t(k)}</a>`).join('')}
        `).join('')}</nav>
        <div class="side-foot">
          <button class="lang" data-act="lang">${t('lang')}</button>
          <div class="who">${esc(Core.Auth.user.name)}${Core.Auth.isAdmin ? ' · admin' : ''}</div>
          <button class="logout" data-act="logout">⎋ ${t('logout')}</button>
        </div>
      </aside>
      <main class="main">
        <header class="top">
          <button class="burger" data-act="menu">☰</button>
          <div class="title">${t('appName')}</div>
          ${this.syncBadge()}
        </header>
        <section id="view"></section>
      </main>`;
    app.querySelectorAll('[data-act]').forEach((b) => b.onclick = () => this.act(b.dataset.act));
    this.route(hash);
  },

  act(a) {
    if (a === 'logout') { if (confirm('Log out?')) Sync.signOut(); }
    if (a === 'lang') { setLang(getLang() === 'en' ? 'ta' : 'en'); this.refresh(); }
    if (a === 'menu') { $('#app').classList.toggle('open'); }
  },

  chrome() { const b = $('.badge'); if (b) b.outerHTML = this.syncBadge(); },

  route(hash) {
    $('#app').classList.remove('open');
    const v = $('#view'); if (!v) return;
    if (hash.startsWith('#/jlg/new')) return this.jlgNew(v);
    if (hash.startsWith('#/jlg/records')) return this.jlgRecords(v);
    if (hash.startsWith('#/center/new')) return this.centerNew(v);
    if (hash.startsWith('#/center/records')) return this.centerRecords(v);
    location.hash = '#/jlg/new';
  },

  /* ---------------- auth ---------------- */
  renderAuth() {
    const def = window.DEFAULT_SERVER || '';
    $('#app').innerHTML = `
      <div class="auth">
        <div class="card auth-card">
          <img class="auth-logo" src="icon-192.png"/>
          <h1>${t('appName')}</h1>
          <div class="seg"><button data-m="login" class="on">${t('login')}</button><button data-m="setup">${t('setup')}</button></div>
          <label>${t('serverUrl')}</label><input id="a-url" value="${esc(def)}"/>
          <div id="a-name-wrap" style="display:none"><label>${t('fullName')}</label><input id="a-name"/></div>
          <label>${t('username')}</label><input id="a-user"/>
          <label>${t('password')}</label><input id="a-pass" type="password"/>
          <div id="a-err" class="err"></div>
          <button id="a-go" class="btn-accent">${t('login')}</button>
        </div>
      </div>`;
    let mode = 'login';
    const segs = $('#app').querySelectorAll('.seg button');
    segs.forEach((b) => b.onclick = () => {
      mode = b.dataset.m; segs.forEach((x) => x.classList.toggle('on', x === b));
      $('#a-name-wrap').style.display = mode === 'setup' ? '' : 'none';
      $('#a-go').textContent = mode === 'setup' ? t('setup') : t('login');
    });
    $('#a-go').onclick = async () => {
      const url = $('#a-url').value, u = $('#a-user').value, p = $('#a-pass').value, nm = ($('#a-name') || {}).value || u;
      $('#a-err').textContent = '';
      try {
        if (!url) throw new Error('Server URL required');
        if (mode === 'setup') await Sync.setup(url, nm, u, p); else await Sync.signIn(url, u, p);
        this.refresh();
      } catch (e) { $('#a-err').textContent = (e.message || 'Failed'); }
    };
  },

  /* ---------------- JLG new ---------------- */
  jlgNew(v) {
    const centers = Core.all('centers').sort((a, b) => (a.centerNumber > b.centerNumber ? -1 : 1));
    const days = Core.COLLECTION_DAYS;
    const today = Core.fmtDMY(new Date());
    v.innerHTML = `
      <h2>${t('newJlg')}</h2>
      <div class="card form">
        <label>${t('center')}</label>
        <select id="f-center">${centers.length ? centers.map((c) => `<option value="${esc(c.id)}">${esc(c.centerNumber)} — ${esc(c.centerName)}</option>`).join('') : `<option value="">(no centers — create one first)</option>`}</select>
        <label>${t('customer')}</label><input id="f-member"/>
        <label>${t('aadhaar')}</label><input id="f-aadhaar"/>
        <label>${t('address')}</label><textarea id="f-address"></textarea>
        <label>${t('loanDate')}</label><input id="f-date" value="${today}"/>
        <label>${t('loanAmt')}</label><input id="f-amt" inputmode="decimal"/>
        <label>${t('interest')}</label><input id="f-rate" inputmode="decimal"/>
        <label>${t('tenure')}</label><input id="f-tenure" inputmode="numeric"/>
        <label>${t('collectionDay')}</label><select id="f-day">${days.map((d) => `<option>${d}</option>`).join('')}</select>
        <label>${t('emi')}</label><input id="f-emi" readonly class="ro"/>
        <label>${t('nominee')}</label><input id="f-nom"/>
        <label>${t('relation')}</label><input id="f-rel"/>
        <div class="row-btn"><button id="f-save" class="btn-accent">${t('save')}</button><button id="f-clear" class="btn-ghost">${t('clear')}</button></div>
      </div>`;
    const recalc = () => {
      const emi = Core.weeklyEmi(Core.num($('#f-amt').value), Core.num($('#f-rate').value), parseInt($('#f-tenure').value || 0, 10) || 0);
      $('#f-emi').value = emi > 0 ? '₹ ' + Core.inr(emi) + ' (Week)' : '';
    };
    ['f-amt', 'f-rate', 'f-tenure'].forEach((id) => $('#' + id).oninput = recalc);
    $('#f-clear').onclick = () => this.jlgNew(v);
    $('#f-save').onclick = () => {
      const cid = $('#f-center').value, c = Core.get('centers', cid);
      if (!c) return toast('Select a center');
      if (!$('#f-member').value.trim()) return toast('Customer name required');
      const emi = Core.weeklyEmi(Core.num($('#f-amt').value), Core.num($('#f-rate').value), parseInt($('#f-tenure').value || 0, 10) || 0);
      Core.saveRec('loans', {
        loanNumber: Core.nextLoanNumber(), loanDate: $('#f-date').value,
        centerNumber: c.centerNumber, centerName: c.centerName,
        member: $('#f-member').value.trim(), aadhaar: $('#f-aadhaar').value.trim(),
        address: $('#f-address').value.trim(), loanAmt: Core.num($('#f-amt').value),
        interestRate: Core.num($('#f-rate').value), tenure: parseInt($('#f-tenure').value || 0, 10) || 0,
        collectionDay: $('#f-day').value, emi, freq: 'Week',
        nomineeName: $('#f-nom').value.trim(), nomineeRelation: $('#f-rel').value.trim(), status: 'Active',
      });
      toast('JLG loan saved'); this.jlgNew(v);
    };
  },

  /* ---------------- JLG records ---------------- */
  jlgRecords(v) {
    const centers = Core.all('centers');
    const st = this._jf || (this._jf = { name: '', loanNo: '', aadhaar: '', center: '', day: '', status: '' });
    const draw = () => {
      let rows = Core.all('loans').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      rows = rows.filter((r) =>
        (!st.name || (r.member || '').toLowerCase().includes(st.name.toLowerCase())) &&
        (!st.loanNo || (r.loanNumber || '').toLowerCase().includes(st.loanNo.toLowerCase())) &&
        (!st.aadhaar || (r.aadhaar || '').includes(st.aadhaar)) &&
        (!st.center || r.centerNumber === st.center) &&
        (!st.day || r.collectionDay === st.day) &&
        (!st.status || r.status === st.status));
      $('#jlg-count').textContent = `(${rows.length})`;
      $('#jlg-body').innerHTML = rows.length ? rows.map((r) => `
        <div class="tr">
          <div>${esc(r.loanNumber)}</div><div>${esc(r.member)}</div>
          <div>${esc(r.centerNumber || '')}</div><div class="num">${Core.inr(Core.num(r.loanAmt))}</div>
          <div class="num">${Core.inr(Core.num(r.emi))}</div><div>${esc(r.collectionDay || '')}</div>
          <div><span class="pill ${r.status}">${esc(r.status)}</span></div>
          <div><button class="mini" data-report="${esc(r.id)}">📊 ${t('report')}</button></div>
        </div>`).join('') : `<div class="empty">No records</div>`;
      $('#jlg-body').querySelectorAll('[data-report]').forEach((b) => b.onclick = () => this.report(b.dataset.report));
    };
    v.innerHTML = `
      <h2>${t('jlgRecords')} <span id="jlg-count" class="muted"></span></h2>
      <div class="card filters">
        <input id="jf-name" placeholder="${t('customer')}"/>
        <input id="jf-loan" placeholder="${t('loanNo')}"/>
        <input id="jf-aad" placeholder="${t('aadhaar')}"/>
        <select id="jf-center"><option value="">${t('center')}: All</option>${centers.map((c) => `<option value="${esc(c.centerNumber)}">${esc(c.centerNumber)} — ${esc(c.centerName)}</option>`).join('')}</select>
        <select id="jf-day"><option value="">${t('collectionDay')}: All</option>${Core.COLLECTION_DAYS.map((d) => `<option>${d}</option>`).join('')}</select>
        <select id="jf-status"><option value="">${t('status')}: All</option><option>Active</option><option>Closed</option><option>Overdue</option></select>
      </div>
      <div class="card table">
        <div class="tr th"><div>${t('loanNo')}</div><div>${t('customer')}</div><div>${t('centerNo')}</div><div>${t('loanAmt')}</div><div>${t('emi')}</div><div>${t('collectionDay')}</div><div>${t('status')}</div><div>${t('report')}</div></div>
        <div id="jlg-body"></div>
      </div>`;
    $('#jf-name').oninput = (e) => { st.name = e.target.value; draw(); };
    $('#jf-loan').oninput = (e) => { st.loanNo = e.target.value; draw(); };
    $('#jf-aad').oninput = (e) => { st.aadhaar = e.target.value; draw(); };
    $('#jf-center').onchange = (e) => { st.center = e.target.value; draw(); };
    $('#jf-day').onchange = (e) => { st.day = e.target.value; draw(); };
    $('#jf-status').onchange = (e) => { st.status = e.target.value; draw(); };
    draw();
  },

  /* ---------------- collection report ---------------- */
  report(loanId) {
    const loan = Core.get('loans', loanId); if (!loan) return;
    const admin = Core.Auth.isAdmin;
    const layer = $('#layer');
    const render = () => {
      const sched = Core.loanSchedule(loan);
      const collected = Core.totalCollected(loan.id);
      const totalDue = Core.num(loan.emi) * (parseInt(loan.tenure || 0, 10) || 0);
      const today = new Date();
      layer.innerHTML = `
        <div class="modal-bg"></div>
        <div class="modal">
          <div class="modal-head">
            <b>${t('weekly')} — ${esc(loan.loanNumber)}</b>
            <div><button class="mini" id="r-print">🖨 ${t('print')}</button> <button class="mini" id="r-close">✕</button></div>
          </div>
          <div class="sum">
            <div><span>${t('customer')}</span>${esc(loan.member)}</div>
            <div><span>${t('center')}</span>${esc(loan.centerName || loan.centerNumber || '')}</div>
            <div><span>${t('emi')}</span>₹ ${Core.inr(Core.num(loan.emi))}</div>
            <div><span>${t('collected')}</span>₹ ${Core.inr(collected)}</div>
            <div><span>Balance</span>₹ ${Core.inr(Math.max(totalDue - collected, 0))}</div>
          </div>
          <div class="table">
            <div class="tr th"><div>${t('week')}</div><div>${t('due')}</div><div>${t('emi')}</div><div>${t('collected')}</div><div>${t('status')}</div><div></div></div>
            <div id="r-body">${sched.map((w) => {
              const saved = w.saved; const paid = saved ? Core.num(saved.amountPaid) : 0;
              const stt = saved ? (paid > 0 ? 'Paid' : 'Nil') : (w.dueObj < today ? 'Overdue' : 'Pending');
              const editable = !saved || admin;
              return `<div class="tr">
                <div>${w.weekNo}</div><div>${w.dueDate}</div><div class="num">${Core.inr(w.amountDue)}</div>
                <div><input class="wk" data-wk="${w.weekNo}" data-due="${w.dueDate}" value="${saved ? Core.inr(paid) : ''}" ${editable ? '' : 'readonly'} inputmode="decimal"/></div>
                <div><span class="pill ${stt}">${stt}</span></div>
                <div>${editable ? `<button class="mini save" data-save="${w.weekNo}">💾</button>` : `<span class="muted sm">🔒 ${t('adminOnly')}</span>`}</div>
              </div>`;
            }).join('')}</div>
          </div>
        </div>`;
      $('#r-close').onclick = () => layer.innerHTML = '';
      $('#r-print').onclick = () => this.reportPDF(loan);
      layer.querySelectorAll('[data-save]').forEach((b) => b.onclick = () => {
        const wk = +b.dataset.save; const inp = layer.querySelector(`.wk[data-wk="${wk}"]`);
        const amt = Core.num(inp.value); const due = inp.dataset.due;
        if (amt <= 0 && !confirm('Save week ' + wk + ' with ₹0?')) return;
        Core.saveCollection(loan, wk, due, Core.num(loan.emi), amt);
        toast('Week ' + wk + ' saved'); render();
      });
    };
    render();
  },

  reportPDF(loan) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    try { doc.addImage(window.LOGO_DATA_URL, 'PNG', W / 2 - 23, 10, 46, 23); } catch (e) {}
    doc.setFontSize(16); doc.setTextColor('#0E1B3A');
    doc.text(t('appName'), W / 2, 40, { align: 'center' });
    doc.setFontSize(11); doc.setTextColor('#3B6FE0');
    doc.text(t('weekly'), W / 2, 47, { align: 'center' });

    const collected = Core.totalCollected(loan.id);
    const totalDue = Core.num(loan.emi) * (parseInt(loan.tenure || 0, 10) || 0);
    doc.autoTable({
      startY: 52, theme: 'grid', styles: { fontSize: 9 },
      body: [
        ['Loan No', loan.loanNumber, 'Customer', loan.member],
        ['Center', (loan.centerName || loan.centerNumber || '-'), 'Collection Day', loan.collectionDay || '-'],
        ['Loan Amount', 'Rs. ' + Core.inr(Core.num(loan.loanAmt)), 'Weekly EMI', 'Rs. ' + Core.inr(Core.num(loan.emi))],
        ['Tenure', (loan.tenure || 0) + ' weeks', 'Interest %', String(loan.interestRate || '')],
        ['Total Collected', 'Rs. ' + Core.inr(collected), 'Balance', 'Rs. ' + Core.inr(Math.max(totalDue - collected, 0))],
        ['Address', loan.address || '-', 'Status', loan.status || ''],
      ],
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [238, 240, 251] }, 2: { fontStyle: 'bold', fillColor: [238, 240, 251] } },
    });
    const today = new Date();
    const rows = Core.loanSchedule(loan).map((w) => {
      const saved = w.saved; const paid = saved ? Core.num(saved.amountPaid) : 0;
      const stt = saved ? (paid > 0 ? 'Paid' : 'Nil') : (w.dueObj < today ? 'Overdue' : 'Pending');
      return [w.weekNo, w.dueDate, Core.inr(w.amountDue), saved ? Core.inr(paid) : '-',
        saved && saved.updatedAt ? Core.fmtDMY(new Date(saved.updatedAt)) : '-', stt];
    });
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 6, theme: 'grid', styles: { fontSize: 8.5 },
      head: [['Week', 'Due Date', 'EMI Due', 'Collected', 'Paid Date', 'Status']],
      headStyles: { fillColor: [14, 27, 58] },
      alternateRowStyles: { fillColor: [238, 240, 251] },
      body: rows,
    });
    doc.setFontSize(8); doc.setTextColor('#6B7280');
    doc.text('Generated ' + Core.fmtDMY(today) + ' • computer-generated report',
      14, doc.lastAutoTable.finalY + 8);
    doc.save('CollectionReport_' + loan.loanNumber + '.pdf');
  },

  /* ---------------- centers ---------------- */
  centerNew(v) {
    v.innerHTML = `
      <h2>${t('newCenter')}</h2>
      <div class="card form">
        <label>${t('centerNo')}</label><input value="${esc(Core.nextCenterNumber())}" readonly class="ro"/>
        <div class="muted sm">(generated automatically on save)</div>
        <label>${t('centerName')}</label><input id="c-name"/>
        <div class="row-btn"><button id="c-save" class="btn-accent">${t('save')}</button></div>
      </div>`;
    $('#c-save').onclick = () => {
      const name = $('#c-name').value.trim(); if (!name) return toast('Center name required');
      Core.saveRec('centers', { centerNumber: Core.nextCenterNumber(), centerName: name });
      toast('Center saved'); this.centerNew(v);
    };
  },

  centerRecords(v) {
    const st = this._cf || (this._cf = { num: '', name: '' });
    const draw = () => {
      let rows = Core.all('centers').sort((a, b) => (a.centerNumber > b.centerNumber ? -1 : 1));
      rows = rows.filter((r) =>
        (!st.num || (r.centerNumber || '').toLowerCase().includes(st.num.toLowerCase())) &&
        (!st.name || (r.centerName || '').toLowerCase().includes(st.name.toLowerCase())));
      $('#c-count').textContent = `(${rows.length})`;
      $('#c-body').innerHTML = rows.length ? rows.map((r) => `
        <div class="tr"><div>${esc(r.centerNumber)}</div><div>${esc(r.centerName)}</div>
        <div>${Core.Auth.isAdmin ? `<button class="mini del" data-del="${esc(r.id)}">🗑</button>` : ''}</div></div>`).join('')
        : `<div class="empty">No centers</div>`;
      $('#c-body').querySelectorAll('[data-del]').forEach((b) => b.onclick = () => {
        if (confirm('Delete center?')) { Core.removeRec('centers', b.dataset.del); draw(); }
      });
    };
    v.innerHTML = `
      <h2>${t('centerRecords')} <span id="c-count" class="muted"></span></h2>
      <div class="card filters">
        <input id="cf-num" placeholder="${t('centerNo')}"/><input id="cf-name" placeholder="${t('centerName')}"/>
      </div>
      <div class="card table">
        <div class="tr th"><div>${t('centerNo')}</div><div>${t('centerName')}</div><div></div></div>
        <div id="c-body"></div>
      </div>`;
    $('#cf-num').oninput = (e) => { st.num = e.target.value; draw(); };
    $('#cf-name').oninput = (e) => { st.name = e.target.value; draw(); };
    draw();
  },
};

window.UI = UI;

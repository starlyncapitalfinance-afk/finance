/* ============ UI: shell, router, screens, collection report + PDF ============ */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); };

const NAV = [
  { group: 'overview', items: [['#/dashboard', 'dashboard'], ['#/eod', 'eod']] },
  { group: 'loan', items: [['#/jlg/new', 'newLoan'], ['#/jlg/records', 'loanRecords']] },
  { group: 'center', items: [['#/center/new', 'newCenter'], ['#/center/records', 'centerRecords']] },
  { group: 'account', items: [['#/users', 'users', true], ['#/profile', 'profile']] },
];
const SVG = (p) => `<svg class="navic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const NAV_ICON = {
  dashboard: SVG('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  eod: SVG('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="m9 15 2 2 4-4"/>'),
  newLoan: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
  loanRecords: SVG('<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>'),
  newCenter: SVG('<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>'),
  centerRecords: SVG('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h6"/>'),
  users: SVG('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5"/><path d="M16 4.6a3 3 0 0 1 0 5.8M21 20c0-2.5-1.3-4.2-3.4-4.8"/>'),
  profile: SVG('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 19a6 6 0 0 1 11 0"/>'),
};

const UI = {
  mount() {
    document.body.innerHTML =
      `<div id="app"></div><div id="layer"></div><div id="toast"></div>`;
    window.addEventListener('hashchange', () => this.refresh());
    // close the mobile drawer when tapping outside the sidebar
    document.addEventListener('click', (e) => {
      const app = $('#app');
      if (app && app.classList.contains('open') &&
          !e.target.closest('.side') && !e.target.closest('[data-act="menu"]')) {
        app.classList.remove('open');
      }
      // Tapping a nav link that is ALREADY active won't fire hashchange,
      // so force a fresh re-render (re-reads data + resets that view's filters).
      const nav = e.target.closest('a.navlink');
      if (nav && location.hash === nav.getAttribute('href')) {
        e.preventDefault(); this.refresh();
      }
    });
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
    const hash = location.hash || '#/dashboard';
    app.innerHTML = `
      <aside class="side">
        <div class="logo"><img src="icon-192.png" alt="logo"/></div>
        <nav class="nav">${NAV.map((g) => `
          <div class="grp">${t(g.group)}</div>
          ${g.items.filter((it) => !it[2] || Core.Auth.isAdmin).map(([h, k]) => `<a href="${h}" class="navlink ${hash.startsWith(h) ? 'active' : ''}">${NAV_ICON[k] || ''}<span>${t(k)}</span></a>`).join('')}
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
        ${(Sync.serverStale && Core.Auth.isAdmin) ? `<div class="warnbar">⚠ ${t('serverStale')}</div>` : ''}
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
    if (hash.startsWith('#/users')) return this.usersView(v);
    if (hash.startsWith('#/profile')) return this.profileView(v);
    if (hash.startsWith('#/dashboard')) return this.dashboardView(v);
    if (hash.startsWith('#/eod')) return this.eodView(v);
    location.hash = '#/dashboard';
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

    // if the server already has an admin, hide "Set up server" (only Sign in)
    if (def) Sync.status(def).then((st) => {
      if (st && st.hasAdmin) {
        const setupBtn = $('#app').querySelector('.seg button[data-m="setup"]');
        if (setupBtn) setupBtn.style.display = 'none';
        const seg = $('#app').querySelector('.seg'); if (seg) seg.style.display = 'none';
      }
    }).catch(() => {});
  },

  /* ---------------- JLG new ---------------- */
  jlgNew(v) {
    const centers = Core.all('centers').sort((a, b) => (a.centerNumber > b.centerNumber ? -1 : 1));
    const today = Core.fmtDMY(new Date());
    const todayISO = new Date().toISOString().slice(0,10);
    const rels = ['Wife', 'Husband', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Other'];
    const aadBoxes = Array.from({ length: 12 }, (_, i) =>
      `<input class="aad" data-i="${i}" maxlength="1" inputmode="numeric"${i === 4 || i === 8 ? ' style="margin-left:8px"' : ''}/>`).join('');
    v.innerHTML = `
      <div class="formhead">
        <h2>${t('newLoan')}</h2>
        <div class="hbtns">
          <button id="f-scanbtn" class="mini">📷 ${t('scan')}</button>
          <button id="f-sample" class="mini" style="background:#059669">${t('sample')}</button>
        </div>
      </div>
      <input type="file" id="f-scan" accept="image/*" capture="environment" hidden/>
      <div class="card form">
        <label>${t('center')} <span class="req">*</span></label>
        <select id="f-center">${centers.length ? centers.map((c) => `<option value="${esc(c.id)}">${esc(c.centerNumber)} — ${esc(c.centerName)}</option>`).join('') : `<option value="">(no centers — create one first)</option>`}</select>
        <label>${t('group')} <span class="req">*</span></label>
        <select id="f-group"></select>
        <label>${t('customer')} <span class="req">*</span></label><input id="f-member"/>
        <div class="frow">
          <div><label>${t('phone')} <span class="req">*</span></label><input id="f-phone" inputmode="tel" maxlength="15" placeholder="10-digit mobile"/></div>
          <div><label>${t('altPhone')}</label><input id="f-phone2" inputmode="tel" maxlength="15" placeholder="${t('optional')}"/></div>
        </div>
        <label>${t('aadhaar')}</label>
        <div class="aadwrap">${aadBoxes}</div>
        <label>${t('address')}</label><textarea id="f-address"></textarea>
        <label>${t('loanDate')} <span class="req">*</span></label><input id="f-date" type="date" value=""/>
        <div class="frow">
          <div><label>${t('loanAmt')} <span class="req">*</span></label><input id="f-amt" inputmode="decimal"/></div>
          <div><label>${t('deliveryAmt')} <span class="req">*</span></label><input id="f-deliv" inputmode="decimal"/></div>
        </div>
        <div class="frow">
          <div><label>${t('tenure')} <span class="req">*</span></label><input id="f-tenure" inputmode="numeric"/></div>
          <div><label>${t('emi')} <span class="req">*</span></label><input id="f-emi" inputmode="decimal"/></div>
        </div>
        <div class="frow">
          <div><label>${t('totalCollectable')}</label><input id="f-total" readonly class="ro"/></div>
          <div><label>${t('totalInterest')}</label><input id="f-int" readonly class="ro"/></div>
        </div>
        <div class="frow">
          <div><label>${t('flatPct')}</label><input id="f-flat" readonly class="ro"/></div>
          <div><label>${t('weeksPaid')}</label><input id="f-paid" inputmode="numeric" placeholder="0"/></div>
        </div>
        <div class="muted sm" style="margin:-4px 0 6px">${t('weeksPaidHint')}</div>
        <div class="frow">
          <div><label>${t('nominee')}</label><input id="f-nom"/></div>
          <div><label>${t('relation')}</label><select id="f-rel">${rels.map((r) => `<option>${r}</option>`).join('')}</select></div>
        </div>
        <div class="row-btn"><button id="f-save" class="btn-accent">${t('save')}</button><button id="f-clear" class="btn-ghost">${t('clear')}</button></div>
      </div>`;

    // aadhaar 12-box auto-advance
    const boxes = [...v.querySelectorAll('.aad')];
    boxes.forEach((b, i) => {
      b.oninput = () => {
        b.value = b.value.replace(/\D/g, '').slice(0, 1);
        if (b.value && i < 11) boxes[i + 1].focus();
      };
      b.onkeydown = (e) => {
        if (e.key === 'Backspace' && !b.value && i > 0) boxes[i - 1].focus();
      };
      b.onpaste = (e) => {
        const d = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 12);
        if (d) { e.preventDefault(); d.split('').forEach((ch, k) => { if (boxes[k]) boxes[k].value = ch; }); boxes[Math.min(d.length, 11)].focus(); }
      };
    });
    const readAad = () => { const d = boxes.map((b) => b.value).join(''); return d ? d.replace(/(\d{4})(\d{4})(\d{0,4})/, (m, a, b2, c) => [a, b2, c].filter(Boolean).join(' ')) : ''; };
    const setAad = (val) => { const d = String(val || '').replace(/\D/g, '').slice(0, 12).split(''); boxes.forEach((b, k) => b.value = d[k] || ''); };

    const recalc = () => {
      const amt = Core.num($('#f-amt').value);
      const weeks = parseInt($('#f-tenure').value || 0, 10) || 0;
      const emi = Core.num($('#f-emi').value);
      const total = emi * weeks;
      const interest = Math.max(total - amt, 0);
      const flat = amt > 0 ? (interest / amt * 100) : 0;
      $('#f-total').value = total > 0 ? '₹ ' + Core.inr(total) : '';
      $('#f-int').value = total > 0 ? '₹ ' + Core.inr(interest) : '';
      $('#f-flat').value = total > 0 ? flat.toFixed(2) + ' %' : '';
    };
    ['f-amt', 'f-tenure', 'f-emi'].forEach((id) => $('#' + id).oninput = recalc);

    // Group dropdown — list only the groups that belong to the chosen center
    const fillGroups = () => {
      const c = Core.get('centers', $('#f-center').value);
      const groups = c ? Core.groupsForCenter(c.centerNumber) : [];
      $('#f-group').innerHTML = groups.length
        ? `<option value="">${t('groupSelect')}</option>` + groups.map((g) => `<option value="${esc(g.id)}">${esc(g.groupName)} (${esc(g.groupNumber)})</option>`).join('')
        : `<option value="">${t('noGroupsForCenter')}</option>`;
    };
    $('#f-center').onchange = fillGroups;
    fillGroups();

    $('#f-clear').onclick = () => this.jlgNew(v);

    $('#f-sample').onclick = () => {
      // Leave the first 4 fields EMPTY for the user to fill:
      //   Center, Customer Name, Aadhaar, Address
      // Auto-load sensible defaults for everything else (user can still edit).
      $('#f-date').value = todayISO;
      $('#f-amt').value = '10200'; $('#f-deliv').value = '9600'; $('#f-tenure').value = '20'; $('#f-emi').value = '620';
      $('#f-paid').value = '0';
      $('#f-nom').value = 'Kamala Kannan'; $('#f-rel').value = 'Wife';
      recalc();
      toast(t('sampleLoaded'));
    };

    $('#f-scanbtn').onclick = () => $('#f-scan').click();
    $('#f-scan').onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const btn = $('#f-scanbtn'); const old = btn.textContent; btn.textContent = '⏳'; btn.disabled = true;
      try {
        const url = URL.createObjectURL(file);
        const r = await OCR.scan(url); URL.revokeObjectURL(url);
        if (r.name) $('#f-member').value = r.name;
        if (r.aadhaar) setAad(r.aadhaar);
        if (r.address) $('#f-address').value = r.address;
        toast((r.name || r.aadhaar || r.address) ? 'Filled — please verify' : 'Could not read card');
      } catch (err) { toast('Scan failed: ' + (err.message || err)); }
      finally { btn.textContent = old; btn.disabled = false; }
    };

    $('#f-save').onclick = () => {
      const cid = $('#f-center').value, c = Core.get('centers', cid);
      if (!c) return toast(t('centerRequired'));
      if (!$('#f-group').value) return toast(t('groupRequired'));
      if (!$('#f-member').value.trim()) return toast('Customer name required');
      if (!$('#f-date').value) return toast(t('loanDateRequired'));
      const phone = $('#f-phone').value.trim();
      if (!phone) return toast(t('phoneRequired'));
      if (!/^[0-9+\-\s]{6,15}$/.test(phone)) return toast(t('phoneInvalid'));
      const amt = Core.num($('#f-amt').value);
      const deliv = Core.num($('#f-deliv').value);
      const weeks = parseInt($('#f-tenure').value || 0, 10) || 0;
      const emi = Core.num($('#f-emi').value);
      if (amt <= 0) return toast(t('loanAmtRequired'));
      if (deliv <= 0) return toast(t('deliveryAmtRequired'));
      if (weeks <= 0) return toast(t('tenureRequired'));
      if (emi <= 0) return toast(t('emiRequired'));
      const totalCollectable = emi * weeks;
      const interestTotal = Math.max(totalCollectable - amt, 0);
      const flatPct = amt > 0 ? (interestTotal / amt * 100) : 0;
      const loanDate = Core.parseDMY($('#f-date').value);
      const weekday = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][loanDate.getDay()];
      const saved = Core.saveRec('loans', {
        loanNumber: Core.nextLoanNumber(), loanDate: (function(x){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(x);return m?`${m[3]}-${m[2]}-${m[1]}`:x;})($('#f-date').value),
        centerNumber: c.centerNumber, centerName: c.centerName,
        groupId: $('#f-group').value, groupName: (Core.get('groups', $('#f-group').value) || {}).groupName || '', groupNumber: (Core.get('groups', $('#f-group').value) || {}).groupNumber || '',
        member: $('#f-member').value.trim(), aadhaar: readAad(),
        phone: phone, altPhone: $('#f-phone2').value.trim(),
        address: $('#f-address').value.trim(), loanAmt: Core.num($('#f-amt').value),
        deliveryAmt: Core.num($('#f-deliv').value), tenure: weeks,
        interestRate: +flatPct.toFixed(2), interestTotal, totalCollectable,
        collectionDay: weekday, emi, freq: 'Week',
        nomineeName: $('#f-nom').value.trim(), nomineeRelation: $('#f-rel').value, status: 'Active',
      });
      const wp = parseInt($('#f-paid').value || 0, 10) || 0;
      if (wp > 0) Core.importPaidWeeks(saved, wp);
      toast('Loan saved' + (wp > 0 ? ' (' + wp + ' weeks marked paid)' : '')); this.jlgNew(v);
    };
  },

  /* ---------------- JLG records ---------------- */
  jlgRecords(v) {
    // Always start fresh when landing on Loan Records (reset search + collapse all).
    const st = (this._jf = { q: '', status: '', center: '', group: '' });
    const EC = new Set();  // expanded center numbers
    const EG = new Set();  // expanded "centerNumber||groupId" keys
    let exported = [];

    // Build the Center -> Group -> Customers tree from the current data.
    const buildTree = () => {
      const q = st.q.trim().toLowerCase();
      let loans = Core.all('loans').filter((l) => !l.deleted);
      if (st.center) loans = loans.filter((l) => l.centerNumber === st.center);
      if (st.group) loans = loans.filter((l) => (l.groupId || '') === st.group);
      if (st.status) loans = loans.filter((l) => Core.loanStatus(l) === st.status);
      if (q) loans = loans.filter((l) =>
        (l.member || '').toLowerCase().includes(q) ||
        (l.loanNumber || '').toLowerCase().includes(q) ||
        (l.aadhaar || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
        (l.groupName || '').toLowerCase().includes(q));
      exported = loans;

      const centers = Core.all('centers').sort((a, b) => (a.centerNumber > b.centerNumber ? 1 : -1));
      const byCenter = {};
      loans.forEach((l) => { (byCenter[l.centerNumber || '—'] = byCenter[l.centerNumber || '—'] || []).push(l); });

      // only centers that have (matching) loans, newest-at-top within group
      const tree = [];
      centers.concat([{ centerNumber: '—', centerName: 'No Center', village: '' }]).forEach((c) => {
        const cl = byCenter[c.centerNumber]; if (!cl || !cl.length) return;
        const groupsMap = {};
        cl.forEach((l) => { const k = l.groupId || 'ungrouped'; (groupsMap[k] = groupsMap[k] || { id: k, name: l.groupName || t('ungrouped'), number: l.groupNumber || '', loans: [] }).loans.push(l); });
        const groups = Object.values(groupsMap).sort((a, b) => (a.name > b.name ? 1 : -1));
        let camt = 0, ccol = 0;
        groups.forEach((g) => {
          g.loans.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          g.amt = g.loans.reduce((s, l) => s + Core.num(l.loanAmt), 0);
          g.col = g.loans.reduce((s, l) => s + Core.totalCollected(l.id), 0);
          camt += g.amt; ccol += g.col;
        });
        tree.push({ center: c, count: cl.length, groups, amt: camt, col: ccol });
      });
      return tree;
    };

    const draw = () => {
      const tree = buildTree();
      const total = exported.length;
      const searching = !!st.q.trim() || !!st.status;
      $('#jlg-count').textContent = `(${total})`;
      const host = $('#jlg-acc');

      if (!tree.length) { host.innerHTML = `<div class="empty" style="padding:28px">${t('noRecords')}</div>`; return; }

      const money = (n) => '₹ ' + Core.inr(n);
      let rows = '';
      tree.forEach((node) => {
        const cnum = node.center.centerNumber;
        const copen = searching || EC.has(cnum);
        const csub = [esc(cnum), node.center.village ? esc(node.center.village) : '', node.count + ' ' + t('customers')].filter(Boolean).join(' · ');
        rows += `<div class="ntr lvl0 ${copen ? 'exp' : ''}" data-center="${esc(cnum)}" role="button">
          <div class="ntr-name" style="padding-left:14px">
            <span class="ntr-chev ${copen ? 'open' : ''}">▸</span>
            <span class="ntr-txt"><b>${esc(node.center.centerName || '')}</b><small>${csub}</small><span class="m-metrics">${t('loanAmt')} ${money(node.amt)} · ${t('collected')} ${money(node.col)}</span></span>
          </div>
          <div class="ntr-num">${money(node.amt)}</div>
          <div class="ntr-num">${money(node.col)}</div>
          <div class="ntr-actcol"></div>
        </div>`;
        if (!copen) return;
        node.groups.forEach((g) => {
          const gkey = cnum + '||' + g.id;
          const gopen = searching || EG.has(gkey);
          rows += `<div class="ntr lvl1 ${gopen ? 'exp' : ''}" data-group="${esc(gkey)}" role="button">
            <div class="ntr-name" style="padding-left:40px">
              <span class="ntr-chev ${gopen ? 'open' : ''}">▸</span>
              <span class="ntr-txt"><b>${esc(g.name)}</b><small>${g.number ? esc(g.number) + ' · ' : ''}${g.loans.length} ${t('customers')}</small><span class="m-metrics">${t('loanAmt')} ${money(g.amt)} · ${t('collected')} ${money(g.col)}</span></span>
            </div>
            <div class="ntr-num">${money(g.amt)}</div>
            <div class="ntr-num">${money(g.col)}</div>
            <div class="ntr-actcol">${g.id !== 'ungrouped' ? `<button class="mini" data-greport="${esc(cnum)}||${esc(g.id)}" title="${t('groupReport')}">📊</button>` : ''}</div>
          </div>`;
          if (!gopen) return;
          g.loans.forEach((l) => {
            const sttv = Core.loanStatus(l);
            rows += `<div class="ntr lvl2 leaf" data-detail="${esc(l.id)}" role="button">
              <div class="ntr-name" style="padding-left:66px">
                <span class="ntr-dot"></span>
                <span class="ntr-txt"><b>${esc(l.member)}</b><small>${esc(l.loanNumber)}${l.phone ? ' · 📞 ' + esc(l.phone) : ''} · ${esc(l.collectionDay || '')} · <span class="pill ${sttv}">${sttv}</span></small><span class="m-metrics">${t('loanAmt')} ${money(Core.num(l.loanAmt))} · ${t('collected')} ${money(Core.totalCollected(l.id))}</span></span>
              </div>
              <div class="ntr-num">${money(Core.num(l.loanAmt))}</div>
              <div class="ntr-num">${money(Core.totalCollected(l.id))}</div>
              <div class="ntr-actcol"><button class="mini" data-report="${esc(l.id)}" title="${t('report')}">📊</button></div>
            </div>`;
          });
        });
      });
      host.innerHTML = rows;

      // wire expand/collapse + actions
      host.querySelectorAll('[data-center]').forEach((r) => r.onclick = () => {
        const k = r.dataset.center; EC.has(k) ? EC.delete(k) : EC.add(k); draw();
      });
      host.querySelectorAll('[data-group]').forEach((r) => r.onclick = () => {
        const k = r.dataset.group; EG.has(k) ? EG.delete(k) : EG.add(k); draw();
      });
      host.querySelectorAll('[data-report]').forEach((b) => b.onclick = (e) => {
        e.stopPropagation(); this.report(b.dataset.report, draw);
      });
      host.querySelectorAll('[data-greport]').forEach((b) => b.onclick = (e) => {
        e.stopPropagation(); const [cn, gid] = b.dataset.greport.split('||'); this.groupReport(cn, gid, draw);
      });
      host.querySelectorAll('.ntr.leaf[data-detail]').forEach((row) => row.onclick = () => this.loanDetail(row.dataset.detail, draw));
    };

    v.innerHTML = `
      <div class="pagehead"><h2>${t('loanRecords')} <span id="jlg-count" class="muted"></span></h2>
        <button id="jlg-xls" class="mini" style="background:#059669">⬇ ${t('excel')}</button></div>
      <div class="card filters">
        <input id="jf-q" placeholder="🔍 ${t('searchCustomer')}"/>
        <select id="jf-center"><option value="">${t('allCenters')}</option>${Core.all('centers').sort((a,b)=>(a.centerNumber>b.centerNumber?1:-1)).map((c)=>`<option value="${esc(c.centerNumber)}">${esc(c.centerNumber)} — ${esc(c.centerName)}</option>`).join('')}</select>
        <select id="jf-group"><option value="">${t('allGroups')}</option></select>
        <select id="jf-status"><option value="">${t('status')}: All</option><option>Active</option><option>Closed</option><option>Overdue</option></select>
      </div>
      <div class="ntree">
        <div class="ntree-head">
          <div class="nh-name">${t('centerGroupCustomer')}</div>
          <div class="nh-num">${t('loanAmt')}</div>
          <div class="nh-num">${t('collected')}</div>
          <div class="nh-act"></div>
        </div>
        <div class="ntree-body" id="jlg-acc"></div>
      </div>`;
    const fillGroupFilter = () => {
      const gs = st.center ? Core.groupsForCenter(st.center) : [];
      $('#jf-group').innerHTML = `<option value="">${t('allGroups')}</option>` + gs.map((g) => `<option value="${esc(g.id)}">${esc(g.groupName)} (${esc(g.groupNumber)})</option>`).join('');
    };
    $('#jf-q').oninput = (e) => { st.q = e.target.value; draw(); };
    $('#jf-center').onchange = (e) => { st.center = e.target.value; st.group = ''; fillGroupFilter(); draw(); };
    $('#jf-group').onchange = (e) => { st.group = e.target.value; draw(); };
    $('#jf-status').onchange = (e) => { st.status = e.target.value; draw(); };
    $('#jlg-xls').onclick = () => this.exportXlsx('Loans', exported.map((r) => ({ 'Loan No': r.loanNumber, Customer: r.member, Phone: r.phone || '', 'Alt Phone': r.altPhone || '', Aadhaar: r.aadhaar, Center: r.centerName, Group: r.groupName || '', 'Loan Amt': Core.num(r.loanAmt), 'Interest %': r.interestRate, Tenure: r.tenure, 'Collection Day': r.collectionDay, 'Weekly EMI': Core.num(r.emi), Status: r.status })));
    draw();
  },

  loanDetail(id, after) {
    const r = Core.get('loans', id); if (!r) return;
    const admin = Core.Auth.canManage;   // Admin or Manager can edit/assign/delete members
    const layer = $('#layer');
    layer.innerHTML = `
      <div class="modal-bg"></div>
      <div class="modal" style="max-width:460px">
        <div class="modal-head">
          <div><b>${esc(r.loanNumber)}</b><div class="rsub" style="margin-top:2px">${esc(r.member)}</div></div>
          <button class="mini ghost" id="d-close">✕</button>
        </div>
        <div style="margin:2px 0 10px"><span class="pill ${Core.loanStatus(r)}">${Core.loanStatus(r)}</span></div>

        <div class="dsec">${t('customer')}</div>
        <div class="dl">
          <div><span>${t('customer')}</span><b>${esc(r.member)}</b></div>
          <div><span>${t('phone')}</span><b>${r.phone ? `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>` : '-'}</b></div>
          <div><span>${t('altPhone')}</span><b>${r.altPhone ? `<a href="tel:${esc(r.altPhone)}">${esc(r.altPhone)}</a>` : '-'}</b></div>
          <div><span>${t('center')}</span><b>${esc(r.centerName || '-')}</b></div>
          <div><span>${t('group')}</span><b>${esc(r.groupName || '-')}</b></div>
          <div><span>${t('aadhaar')}</span><b>${esc(r.aadhaar || '-')}</b></div>
          <div><span>${t('address')}</span><b>${esc(r.address || '-')}</b></div>
        </div>

        <div class="dsec">${t('loan')}</div>
        <div class="dl">
          <div><span>${t('loanDate')}</span><b>${esc(r.loanDate || '-')}</b></div>
          <div><span>${t('loanAmt')}</span><b>₹ ${Core.inr(Core.num(r.loanAmt))}</b></div>
          <div><span>${t('deliveryAmt')}</span><b>₹ ${Core.inr(Core.num(r.deliveryAmt))}</b></div>
          <div><span>${t('emi')}</span><b>₹ ${Core.inr(Core.num(r.emi))}</b></div>
          <div><span>${t('tenure')}</span><b>${esc(r.tenure || '-')}</b></div>
          <div><span>${t('flatPct')}</span><b>${esc(r.interestRate || '0')} %</b></div>
          <div><span>${t('collectionDay')}</span><b>${esc(r.collectionDay || '-')}</b></div>
        </div>

        <div class="dsec">${t('nominee')}</div>
        <div class="dl">
          <div><span>${t('nominee')}</span><b>${esc(r.nomineeName || '-')}</b></div>
          <div><span>${t('relation')}</span><b>${esc(r.nomineeRelation || '-')}</b></div>
        </div>

        ${admin ? `<div class="dsec">${t('assignGroup')}</div>
        <div class="row-btn" style="gap:8px">
          <select id="d-group" style="flex:1">
            <option value="">${t('ungrouped')}</option>
            ${Core.groupsForCenter(r.centerNumber).map((g) => `<option value="${esc(g.id)}" ${g.id === r.groupId ? 'selected' : ''}>${esc(g.groupName)} (${esc(g.groupNumber)})</option>`).join('')}
          </select>
          <button class="mini" id="d-gsave" style="background:var(--accent)">${t('save')}</button>
        </div>
        ${Core.groupsForCenter(r.centerNumber).length ? '' : `<div class="muted sm" style="margin-top:4px">${t('noGroupsForCenter')}</div>`}` : ''}

        <label style="margin-top:14px">${t('status')}</label>
        <div class="row-btn">
          <button class="mini" data-st="Active" style="background:#059669">${t('active')}</button>
          <button class="mini" data-st="Closed" style="background:#6B7280">${t('closed')}</button>
          <button class="mini" data-st="Overdue" style="background:#DC2626">${t('overdue')}</button>
        </div>
        ${admin ? `<div class="row-btn" style="margin-top:12px">
          <button class="mini" id="d-edit" style="background:var(--brand)">✏️ ${t('editMember')}</button>
          <button class="mini del" id="d-del">🗑 ${t('del')}</button>
        </div>` : ''}
      </div>`;
    const close = () => { layer.innerHTML = ''; after && after(); };
    $('#d-close').onclick = close;
    layer.querySelector('.modal-bg').onclick = close;
    if (admin && $('#d-edit')) $('#d-edit').onclick = () => this.editMember(id, after);
    if (admin && $('#d-gsave')) $('#d-gsave').onclick = () => {
      const gid = $('#d-group').value; const g = Core.get('groups', gid);
      Core.saveRec('loans', { ...r, groupId: gid, groupName: g ? g.groupName : '', groupNumber: g ? g.groupNumber : '' });
      toast(gid ? t('movedToGroup') + ' ' + (g ? g.groupName : '') : t('removedFromGroup')); close();
    };
    layer.querySelectorAll('[data-st]').forEach((b) => b.onclick = () => {
      Core.saveRec('loans', { ...r, status: b.dataset.st }); toast('Status: ' + b.dataset.st); close();
    });
    if (admin) $('#d-del').onclick = () => { if (confirm('Delete loan ' + r.loanNumber + ' and all its collections?')) { Core.all('weeks').forEach((w) => { if (w.loanId === id) Core.removeRec('weeks', w.id); }); Core.removeRec('loans', id); toast('Deleted'); close(); } };
  },

  /* ---------------- edit member / loan details (admin/manager) ---------------- */
  editMember(id, after) {
    if (!Core.Auth.canManage) return toast(t('adminOnly'));
    const r = Core.get('loans', id); if (!r) return;
    const rels = ['Wife', 'Husband', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister', 'Other'];
    const layer = $('#layer');
    layer.innerHTML = `
      <div class="modal-bg"></div>
      <div class="modal" style="max-width:480px">
        <div class="modal-head">
          <div><b>${t('editMember')}</b><div class="rsub" style="margin-top:2px">${esc(r.loanNumber)}</div></div>
          <button class="mini ghost" id="em-close">✕</button>
        </div>
        <div class="form">
          <label>${t('customer')} <span class="req">*</span></label><input id="em-member" value="${esc(r.member || '')}"/>
          <div class="frow">
            <div><label>${t('phone')} <span class="req">*</span></label><input id="em-phone" inputmode="tel" maxlength="15" value="${esc(r.phone || '')}"/></div>
            <div><label>${t('altPhone')}</label><input id="em-phone2" inputmode="tel" maxlength="15" value="${esc(r.altPhone || '')}"/></div>
          </div>
          <label>${t('aadhaar')}</label><input id="em-aad" inputmode="numeric" maxlength="12" value="${esc(r.aadhaar || '')}"/>
          <label>${t('address')}</label><textarea id="em-address">${esc(r.address || '')}</textarea>
          <div class="frow">
            <div><label>${t('loanAmt')}</label><input id="em-amt" inputmode="decimal" value="${esc(Core.num(r.loanAmt))}"/></div>
            <div><label>${t('deliveryAmt')}</label><input id="em-deliv" inputmode="decimal" value="${esc(Core.num(r.deliveryAmt))}"/></div>
          </div>
          <div class="frow">
            <div><label>${t('tenure')}</label><input id="em-tenure" inputmode="numeric" value="${esc(r.tenure || 0)}"/></div>
            <div><label>${t('emi')}</label><input id="em-emi" inputmode="decimal" value="${esc(Core.num(r.emi))}"/></div>
          </div>
          <div class="frow">
            <div><label>${t('nominee')}</label><input id="em-nom" value="${esc(r.nomineeName || '')}"/></div>
            <div><label>${t('relation')}</label><select id="em-rel">${rels.map((x) => `<option ${x === r.nomineeRelation ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
          </div>
          <div class="row-btn" style="margin-top:14px"><button id="em-save" class="btn-accent">${t('save')}</button></div>
        </div>
      </div>`;
    const close = () => { layer.innerHTML = ''; after && after(); };
    $('#em-close').onclick = close;
    layer.querySelector('.modal-bg').onclick = close;
    $('#em-save').onclick = () => {
      const member = $('#em-member').value.trim(); if (!member) return toast('Customer name required');
      const phone = $('#em-phone').value.trim(); if (!phone) return toast(t('phoneRequired'));
      if (!/^[0-9+\-\s]{6,15}$/.test(phone)) return toast(t('phoneInvalid'));
      const amt = Core.num($('#em-amt').value);
      const tenure = parseInt($('#em-tenure').value || 0, 10) || 0;
      const emi = Core.num($('#em-emi').value);
      const totalCollectable = emi * tenure;
      const interestTotal = Math.max(totalCollectable - amt, 0);
      const flatPct = amt > 0 ? (interestTotal / amt * 100) : 0;
      Core.saveRec('loans', {
        ...r, member, phone, altPhone: $('#em-phone2').value.trim(),
        aadhaar: $('#em-aad').value.trim(), address: $('#em-address').value.trim(),
        loanAmt: amt, deliveryAmt: Core.num($('#em-deliv').value), tenure, emi,
        totalCollectable, interestTotal, interestRate: +flatPct.toFixed(2),
        nomineeName: $('#em-nom').value.trim(), nomineeRelation: $('#em-rel').value,
      });
      toast(t('memberUpdated')); close();
    };
  },

  async exportXlsx(name, rows) {
    if (!rows.length) return toast('Nothing to export');
    if (!window.XLSX) return toast('Excel library not loaded');
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, name);
    const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    await saveOrShare(name + '.xlsx', b64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    toast('Excel ready');
  },

  /* ---------------- collection report ---------------- */
  report(loanId, after) {
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
            <div><span>${t('phone')}</span>${esc(loan.phone || '-')}</div>
            <div><span>${t('loanDate')}</span>${esc(loan.loanDate || '')}</div>
            <div><span>${t('center')}</span>${esc(loan.centerName || loan.centerNumber || '')}</div>
            <div><span>${t('emi')}</span>₹ ${Core.inr(Core.num(loan.emi))}</div>
            <div><span>${t('collected')}</span>₹ ${Core.inr(collected)}</div>
            <div><span>Balance</span>₹ ${Core.inr(Math.max(totalDue - collected, 0))}</div>
          </div>
          <div class="table rtable">
            <div class="tr th"><div>${t('week')}</div><div>${t('due')}</div><div>${t('emi')}</div><div>${t('collected')}</div><div>${t('status')}</div><div></div></div>
            <div id="r-body">${sched.map((w) => {
              const saved = w.saved; const paid = saved ? Core.num(saved.amountPaid) : 0;
              const stt = saved ? (paid > 0 ? 'Paid' : 'Nil') : (w.dueObj < today ? 'Overdue' : 'Pending');
              const editable = !saved || admin;
              return `<div class="tr rrow">
                <div class="rc"><span class="rl">${t('week')}</span><b>${w.weekNo}</b></div>
                <div class="rc"><span class="rl">${t('due')}</span>${w.dueDate}</div>
                <div class="rc num"><span class="rl">${t('emi')}</span>${Core.inr(w.amountDue)}</div>
                <div class="rc rc-input"><span class="rl">${t('collected')}</span><input class="wk" data-wk="${w.weekNo}" data-due="${w.dueDate}" value="${saved ? Core.inr(paid) : Core.inr(w.amountDue)}" ${editable ? '' : 'readonly'} inputmode="decimal"/></div>
                <div class="rc"><span class="rl">${t('status')}</span><span class="pill ${stt}">${stt}</span></div>
                <div class="rc rc-act">${editable ? `<button class="mini save" data-save="${w.weekNo}">💾 <span class="savetxt">${t('save')}</span></button>` : `<span class="muted sm">🔒 ${t('adminOnly')}</span>`}</div>
              </div>`;
            }).join('')}</div>
          </div>
        </div>`;
      const closeModal = () => { layer.innerHTML = ''; if (typeof after === 'function') after(); };
      $('#r-close').onclick = closeModal;
      layer.querySelector('.modal-bg').onclick = closeModal;
      $('#r-print').onclick = () => this.reportPDF(loan);
      layer.querySelectorAll('[data-save]').forEach((b) => b.onclick = () => {
        const wk = +b.dataset.save; const inp = layer.querySelector(`.wk[data-wk="${wk}"]`);
        const amt = Core.num(inp.value); const due = inp.dataset.due;
        if (amt <= 0 && !confirm('Save week ' + wk + ' with ₹0?')) return;
        Core.saveCollection(loan, wk, due, Core.num(loan.emi), amt);
        toast('Week ' + wk + ' saved'); render();
        if (typeof after === 'function') after(); // keep the list behind the modal live
      });
    };
    render();
  },

  // register the bundled Inter font on a jsPDF doc (professional typography)
  pdfFont(doc) {
    const F = window.INTER_TTF; if (!F) return 'helvetica';
    try {
      doc.addFileToVFS('Inter-Regular.ttf', F.normal); doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
      doc.addFileToVFS('Inter-SemiBold.ttf', F.semibold); doc.addFont('Inter-SemiBold.ttf', 'Inter', 'bold');
      doc.setFont('Inter', 'normal');
      return 'Inter';
    } catch (e) { return 'helvetica'; }
  },

  async reportPDF(loan) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 14;
    const FONT = this.pdfFont(doc);
    const NAVY = [14, 27, 58], GREY = [107, 114, 128], LINE = [120, 120, 120];
    const today = new Date();

    // ---- centered letterhead (classic) — no subtitle ----
    doc.setFont(FONT, 'bold'); doc.setFontSize(20); doc.setTextColor(...NAVY);
    doc.text(t('appName'), W / 2, 21, { align: 'center' });
    doc.setFontSize(8.5); doc.setFont(FONT, 'normal'); doc.setTextColor(...GREY);
    doc.text(Core.fmtDMY(today), W - M - 3, 15, { align: 'right' });
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.4); doc.line(M + 3, 26, W - M - 3, 26);

    // ---- customer info (borderless, grey labels) ----
    doc.autoTable({
      startY: 31, theme: 'plain', margin: { left: M + 3, right: M + 3 },
      styles: { font: FONT, fontSize: 9.5, cellPadding: { top: 1.5, bottom: 1.5, left: 0, right: 2 }, textColor: [33, 37, 41] },
      body: [
        ['Loan No', loan.loanNumber, 'Customer', loan.member],
        ['Phone', loan.phone || '-', 'Center', (loan.centerName || loan.centerNumber || '-')],
        ['Group', loan.groupName || '-', 'Loan Date', loan.loanDate || '-'],
        ['Loan Amount', 'Rs. ' + Core.inr(Core.num(loan.loanAmt)), 'Weekly EMI', 'Rs. ' + Core.inr(Core.num(loan.emi))],
        ['Tenure', (loan.tenure || 0) + ' weeks', 'Nominee', loan.nomineeName || '-'],
      ],
      columnStyles: {
        0: { fontStyle: 'bold', textColor: GREY, cellWidth: 26 },
        1: { cellWidth: 60 },
        2: { fontStyle: 'bold', textColor: GREY, cellWidth: 26 },
        3: { cellWidth: 'auto' },
      },
    });

    // Week | Due Date | EMI Amount | Collected | Staff Sign | Member Sign  (Paid Date removed)
    const rows = Core.loanSchedule(loan).map((w) => {
      const saved = w.saved; const paid = saved ? Core.num(saved.amountPaid) : 0;
      return [w.weekNo, w.dueDate, Core.inr(w.amountDue), saved ? Core.inr(paid) : '', '', ''];
    });
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 5, theme: 'grid', margin: { left: M + 3, right: M + 3 },
      styles: { font: FONT, fontSize: 8.5, minCellHeight: 9, valign: 'middle', lineColor: LINE, lineWidth: 0.2, textColor: [40, 45, 55] },
      head: [['Week', 'Due Date', 'EMI Amount', 'Collected', 'Staff Sign', 'Member Sign']],
      headStyles: { font: FONT, fontStyle: 'bold', fillColor: [230, 234, 242], textColor: NAVY, halign: 'center', lineColor: LINE, lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: 16, halign: 'center' },
        1: { cellWidth: 26, halign: 'center' },
        2: { cellWidth: 26, halign: 'right' },
        3: { cellWidth: 26, halign: 'right' },
        4: { cellWidth: 'auto' },
        5: { cellWidth: 'auto' },
      },
      body: rows,
      didDrawPage: () => {
        // full page border (classic frame) + footer, on every page
        doc.setDrawColor(...NAVY); doc.setLineWidth(0.6); doc.rect(8, 8, W - 16, H - 16);
        doc.setFont(FONT, 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GREY);
        doc.text('Generated ' + Core.fmtDMY(today), W / 2, H - 12, { align: 'center' });
      },
    });
    const b64 = doc.output('datauristring').split(',')[1];
    await saveOrShare('CollectionReport_' + loan.loanNumber + '.pdf', b64, 'application/pdf');
    toast('PDF ready');
  },

  /* ---------------- group report (all customers in a group) ---------------- */
  groupReport(centerNumber, groupId, after) {
    const g = Core.get('groups', groupId);
    const center = Core.all('centers').find((c) => c.centerNumber === centerNumber) || {};
    const loans = Core.all('loans').filter((l) => !l.deleted && l.centerNumber === centerNumber && (l.groupId || '') === groupId)
      .sort((a, b) => (a.member || '').localeCompare(b.member || ''));
    const layer = $('#layer');
    const rowData = loans.map((l) => {
      const amt = Core.num(l.loanAmt);
      const totalDue = Core.num(l.emi) * (parseInt(l.tenure || 0, 10) || 0);
      const col = Core.totalCollected(l.id);
      return { l, amt, col, bal: Math.max(totalDue - col, 0), stt: Core.loanStatus(l) };
    });
    const tAmt = rowData.reduce((s, r) => s + r.amt, 0);
    const tCol = rowData.reduce((s, r) => s + r.col, 0);
    const tBal = rowData.reduce((s, r) => s + r.bal, 0);
    layer.innerHTML = `
      <div class="modal-bg"></div>
      <div class="modal" style="max-width:720px">
        <div class="modal-head">
          <div><b>${t('groupReport')}</b><div class="rsub" style="margin-top:2px">${esc(g ? g.groupName : t('ungrouped'))}${g ? ' · ' + esc(g.groupNumber) : ''} · ${esc(center.centerName || centerNumber)}</div></div>
          <div><button class="mini" id="gr-print">🖨 ${t('print')}</button> <button class="mini" id="gr-close">✕</button></div>
        </div>
        <div class="sum">
          <div><span>${t('customers')}</span>${loans.length}</div>
          <div><span>${t('loanAmt')}</span>₹ ${Core.inr(tAmt)}</div>
          <div><span>${t('collected')}</span>₹ ${Core.inr(tCol)}</div>
          <div><span>${t('balance')}</span>₹ ${Core.inr(tBal)}</div>
        </div>
        <div class="table rtable">
          <div class="tr th grtr"><div>${t('customer')}</div><div>${t('loanNo')}</div><div>${t('loanAmt')}</div><div>${t('collected')}</div><div>${t('balance')}</div><div>${t('status')}</div></div>
          <div>${rowData.map((r) => `<div class="tr rrow grtr" data-open="${esc(r.l.id)}" role="button">
            <div class="rc"><span class="rl">${t('customer')}</span><b>${esc(r.l.member)}${r.l.phone ? `<small style="display:block;color:#8A92A6;font-weight:400">📞 ${esc(r.l.phone)}</small>` : ''}</b></div>
            <div class="rc"><span class="rl">${t('loanNo')}</span>${esc(r.l.loanNumber)}</div>
            <div class="rc num"><span class="rl">${t('loanAmt')}</span>${Core.inr(r.amt)}</div>
            <div class="rc num"><span class="rl">${t('collected')}</span>${Core.inr(r.col)}</div>
            <div class="rc num"><span class="rl">${t('balance')}</span>${Core.inr(r.bal)}</div>
            <div class="rc"><span class="rl">${t('status')}</span><span class="pill ${r.stt}">${r.stt}</span></div>
          </div>`).join('') || `<div class="empty" style="padding:18px">${t('noRecords')}</div>`}</div>
        </div>
      </div>`;
    const close = () => { layer.innerHTML = ''; after && after(); };
    $('#gr-close').onclick = close;
    layer.querySelector('.modal-bg').onclick = close;
    $('#gr-print').onclick = () => this.groupReportPDF(center, g, rowData, { tAmt, tCol, tBal });
    layer.querySelectorAll('[data-open]').forEach((row) => row.onclick = () => this.report(row.dataset.open, () => this.groupReport(centerNumber, groupId, after)));
  },

  async groupReportPDF(center, g, rowData, totals) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    try { doc.addImage(window.LOGO_DATA_URL, 'PNG', W / 2 - 23, 10, 46, 23); } catch (e) {}
    doc.setFontSize(16); doc.setTextColor('#0E1B3A'); doc.text(t('appName'), W / 2, 40, { align: 'center' });
    doc.setFontSize(11); doc.setTextColor('#3B6FE0'); doc.text(t('groupReport'), W / 2, 47, { align: 'center' });
    doc.autoTable({
      startY: 52, theme: 'grid', styles: { fontSize: 9 },
      body: [
        ['Group', g ? g.groupName + ' (' + g.groupNumber + ')' : t('ungrouped'), 'Center', (center.centerName || '-')],
        ['Village', center.village || '-', 'Customers', String(rowData.length)],
      ],
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [238, 240, 251] }, 2: { fontStyle: 'bold', fillColor: [238, 240, 251] } },
    });
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 6, theme: 'grid', styles: { fontSize: 9 },
      head: [['Customer', 'Phone', 'Loan No', 'Loan Amt', 'Collected', 'Balance', 'Status']],
      headStyles: { fillColor: [14, 27, 58] }, alternateRowStyles: { fillColor: [238, 240, 251] },
      body: rowData.map((r) => [r.l.member, r.l.phone || '-', r.l.loanNumber, Core.inr(r.amt), Core.inr(r.col), Core.inr(r.bal), r.stt]),
      foot: [['Totals', '', '', Core.inr(totals.tAmt), Core.inr(totals.tCol), Core.inr(totals.tBal), '']],
      footStyles: { fillColor: [59, 111, 224], textColor: 255, fontStyle: 'bold' },
    });
    doc.setFontSize(8); doc.setTextColor('#6B7280');
    doc.text('Generated ' + Core.fmtDMY(new Date()) + ' • computer-generated report', 14, doc.lastAutoTable.finalY + 8);
    const b64 = doc.output('datauristring').split(',')[1];
    await saveOrShare('GroupReport_' + (g ? g.groupNumber : 'ungrouped') + '.pdf', b64, 'application/pdf');
    toast('PDF ready');
  },

  /* ---------------- centers ---------------- */
  centerNew(v) {
    const staff = Core.all('users');
    v.innerHTML = `
      <h2>${t('newCenter')}</h2>
      <div class="card form">
        <label>${t('centerNo')}</label><input value="${esc(Core.nextCenterNumber())}" readonly class="ro"/>
        <div class="muted sm">(generated automatically on save)</div>
        <label>${t('centerName')}</label><input id="c-name"/>
        <label>${t('village')}</label><input id="c-village" placeholder="${t('villageHint')}"/>
        <label>${t('staff')}</label>
        <select id="c-staff">${staff.length ? staff.map((u)=>`<option value="${esc(u.id)}">${esc(u.name)} (${esc(u.username||'')})</option>`).join('') : `<option value="">(no staff)</option>`}</select>
        <div class="row-btn"><button id="c-save" class="btn-accent">${t('save')}</button></div>
      </div>`;
    $('#c-save').onclick = () => {
      const name = $('#c-name').value.trim(); if (!name) return toast('Center name required');
      const sid = $('#c-staff').value; const su = Core.get('users', sid);
      Core.saveRec('centers', { centerNumber: Core.nextCenterNumber(), centerName: name, village: $('#c-village').value.trim(), staffId: sid, staffName: su ? su.name : '' });
      toast('Center saved'); this.centerNew(v);
    };
  },

  /* ---------------- edit an existing center (admin) ---------------- */
  editCenter(id, after) {
    const c = Core.get('centers', id); if (!c) return;
    const staff = Core.all('users');
    const layer = $('#layer');
    layer.innerHTML = `
      <div class="modal-bg"></div>
      <div class="modal" style="max-width:460px">
        <div class="modal-head">
          <div><b>${t('editCenter')}</b><div class="rsub" style="margin-top:2px">${esc(c.centerNumber)}</div></div>
          <button class="mini ghost" id="ec-close">✕</button>
        </div>
        <div class="form">
          <label>${t('centerName')}</label><input id="ec-name" value="${esc(c.centerName || '')}"/>
          <label>${t('village')}</label><input id="ec-village" value="${esc(c.village || '')}" placeholder="${t('villageHint')}"/>
          <label>${t('staff')}</label>
          <select id="ec-staff">${staff.length ? staff.map((u) => `<option value="${esc(u.id)}" ${u.id === c.staffId ? 'selected' : ''}>${esc(u.name)} (${esc(u.username || '')})</option>`).join('') : `<option value="">(no staff)</option>`}</select>
          <div class="row-btn" style="margin-top:14px"><button id="ec-save" class="btn-accent">${t('save')}</button></div>
        </div>
      </div>`;
    const close = () => { layer.innerHTML = ''; after && after(); };
    $('#ec-close').onclick = close;
    layer.querySelector('.modal-bg').onclick = close;
    $('#ec-save').onclick = () => {
      const name = $('#ec-name').value.trim(); if (!name) return toast('Center name required');
      const sid = $('#ec-staff').value; const su = Core.get('users', sid);
      // keep the same centerNumber so existing loans/groups stay linked
      Core.saveRec('centers', { ...c, centerName: name, village: $('#ec-village').value.trim(), staffId: sid, staffName: su ? su.name : '' });
      toast(t('centerUpdated')); close();
    };
  },

  centerRecords(v) {
    const admin = Core.Auth.canManage;   // Admin or Manager can edit/delete centers
    const st = this._cf || (this._cf = { num: '', name: '', page: 1 });
    const PER = 12; let current = [];
    const draw = () => {
      let rows = Core.all('centers').sort((a, b) => (a.centerNumber > b.centerNumber ? -1 : 1));
      rows = rows.filter((r) =>
        (!st.num || (r.centerNumber || '').toLowerCase().includes(st.num.toLowerCase())) &&
        (!st.name || (r.centerName || '').toLowerCase().includes(st.name.toLowerCase())));
      current = rows;
      const pages = Math.max(1, Math.ceil(rows.length / PER)); if (st.page > pages) st.page = pages;
      const slice = rows.slice((st.page - 1) * PER, st.page * PER);
      $('#c-count').textContent = `(${rows.length})`;
      $('#c-body').innerHTML = slice.length ? slice.map((r) => {
        const gc = Core.groupsForCenter(r.centerNumber).length;
        return `
        <tr><td>${esc(r.centerNumber)}</td><td>${esc(r.centerName)}</td><td>${esc(r.village || '-')}</td><td>${esc(r.staffName || '-')}</td>
        <td><button class="mini ghost" data-grp="${esc(r.id)}">👥 ${t('groups')} (${gc})</button></td>
        <td style="white-space:nowrap">${admin ? `<button class="mini ghost" data-edit="${esc(r.id)}" title="${t('edit')}">✏️</button> <button class="mini del" data-del="${esc(r.id)}">🗑</button>` : ''}</td></tr>`;
      }).join('')
        : `<tr><td colspan="6" class="empty">No centers</td></tr>`;
      $('#c-pager').innerHTML = `<button class="mini ghost" ${st.page<=1?'disabled':''} id="cp-prev">◀</button><span class="muted">Page ${st.page} / ${pages}</span><button class="mini ghost" ${st.page>=pages?'disabled':''} id="cp-next">▶</button>`;
      const pv=$('#cp-prev'),nx=$('#cp-next'); if(pv)pv.onclick=()=>{st.page--;draw();}; if(nx)nx.onclick=()=>{st.page++;draw();};
      $('#c-body').querySelectorAll('[data-del]').forEach((b)=>b.onclick=()=>{ if(confirm('Delete center?')){Core.removeRec('centers',b.dataset.del);draw();} });
      $('#c-body').querySelectorAll('[data-grp]').forEach((b)=>b.onclick=()=>this.manageGroups(b.dataset.grp, draw));
      $('#c-body').querySelectorAll('[data-edit]').forEach((b)=>b.onclick=()=>this.editCenter(b.dataset.edit, draw));
    };
    v.innerHTML = `
      <div class="pagehead"><h2>${t('centerRecords')} <span id="c-count" class="muted"></span></h2>
        <button id="c-xls" class="mini" style="background:#059669">⬇ ${t('excel')}</button></div>
      <div class="card filters"><input id="cf-num" placeholder="${t('centerNo')}"/><input id="cf-name" placeholder="${t('centerName')}"/></div>
      <div class="dtable"><table class="dtbl">
        <thead><tr><th>${t('centerNo')}</th><th>${t('centerName')}</th><th>${t('village')}</th><th>${t('staff')}</th><th>${t('groups')}</th><th></th></tr></thead>
        <tbody id="c-body"></tbody></table></div>
      <div class="pager" id="c-pager"></div>`;
    $('#cf-num').oninput=(e)=>{st.num=e.target.value;st.page=1;draw();};
    $('#cf-name').oninput=(e)=>{st.name=e.target.value;st.page=1;draw();};
    $('#c-xls').onclick=()=>this.exportXlsx('Centers', current.map((r)=>({'Center No':r.centerNumber,'Center Name':r.centerName,Village:r.village||'',Staff:r.staffName})));
    draw();
  },

  /* ---------------- groups under a center ---------------- */
  manageGroups(centerId, after) {
    const c = Core.get('centers', centerId); if (!c) return;
    const admin = Core.Auth.isAdmin;
    const canManage = Core.Auth.canManage;   // Admin or Manager
    const myId = Core.Auth.user && Core.Auth.user.id;
    const layer = $('#layer');
    const render = () => {
      const groups = Core.groupsForCenter(c.centerNumber);
      layer.innerHTML = `
        <div class="modal-bg"></div>
        <div class="modal" style="max-width:480px">
          <div class="modal-head">
            <div><b>${t('groups')}</b><div class="rsub" style="margin-top:2px">${esc(c.centerNumber)} — ${esc(c.centerName)}${c.village ? ' · ' + esc(c.village) : ''}</div></div>
            <button class="mini ghost" id="g-close">✕</button>
          </div>
          <div class="addgrp">
            <input id="g-name" placeholder="${t('groupNamePh')}" autocomplete="off"/>
            <button class="mini" id="g-add" style="background:var(--accent)">＋ ${t('addGroup')}</button>
          </div>
          <div class="grouplist">
            ${groups.length ? groups.map((g) => {
              const n = Core.all('loans').filter((l) => l.groupId === g.id).length;
              const canDel = canManage || g.createdBy === myId;   // Admin/Manager, or the creator
              return `<div class="grow">
                <div class="gmeta"><b>${esc(g.groupName)}</b><span class="muted sm">${esc(g.groupNumber)} · ${n} ${t('customers')}</span></div>
                <div style="display:flex;gap:6px">
                  ${admin ? `<button class="mini ghost" data-gmem="${esc(g.id)}">👤 ${t('members')}</button>` : ''}
                  ${canManage ? `<button class="mini ghost" data-gedit="${esc(g.id)}" title="${t('edit')}">✏️</button>` : ''}
                  ${canDel ? `<button class="mini del" data-gdel="${esc(g.id)}">🗑</button>` : ''}
                </div>
              </div>`;
            }).join('') : `<div class="empty" style="padding:18px">${t('noGroups')}</div>`}
          </div>
        </div>`;
      const close = () => { layer.innerHTML = ''; after && after(); };
      $('#g-close').onclick = close;
      layer.querySelector('.modal-bg').onclick = close;
      const addGroup = () => {
        const name = $('#g-name').value.trim(); if (!name) return toast(t('groupNameReq'));
        Core.saveRec('groups', { groupNumber: Core.nextGroupNumber(), groupName: name, centerId: c.id, centerNumber: c.centerNumber, centerName: c.centerName });
        toast(t('groupSaved')); render();
      };
      $('#g-add').onclick = addGroup;
      $('#g-name').onkeydown = (e) => { if (e.key === 'Enter') addGroup(); };
      layer.querySelectorAll('[data-gdel]').forEach((b) => b.onclick = () => {
        const g = Core.get('groups', b.dataset.gdel);
        const n = Core.all('loans').filter((l) => l.groupId === b.dataset.gdel).length;
        if (n > 0) return toast(t('groupHasLoans'));
        if (confirm('Delete group ' + (g ? g.groupName : '') + '?')) { Core.removeRec('groups', b.dataset.gdel); render(); }
      });
      layer.querySelectorAll('[data-gmem]').forEach((b) => b.onclick = () => this.groupMembers(b.dataset.gmem, render));
      layer.querySelectorAll('[data-gedit]').forEach((b) => b.onclick = () => this.editGroup(b.dataset.gedit, render));
    };
    render();
  },

  /* ---------------- rename a group (admin/manager) ---------------- */
  editGroup(groupId, after) {
    const g = Core.get('groups', groupId); if (!g) return;
    const layer = $('#layer');
    layer.innerHTML = `
      <div class="modal-bg"></div>
      <div class="modal" style="max-width:420px">
        <div class="modal-head">
          <div><b>${t('editGroup')}</b><div class="rsub" style="margin-top:2px">${esc(g.groupNumber)}</div></div>
          <button class="mini ghost" id="eg-close">✕</button>
        </div>
        <div class="form">
          <label>${t('group')} ${t('groupNamePh')}</label>
          <input id="eg-name" value="${esc(g.groupName)}" autocomplete="off"/>
          <div class="row-btn" style="margin-top:14px"><button id="eg-save" class="btn-accent">${t('save')}</button></div>
        </div>
      </div>`;
    const close = () => { layer.innerHTML = ''; after && after(); };
    $('#eg-close').onclick = close;
    layer.querySelector('.modal-bg').onclick = close;
    $('#eg-save').onclick = () => {
      const name = $('#eg-name').value.trim(); if (!name) return toast(t('groupNameReq'));
      // keep the same group id/number so all loans stay linked; update the name everywhere
      Core.saveRec('groups', { ...g, groupName: name });
      Core.all('loans').filter((l) => l.groupId === g.id).forEach((l) => Core.saveRec('loans', { ...l, groupName: name }));
      toast(t('groupUpdated')); close();
    };
  },

  /* ---------------- add / remove existing customers in a group (admin) ---------------- */
  groupMembers(groupId, after) {
    if (!Core.Auth.isAdmin) return toast(t('adminOnly'));   // member arrangement = admin only
    const g = Core.get('groups', groupId); if (!g) return;
    const layer = $('#layer');
    let q = '';
    const render = () => {
      // every customer in this group's center, with their current group shown
      let loans = Core.all('loans').filter((l) => !l.deleted && l.centerNumber === g.centerNumber);
      if (q) loans = loans.filter((l) => (l.member || '').toLowerCase().includes(q.toLowerCase()) || (l.loanNumber || '').toLowerCase().includes(q.toLowerCase()));
      loans.sort((a, b) => (a.member || '').localeCompare(b.member || ''));
      layer.innerHTML = `
        <div class="modal-bg"></div>
        <div class="modal" style="max-width:520px">
          <div class="modal-head">
            <div><b>${t('members')}</b><div class="rsub" style="margin-top:2px">${esc(g.groupName)} · ${esc(g.groupNumber)}</div></div>
            <button class="mini ghost" id="gm-close">✕</button>
          </div>
          <div class="muted sm" style="margin-bottom:8px">${t('membersHint')}</div>
          <div class="addgrp"><input id="gm-q" placeholder="🔍 ${t('searchCustomer')}" value="${esc(q)}" autocomplete="off"/></div>
          <div class="grouplist">
            ${loans.length ? loans.map((l) => {
              const inThis = l.groupId === groupId;
              const other = !inThis && l.groupId ? l.groupName : '';
              return `<label class="mrow">
                <input type="checkbox" class="mchk" data-id="${esc(l.id)}" ${inThis ? 'checked' : ''}/>
                <div class="gmeta"><b>${esc(l.member)}</b><span class="muted sm">${esc(l.loanNumber)}${other ? ' · <span class="pill Current">' + esc(other) + '</span>' : ''}</span></div>
              </label>`;
            }).join('') : `<div class="empty" style="padding:18px">${t('noRecords')}</div>`}
          </div>
          <div class="row-btn" style="margin-top:12px"><button id="gm-save" class="btn-accent">${t('save')}</button></div>
        </div>`;
      const close = () => { layer.innerHTML = ''; after && after(); };
      $('#gm-close').onclick = close;
      layer.querySelector('.modal-bg').onclick = close;
      $('#gm-q').oninput = (e) => { q = e.target.value; const pos = e.target.selectionStart; render(); const nb = $('#gm-q'); if (nb) { nb.focus(); try { nb.setSelectionRange(pos, pos); } catch (x) {} } };
      $('#gm-save').onclick = () => {
        let added = 0, removed = 0;
        layer.querySelectorAll('.mchk').forEach((chk) => {
          const l = Core.get('loans', chk.dataset.id); if (!l) return;
          const checked = chk.checked; const inThis = l.groupId === groupId;
          if (checked && !inThis) { Core.saveRec('loans', { ...l, groupId: groupId, groupName: g.groupName, groupNumber: g.groupNumber }); added++; }
          else if (!checked && inThis) { Core.saveRec('loans', { ...l, groupId: '', groupName: '', groupNumber: '' }); removed++; }
        });
        toast(`${added} ${t('added')}, ${removed} ${t('removed')}`);
        close();
      };
    };
    render();
  },

  /* ---------------- users (admin) ---------------- */
  usersView(v) {
    if (!Core.Auth.isAdmin) { v.innerHTML = `<div class="empty">Admins only.</div>`; return; }
    const roles = ['Admin', 'Manager', 'Staff', 'Accountant', 'Viewer'];
    const draw = async () => {
      let list = [];
      try { list = await Sync.listUsers(); }
      catch (e) { list = Core.all('users').map((u) => ({ id: u.id, name: u.name, username: u.username, role: u.role })); }
      $('#u-body').innerHTML = list.length ? list.map((u) => `
        <div class="tr"><div>${esc(u.name)}</div><div>${esc(u.username || '')}</div>
        <div>${esc(u.role)}</div>
        <div><button class="mini" data-role="${esc(u.id)}" data-cur="${esc(u.role)}">${t('role')}</button></div></div>`).join('')
        : `<div class="empty">No users</div>`;
      $('#u-body').querySelectorAll('[data-role]').forEach((b) => b.onclick = async () => {
        const nr = prompt('Role (' + roles.join('/') + '):', b.dataset.cur); if (!nr || !roles.includes(nr)) return;
        try { await Sync.updateUser(b.dataset.role, { role: nr }); toast('Role updated'); Sync.run(); draw(); }
        catch (e) { toast(e.message || 'Failed'); }
      });
    };
    v.innerHTML = `
      <h2>${t('users')}</h2>
      <div class="card form">
        <b>${t('addUser')}</b>
        <label>${t('fullName')}</label><input id="u-name"/>
        <label>${t('username')}</label><input id="u-user"/>
        <label>${t('password')}</label><input id="u-pass" type="password"/>
        <label>${t('role')}</label><select id="u-role">${roles.map((r) => `<option ${r === 'Staff' ? 'selected' : ''}>${r}</option>`).join('')}</select>
        <div class="row-btn"><button id="u-add" class="btn-accent">${t('addUser')}</button></div>
      </div>
      <div class="card table" style="margin-top:12px">
        <div class="tr th" style="grid-template-columns:1.4fr 1.4fr 1fr .8fr"><div>${t('fullName')}</div><div>${t('username')}</div><div>${t('role')}</div><div></div></div>
        <div id="u-body"></div>
      </div>`;
    document.querySelectorAll('#u-body .tr, #view .table .tr').forEach(() => {});
    $('#u-add').onclick = async () => {
      const n = $('#u-name').value.trim(), u = $('#u-user').value.trim(), p = $('#u-pass').value, r = $('#u-role').value;
      if (!u || !p) return toast('Username and password required');
      try { await Sync.createUser(n || u, u, p, r); toast('User added'); $('#u-name').value = $('#u-user').value = $('#u-pass').value = ''; Sync.run(); draw(); }
      catch (e) { toast(e.message || 'Failed'); }
    };
    // fix users table row columns
    const style = document.createElement('style'); style.textContent = '#u-body .tr{grid-template-columns:1.4fr 1.4fr 1fr .8fr}'; v.appendChild(style);
    draw();
  },

  /* ---------------- profile ---------------- */
  profileView(v) {
    v.innerHTML = `
      <h2>${t('profile')}</h2>
      <div class="card form">
        <div><span class="muted">${t('fullName')}:</span> <b>${esc(Core.Auth.user.name)}</b></div>
        <div><span class="muted">${t('role')}:</span> <b>${esc(Core.Auth.role)}</b></div>
        <hr style="border:0;border-top:1px solid var(--line);margin:14px 0"/>
        <b>${t('changePw')}</b>
        <label>${t('oldPw')}</label><input id="p-old" type="password"/>
        <label>${t('newPw')}</label><input id="p-new" type="password"/>
        <div class="row-btn"><button id="p-save" class="btn-accent">${t('changePw')}</button></div>
      </div>`;
    $('#p-save').onclick = async () => {
      const o = $('#p-old').value, n = $('#p-new').value;
      if (!n) return toast('Enter new password');
      try { await Sync.changePassword(o, n); toast('Password changed'); $('#p-old').value = $('#p-new').value = ''; }
      catch (e) { toast(e.message || 'Failed'); }
    };

    // ---- Appearance / theme picker ----
    const cur = (window.getTheme && getTheme()) || 'ocean';
    const th = document.createElement('div');
    th.className = 'card form';
    th.style.cssText = 'margin-top:14px';
    th.innerHTML = `<b>${t('appearance')}</b><div class="muted sm" style="margin:6px 0 10px">${t('appearanceDesc')}</div>
      <div class="themegrid">${(window.THEMES || []).map((tm) => `
        <div class="themecard ${tm.id === cur ? 'active' : ''}" data-theme="${tm.id}">
          <div class="themeswatch" style="background:linear-gradient(135deg,${tm.brand},${tm.accent})"></div>
          <div class="themename">${esc(tm.name)}${tm.dark ? ' 🌙' : ''}</div>
        </div>`).join('')}</div>`;
    v.appendChild(th);
    th.querySelectorAll('[data-theme]').forEach((c) => c.onclick = () => {
      if (window.setTheme) setTheme(c.dataset.theme);
      toast(t('themeApplied'));
      this.refresh();
    });

    const rs = document.createElement('div');
    rs.className = 'card form';
    rs.style.cssText = 'margin-top:14px';
    rs.innerHTML = `<b>${t('resync')}</b><div class="muted sm" style="margin:6px 0 12px">${t('resyncDesc')}</div><button id="p-resync" class="btn-brand">${t('resync')}</button>`;
    v.appendChild(rs);
    $('#p-resync').onclick = async () => {
      if (!window.Sync || !Sync.configured()) return toast('Not signed in to a server');
      Sync.cursor = 0;
      toast('Syncing from server…');
      try { await Sync.run(); toast('Sync done'); UI.refresh(); } catch (e) { toast('Sync failed: ' + (e.message || e)); }
    };

    if (Core.Auth.isAdmin) {
      const ps = document.createElement('div');
      ps.className = 'card form';
      ps.style.cssText = 'margin-top:14px';
      ps.innerHTML = `<b>${t('pushAll')}</b><div class="muted sm" style="margin:6px 0 12px">${t('pushAllDesc')}</div><button id="p-pushall" class="btn-brand">${t('pushAll')}</button>`;
      v.appendChild(ps);
      $('#p-pushall').onclick = async () => {
        if (!window.Sync || !Sync.configured()) return toast('Not signed in to a server');
        // Re-queue every local record so anything previously dropped (e.g. groups
        // rejected by an out-of-date server) is sent again now the server supports it.
        let n = 0;
        Core.SYNCED.forEach((table) => { Core.all(table).forEach((r) => { Core.queueSync(table, r.id); n++; }); });
        toast(t('pushAll') + '… (' + n + ')');
        try { await Sync.run(); toast('Done — ' + n + ' records sent'); UI.refresh(); } catch (e) { toast('Sync failed: ' + (e.message || e)); }
      };
    }

    if (Core.Auth.isAdmin) {
      const dz = document.createElement('div');
      dz.className = 'card form';
      dz.style.cssText = 'margin-top:14px;border-color:#FECACA';
      dz.innerHTML = `<b style="color:#DC2626">⚠ ${t('masterReset')}</b>
        <div class="muted sm" style="margin:6px 0 12px">${t('masterResetDesc')}</div>
        <button id="p-reset" class="btn-danger">${t('masterReset')}</button>`;
      v.appendChild(dz);
      $('#p-reset').onclick = () => {
        const ans = prompt(t('masterResetConfirm'));
        if ((ans || '').trim().toUpperCase() !== 'RESET') return;
        const cnt = Core.masterReset();
        toast(t('masterReset') + ': ' + cnt + ' records removed');
        if (window.Sync) Sync.run();
        location.hash = '#/dashboard'; UI.refresh();
      };
    }
  },
  /* ---------------- dashboard ---------------- */
  _todayRange() {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return [d.getTime(), d.getTime() + 86400000];
  },

  _bars(items, money) {
    const max = Math.max(1, ...items.map((i) => i.value));
    return `<div class="bars">${items.map((i) => `
      <div class="bar"><span class="bl">${esc(i.label)}</span>
      <div class="btrack"><div class="bfill" style="width:${(i.value / max * 100).toFixed(1)}%;background:${i.color || 'var(--brand)'}"></div></div>
      <span class="bv">${money ? '₹ ' + Core.inr(i.value) : i.value}</span></div>`).join('')}</div>`;
  },
  _line(values, labels) {
    const w = 560, h = 170, pL = 36, pR = 12, pT = 12, pB = 26;
    const max = Math.max(1, ...values); const n = values.length;
    const X = (i) => pL + (n <= 1 ? 0 : (i / (n - 1)) * (w - pL - pR));
    const Y = (v) => h - pB - (v / max) * (h - pT - pB);
    const pts = values.map((v, i) => [X(i), Y(v)]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    const area = `M${X(0)} ${h - pB} ` + pts.map((p) => `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + ` L${X(n - 1).toFixed(1)} ${h - pB} Z`;
    const dots = pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="#5B6CF0"/>`).join('');
    const xl = labels.map((l, i) => `<text x="${X(i).toFixed(1)}" y="${h - 8}" font-size="10" fill="#9AA3B5" text-anchor="middle">${esc(l)}</text>`).join('');
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-height:200px">
      <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5B6CF0" stop-opacity=".16"/><stop offset="1" stop-color="#5B6CF0" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#lg)"/><path d="${line}" fill="none" stroke="#5B6CF0" stroke-width="2.5" stroke-linejoin="round"/>${dots}${xl}</svg>`;
  },
  _columns(items) {
    const w = 560, h = 185, pL = 10, pR = 10, pT = 16, pB = 38;
    const max = Math.max(1, ...items.map((i) => i.value)); const n = items.length;
    const gap = (w - pL - pR) / n; const bw = gap * 0.5;
    const bars = items.map((it, i) => { const bh = (it.value / max) * (h - pT - pB); const x = pL + gap * i + (gap - bw) / 2; const y = h - pB - bh;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(bh,1).toFixed(1)}" rx="6" fill="${it.color || '#5B6CF0'}"/>
      <text x="${(x + bw / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" font-size="9.5" fill="#6B7280" text-anchor="middle">${Core.inr(it.value)}</text>
      <text x="${(x + bw / 2).toFixed(1)}" y="${h - 14}" font-size="10" fill="#9AA3B5" text-anchor="middle">${esc(it.label)}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-height:215px">${bars}</svg>`;
  },

  dashboardView(v) {
    const loans = Core.all('loans'), centers = Core.all('centers'), weeks = Core.all('weeks');
    const D = (l) => Core.num(l.deliveryAmt || l.loanAmt);
    const EXP = (l) => Core.num(l.totalCollectable) || Core.num(l.emi) * (parseInt(l.tenure || 0, 10) || 0);
    const INT = (l) => Core.num(l.interestTotal) || Math.max(EXP(l) - Core.num(l.loanAmt), 0);
    const delivered = loans.reduce((s, l) => s + D(l), 0);
    const loanTotal = loans.reduce((s, l) => s + Core.num(l.loanAmt), 0);
    const expected = loans.reduce((s, l) => s + EXP(l), 0);
    const interestTotal = loans.reduce((s, l) => s + INT(l), 0);
    const docCharge = loans.reduce((s, l) => s + Math.max(Core.num(l.loanAmt) - Core.num(l.deliveryAmt || l.loanAmt), 0), 0);
    const collected = weeks.reduce((s, w) => s + Core.num(w.amountPaid), 0);
    const outstanding = Math.max(expected - collected, 0);
    const active = loans.filter((l) => Core.loanStatus(l) === 'Active').length;
    const overdue = loans.filter((l) => Core.loanStatus(l) === 'Overdue').length;
    const clients = new Set(loans.map((l) => l.member)).size;
    const totalExpProfit = interestTotal + docCharge;
    const earnedProfit = expected > 0 ? (collected / expected) * totalExpProfit : 0;
    const roi = delivered > 0 ? (totalExpProfit / delivered * 100) : 0;
    const profitByCenter = {};
    loans.forEach((l) => { const k = l.centerName || l.centerNumber || '—'; profitByCenter[k] = (profitByCenter[k] || 0) + (EXP(l) - D(l)); });
    const centerProfit = Object.entries(profitByCenter).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, val]) => ({ label: k, value: val, color: '#7C3AED' }));
    const expenses = Core.all('eod').reduce((s, e) => s + Core.num(e.expensesTotal), 0);
    const realPL = collected - delivered - expenses;
    const expectedProfit = interestTotal;
    const realized = collected - delivered;
    const netProfit = realized - expenses;

    const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date(); const months = [];
    for (let i = 5; i >= 0; i--) months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
    const trend = months.map((d) => { const t0 = d.getTime(), t1 = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
      return weeks.filter((w) => w.updatedAt >= t0 && w.updatedAt < t1).reduce((s, w) => s + Core.num(w.amountPaid), 0); });
    const trendLabels = months.map((d) => MN[d.getMonth()]);

    const ic = (p) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
    const DIC = {
      loan: ic('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.4"/><path d="M6 10v4M18 10v4"/>'),
      out: ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
      doc: ic('<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4M9 13h6M9 17h6"/>'),
      int: ic('<path d="M3 17l6-6 4 4 7-7"/><path d="M14 8h6v6"/>'),
      cli: ic('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5"/><path d="M16 4.6a3 3 0 0 1 0 5.8M21 20c0-2.5-1.3-4.2-3.4-4.8"/>'),
    };
    const card = (label, val, grad, icon, sub, money) =>
      `<div class="dcard grad" style="background:${grad}">
         <div class="dico">${icon}</div>
         <div class="dval">${money === false ? val : '₹ ' + Core.inr(val)}</div>
         <div class="dlbl">${label}</div>
         ${sub ? `<div class="dsub">${sub}</div>` : ''}
       </div>`;

    v.innerHTML = `
      <div class="dashhead">
        <div><h2>${t('dashboard')}</h2><div class="dashsub">${clients} ${t('totalClients').toLowerCase()}</div></div>
      </div>
      <div class="dgrid">
        ${card(t('totalLoanAmt'), loanTotal, 'linear-gradient(135deg,#7A6CF0,#9D8DF8)', DIC.loan, loans.length + ' loans')}
        ${card(t('outstanding'), outstanding, 'linear-gradient(135deg,#FB6FA0,#F04E78)', DIC.out, 'to collect')}
        ${card(t('documentCharge'), docCharge, 'linear-gradient(135deg,#2FD4C0,#0FB0A2)', DIC.doc, 'upfront')}
        ${card(t('totalInterest'), interestTotal, 'linear-gradient(135deg,#FBB24C,#F2840F)', DIC.int, 'projected')}
        ${card(t('totalClients'), clients, 'linear-gradient(135deg,#5BA7FF,#3B7BF6)', DIC.cli, 'active', false)}
      </div>

      <div class="dash-bottom" style="margin-top:14px">
        <div class="card" style="padding:16px">
          <b>${t('overview')}</b>
          <div style="margin-top:8px">${this._columns([
            { label: t('totalLoanAmt'), value: loanTotal, color: '#3B6FE0' },
            { label: t('outstanding'), value: outstanding, color: '#DC2626' },
            { label: t('documentCharge'), value: docCharge, color: '#0EA5A4' },
            { label: t('totalInterest'), value: interestTotal, color: '#D4AF60' },
            { label: t('collected'), value: collected, color: '#059669' },
          ])}</div>
        </div>
        <div class="card" style="padding:16px">
          <b>${t('collectionTrend')}</b>
          <div style="margin-top:8px">${this._line(trend, trendLabels)}</div>
        </div>
      </div>

      <div class="dash-bottom" style="margin-top:14px">
        <div class="card" style="padding:16px">
          <b>${t('profitLoss')}</b>
          <div class="pnl">
            <div class="pnlsub">${t('projected')}</div>
            <div class="pnlrow"><span>${t('totalExpectedProfit')}</span><b style="color:#7C3AED">₹ ${Core.inr(totalExpProfit)}</b></div>
            <div class="pnlrow"><span>${t('earnedProfit')}</span><b style="color:#059669">₹ ${Core.inr(earnedProfit)}</b></div>
            <div class="pnlrow"><span>${t('roi')}</span><span class="pill Active">${roi.toFixed(1)}%</span></div>
            <div class="pnlsub">${t('realPL')}</div>
            <div class="pnlrow"><span>${t('collected')}</span><b style="color:#059669">₹ ${Core.inr(collected)}</b></div>
            <div class="pnlrow"><span>${t('totalDelivered')}</span><b style="color:#374151">₹ ${Core.inr(delivered)}</b></div>
            <div class="pnlrow"><span>${t('expenses')}</span><b style="color:#DC2626">₹ ${Core.inr(expenses)}</b></div>
            <div class="netbox"><span>${t('netCashPosition')}</span><b style="color:${realPL >= 0 ? '#059669' : '#DC2626'}">${realPL < 0 ? '−' : ''}₹ ${Core.inr(Math.abs(realPL))}</b></div>
          </div>
        </div>
        <div class="card" style="padding:16px">
          <b>${t('profitByCenter')}</b>
          <div style="margin-top:8px">${centerProfit.length ? this._columns(centerProfit) : `<div class="muted" style="padding:14px 0">—</div>`}</div>
        </div>
      </div>`;
  },

  // ---- EOD auto calculations (JLG only) ----
  computeEod(dateObj) {
    const loans = Core.all('loans'), weeks = Core.all('weeks');
    const d0 = new Date(dateObj); d0.setHours(0, 0, 0, 0);
    const t0 = d0.getTime(), t1 = t0 + 86400000;
    const wd = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d0.getDay()];
    let emiExpected = 0, overdue = 0, outstanding = 0;
    loans.forEach((l) => {
      const emi = Core.num(l.emi), tenure = parseInt(l.tenure || 0, 10) || 0;
      const start = Core.parseDMY(l.loanDate), last = Core.addWeeks(start, tenure);
      const coll = weeks.filter((w) => w.loanId === l.id).reduce((s, w) => s + Core.num(w.amountPaid), 0);
      if (Core.loanStatus(l) !== 'Closed' && l.collectionDay === wd && d0 > start && d0 <= last) emiExpected += emi;
      const elapsed = Math.max(0, Math.min(tenure, Math.floor(((d0 - start) / 86400000 - 1) / 7)));
      overdue += Math.max(elapsed * emi - coll, 0);
      outstanding += Math.max(tenure * emi - coll, 0);
    });
    const emiCollected = weeks.filter((w) => w.updatedAt >= t0 && w.updatedAt < t1).reduce((s, w) => s + Core.num(w.amountPaid), 0);
    const loanDisbursed = loans.filter((l) => { const d = Core.parseDMY(l.loanDate); d.setHours(0, 0, 0, 0); return d.getTime() === t0; }).reduce((s, l) => s + Core.num(l.deliveryAmt || l.loanAmt), 0);
    // opening = previous closed/saved day's cash in hand
    const prev = Core.all('eod').map((e) => ({ e, d: Core.parseDMY(e.date) }))
      .filter((x) => x.d < d0).sort((a, b) => b.d - a.d);
    const opening = prev.length ? (typeof prev[0].e.cashInHand === 'number' ? prev[0].e.cashInHand : Core.num(prev[0].e.cashInHand)) : 0;
    return { emiExpected, overdue, outstanding, emiCollected, loanDisbursed, opening };
  },

  eodView(v) {
    const tab = this._eodTab || 'entry';
    v.innerHTML = `
      <div class="eodtabs">
        <button data-tab="entry" class="${tab === 'entry' ? 'on' : ''}">EOD Entry</button>
        <button data-tab="history" class="${tab === 'history' ? 'on' : ''}">EOD History</button>
      </div>
      <div id="eod-wrap"></div>`;
    v.querySelectorAll('.eodtabs button').forEach((b) => b.onclick = () => { this._eodTab = b.dataset.tab; this.eodView(v); });
    if (tab === 'history') return this.eodHistory($('#eod-wrap'));
    this.eodEntry($('#eod-wrap'));
  },

  eodEntry(host) {
    const dISO = this._eodDate || new Date().toISOString().slice(0, 10);
    this._eodDate = dISO;
    const dObj = new Date(dISO);
    const dateStr = Core.fmtDMY(dObj);
    const id = 'eod-' + dISO.replace(/-/g, '');
    let existing = Core.get('eod', id);
    if (existing && existing.deleted) existing = null;
    const auto = this.computeEod(dObj);
    const st = this._eodS = Object.assign({
      addFund: 0, bankDeposit: 0, expenses: [],
      denom: { 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0, coins: 0 },
    }, existing ? {
      addFund: Core.num(existing.addFund), bankDeposit: Core.num(existing.bankDeposit),
      expenses: existing.expenses || [], denom: existing.denom || {},
    } : {});
    const closed = existing && existing.status === 'closed';
    const admin = Core.Auth.isAdmin;
    const disbEditable = admin && !closed;
    const disbVal = (existing && existing.loanDisbursed != null) ? Core.num(existing.loanDisbursed) : auto.loanDisbursed;

    const money = (id2, val, ro) => `<input id="${id2}" class="eodin ${ro ? 'ro' : ''}" ${ro ? 'readonly' : ''} value="${ro ? '₹ ' + Core.inr(val) : (val || '')}" inputmode="decimal"/>`;
    const DEN = [500, 200, 100, 50, 20, 10, 5, 2, 1];

    host.innerHTML = `
      <div class="eodhead">
        <h2>${t('eod')} <span class="eodstatus ${closed ? 'cl' : 'op'}">${closed ? 'CLOSED' : 'OPEN'}</span></h2>
        <input type="date" id="eod-date" value="${dISO}" class="eoddate"/>
      </div>

      <div class="eodsec s1">
        <div class="eodtitle"><span class="eodnum">1</span> Expected Collection Summary</div>
        <div class="eodrow"><span>Opening Cash (prev day)</span>${money('a-open', auto.opening, 1)}</div>
        <div class="eodrow"><span>Today's EMI Expected</span>${money('a-emiexp', auto.emiExpected, 1)}</div>
        <div class="eodrow"><span>Overdue Amount</span>${money('a-overdue', auto.overdue, 1)}</div>
        <div class="eodrow tot"><span>Total Expected Amount</span>${money('a-texp', auto.opening + auto.emiExpected + auto.overdue, 1)}</div>
      </div>

      <div class="eodgrid2">
        <div class="eodsec s3">
          <div class="eodtitle"><span class="eodnum">2</span> Cash In</div>
          <div class="eodrow"><span>EMI Collected (auto)</span>${money('a-coll', auto.emiCollected, 1)}</div>
          <div class="eodrow"><span>Add Fund</span>${money('m-fund', st.addFund)}</div>
          <div class="eodrow tot"><span>Total Cash In</span>${money('a-cashin', 0, 1)}</div>
        </div>
        <div class="eodsec s4">
          <div class="eodtitle"><span class="eodnum">3</span> Cash Out</div>
          <div class="eodrow"><span>Loan Disbursed${disbEditable ? '' : ' (auto)'}</span>${money('a-disb', disbVal, !disbEditable)}</div>
          <div class="eodrow"><span>Expenses</span><button class="mini" id="m-addexp">+ Add</button></div>
          <div id="exp-list"></div>
          <div class="eodrow"><span>Expenses Total</span>${money('a-exptot', 0, 1)}</div>
          <div class="eodrow"><span>Bank Deposit</span>${money('m-bank', st.bankDeposit)}</div>
          <div class="eodrow tot"><span>Total Cash Out</span>${money('a-cashout', 0, 1)}</div>
        </div>
      </div>

      <div class="eodsec s5">
        <div class="eodtitle"><span class="eodnum">4</span> Cash Denomination Tally</div>
        ${DEN.map((d) => `<div class="eodrow den"><span>₹${d} ×</span><input class="dcount" data-d="${d}" value="${st.denom[d] || 0}" inputmode="numeric" style="max-width:90px"/><span class="damt" id="damt-${d}">₹ 0.00</span></div>`).join('')}
        <div class="eodrow den"><span>Coins (amount)</span><input class="dcount" data-d="coins" value="${st.denom.coins || 0}" inputmode="decimal" style="max-width:90px"/><span class="damt" id="damt-coins">₹ 0.00</span></div>
        <div class="eodrow tot"><span>Denomination Total</span>${money('a-dentot', 0, 1)}</div>
      </div>

      <div class="eodsec s6">
        <div class="eodtitle"><span class="eodnum">5</span> Cash in Hand</div>
        <div class="cih" id="a-cih">₹ 0.00</div>
        <div id="a-tally" style="margin-top:4px"></div>
      </div>

      <div class="eodbtns">
        <button class="btn-accent" id="eod-save" ${closed ? 'disabled' : ''}>💾 Save EOD</button>
        <button class="btn-brand" id="eod-print">🖨 Print / PDF</button>
        ${!closed ? `<button id="eod-close" style="background:#F59E0B;color:#fff;border-radius:10px;padding:11px 18px;font-weight:700;font-size:14px;box-shadow:0 1px 2px rgba(17,24,39,.08)">🔒 Close Day</button>` : `<span class="muted">Day closed — locked.</span>`}
      </div>`;

    const num = (id2) => Core.num(($('#' + id2) || {}).value);
    const setRO = (id2, val) => { const e = $('#' + id2); if (e) e.value = '₹ ' + Core.inr(val); };

    const renderExp = () => {
      $('#exp-list').innerHTML = st.expenses.map((e, i) => `
        <div class="eodrow exp"><input value="${esc(e.name || '')}" data-ei="${i}" class="exp-name" placeholder="name"/><input value="${e.amt || ''}" data-ei="${i}" class="exp-amt" inputmode="decimal" style="max-width:110px"/><button class="mini del" data-ex="${i}">✕</button></div>`).join('');
      $('#exp-list').querySelectorAll('.exp-name').forEach((x) => x.oninput = () => { st.expenses[+x.dataset.ei].name = x.value; });
      $('#exp-list').querySelectorAll('.exp-amt').forEach((x) => x.oninput = () => { st.expenses[+x.dataset.ei].amt = Core.num(x.value); recompute(); });
      $('#exp-list').querySelectorAll('[data-ex]').forEach((x) => x.onclick = () => { st.expenses.splice(+x.dataset.ex, 1); renderExp(); recompute(); });
    };

    const recompute = () => {
      st.addFund = num('m-fund'); st.bankDeposit = num('m-bank');
      let denTot = 0;
      [...host.querySelectorAll('.dcount')].forEach((x) => {
        const d = x.dataset.d; const c = Core.num(x.value); st.denom[d] = c;
        const amt = d === 'coins' ? c : c * Number(d);
        const lbl = $('#damt-' + d); if (lbl) lbl.textContent = '₹ ' + Core.inr(amt);
        denTot += amt;
      });
      const expTot = st.expenses.reduce((s, e) => s + Core.num(e.amt), 0);
      const cashIn = auto.emiCollected + st.addFund;
      const disbursed = disbEditable ? num('a-disb') : disbVal;
      const cashOut = disbursed + expTot + st.bankDeposit;
      const cih = auto.opening + cashIn - cashOut;
      setRO('a-cashin', cashIn); setRO('a-exptot', expTot); setRO('a-cashout', cashOut);
      setRO('a-dentot', denTot);
      const tally = Math.abs(denTot - cih) < 0.01;
      const cihEl = $('#a-cih');
      cihEl.textContent = '₹ ' + Core.inr(cih);
      cihEl.style.color = tally ? '#059669' : '#DC2626';
      const te = $('#a-tally');
      if (te) te.innerHTML = (denTot === 0 && Math.abs(cih) > 0.01)
        ? '<span style="color:#9AA3B5;font-size:12px">Count the cash below (denomination) to verify</span>'
        : (tally
            ? '<span style="color:#059669;font-weight:700;font-size:13px">✓ Tallied — denomination matches cash in hand</span>'
            : '<span style="color:#DC2626;font-weight:700;font-size:13px">✗ Mismatch: ' + (denTot - cih >= 0 ? '+' : '') + Core.inr(denTot - cih) + ' (denomination vs cash)</span>');
      st._computed = { cashIn, cashOut, expTot, denTot, cih, disbursed, ...auto, date: dateStr };
    };

    $('#eod-date').onchange = (e) => { this._eodDate = e.target.value; this.eodEntry(host); };
    host.querySelectorAll('#m-fund,#m-bank,#a-disb,.dcount').forEach((x) => x.oninput = recompute);
    $('#m-addexp').onclick = () => { st.expenses.push({ name: '', amt: 0 }); renderExp(); };
    try { renderExp(); recompute(); } catch (e) { console.error('EOD calc error', e); toast('EOD calc: ' + (e.message || e)); }

    const buildRec = (status) => ({
      id, date: dateStr, opening: auto.opening, emiExpected: auto.emiExpected, overdue: auto.overdue,
      totalExpected: auto.opening + auto.emiExpected + auto.overdue, outstanding: auto.outstanding,
      emiCollected: auto.emiCollected, addFund: st.addFund, totalCashIn: st._computed.cashIn,
      loanDisbursed: st._computed.disbursed, expenses: st.expenses, expensesTotal: st._computed.expTot,
      bankDeposit: st.bankDeposit, totalCashOut: st._computed.cashOut, denom: st.denom,
      denomTotal: st._computed.denTot, cashInHand: st._computed.cih, status,
    });

    $('#eod-save').onclick = () => { try { recompute(); Core.saveRec('eod', buildRec('open')); if (window.Sync) Sync.run(); toast('EOD saved'); } catch (e) { toast('Save failed: ' + (e.message || e)); } };
    $('#eod-close').onclick = () => { if (confirm('Close the day? Data will be locked.')) { try { recompute(); Core.saveRec('eod', buildRec('closed')); if (window.Sync) Sync.run(); toast('Day closed'); this.eodEntry(host); } catch (e) { toast('Close failed: ' + (e.message || e)); } } };
    $('#eod-print').onclick = () => this.eodPDF(buildRec(closed ? 'closed' : 'open'));
  },

  // Admin: back-fill EOD records for every past day with activity, up to today.
  // Uses the real collection/loan data; leaves any day that already has a record untouched.
  autoGenerateEod(host) {
    if (!Core.Auth.isAdmin) return toast(t('adminOnly'));
    const loans = Core.all('loans').filter((l) => !l.deleted);
    if (!loans.length) return toast('No loans yet');
    let start = null;
    loans.forEach((l) => { const d = Core.parseDMY(l.loanDate); if (d && !isNaN(d) && (!start || d < start)) start = d; });
    if (!start) return toast('No loan dates found');
    start.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    const existing = new Set(Core.all('eod').filter((e) => !e.deleted).map((e) => e.id));
    let created = 0, guard = 0;
    for (let d = new Date(start); d <= today && guard < 1200; d.setDate(d.getDate() + 1), guard++) {
      const dISO = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      const id = 'eod-' + dISO.replace(/-/g, '');
      if (existing.has(id)) continue;                 // never overwrite an existing (manual) day
      const auto = this.computeEod(new Date(dISO));
      const hasActivity = auto.emiCollected > 0 || auto.loanDisbursed > 0 || auto.emiExpected > 0;
      if (!hasActivity) continue;                     // skip quiet days (opening still chains forward)
      const cashIn = auto.emiCollected;               // no manual add-fund
      const cashOut = auto.loanDisbursed;             // no manual expenses / bank deposit
      const cih = auto.opening + cashIn - cashOut;
      Core.saveRec('eod', {
        id, date: Core.fmtDMY(new Date(dISO)),
        opening: auto.opening, emiExpected: auto.emiExpected, overdue: auto.overdue,
        totalExpected: auto.opening + auto.emiExpected + auto.overdue, outstanding: auto.outstanding,
        emiCollected: auto.emiCollected, addFund: 0, totalCashIn: cashIn,
        loanDisbursed: auto.loanDisbursed, expenses: [], expensesTotal: 0,
        bankDeposit: 0, totalCashOut: cashOut, denom: {}, denomTotal: 0,
        cashInHand: cih, status: 'open', auto: true,
      });
      existing.add(id); created++;
    }
    if (window.Sync) Sync.run();
    toast(created ? created + ' EOD days generated' : 'Already up to date');
    this.eodHistory(host);
  },

  eodHistory(host) {
    const f = this._eodHF || (this._eodHF = { from: '', to: '' });
    const admin = Core.Auth.isAdmin;
    let rows = Core.all('eod').sort((a, b) => Core.parseDMY(b.date) - Core.parseDMY(a.date));
    if (f.from) rows = rows.filter((r) => Core.parseDMY(r.date) >= new Date(f.from));
    if (f.to) rows = rows.filter((r) => Core.parseDMY(r.date) <= new Date(f.to));
    host.innerHTML = `
      <div class="pagehead"><h2>EOD History</h2>
        <div class="hbtns"><input type="date" id="eh-from" value="${f.from}" class="eoddate"/><input type="date" id="eh-to" value="${f.to}" class="eoddate"/><button class="mini ghost" id="eh-clear">Clear</button>${admin ? `<button class="mini" id="eh-auto" style="background:var(--brand)">⚡ ${t('autoGenerate')}</button>` : ''}</div></div>
      <div class="card eodtable ${admin ? 'eod-admin' : ''}">
        <div class="etr eth"><div>Date</div><div>Opening</div><div>Expected</div><div>Cash In</div><div>Cash Out</div><div>In Hand</div><div>Outstanding</div><div>Status</div>${admin ? '<div></div>' : ''}</div>
        ${rows.length ? rows.map((r) => {
          const sinr = (v) => { const n = (typeof v === 'number') ? v : Core.num(v); return (n < 0 ? '-' : '') + Core.inr(Math.abs(n)); };
          return `
          <div class="etr">
            <div>${esc(r.date)}</div><div>${sinr(r.opening)}</div>
            <div>${sinr(r.totalExpected)}</div><div>${sinr(r.totalCashIn)}</div>
            <div>${sinr(r.totalCashOut)}</div><div style="color:${(typeof r.cashInHand === 'number' ? r.cashInHand : Core.num(r.cashInHand)) < 0 ? '#DC2626' : '#059669'}">${sinr(r.cashInHand)}</div>
            <div style="color:#DC2626">${sinr(r.outstanding)}</div>
            <div><span class="pill ${r.status === 'closed' ? 'Closed' : 'Active'}">${r.status === 'closed' ? '🔒 Closed' : (r.auto ? '⚡ Auto' : 'Open')}</span></div>
            ${admin ? `<div><button class="mini del" data-del="${esc(r.id)}">🗑</button></div>` : ''}
          </div>`;
        }).join('') : `<div class="empty">No EOD records</div>`}
      </div>`;
    $('#eh-from').onchange = (e) => { f.from = e.target.value; this.eodHistory(host); };
    $('#eh-to').onchange = (e) => { f.to = e.target.value; this.eodHistory(host); };
    $('#eh-clear').onclick = () => { f.from = ''; f.to = ''; this.eodHistory(host); };
    if (admin) { const ab = $('#eh-auto'); if (ab) ab.onclick = () => { if (confirm(t('autoGenerateConfirm'))) this.autoGenerateEod(host); }; }
    host.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => {
      if (confirm('Delete this EOD record? (' + b.closest('.etr').firstElementChild.textContent + ')')) {
        Core.removeRec('eod', b.dataset.del); this.eodHistory(host);
      }
    });
  },

  async eodPDF(rec) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    try { doc.addImage(window.LOGO_DATA_URL, 'PNG', W / 2 - 23, 10, 46, 23); } catch (x) {}
    doc.setFontSize(16); doc.setTextColor('#0E1B3A'); doc.text(t('appName'), W / 2, 40, { align: 'center' });
    doc.setFontSize(12); doc.setTextColor('#3B6FE0'); doc.text('End of Day — ' + rec.date, W / 2, 47, { align: 'center' });
    const R = (k) => 'Rs. ' + Core.inr(Core.num(rec[k]));
    doc.autoTable({
      startY: 52, theme: 'grid', styles: { fontSize: 9.5 },
      body: [
        ['Opening Cash', R('opening'), 'EMI Collected', R('emiCollected')],
        ['Today EMI Expected', R('emiExpected'), 'Add Fund', R('addFund')],
        ['Overdue', R('overdue'), 'Total Cash In', R('totalCashIn')],
        ['Total Expected', R('totalExpected'), 'Loan Disbursed', R('loanDisbursed')],
        ['Outstanding', R('outstanding'), 'Expenses', R('expensesTotal')],
        ['', '', 'Bank Deposit', R('bankDeposit')],
        ['', '', 'Total Cash Out', R('totalCashOut')],
        ['CASH IN HAND', R('cashInHand'), 'Status', (rec.status || 'open').toUpperCase()],
      ],
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [238, 240, 251] }, 2: { fontStyle: 'bold', fillColor: [238, 240, 251] } },
    });
    if ((rec.expenses || []).length) {
      doc.autoTable({ startY: doc.lastAutoTable.finalY + 6, theme: 'grid', styles: { fontSize: 9 },
        head: [['Expense', 'Amount (Rs.)']], headStyles: { fillColor: [14, 27, 58] },
        body: rec.expenses.map((e) => [e.name || '-', Core.inr(Core.num(e.amt))]) });
    }
    doc.setFontSize(8); doc.setTextColor('#6B7280');
    doc.text('Generated ' + Core.fmtDMY(new Date()) + ' • ' + t('appName'), 14, doc.lastAutoTable.finalY + 8);
    const b64 = doc.output('datauristring').split(',')[1];
    await saveOrShare('EOD_' + rec.date + '.pdf', b64, 'application/pdf');
    toast('EOD PDF ready');
  },
};

window.UI = UI;

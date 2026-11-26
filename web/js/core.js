/* ============ Sri Finance JLG — core: local-first DB, auth, models ============
   Offline-first: everything writes to IndexedDB first and is queued for sync.
   Records carry id/createdAt/updatedAt/createdBy/updatedBy; sync is last-write-wins. */

const APP_VERSION = '1.0.0';
const SCHEMA_VERSION = 1;
const IDB_NAME = 'jlg', IDB_VERSION = 4;
const SYNCED = ['users', 'centers', 'groups', 'loans', 'weeks', 'settings', 'eod'];
const LOCAL_STORES = ['syncQueue', 'appMeta'];
const ALL_STORES = [...SYNCED, ...LOCAL_STORES];

/* in-memory cache: one Map per table */
const C = {};
ALL_STORES.forEach((s) => (C[s] = new Map()));

let IDB = null, STORAGE_OK = true;

function openDB() {
  return new Promise((res) => {
    let req;
    try { req = indexedDB.open(IDB_NAME, IDB_VERSION); }
    catch (e) { STORAGE_OK = false; return res(null); }
    req.onupgradeneeded = () => {
      const db = req.result;
      ALL_STORES.forEach((s) => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => { STORAGE_OK = false; res(null); };
  });
}

function idbAll(store) {
  return new Promise((res) => {
    if (!IDB || !IDB.objectStoreNames.contains(store)) return res([]);
    const r = IDB.transaction(store, 'readonly').objectStore(store).getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => res([]);
  });
}
function idbPut(store, rec) { if (IDB && IDB.objectStoreNames.contains(store)) try { IDB.transaction(store, 'readwrite').objectStore(store).put(rec); } catch (e) {} }
function idbDel(store, id) { if (IDB && IDB.objectStoreNames.contains(store)) try { IDB.transaction(store, 'readwrite').objectStore(store).delete(id); } catch (e) {} }

async function loadAll() {
  for (const s of ALL_STORES) {
    const rows = await idbAll(s);
    rows.forEach((r) => C[s].set(r.id, r));
  }
}

/* ---------- helpers ---------- */
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
const now = () => Date.now();
const num = (v) => { const f = parseFloat(String(v == null ? '' : v).replace(/[^\d.]/g, '')); return isNaN(f) ? 0 : f; };
function get(table, id) { return C[table] && C[table].get(id); }
function all(table) { return [...(C[table] ? C[table].values() : [])].filter((r) => !r.deleted); }

function putLocal(table, rec) { C[table].set(rec.id, rec); idbPut(table, rec); }
function queueSync(table, id) {
  if (!SYNCED.includes(table)) return;
  const q = { id: table + ':' + id, table, recId: id, at: now() };
  C.syncQueue.set(q.id, q); idbPut('syncQueue', q);
  if (window.Sync) Sync.soon();
}

/* create/update a synced record */
function saveRec(table, data, action) {
  const id = data.id || uid();
  const prev = get(table, id);
  const uname = (Auth.user && Auth.user.id) || 'local-admin';
  const rec = {
    ...prev, ...data, id, deleted: false,
    createdAt: prev ? prev.createdAt : now(),
    createdBy: prev ? prev.createdBy : uname,
    updatedAt: now(), updatedBy: uname,
  };
  putLocal(table, rec);
  queueSync(table, id);
  return rec;
}
function removeRec(table, id) {
  const prev = get(table, id); if (!prev) return;
  const rec = { ...prev, deleted: true, updatedAt: now(), updatedBy: (Auth.user && Auth.user.id) || 'local-admin' };
  putLocal(table, rec); queueSync(table, id);
}

/* ---------- auth / session ---------- */
const Auth = {
  session: null,              // {serverUrl, token, user:{id,name,role}}
  user: { id: 'local-admin', name: 'Admin', role: 'Admin' },
  load() {
    try { const s = JSON.parse(localStorage.getItem('jlg_session') || 'null'); if (s) this.set(s); } catch (e) {}
  },
  set(s) {
    this.session = s;
    this.user = (s && s.user) || { id: 'local-admin', name: 'Admin', role: 'Admin' };
    try { localStorage.setItem('jlg_session', JSON.stringify(s)); } catch (e) {}
  },
  get role() { const u = get('users', this.user.id); return (u && u.role) || this.user.role || 'Viewer'; },
  get isAdmin() { return this.role === 'Admin'; },
  get isManager() { return this.role === 'Manager'; },
  get canManage() { return this.role === 'Admin' || this.role === 'Manager'; },
  get signedIn() { return !!(this.session && this.session.token); },
};

/* ---------- auto numbers ---------- */
function nextCenterNumber() {
  let max = 0;
  all('centers').forEach((c) => { const m = /CTR-(\d+)/.exec(c.centerNumber || ''); if (m) max = Math.max(max, +m[1]); });
  return 'CTR-' + String(max + 1).padStart(4, '0');
}
function nextGroupNumber() {
  let max = 0;
  all('groups').forEach((g) => { const m = /GRP-(\d+)/.exec(g.groupNumber || ''); if (m) max = Math.max(max, +m[1]); });
  return 'GRP-' + String(max + 1).padStart(4, '0');
}
function groupsForCenter(centerNumber) {
  return all('groups')
    .filter((g) => g.centerNumber === centerNumber)
    .sort((a, b) => (a.groupName || '').localeCompare(b.groupName || ''));
}
function nextLoanNumber() {
  const d = new Date();
  const key = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const pfx = 'JLG-' + key + '-';
  let max = 0;
  all('loans').forEach((l) => { if ((l.loanNumber || '').startsWith(pfx)) max = Math.max(max, +(l.loanNumber.split('-').pop())); });
  return pfx + String(max + 1).padStart(4, '0');
}

/* ---------- finance ---------- */
const COLLECTION_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function weeklyEmi(principal, ratePct, weeks) {
  if (principal <= 0 || weeks <= 0) return 0;
  const interest = principal * (ratePct / 100) * (weeks / 52);
  return (principal + interest) / weeks;
}
function inr(n) {
  if (isNaN(n)) return '0.00';
  const neg = n < 0; n = Math.abs(n);
  const [i, dec] = n.toFixed(2).split('.');
  let s = i, out = s.slice(-3); s = s.slice(0, -3);
  while (s.length) { out = s.slice(-2) + ',' + out; s = s.slice(0, -2); }
  return (neg ? '-' : '') + out + '.' + dec;
}
function parseDMY(s) {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(s || '').trim());
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(s); return isNaN(d) ? new Date() : d;
}
function fmtDMY(d) { const p = (x) => String(x).padStart(2, '0'); return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`; }
function addWeeks(d, w) { const r = new Date(d); r.setDate(r.getDate() + w * 7); return r; }

/* weekly schedule for a loan, merged with saved collections */
function loanSchedule(loan) {
  const start = parseDMY(loan.loanDate);
  const emi = num(loan.emi);
  const tenure = parseInt(loan.tenure || 0, 10) || 0;
  const saved = {};
  all('weeks').forEach((w) => { if (w.loanId === loan.id) saved[w.weekNo] = w; });
  const rows = [];
  for (let wk = 1; wk <= tenure; wk++) {
    const due = addWeeks(start, wk);
    rows.push({ weekNo: wk, dueDate: fmtDMY(due), dueObj: due, amountDue: emi, saved: saved[wk] || null });
  }
  return rows;
}
function saveCollection(loan, weekNo, dueDate, amountDue, amountPaid) {
  const id = loan.id + ':' + weekNo;
  saveRec('weeks', {
    id, loanId: loan.id, weekNo, dueDate, amountDue, amountPaid,
    collectedBy: (Auth.user && Auth.user.name) || '',
  });
}
function totalCollected(loanId) {
  let s = 0; all('weeks').forEach((w) => { if (w.loanId === loanId) s += num(w.amountPaid); }); return s;
}

/* auto status: Closed if fully paid/manually closed; Overdue if a past-due week is unpaid; else Active */
function loanStatus(loan) {
  if (!loan) return 'Active';
  if (loan.status === 'Closed') return 'Closed';
  const tenure = parseInt(loan.tenure || 0, 10) || 0;
  const emi = num(loan.emi);
  const start = parseDMY(loan.loanDate);
  const wks = all('weeks').filter((w) => w.loanId === loan.id);
  const paidCount = wks.filter((w) => num(w.amountPaid) > 0).length;
  const totalPaid = wks.reduce((sm, w) => sm + num(w.amountPaid), 0);
  if (tenure > 0 && totalPaid >= emi * tenure) return 'Closed';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weeksDue = Math.max(0, Math.min(tenure, Math.floor(((today - start) / 86400000 - 1) / 7)));
  if (paidCount < weeksDue) return 'Overdue';
  return 'Active';
}

/* admin master reset: soft-delete all business records (loans, weeks, centers, eod);
   deletions sync to server + other devices via the normal sync. User accounts are kept. */
function masterReset() {
  let n = 0;
  ['loans', 'weeks', 'centers', 'eod', 'settings'].forEach((table) => {
    all(table).forEach((r) => { removeRec(table, r.id); n++; });
  });
  return n;
}

/* import historical paid weeks for an old loan: marks weeks 1..N as paid, dated in the past
   so they count toward collected/overdue but NOT toward today's EOD collection. */
function importPaidWeeks(loan, weeksPaid) {
  const emi = num(loan.emi), tenure = parseInt(loan.tenure || 0, 10) || 0;
  const start = parseDMY(loan.loanDate);
  const uname = (Auth.user && Auth.user.name) || 'import';
  const n = Math.min(weeksPaid, tenure);
  for (let wk = 1; wk <= n; wk++) {
    const due = addWeeks(start, wk);
    const id = loan.id + ':' + wk;
    const rec = { id, loanId: loan.id, weekNo: wk, dueDate: fmtDMY(due), amountDue: emi,
      amountPaid: emi, collectedBy: uname, createdAt: due.getTime(), createdBy: uname,
      updatedAt: due.getTime(), updatedBy: uname };
    putLocal('weeks', rec); queueSync('weeks', id);
  }
  return n;
}

window.Core = {
  APP_VERSION, SCHEMA_VERSION, SYNCED, C, Auth,
  openDB: async () => { IDB = await openDB(); await loadAll(); },
  get, all, putLocal, queueSync, saveRec, removeRec, idbDel,
  uid, now, num, inr, parseDMY, fmtDMY, addWeeks,
  nextCenterNumber, nextGroupNumber, groupsForCenter, nextLoanNumber, weeklyEmi, COLLECTION_DAYS,
  loanSchedule, saveCollection, totalCollected, loanStatus, masterReset, importPaidWeeks,
};

/* ============ Offline-first sync (last-write-wins) ============
   push local queue -> server keeps newer -> pull changes since cursor. */
const newer = (a, b) =>
  (a.updatedAt || 0) > (b.updatedAt || 0) ||
  ((a.updatedAt || 0) === (b.updatedAt || 0) && String(a.updatedBy || '') > String(b.updatedBy || ''));

const Sync = {
  state: 'local', busy: false, lastError: '', _t: null,
  get cursorKey() { return 'jlg_cursor:' + ((Core.Auth.session && Core.Auth.session.serverUrl) || ''); },
  get cursor() { return parseInt(localStorage.getItem(this.cursorKey) || '0', 10); },
  set cursor(v) { localStorage.setItem(this.cursorKey, String(v)); },
  configured() { const s = Core.Auth.session; return !!(s && s.token && s.serverUrl); },
  pending() { return Core.C.syncQueue.size; },
  soon() { clearTimeout(this._t); this._t = setTimeout(() => this.run(), 1200); },

  async api(path, opts = {}) {
    const s = Core.Auth.session;
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 25000);
    try {
      const r = await fetch(s.serverUrl.replace(/\/+$/, '') + path, {
        method: opts.method || 'GET', signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', ...(s.token ? { Authorization: 'Bearer ' + s.token } : {}) },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { const e = new Error(data.error || ('HTTP ' + r.status)); e.status = r.status; throw e; }
      return data;
    } finally { clearTimeout(tm); }
  },

  async run() {
    if (!this.configured()) { this.state = 'local'; return UI && UI.chrome(); }
    if (!navigator.onLine) { this.state = 'offline'; return UI && UI.chrome(); }
    if (this.busy) return; this.busy = true; this.state = 'syncing'; UI && UI.chrome();
    let changed = false;
    try {
      changed = (await this.push()) | (await this.pull());
      this.state = 'ok'; this.lastError = '';
      localStorage.setItem('jlg_lastsync', String(Date.now()));
    } catch (e) {
      this.state = e.status === 401 ? 'auth' : (navigator.onLine ? 'error' : 'offline');
      this.lastError = e.message;
    } finally {
      this.busy = false; UI && UI.chrome(); if (changed && UI) UI.refresh();
    }
  },

  async push() {
    let changed = false;
    const queue = [...Core.C.syncQueue.values()].sort((a, b) => a.at - b.at);
    for (let i = 0; i < queue.length; i += 40) {
      const batch = queue.slice(i, i + 40)
        .map((q) => ({ q, rec: Core.get(q.table, q.recId) })).filter((x) => x.rec);
      if (!batch.length) continue;
      const res = await this.api('/api/push', { method: 'POST', body: { records: batch.map((x) => ({ table: x.q.table, rec: x.rec })) } });
      (res.results || []).forEach((r, k) => {
        const { q, rec } = batch[k];
        const local = Core.get(q.table, q.recId);
        if (r.status === 'stale' && r.server && newer(r.server, local)) { Core.putLocal(q.table, r.server); changed = true; }
        if (r.status === 'denied') { Core.C.syncQueue.delete(q.id); Core.idbDel('syncQueue', q.id); return; }
        if (local && local.updatedAt === rec.updatedAt) { Core.C.syncQueue.delete(q.id); Core.idbDel('syncQueue', q.id); }
      });
    }
    return changed;
  },

  async pull() {
    let changed = false, more = true, guard = 0;
    while (more && guard++ < 50) {
      const res = await this.api('/api/pull?since=' + this.cursor + '&limit=400');
      (res.records || []).forEach(({ table, rec }) => {
        if (!Core.C[table]) return;
        const local = Core.get(table, rec.id);
        if (!local || newer(rec, local)) { Core.putLocal(table, rec); changed = true; }
      });
      if (res.cursor != null) this.cursor = res.cursor;
      more = !!res.more;
    }
    return changed;
  },

  async status(serverUrl) {
    const r = await fetch(serverUrl.trim().replace(/\/+$/, '') + '/api/status', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
  },
  async signIn(serverUrl, username, password) {
    serverUrl = serverUrl.trim().replace(/\/+$/, '');
    const r = await fetch(serverUrl + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.token) throw new Error(data.error || 'login failed');
    Core.Auth.set({ serverUrl, token: data.token, user: data.user });
    await this.run();
  },
  async setup(serverUrl, name, username, password) {
    serverUrl = serverUrl.trim().replace(/\/+$/, '');
    const r = await fetch(serverUrl + '/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, username, password }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.token) throw new Error(data.error || 'setup failed');
    Core.Auth.set({ serverUrl, token: data.token, user: data.user });
    await this.run();
  },
  signOut() { Core.Auth.set(null); this.state = 'local'; UI && UI.chrome(); if (UI) UI.refresh(); },
};

window.Sync = Sync;
window.addEventListener('online', () => Sync.run());
window.addEventListener('offline', () => { Sync.state = Sync.configured() ? 'offline' : 'local'; UI && UI.chrome(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) Sync.run(); });
setInterval(() => { if (!document.hidden) Sync.run(); }, 60000);

/* ======================================================================
   Sri Finance JLG — Cloudflare Worker sync server (D1)
   Same API contract as the ZYFM app, so the web/mobile client's sync
   module can talk to it unchanged:
     POST /api/setup   {name, username, password}      -> first admin
     POST /api/login   {username, password}            -> {token, user}
     GET  /api/status                                  -> {ok, users, hasAdmin}
     GET  /api/meta  | POST /api/meta                  -> schema version
     POST /api/push    {records:[{table, rec}]}        -> {results:[...]}
     GET  /api/pull?since=<cursor>&limit=400           -> {records, cursor, more}
     POST /api/audit   {logs:[...]}
   Rule everywhere: a record replaces another only if updatedAt is newer
   (tie-break updatedBy) — older data never overwrites newer.
   ====================================================================== */

const SCHEMA_VERSION = 1;
const MIN_CLIENT_SCHEMA = 1;
const SYNCED = ["users", "centers", "loans", "weeks", "settings", "eod"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...CORS } });
const err = (msg, status = 400) => json({ error: msg }, status);
const now = () => Date.now();
const newer = (a, b) =>
  (a.updated_at || 0) > (b.updated_at || 0) ||
  ((a.updated_at || 0) === (b.updated_at || 0) && String(a.updated_by || "") > String(b.updated_by || ""));

// ---- password hashing (PBKDF2 / SHA-256) ----
async function hashPw(password, saltHex) {
  const salt = saltHex ? hexToBuf(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  return { hash: bufToHex(bits), salt: bufToHex(salt.buffer || salt) };
}
const bufToHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const hexToBuf = (hex) => new Uint8Array((hex.match(/.{1,2}/g) || []).map((h) => parseInt(h, 16)));
const token = () => bufToHex(crypto.getRandomValues(new Uint8Array(24)).buffer);

async function nextSeq(DB) {
  await DB.prepare("UPDATE seqctr SET val = val + 1 WHERE id = 1").run();
  const r = await DB.prepare("SELECT val FROM seqctr WHERE id = 1").first();
  return r.val;
}

async function auth(DB, req) {
  const h = req.headers.get("Authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!tok) return null;
  return await DB.prepare("SELECT id, name, username, role FROM users WHERE token = ?").bind(tok).first();
}

function safeUser(u) { return { id: u.id, name: u.name, username: u.username, role: u.role }; }

// mirror a user profile into the synced records table so clients learn roles via pull
async function mirrorUser(DB, u) {
  const seq = await nextSeq(DB);
  const rec = { id: u.id, name: u.name, username: u.username, role: u.role, updatedAt: now(), updatedBy: u.id };
  await DB.prepare(
    "INSERT INTO records (tbl,id,data,updated_at,updated_by,deleted,seq) VALUES ('users',?,?,?,?,0,?) " +
    "ON CONFLICT(tbl,id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at, updated_by=excluded.updated_by, seq=excluded.seq")
    .bind(u.id, JSON.stringify(rec), rec.updatedAt, u.id, seq).run();
}

export default {
  async fetch(req, env) {
    const DB = env.DB;
    const url = new URL(req.url);
    const path = url.pathname;
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    try {
      // ---------- status ----------
      if (path === "/api/status" && req.method === "GET") {
        const c = await DB.prepare("SELECT COUNT(*) n FROM users").first();
        return json({ ok: true, users: c.n, hasAdmin: c.n > 0, schemaVersion: SCHEMA_VERSION });
      }

      // ---------- first-admin setup ----------
      if (path === "/api/setup" && req.method === "POST") {
        const c = await DB.prepare("SELECT COUNT(*) n FROM users").first();
        if (c.n > 0) return err("already set up", 409);
        const { name, username, password } = await req.json();
        if (!username || !password) return err("username and password required");
        const { hash, salt } = await hashPw(password);
        const id = crypto.randomUUID(), tok = token();
        await DB.prepare(
          "INSERT INTO users (id,name,username,pass,salt,role,token,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,?)")
          .bind(id, name || username, username, hash, salt, "Admin", tok, now(), id).run();
        await mirrorUser(DB, { id, name: name || username, username, role: "Admin" });
        return json({ token: tok, user: { id, name: name || username, role: "Admin" } });
      }

      // ---------- login ----------
      if (path === "/api/login" && req.method === "POST") {
        const { username, password } = await req.json();
        const u = await DB.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();
        if (!u) return err("invalid credentials", 401);
        const { hash } = await hashPw(password, u.salt);
        if (hash !== u.pass) return err("invalid credentials", 401);
        const tok = token();
        await DB.prepare("UPDATE users SET token = ? WHERE id = ?").bind(tok, u.id).run();
        return json({ token: tok, user: { id: u.id, name: u.name, role: u.role } });
      }

      // ---------- meta ----------
      if (path === "/api/meta") {
        if (req.method === "GET")
          return json({ schemaVersion: SCHEMA_VERSION, minClientSchema: MIN_CLIENT_SCHEMA, appVersion: "1.0.0" });
        const me = await auth(DB, req);
        if (!me) return err("unauthorized", 401);
        return json({ ok: true }); // server owns schema version; accept and ignore
      }

      // everything below needs auth
      const me = await auth(DB, req);
      if (!me && path.startsWith("/api/")) {
        if (["/api/push", "/api/pull", "/api/audit"].includes(path)) return err("unauthorized", 401);
      }

      // ---------- pull ----------
      if (path === "/api/pull" && req.method === "GET") {
        if (!me) return err("unauthorized", 401);
        const since = parseInt(url.searchParams.get("since") || "0", 10);
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "400", 10), 1000);
        const rs = await DB.prepare(
          "SELECT tbl,id,data,updated_at,updated_by,deleted,seq FROM records WHERE seq > ? ORDER BY seq LIMIT ?")
          .bind(since, limit).all();
        const rows = rs.results || [];
        const records = rows.map((r) => {
          const rec = JSON.parse(r.data || "{}");
          rec.id = r.id; rec.updatedAt = r.updated_at; rec.updatedBy = r.updated_by;
          if (r.deleted) rec.deleted = true;
          return { table: r.tbl, rec };
        });
        const cursor = rows.length ? rows[rows.length - 1].seq : since;
        return json({ records, cursor, more: rows.length === limit });
      }

      // ---------- push ----------
      if (path === "/api/push" && req.method === "POST") {
        if (!me) return err("unauthorized", 401);
        const canWrite = me.role !== "Viewer";
        const { records } = await req.json();
        const results = [];
        for (const { table, rec } of records || []) {
          if (!SYNCED.includes(table)) { results.push({ status: "denied" }); continue; }
          // user records: only Admin may change
          if (table === "users" && me.role !== "Admin") { results.push({ status: "denied" }); continue; }
          if (!canWrite) { results.push({ status: "denied" }); continue; }

          const existing = await DB.prepare("SELECT data,updated_at,updated_by,deleted FROM records WHERE tbl=? AND id=?")
            .bind(table, rec.id).first();
          const incoming = { updated_at: rec.updatedAt || 0, updated_by: rec.updatedBy || me.id };

          if (existing && !newer(incoming, existing)) {
            const srv = JSON.parse(existing.data || "{}");
            srv.id = rec.id; srv.updatedAt = existing.updated_at; srv.updatedBy = existing.updated_by;
            if (existing.deleted) srv.deleted = true;
            results.push({ status: "stale", server: srv });
            continue;
          }
          const seq = await nextSeq(DB);
          await DB.prepare(
            "INSERT INTO records (tbl,id,data,updated_at,updated_by,deleted,seq) VALUES (?,?,?,?,?,?,?) " +
            "ON CONFLICT(tbl,id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at, " +
            "updated_by=excluded.updated_by, deleted=excluded.deleted, seq=excluded.seq")
            .bind(table, rec.id, JSON.stringify(rec), incoming.updated_at, incoming.updated_by,
                  rec.deleted ? 1 : 0, seq).run();
          results.push({ status: "ok" });
        }
        return json({ results });
      }

      // ---------- users management (admin) ----------
      if (path === "/api/users" && req.method === "GET") {
        if (!me || me.role !== "Admin") return err("admin only", 403);
        const rs = await DB.prepare("SELECT id,name,username,role FROM users ORDER BY name").all();
        return json({ users: rs.results || [] });
      }
      if (path === "/api/users" && req.method === "POST") {
        if (!me || me.role !== "Admin") return err("admin only", 403);
        const { name, username, password, role } = await req.json();
        if (!username || !password) return err("username and password required");
        const dup = await DB.prepare("SELECT id FROM users WHERE username=?").bind(username).first();
        if (dup) return err("username already exists", 409);
        const { hash, salt } = await hashPw(password);
        const id = crypto.randomUUID();
        const r = ["Admin", "Manager", "Staff", "Accountant", "Viewer"].includes(role) ? role : "Staff";
        await DB.prepare(
          "INSERT INTO users (id,name,username,pass,salt,role,token,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,?)")
          .bind(id, name || username, username, hash, salt, r, "", now(), me.id).run();
        await mirrorUser(DB, { id, name: name || username, username, role: r });
        return json({ ok: true, id });
      }
      if (path === "/api/users/update" && req.method === "POST") {
        if (!me || me.role !== "Admin") return err("admin only", 403);
        const { id, name, role, password } = await req.json();
        const u = await DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first();
        if (!u) return err("not found", 404);
        const newName = name != null ? name : u.name;
        const newRole = ["Admin", "Manager", "Staff", "Accountant", "Viewer"].includes(role) ? role : u.role;
        let pass = u.pass, salt = u.salt;
        if (password) { const h = await hashPw(password); pass = h.hash; salt = h.salt; }
        await DB.prepare("UPDATE users SET name=?, role=?, pass=?, salt=?, updated_at=?, updated_by=? WHERE id=?")
          .bind(newName, newRole, pass, salt, now(), me.id, id).run();
        await mirrorUser(DB, { id, name: newName, username: u.username, role: newRole });
        return json({ ok: true });
      }

      // ---------- change own password ----------
      if (path === "/api/password" && req.method === "POST") {
        if (!me) return err("unauthorized", 401);
        const { oldPassword, newPassword } = await req.json();
        if (!newPassword) return err("new password required");
        const u = await DB.prepare("SELECT * FROM users WHERE id=?").bind(me.id).first();
        const { hash } = await hashPw(oldPassword || "", u.salt);
        if (hash !== u.pass) return err("current password is wrong", 403);
        const h = await hashPw(newPassword);
        await DB.prepare("UPDATE users SET pass=?, salt=?, updated_at=? WHERE id=?")
          .bind(h.hash, h.salt, now(), me.id).run();
        return json({ ok: true });
      }

      // ---------- audit ----------
      if (path === "/api/audit" && req.method === "POST") {
        if (!me) return err("unauthorized", 401);
        const { logs } = await req.json();
        for (const l of logs || [])
          await DB.prepare("INSERT OR IGNORE INTO audit (id,data,at) VALUES (?,?,?)")
            .bind(l.id, JSON.stringify(l), l.at || now()).run();
        return json({ ok: true });
      }

      return err("not found", 404);
    } catch (e) {
      return err(String(e && e.message || e), 500);
    }
  },
};

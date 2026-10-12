import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
// Minimal Supabase-owned objects emulate auth/storage interfaces, not Supabase Auth itself.
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1,'/') $$;
GRANT USAGE ON SCHEMA auth,storage TO authenticated;
GRANT SELECT ON storage.objects TO authenticated;`);
await db.exec(
  (await fs.readFile("infra/database/001_schema.sql", "utf8")).replace(
    /^\uFEFF/,
    "",
  ),
);
await db.exec(await fs.readFile("infra/database/002_supabase_rls.sql", "utf8"));
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
for (const [id, name] of [
  [a, "Tenant A"],
  [b, "Tenant B"],
]) {
  await db.query("INSERT INTO auth.users VALUES ($1)", [id]);
  await db.query(
    "INSERT INTO organizations(id,name,created_at,updated_at) VALUES ($1,$2,now(),now())",
    [id, name],
  );
  await db.query(
    "INSERT INTO memberships(id,organization_id,user_id,role,created_at) VALUES ($1,$1,$1,'owner',now())",
    [id],
  );
  await db.query(
    `INSERT INTO cases(id,organization_id,created_by,title,legal_entity_name,chain_id,contract_address,policy_version,notes,status,mode,scenario,wallet_proof,created_at,updated_at)
 VALUES ($1,$1,$1,$2,$2,11155111,'0x1111111111111111111111111111111111111111','1.0','','DRAFT','live','valid-case','{}',now(),now())`,
    [id, name],
  );
  await db.query("INSERT INTO storage.objects VALUES ($1,'evidence',$2)", [
    id,
    id + "/case/document.pdf",
  ]);
}
await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${a}';`);
assert.equal((await db.query("SELECT * FROM cases")).rows.length, 1);
assert.equal(
  (await db.query("SELECT * FROM cases WHERE id=$1", [b])).rows.length,
  0,
);
assert.equal((await db.query("SELECT * FROM memberships")).rows.length, 1);
assert.equal((await db.query("SELECT * FROM storage.objects")).rows.length, 1);
await assert.rejects(
  () => db.query("UPDATE memberships SET role='admin'"),
  /permission denied/i,
);
await assert.rejects(
  () => db.query("UPDATE cases SET title='unauthorized'"),
  /permission denied/i,
);
await assert.rejects(
  () => db.query("SELECT * FROM reports"),
  /permission denied/i,
);
await assert.rejects(
  () => db.query("SELECT * FROM chain_anchors"),
  /permission denied/i,
);
await db.exec("RESET ROLE; SET ROLE anon;");
await assert.rejects(
  () => db.query("SELECT * FROM cases"),
  /permission denied/i,
);
await db.exec("RESET ROLE;");
// Exercise the finalization trigger using a minimal policy/run/report.
await db.query(
  "INSERT INTO policies(id,policy_code,version,jurisdiction,rules_json,policy_hash,effective_at,created_at) VALUES ($1,'TEST','1','internal','{}',$2,'2026-01-01',now())",
  [a, "a".repeat(64)],
);
await db.query(
  "INSERT INTO check_runs(id,organization_id,case_id,policy_id,status,started_at,snapshot,diff,cre_evidence,created_at) VALUES ($1,$1,$1,$1,'PASS',now(),'{}','[]','{}',now())",
  [a],
);
await db.query(
  "INSERT INTO reports(id,organization_id,run_id,version,payload,policy_hash,status,finalized_at,created_at) VALUES ($1,$1,$1,1,'{}',$2,'FINALIZED',now(),now())",
  [a, "a".repeat(64)],
);
await db.query("UPDATE reports SET payload='{}'::json WHERE id=$1", [a]);
await assert.rejects(
  () =>
    db.query(
      "UPDATE reports SET payload='{\"modified\":true}'::json WHERE id=$1",
      [a],
    ),
  /immutable/i,
);
await assert.rejects(
  () => db.query("UPDATE reports SET finalized_at=NULL WHERE id=$1", [a]),
  /immutable/i,
);
await assert.rejects(
  () => db.query("DELETE FROM reports WHERE id=$1", [a]),
  /immutable/i,
);
await db.query("UPDATE reports SET status='ANCHORED' WHERE id=$1", [a]);
console.log(
  "PASS: PostgreSQL migration, tenant SELECT/storage boundaries, role escalation denial, private report denial, immutable report trigger (PGlite; Auth/Storage schemas emulated).",
);
await db.close();

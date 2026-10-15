import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20261014184509_store.sql", import.meta.url), "utf8");

test("keeps payment orders behind RLS and blocks direct client table grants", () => {
  assert.match(migration, /alter table public\.orders enable row level security/i);
  assert.match(migration, /revoke all on public\.products, public\.orders from anon, authenticated/i);
  assert.doesNotMatch(migration, /grant\s+(?:select|insert|update|delete|all)[^;]*\borders\b\s+to\s+(?:anon|authenticated)/i);
});

test("constrains stored payment states and keeps Genius Pay references unique", () => {
  assert.match(migration, /payment_status text not null check \(payment_status in \('pending','paid','failed','initialization_failed','refunded'\)\)/i);
  assert.match(migration, /geniuspay_reference text unique/i);
});

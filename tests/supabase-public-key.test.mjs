import assert from "node:assert/strict";
import test from "node:test";
import { getSupabasePublicKey } from "../src/lib/supabase/public-key.ts";

const publishableKeyName = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
const anonKeyName = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

function withPublicKeys(keys, callback) {
  const previous = {
    publishable: process.env[publishableKeyName],
    anon: process.env[anonKeyName],
  };
  delete process.env[publishableKeyName];
  delete process.env[anonKeyName];
  if (keys.publishable !== undefined) process.env[publishableKeyName] = keys.publishable;
  if (keys.anon !== undefined) process.env[anonKeyName] = keys.anon;
  try {
    callback();
  } finally {
    if (previous.publishable === undefined) delete process.env[publishableKeyName];
    else process.env[publishableKeyName] = previous.publishable;
    if (previous.anon === undefined) delete process.env[anonKeyName];
    else process.env[anonKeyName] = previous.anon;
  }
}

test("accepts the configured legacy anon key when the publishable key name is absent", () => {
  withPublicKeys({ anon: "anon-test-only" }, () => {
    assert.equal(getSupabasePublicKey(), "anon-test-only");
  });
});

test("prefers the publishable key when both public key names are configured", () => {
  withPublicKeys({ publishable: "publishable-test-only", anon: "anon-test-only" }, () => {
    assert.equal(getSupabasePublicKey(), "publishable-test-only");
  });
});

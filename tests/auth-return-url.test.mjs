import assert from "node:assert/strict";
import { test } from "node:test";
import { safeAuthReturnTo } from "../src/lib/auth-return-url.ts";

const site = "https://tripanza-next-js-website.vercel.app/api/auth/social/callback";

test("keeps legitimate same-site return destinations", () => {
  assert.equal(safeAuthReturnTo("/tours/goa-youth-trip?date=2026-10-16#booking", site), "/tours/goa-youth-trip?date=2026-10-16#booking");
  assert.equal(safeAuthReturnTo("/", site), "/");
});

test("rejects destinations that could leave the site", () => {
  for (const value of [
    null,
    "https://evil.example/login",
    "//evil.example/login",
    "/\\evil.example/login",
    "/safe\\evil.example/login",
    "/\nevil.example/login",
  ]) {
    assert.equal(safeAuthReturnTo(value, site), "/", String(value));
  }
});

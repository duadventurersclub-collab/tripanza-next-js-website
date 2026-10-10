import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeTourSeo, redirectedTourSlug } from "../src/lib/tour-seo-types.ts";

test("normalizes tour search fields and rejects unsafe redirect destinations", () => {
  const config = normalizeTourSeo({
    tours: {
      "42": { title: "Custom title", description: "Trip details", image_url: "https://example.com/trip.jpg", noindex: true },
      bad: { title: "Ignored" },
      "43": { image_url: "javascript:alert(1)", noindex: "true" },
    },
    redirects: [
      { from: "old-goa-trip", to: "goa-youth-trip" },
      { from: "old-goa-trip", to: "another-tour" },
      { from: "outside", to: "https://evil.example" },
      { from: "same", to: "same" },
    ],
  });
  assert.equal(config.tours["42"].noindex, true);
  assert.equal(config.tours["42"].image_url, "https://example.com/trip.jpg");
  assert.equal(config.tours["43"].image_url, "");
  assert.equal(config.tours["43"].noindex, false);
  assert.equal(config.tours.bad, undefined);
  assert.deepEqual(config.redirects, [{ from: "old-goa-trip", to: "goa-youth-trip" }]);
  assert.equal(redirectedTourSlug(config, "old-goa-trip"), "goa-youth-trip");
  assert.equal(redirectedTourSlug(config, "unknown"), null);
});

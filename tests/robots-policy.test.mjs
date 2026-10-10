import assert from "node:assert/strict";
import { test } from "node:test";
import { AI_SEARCH_BOTS, AI_TRAINING_BOTS, buildRobotsRules, PRIVATE_ROBOT_PATHS } from "../src/lib/robots-policy.ts";

test("default policy allows public paths while excluding private paths", () => {
  const rules = buildRobotsRules(true, true);
  assert.equal(rules.length, 1);
  assert.deepEqual(rules[0], { userAgent: "*", allow: "/", disallow: PRIVATE_ROBOT_PATHS });
});

test("search and training choices only disallow their own documented bots", () => {
  for (const [searchEnabled, trainingEnabled] of [[false, true], [true, false], [false, false]]) {
    const rules = buildRobotsRules(searchEnabled, trainingEnabled);
    const blocked = rules.slice(1).map(rule => rule.userAgent);
    assert.deepEqual(blocked, [
      ...(searchEnabled ? [] : AI_SEARCH_BOTS),
      ...(trainingEnabled ? [] : AI_TRAINING_BOTS),
    ]);
    for (const rule of rules.slice(1)) assert.deepEqual(rule, { userAgent: rule.userAgent, disallow: "/" });
    assert.equal(rules[0].userAgent, "*");
  }
});

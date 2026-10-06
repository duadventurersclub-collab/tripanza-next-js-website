const test = require('node:test');
const assert = require('node:assert/strict');
const { zonedIso } = require('../business/frontend/src/lib/automationTime.ts');

test('scheduled times use the chosen timezone independently of the browser timezone and reject missing DST times', () => {
    assert.equal(zonedIso('2026-10-05T18:30', 'Asia/Calcutta'), '2026-10-05T13:00:00.000Z');
    assert.equal(zonedIso('2026-10-05T18:30', 'UTC'), '2026-10-05T18:30:00.000Z');
    assert.equal(zonedIso('2026-07-01T10:00', 'America/New_York'), '2026-07-01T14:00:00.000Z');
    assert.equal(zonedIso('2026-12-01T10:00', 'America/New_York'), '2026-12-01T15:00:00.000Z');
    assert.throws(() => zonedIso('2026-03-08T02:30', 'America/New_York'), /does not exist/);
    assert.throws(() => zonedIso('', 'UTC'), /valid scheduled/);
});

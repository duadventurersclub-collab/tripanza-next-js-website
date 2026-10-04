// Mechanical extraction/scoping of the supplied template's stylesheet.
import fs from 'node:fs';
import postcss from 'postcss';
const source = fs.readFileSync('../tripanza-create-edit-new-booking.php', 'utf8');
const root = postcss.parse([...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n'));
root.walkRules(rule => {
  if (rule.parent.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return;
  rule.selectors = rule.selectors.map(selector => {
    if ([':root', 'html', 'body.admin-bar', 'body.tripanza-booking-page'].includes(selector)) return '.native-booking-manager';
    return '.native-booking-manager ' + selector;
  });
});
fs.writeFileSync('src/components/admin/booking-manager-original.css', '/* Reference styles, scoped to the native booking manager. Regenerate with scripts/sync-booking-manager-css.mjs. */\n' + root.toString().trim() + '\n');

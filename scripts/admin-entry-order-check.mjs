import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const mainEditor = read('public/admin/editor/index.html');
const whitePapers = read('public/admin/editor/whitepapers.html');

const assertSecurityOrder = (source, label) => {
  const compatibility = source.indexOf('/admin/editor/editor-github-compat.js');
  const session = source.indexOf('/admin/editor/access-fetch-fix.js');
  const d1 = source.indexOf('/admin/editor/editor-d1-direct.js');
  expect(compatibility >= 0, `${label} is missing the GitHub compatibility wrapper.`);
  expect(session >= 0, `${label} is missing the signed-session wrapper.`);
  expect(d1 >= 0, `${label} is missing the D1 direct wrapper.`);
  expect(compatibility < session, `${label} must load compatibility before the signed-session wrapper.`);
  expect(session < d1, `${label} must load the signed-session wrapper before D1 direct publishing.`);
};

assertSecurityOrder(mainEditor, 'Main editor');
assertSecurityOrder(whitePapers, 'White Papers editor');

if (failures.length) {
  console.error('\nAdmin entry-order checks failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error('');
  process.exit(1);
}

console.log('Admin entry-order checks passed. Standalone editors preserve the signed-session publishing chain.');

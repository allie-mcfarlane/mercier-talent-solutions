import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const shell = read('public/admin/editor/admin-shell.js');
const shellCss = read('public/admin/editor/admin-shell.css');
const tools = read('public/admin/editor/workspace-tools.js');
const previewReadonly = read('public/admin/editor/preview-readonly.js');
const previewBuilder = read('scripts/build-admin-preview-data.mjs');
const packageJson = read('package.json');
const editorHtml = read('public/admin/editor/index.html');
const mediaHtml = read('public/admin/editor/media.html');
const menuHtml = read('public/admin/editor/menu.html');
const designHtml = read('public/admin/editor/design.html');
const whitepapersHtml = read('public/admin/editor/whitepapers.html');
const careersHtml = read('public/admin/editor/careers.html');

expect(shell.includes('class="mts-admin-rail"'), 'Shared admin sidebar is missing.');
expect(shell.includes('/admin/editor/#/page/home'), 'Sidebar no longer links directly to editable pages.');
expect(shell.includes('/admin/editor/careers.html'), 'Careers is missing from direct page navigation.');
expect(shell.includes('/admin/editor/whitepapers.html'), 'White Papers library is not routed through the Mercier editor.');
expect(shell.includes('/admin/editor/media.html'), 'Media Assets is not routed through the Mercier editor.');
expect(shell.includes('/admin/editor/menu.html'), 'Top Menu is not routed through the Mercier editor.');
expect(shell.includes('/admin/editor/design.html'), 'Design is not routed through the Mercier editor.');
expect(shell.includes('data-admin-nav="news" href="/admin/editor/#/blog">News & Insights</a>'), 'News & Insights is not the single article manager in the sidebar.');
expect(!shell.includes('data-admin-nav="blog"'), 'A separate Blog Posts navigation item can return.');
expect(shell.includes("['News & Insights page intro', '/admin/editor/#/page/news']"), 'News landing-page settings are not kept secondary to the article manager.');
expect(shell.includes("title.textContent = 'Current Posts'"), 'News & Insights manager does not clearly label the current-post list.');
expect(shell.includes("add.textContent = 'Add New Post'"), 'News & Insights manager does not clearly expose Add New Post.');
expect(shell.includes('quickGrid.querySelector(\'a[href="#/pages"]\')?.remove()'), 'Dashboard can expose the redundant Pages intermediary again.');
expect(shell.includes('ve-dashboard-pages'), 'Dashboard direct-page section is missing.');
expect(!shell.includes('ensurePublishDock'), 'Duplicate floating publish controls returned to the admin shell.');

expect(shellCss.includes('.mts-admin-rail{'), 'Admin sidebar styling is missing.');
expect(shellCss.includes('.ve-section-list{display:flex'), 'Page section navigation is no longer simplified into tabs.');
expect(shellCss.includes('@media(max-width:760px)'), 'Admin workspace is missing mobile layout rules.');
expect(shellCss.includes('.mts-media-grid'), 'Media workspace styling is missing.');
expect(shellCss.includes('.mts-design-grid'), 'Design workspace styling is missing.');

expect(tools.includes("tool === 'media'"), 'Native Media Assets screen is missing.');
expect(tools.includes("tool === 'menu'"), 'Native Top Menu screen is missing.');
expect(tools.includes("tool === 'design'"), 'Native Design screen is missing.');
expect(tools.includes("fetch('/admin/api/media?prefix=images/'"), 'Media Assets no longer loads through the protected media API.');
expect(tools.includes("fetch(`/admin/api/media?path=${encodeURIComponent(path)}`"), 'Media replace/upload no longer uses the protected media API.');
expect(tools.includes("src/content/navigation/main.md"), 'Top Menu is disconnected from the website navigation source.');
expect(tools.includes("src/content/settings/appearance.md"), 'Design is disconnected from approved appearance settings.');
expect(tools.includes('Save Draft'), 'Menu/Design draft workflow is missing.');
expect(tools.includes('Publish'), 'Menu/Design publish workflow is missing.');
expect(tools.includes('window.MTSAdminSession?.getCsrf?.()'), 'Workspace tools are not compatible with signed admin sessions.');

expect(previewReadonly.includes('MTS_ADMIN_PREVIEW_READ_ONLY'), 'Branch preview mode is not explicitly read-only.');
expect(previewReadonly.includes("host !== 'mercier-talent-solutions.pages.dev'"), 'Production Pages hostname can accidentally enter branch preview mode.');
expect(previewReadonly.includes("if (method !== 'GET')"), 'Branch preview can allow admin write requests.');
expect(previewReadonly.includes("snapshot.directories?.['public/images']"), 'Branch preview cannot load Media Assets.');
expect(previewBuilder.includes("'src/content/posts'"), 'Branch preview snapshot is missing current News & Insights posts.');
expect(previewBuilder.includes("'src/content/white-papers'"), 'Branch preview snapshot is missing White Papers.');
expect(previewBuilder.includes("'src/content/navigation'"), 'Branch preview snapshot is missing Top Menu data.');
expect(previewBuilder.includes("'src/content/settings'"), 'Branch preview snapshot is missing Design data.');
expect(packageJson.includes('node scripts/build-admin-preview-data.mjs &&'), 'Build no longer generates the safe admin preview snapshot.');

for (const [name, html, marker] of [
  ['Media Assets', mediaHtml, 'data-tool="media"'],
  ['Top Menu', menuHtml, 'data-tool="menu"'],
  ['Design', designHtml, 'data-tool="design"'],
]) {
  expect(html.includes(marker), `${name} page is missing its workspace mode.`);
  expect(html.includes('/admin/editor/admin-shell.css'), `${name} page is missing shared admin styling.`);
  expect(html.includes('/admin/editor/admin-shell.js'), `${name} page is missing shared admin navigation.`);
  expect(html.includes('/admin/editor/access-fetch-fix.js'), `${name} page is missing protected-request handling.`);
  expect(html.includes('/admin/editor/preview-readonly.js'), `${name} page cannot load safely on branch previews.`);
}

expect(editorHtml.includes('/admin/editor/admin-shell.js'), 'Main editor no longer loads the shared workspace shell.');
expect(editorHtml.includes('/admin/editor/preview-readonly.js'), 'Main editor cannot load page/post data on read-only branch previews.');
expect(whitepapersHtml.includes('/admin/editor/admin-shell.js'), 'White Papers no longer loads the shared workspace shell.');
expect(whitepapersHtml.includes('/admin/editor/preview-readonly.js'), 'White Papers cannot load on read-only branch previews.');
expect(careersHtml.includes('/admin/editor/admin-shell.js'), 'Careers no longer loads the shared workspace shell.');
expect(careersHtml.includes('/admin/editor/preview-readonly.js'), 'Careers cannot load on read-only branch previews.');

if (failures.length) {
  console.error('\nAdmin workspace checks failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error('');
  process.exit(1);
}

console.log('Admin workspace checks passed. Direct page editors, unified News & Insights management, shared sidebar navigation, native Media/Menu/Design screens, and safe read-only branch previews are present.');
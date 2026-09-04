import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(root, 'public/admin/editor/preview-data.json');
const cloudflareBranch = String(process.env.CF_PAGES_BRANCH || '').trim();

if (cloudflareBranch === 'main') {
  if (fs.existsSync(outputPath)) fs.rmSync(outputPath);
  console.log('Admin branch-preview data skipped for production.');
  process.exit(0);
}

const contentRoots = [
  'src/content/pages',
  'src/content/posts',
  'src/content/white-papers',
  'src/content/navigation',
  'src/content/settings',
];

const files = {};
const directories = {};

const fileEntry = (relativePath) => {
  const stat = fs.statSync(path.join(root, relativePath));
  return {
    name: path.basename(relativePath),
    path: relativePath.replaceAll(path.sep, '/'),
    type: 'file',
    size: stat.size,
  };
};

for (const relativeRoot of contentRoots) {
  const absoluteRoot = path.join(root, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) continue;
  const entries = fs.readdirSync(absoluteRoot)
    .filter((name) => name.toLowerCase().endsWith('.md'))
    .sort()
    .map((name) => fileEntry(path.join(relativeRoot, name)));
  directories[relativeRoot] = entries;
  for (const entry of entries) {
    files[entry.path] = fs.readFileSync(path.join(root, entry.path), 'utf8');
  }
}

const imageRoot = 'public/images';
const absoluteImageRoot = path.join(root, imageRoot);
const imagePattern = /\.(png|jpe?g|webp|gif|svg|avif)$/i;
if (fs.existsSync(absoluteImageRoot)) {
  directories[imageRoot] = fs.readdirSync(absoluteImageRoot)
    .filter((name) => imagePattern.test(name) && fs.statSync(path.join(absoluteImageRoot, name)).isFile())
    .sort()
    .map((name) => fileEntry(path.join(imageRoot, name)));
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({ version: 1, files, directories })}\n`, 'utf8');
console.log(`Admin preview data written with ${Object.keys(files).length} content files.`);

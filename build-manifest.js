const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const OUTPUT = path.join(DATA_DIR, 'manifest.json');

function walkDir(dirPath, relativeTo) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const children = [];

  for (const entry of entries) {
    if (entry.name === 'manifest.json') continue;

    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(relativeTo, fullPath);

    if (entry.isDirectory()) {
      children.push({
        type: 'dir',
        name: entry.name,
        children: walkDir(fullPath, relativeTo),
      });
    } else {
      children.push({
        type: 'file',
        name: entry.name,
        path: 'data/' + relPath,
      });
    }
  }

  children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return children;
}

const manifest = {
  type: 'dir',
  name: '/',
  children: walkDir(DATA_DIR, DATA_DIR),
};

fs.writeFileSync(OUTPUT, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote ${OUTPUT}`);

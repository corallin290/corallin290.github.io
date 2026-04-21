let root = null;

export async function init() {
  const res = await fetch('data/manifest.json');
  root = await res.json();
}

export function resolve(inputPath, cwd) {
  const segments = normalizePath(inputPath, cwd);
  let node = root;

  for (const seg of segments) {
    if (node.type !== 'dir') return null;
    const child = node.children.find((c) => c.name === seg);
    if (!child) return null;
    node = child;
  }

  return node;
}

export function list(dirPath, cwd) {
  const node = resolve(dirPath, cwd);
  if (!node || node.type !== 'dir') return null;
  return node.children.map((c) => ({ name: c.name, type: c.type }));
}

export async function read(filePath, cwd) {
  const node = resolve(filePath, cwd);
  if (!node || node.type !== 'file') return null;
  const res = await fetch(node.path);
  return res.text();
}

export function isDir(path, cwd) {
  const node = resolve(path, cwd);
  return node !== null && node.type === 'dir';
}

export function isFile(path, cwd) {
  const node = resolve(path, cwd);
  return node !== null && node.type === 'file';
}

function normalizePath(inputPath, cwd) {
  let parts;
  if (inputPath.startsWith('/')) {
    parts = inputPath.split('/').filter(Boolean);
  } else {
    const cwdParts = cwd.split('/').filter(Boolean);
    const inputParts = inputPath.split('/').filter(Boolean);
    parts = [...cwdParts, ...inputParts];
  }

  const resolved = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }

  return resolved;
}

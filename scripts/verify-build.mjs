import { readFile, access, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve('dist');
for (const entry of ['index.html', 'thinking-school/index.html']) {
  const path = resolve(root, entry);
  const html = await readFile(path, 'utf8');
  if (!/^<!doctype html>/i.test(html.trim()) || !html.includes('lang="ru"')) throw Error(`Invalid HTML5 document: ${entry}`);
  if (html.includes('/src/main.js')) throw Error(`Unbuilt source in ${entry}`);
  const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1]).filter(url => !/^[a-z]+:/i.test(url));
  for (const asset of assets) {
    const target = resolve(dirname(path), asset.replace(/^\//, `${root}/`));
    if (!target.startsWith(`${root}/`)) throw Error(`Asset outside deployment: ${asset}`);
    await access(target);
  }
  console.log(`Verified built HTML and assets: ${entry}`);
}
await access(resolve(root, '.nojekyll'));
const files = await readdir(root);
if (files.some(file => ['package.json', 'node_modules', 'src'].includes(file))) throw Error('Source files leaked into deployment');

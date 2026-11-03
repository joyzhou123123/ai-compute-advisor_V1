import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const baseline = JSON.parse(readFileSync(new URL('../docs/ui-v2-data-baseline.json', import.meta.url), 'utf8'));
const changed = Object.entries(baseline.sha256).filter(([path, expected]) => {
  const actual = createHash('sha256').update(readFileSync(new URL('../' + path, import.meta.url))).digest('hex');
  return actual !== expected;
});
if (changed.length) throw new Error('Original data/calculation files changed: ' + changed.map(([path]) => path).join(', '));
console.log(`${Object.keys(baseline.sha256).length} original data/calculation files match ${baseline.baseCommit} byte for byte.`);

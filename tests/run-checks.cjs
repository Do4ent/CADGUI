/** Discover module suites so CI cannot silently omit new packages. */
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
function collect(directory, pattern) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? collect(filename, pattern) : pattern.test(entry.name) ? [filename] : [];
  });
}
const suites = [...new Set([
  ...collect(path.join(root, 'tests'), /-check\.cjs$/),
  ...collect(path.join(root, 'src'), /\.test\.cjs$/),
])].sort();
if (!suites.length) throw new Error('No check suites found');
for (const suite of suites) {
  console.log(`\nRunning ${path.relative(root, suite)}`);
  const result = spawnSync(process.execPath, [suite], {cwd: root, stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`\nPASS: ${suites.length} check suites`);

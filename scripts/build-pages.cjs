// Build untuk GitHub Pages. Sengaja lewat Node, bukan "VITE_BASE_PATH=/... npm run build",
// karena Git Bash mengubah nilai berawalan / menjadi path Windows dan hasilnya adalah
// index.html yang menunjuk aset 404 — layar putih di semua ponsel.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const steps = [
  [process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { GT_TARGET: 'pages' }],
  [process.execPath, ['scripts/check-pages-build.cjs'], {}],
];

for (const [cmd, args, extraEnv] of steps) {
  const run = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  if (run.status !== 0) {
    console.error(`FAIL  langkah ${args.join(' ')} berhenti dengan kode ${run.status ?? 'sinyal'}`);
    process.exit(run.status || 1);
  }
}

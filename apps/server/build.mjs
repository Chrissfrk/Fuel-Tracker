// Bundles the server (and @fuel/shared, which ships as TypeScript source) into dist/.
// Runtime npm dependencies stay external and are installed in the production image.
import { build } from 'esbuild';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url)));
const rootPkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url)));
const external = Object.keys(pkg.dependencies).filter((d) => !d.startsWith('@fuel/'));

await build({
  entryPoints: { index: 'src/index.ts', seed: 'src/seed.ts' },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external,
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? rootPkg.version ?? '1.0.0'),
  },
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
});

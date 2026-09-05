/**
 * src/ 의 여러 파일을 dist/index.html 한 장으로 합친다.
 *
 * 왜 필요한가: 배포본은 파일 하나여야 한다.
 *  - file:// 로 바로 열려야 하고 (인터넷 없는 제주 중산간)
 *  - 카톡으로 파일 하나만 던지면 끝나야 하고
 *  - GitHub Pages 에 index.html 하나만 올리면 되어야 한다.
 *
 * 의존성 없음. node scripts/build.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src  = join(root, 'src');
const dist = join(root, 'dist');

let html = readFileSync(join(src, 'index.html'), 'utf8');
const css = readFileSync(join(src, 'styles.css'), 'utf8');
const leafletCss = readFileSync(join(src, 'vendor', 'leaflet.css'), 'utf8');
const leafletJs = readFileSync(join(src, 'vendor', 'leaflet.js'), 'utf8');

const files = readdirSync(join(src, 'js')).filter(f => f.endsWith('.js')).sort();
const js = leafletJs + '\n\n' + files
  .map(f => `/* ─────────── ${f} ─────────── */\n` + readFileSync(join(src, 'js', f), 'utf8'))
  .join('\n\n');

html = html.replace('<link rel="stylesheet" href="vendor/leaflet.css">', `<style>\n${leafletCss}\n</style>`);
html = html.replace('<link rel="stylesheet" href="styles.css">', `<style>\n${css}\n</style>`);
html = html.replace('<script src="vendor/leaflet.js"></script>\n', '');
for (const f of files) html = html.replace(`<script src="js/${f}"></script>\n`, '');
html = html.replace('</body>', `<script>\n${js}\n</script>\n</body>`);

mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, 'index.html'), html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`dist/index.html  ${kb} KB  (${files.length}개 스크립트 인라인)`);

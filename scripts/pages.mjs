/**
 * dist/index.html 을 docs/index.html 로 복사한다.
 *
 * 왜 필요한가: GitHub Pages 는 브랜치의 root 또는 /docs 폴더만 소스로 고를 수 있다.
 * dist/ 는 .gitignore 에 있는 빌드 산출물이라 저장소에 안 올라가므로, 배포용으로
 * 한 번 더 docs/ 에 복사해 커밋한다. npm run build 를 먼저 실행해야 한다
 * (npm run pages 는 build 까지 한 번에 한다).
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'docs'), { recursive: true });
copyFileSync(join(root, 'dist', 'index.html'), join(root, 'docs', 'index.html'));
console.log('docs/index.html 갱신됨 — git add docs && git commit && git push 하면 배포된다.');

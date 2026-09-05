/**
 * 빌드 산출물의 기본 건전성 검사. 테스트 프레임워크 없이 즉시 실패를 잡는다.
 * node scripts/check.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'dist', 'index.html'), 'utf8');
let fail = 0;
const check = (ok, msg) => { console.log((ok ? '  OK  ' : ' FAIL ') + msg); if (!ok) fail++; };

// 1. 스크립트 전체가 파싱되는가
const i = html.lastIndexOf('<script>'), j = html.lastIndexOf('</script>');
const code = html.slice(i + 8, j);
try { new Function(code); check(true, 'JS 문법'); }
catch (e) { check(false, 'JS 문법 — ' + e.message); }

// 2. getElementById 대상이 모두 존재하는가 (오타로 조용히 죽는 것을 막는다)
const ids = new Set([...html.matchAll(/id="([A-Za-z0-9_]+)"/g)].map(m => m[1]));
const used = [...new Set([...code.matchAll(/getElementById\('([A-Za-z0-9_]+)'\)/g)].map(m => m[1]))];
const dynamic = ['mmOff'];
const missing = used.filter(u => !ids.has(u) && !dynamic.includes(u));
check(missing.length === 0, 'DOM id 참조' + (missing.length ? ' — 없음: ' + missing.join(', ') : ''));

// 3. 외부 의존성이 없는가 (오프라인 동작의 전제)
const ext = [...html.matchAll(/<script[^>]+src="(https?:[^"]+)"/g)].map(m => m[1]);
check(ext.length === 0, '외부 스크립트 0개' + (ext.length ? ' — ' + ext.join(', ') : ''));

// 4. Leaflet 라이브러리가 (CDN이 아니라) 번들 안에 들어있는가
check(/Leaflet 1\.\d+\.\d+, a JS library for interactive maps/.test(code), 'Leaflet 라이브러리 내장');
check(/L\.tileLayer\(/.test(code), '타일 레이어 초기화 코드 존재');

// 5. 저장이 실제로 되는가.
// window.storage 어댑터(00-storage.js)가 빠지면 save() 가 조용히 아무것도 안 하고
// 새로고침할 때마다 시드로 되돌아간다. 화면에는 아무 오류도 안 나서 놓치기 쉬웠다.
check(/window\.storage\s*=\s*\{/.test(code), '저장소 어댑터 내장 (window.storage 폴백)');
check(/localStorage\.setItem/.test(code), '저장소 어댑터가 localStorage 로 실제 기록');

// 6. 저장은 window.storage 로만 한다 (절대 규칙 4). 어댑터 파일만 예외.
const srcJs = join(root, 'src', 'js');
// 주석은 걷어내고 본다 - 규칙을 설명하는 주석까지 위반으로 잡으면 검사를 못 믿게 된다
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const leaks = readdirSync(srcJs)
  .filter(f => f.endsWith('.js') && f !== '00-storage.js')
  .filter(f => /\b(localStorage|sessionStorage)\b/
    .test(stripComments(readFileSync(join(srcJs, f), 'utf8'))));
check(leaks.length === 0,
  'localStorage 직접 사용 없음' + (leaks.length ? ' — ' + leaks.join(', ') : ''));

console.log(fail ? `\n${fail}건 실패` : '\n전부 통과');
process.exit(fail ? 1 : 0);

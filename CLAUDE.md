# 제주 여행 플래너 — 프로젝트 컨텍스트

Claude Code 가 이 저장소에서 작업할 때 먼저 읽는 문서. 규칙과 함정을 적어둔다.

## 이게 뭔가

2026년 10월 29일 ~ 11월 1일 제주 가족여행 일정 플래너. 휴대폰에서 쓴다.
일정을 편집하면 지도와 이동시간이 즉시 다시 계산된다.

**실제 사용 맥락이 설계를 지배한다.**
- 사용자는 안드로이드 인앱 브라우저와 크롬을 오간다
- 제주 중산간은 통신 음영이 있다
- 가족 여러 명이 같은 일정을 본다 (수정 권한은 일부만)

## 절대 규칙

1. **원격 CDN에서 스크립트를 받아오지 말 것.** `<script src="https://...">` 금지.
   `scripts/check.mjs` 가 이걸 검사한다 (dist 산출물에 `http(s)://` 스크립트가 없는지).
   *(2026-09 변경: "휴대폰이 항상 온라인"이라는 전제로 지도를 Leaflet + 실제 타일로 바꿨다.
   다만 Leaflet 자체는 CDN이 아니라 `src/vendor/leaflet.js`/`leaflet.css` 로 로컬에 내려받아
   번들에 포함한다 — 라이브러리 금지가 아니라 "원격에서 받아오지 않는다"가 이 규칙의 본뜻이다.
   지도 타일 이미지는 여전히 온라인 요청이며, 타일 서버가 막히거나 오프라인이면 지도가 빈
   화면이 된다 — 자체 벡터 지도 대체 기능은 의도적으로 없앴다.)*

2. **ES 모듈(import/export)을 쓰지 말 것.** `src/js/*.js` 는 일반 스크립트다.
   `file://` 로 열어도 동작해야 하는데 모듈은 CORS 때문에 안 된다.
   파일 간 공유는 최상위 `const`/`let`/`function` 으로 한다. 로드 순서는 `src/index.html` 이 결정한다.

3. **`position: fixed` 와 `height: 100dvh` 를 쓰지 말 것.**
   안드로이드 인앱 웹뷰에서 뷰포트를 잘못 잡아 화면이 잘린 전례가 있다.
   대신 일반 문서 흐름 + `position: sticky` 를 쓴다 (헤더, 지도 `#mapWrap`, 하단 `.fab`).
   `#mapWrap` 의 `top` 은 헤더 높이만큼 띄워야 하는데 기기마다 달라서, `10-main.js` 의
   `measureHeader()` 가 실측해 `--hdr-h` 로 넣어준다. 헤더 구조를 바꾸면 이게 따라온다.

4. **localStorage / sessionStorage 를 직접 쓰지 말 것.** 저장은 전부 `window.storage` 로만 한다.
   `js/00-storage.js` 가 어댑터다 — 호스트가 `window.storage` 를 주면 그대로 쓰고, 없으면
   localStorage 로, 그것도 막히면 메모리로 떨어진다. **이 어댑터가 없으면 저장이 조용히
   무시된다**: 실제로 GitHub Pages 에 올린 뒤 새로고침할 때마다 시드로 되돌아가는 버그가 났다.

5. **하드코딩된 좌표는 추정치임을 표시할 것.** 특히 숙소(하도39)와 식당들.

## 구조

```
src/
  index.html        마크업만. 스크립트 로드 순서를 여기서 정한다.
  styles.css        전체 스타일. CSS 변수는 :root 에.
  vendor/leaflet.js/.css  Leaflet 1.9.4 로컬 사본 (CDN 아님). npm install leaflet 로 재내려받기.
  js/00-storage.js  window.storage 어댑터 (localStorage 폴백). 절대 규칙 4 참고
  js/01-seed.js     상수, 시드 일정, 추천 장소 목록
  js/02-state.js    전역 상태 S, 저장/로드
  js/03-schedule.js 시간 계산, 하버사인, 구간 판정, 스케줄 산출, OSRM
  js/05-map.js      Leaflet 래핑 (MAP 객체) + drawMap. 번호 있음(04)은 결번 — 예전 자체 벡터 엔진 자리
  js/06-render.js   리스트/요약 렌더
  js/07-editor.js   일정 편집 시트, 장소 검색, 지도 찍기
  js/08-settings.js 추천 장소, 설정, 내보내기/가져오기
  js/09-sync.js     공유 링크, 방 동기화, 권한
  js/10-main.js     토스트, 초기화
dist/index.html     빌드 산출물. 배포는 이것만. Leaflet JS/CSS 도 여기에 인라인된다.
```

## 명령

```
npm run build    src/ → dist/index.html 한 장으로 합침
npm run check    문법·DOM id·외부 의존성 검사
npm run dev      로컬 서버 (http://localhost:8080/src/)
npm run pages    build 후 docs/index.html 로 복사 (GitHub Pages 배포용, README 참고)
```

개발 중에는 `src/index.html` 을 직접 열어도 된다. 배포 전에는 반드시 build + check.

## 핵심 개념

**이동수단(`item.move`)** — 각 일정에서 *다음* 일정까지의 이동 방식.
`auto`(거리로 도보/자차 판정) / `walk` / `drive` / `air` / `ferry` / `none`.
`air`, `ferry` 는 소요시간을 추정하지 않는다. 다음 일정의 고정시각을 따른다.
김포–제주 610km 를 자차로 계산해 "이동시간 15시간"이 나온 버그가 여기서 나왔다.

**고정시각(`item.fix`)** — 항공편·렌터카처럼 시간이 정해진 일정.
앞 일정이 밀려 도착 예정이 고정시각을 넘으면 "지각" 경고가 뜬다. 이게 이 앱의 핵심 가치다.

**권한** — 편집 링크 `#r=방ID&k=PIN`, 조회 링크 `#r=방ID`.
조회 모드는 `body.viewonly` 클래스로 UI 를 잠근다.
**이건 보안이 아니라 실수 방지다.** 저장소가 공개 KV(jsonblob)라 방 ID 를 알면 직접 쓸 수 있다.
진짜 접근 제어가 필요하면 Supabase RLS 로 갈아타야 한다.

## 알려진 미해결 과제

- 오프라인 캐싱(서비스워커) 없음. HTTPS 호스팅이 있어야 넣을 수 있다.
- 지도가 온라인 전제다. 타일 서버가 막히거나 통신이 끊기면 지도가 빈 화면이 된다
  (제주 중산간 음영 지역 등). 이 프로젝트는 git 버전 관리가 안 되어 있으니, 예전 자체 벡터
  지도 엔진이 필요해지면 새로 만들어야 한다.
- 숙소·식당 좌표가 추정치. 앱 안 검색으로 실좌표를 잡아야 한다.
- 충돌 병합이 last-write-wins. 자동 병합은 일부러 안 한다.

## 코드 스타일

한국어 주석. **무엇을** 하는지가 아니라 **왜** 그렇게 했는지를 적는다.
특히 우회 코드에는 어떤 실패를 겪어서 그렇게 됐는지 남긴다.

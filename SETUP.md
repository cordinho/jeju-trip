# VS Code + Claude Code 설정

## 1. 압축 풀기

`jeju-trip-planner.zip` 을 다음 위치에 풀어 폴더 내용이 이렇게 되도록 한다.

```
C:\Users\zangh\OneDrive\바탕 화면\Claude Code\
    CLAUDE.md
    README.md
    SETUP.md
    package.json
    .gitignore
    .vscode\
    scripts\
    src\
    dist\
```

## 2. VS Code 로 열기

폴더에서 우클릭 → "Code(으)로 열기".
없으면 VS Code 실행 후 File → Open Folder.

처음 열면 확장 프로그램 추천 알림이 뜬다. Live Server 를 설치하면 `src/index.html`
우클릭 → "Open with Live Server" 로 즉시 미리보기가 된다.

## 3. Claude Code 실행

VS Code 터미널(``Ctrl + ` ``)에서:

```
claude
```

설치가 안 되어 있으면 먼저:

```
npm install -g @anthropic-ai/claude-code
```

`CLAUDE.md` 를 자동으로 읽는다. 프로젝트 규칙과 지금까지 겪은 함정이 거기 적혀 있으니
같은 실수를 반복하지 않는다.

## 4. 명령

```
npm run dev      개발 서버. http://localhost:8080/src/
npm run build    dist\index.html 한 장 생성
npm run check    배포 전 검사 (문법, DOM id, 외부 의존성)
```

`npm run dev` 는 `npx` 로 서버를 그때만 받아 쓴다. 설치할 패키지는 없다.

## 5. 작업 흐름

`src/` 를 고치고 → `npm run check` 로 통과 확인 → `dist/index.html` 을 배포한다.
`dist` 는 빌드 산출물이니 직접 고치지 않는다.

## Claude Code 에 던질 만한 첫 작업들

- "10/30 오후가 비어 있다. 하도리 기준 왕복 3시간 안에 다녀올 코스를 3개 제안하고
  각각의 예상 이동시간을 계산해서 시드 데이터에 후보로 넣어줘"
- "숙소 좌표가 추정치다. 구좌읍 면수2길 39 의 실제 좌표를 찾아 01-seed.js 를 고쳐줘"
- "지도에 관성 스크롤을 넣어줘. 외부 라이브러리는 쓰지 말고"
- "서비스워커를 추가해 오프라인에서도 열리게 해줘. GitHub Pages 배포 전제로"
- "10/29 저녁 동선이 무리인지 검증해줘. 제주공항 18:00 도착에서 하도리까지"

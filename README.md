# 제주 여행 플래너

2026.10.29 – 11.01 제주 가족여행 일정. 휴대폰용 단일 파일 웹앱.

## 시작

```bash
npm run dev      # http://localhost:8080/src/ 에서 개발
npm run build    # dist/index.html 한 장 생성
npm run check    # 배포 전 검사
```

Node.js 만 있으면 된다. 설치할 패키지 없음.

## 기능

- 일정 추가·수정·순서 변경. 시간은 "도착 시각" 하나만 입력하고, 비우면 자동 계산
- 구간별 이동시간 자동 계산 — 1km 이하는 도보, 초과는 자차 (기준값은 설정에서 조정)
- 항공·배 구간은 시간을 추정하지 않음
- 앞 일정에서 제때 닿을 수 없는 시각이면 "모자람" 경고
- 지도 자동 연동 (Leaflet + OpenStreetMap 타일). 일정을 바꾸면 핀과 동선이 즉시 갱신
- 여행 당일 실제로 다닌 길을 GPS 로 기록해 계획 위에 겹쳐 표시 (화면이 켜져 있는 동안만)
- 일정은 이 기기에 저장됨. 다른 기기로 옮길 땐 설정의 내보내기/가져오기(JSON)

## 배포

`dist/index.html` 하나만 있으면 된다.

**GitHub Pages** — `npm run pages` 로 `docs/index.html` 을 만든 뒤 커밋·푸시. 저장소 Settings → Pages
→ Branch: `main`, Folder: `/docs`. LTE/5G 등 외부 네트워크에서도 열리는 고정 URL이 생긴다.
수정할 때마다 `npm run pages && git add docs && git commit -m "..." && git push` 반복.
**파일 전달** — 그냥 보내면 된다. 받는 쪽은 브라우저로 열면 되고, 일정은 각자의 기기에 따로 남는다.

휴대폰에서 주소를 연 뒤 "홈 화면에 추가" 하면 앱처럼 뜬다.

## 데이터 출처

지도: [Leaflet](https://leafletjs.com) (로컬 내장, CDN 아님) + OpenStreetMap 타일 — 항상 온라인 전제.
장소 검색: Nominatim (제주·서울 지역만). 도로 경로: OSRM (설정에서 켜면 사용).

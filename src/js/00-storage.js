/* 브라우저가 순서대로 로드하는 일반 스크립트입니다.
   ES 모듈이 아니므로 import/export를 쓰지 마세요 - file:// 에서도 열려야 합니다.
   최상위 const/let/function 은 스크립트 간에 공유됩니다. 순서는 index.html 이 결정합니다. */

/* ══════════════ 저장소 어댑터 ══════════════ */
// 이 앱은 저장을 전부 window.storage 로만 한다 (02-state.js 의 save/load, 09-sync.js 의
// 방 정보, 05-map.js 의 지도 높이). 그런데 window.storage 는 원래 실행 환경이 넣어주던
// 물건이라 GitHub Pages + 폰 브라우저에는 아예 없었고, 그동안 저장이 전부 조용히 무시돼
// 새로고침하면 시드 일정으로 되돌아갔다. (지도에서 찍은 좌표가 사라진 원인)
//
// 그래서 호스트가 주면 그걸 쓰고, 없으면 localStorage 로 같은 모양의 객체를 만들어 둔다.
// 호출부는 그대로 window.storage 만 쓰면 되므로 "localStorage 를 직접 쓰지 않는다"는
// 원칙은 유지된다. localStorage 조차 막힌 경우(사생활 보호 모드, 용량 초과)에는 메모리로
// 떨어져 최소한 그 세션 동안은 편집이 유지된다.
(function(){
  if(window.storage && typeof window.storage.get === 'function') return;

  let ls = null;
  try{
    const probe = '__jeju_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    ls = localStorage;
  }catch(e){ ls = null; }   // 사생활 보호 모드 등에서는 접근 자체가 예외를 던진다

  const mem = new Map();

  window.storage = {
    async get(key){
      try{ if(ls){ const v = ls.getItem(key); if(v != null) return {value:v}; } }catch(e){}
      return mem.has(key) ? {value: mem.get(key)} : null;
    },
    async set(key, value){
      mem.set(key, value);              // 메모리에는 항상 둔다 (localStorage 가 중간에 막혀도 유지)
      try{ if(ls) ls.setItem(key, value); }catch(e){ /* 용량 초과 → 메모리만 */ }
    },
    async delete(key){
      mem.delete(key);
      try{ if(ls) ls.removeItem(key); }catch(e){}
    }
  };
})();

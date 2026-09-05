/* 브라우저가 순서대로 로드하는 일반 스크립트입니다.
   ES 모듈이 아니므로 import/export를 쓰지 마세요 - file:// 에서도 열려야 합니다.
   최상위 const/let/function 은 스크립트 간에 공유됩니다. 순서는 index.html 이 결정합니다. */

/* ══════════════ 상태 ══════════════ */
let S = seed();
let curDay = 0, curItem = null, pickMode = null; // pickMode: 'edit' | 'new'
let insertAt = null; // 새 일정을 저장할 때 끼워 넣을 위치. null이면 맨 뒤에 추가
let editOpen = false; // 편집 폼이 목록 안에 펼쳐져 있는가 (시트가 아니라 인라인이다)
const legCache = {};

// 공유 방을 없앤 뒤로 편집 권한 개념이 사라졌다. 호출부를 그대로 두려고 함수만 남긴다.
const canEdit = () => true;

/* ══════════════ 저장 ══════════════ */
const KEY = 'jeju-trip-v1';
async function save(){
  try{ if(window.storage) await window.storage.set(KEY, JSON.stringify(S)); }catch(e){}
}
async function load(){
  try{
    if(!window.storage) return;
    const r = await window.storage.get(KEY);
    if(r && r.value){ const p = JSON.parse(r.value); if(p && p.days) S = migrate(p); }
  }catch(e){ /* 최초 실행 */ }
}

// 저장해 둔 데이터를 최신 형식으로 올린다. 설정 기본값을 바꿔도 이미 저장된 사람에게는
// 반영되지 않으므로(그래서 "바뀐 게 없다"로 보인다) 여기서 한 번 올려준다.
function migrate(p){
  p.cfg = p.cfg || {};
  if(!(p.ver >= 2)){
    p.cfg.osrm = true;   // 실제 도로 경로를 기본으로
    p.ver = 2;
  }
  return p;
}

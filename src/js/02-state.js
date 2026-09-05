/* 브라우저가 순서대로 로드하는 일반 스크립트입니다.
   ES 모듈이 아니므로 import/export를 쓰지 마세요 - file:// 에서도 열려야 합니다.
   최상위 const/let/function 은 스크립트 간에 공유됩니다. 순서는 index.html 이 결정합니다. */

/* ══════════════ 상태 ══════════════ */
let S = seed();
let curDay = 0, curItem = null, pickMode = null; // pickMode: 'edit' | 'new'
let insertAt = null; // 새 일정을 저장할 때 끼워 넣을 위치. null이면 맨 뒤에 추가
let editOpen = false; // 편집 폼이 목록 안에 펼쳐져 있는가 (시트가 아니라 인라인이다)
const legCache = {};

/* ══════════════ 저장 ══════════════ */
const KEY = 'jeju-trip-v1';
async function save(localOnly){
  try{ if(window.storage) await window.storage.set(KEY, JSON.stringify(S)); }catch(e){}
  if(!localOnly) queuePush();
}
async function load(){
  try{
    if(!window.storage) return;
    const r = await window.storage.get(KEY);
    if(r && r.value){ const p = JSON.parse(r.value); if(p && p.days) S = p; }
  }catch(e){ /* 최초 실행 */ }
}

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
    // migrate() 안에서 leg() 가 S.cfg 를 읽으므로 먼저 S 에 넣고 제자리에서 올린다.
    if(r && r.value){ const p = JSON.parse(r.value); if(p && p.days){ S = p; migrate(); } }
  }catch(e){ /* 최초 실행 */ }
}

// 저장해 둔 데이터를 최신 형식으로 올린다. 기본값이나 형식을 바꿔도 이미 저장된 사람에게는
// 반영되지 않으므로(그래서 "바뀐 게 없다"로 보인다) 여기서 한 번 올려준다.
function migrate(){
  S.cfg = S.cfg || {};
  if(!(S.ver >= 2)){
    S.cfg.osrm = true;   // 실제 도로 경로를 기본으로
    S.ver = 2;
  }
  if(!(S.ver >= 3)){
    // 고정시각(fix)+체류시간(stay) → 도착시각(at) 하나로. 그냥 fix 만 옮기면 체류시간으로
    // 밀려 있던 뒷 일정들의 시각이 통째로 당겨져 버린다. 옛 규칙 그대로 한 번 계산해서
    // 지금 화면에 보이던 시각을 그대로 굳힌다.
    S.days.forEach(day=>{
      legacyStarts(day).forEach((min, i)=>{ day.items[i].at = minToHHMM(min); });
      day.items.forEach(item=>{ delete item.fix; delete item.stay; });
    });
    S.ver = 3;
  }
}

const minToHHMM = m => {
  m = ((Math.round(m) % 1440) + 1440) % 1440;
  return String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0');
};

// ver 2 이하의 스케줄 규칙(고정시각 + 체류시간 + 이동시간)을 그대로 재현한다.
// 이전 목적으로만 쓴다 - 03-schedule.js 의 schedule() 은 이미 새 규칙으로 바뀌었다.
function legacyStarts(day){
  let cur = toMin(day.start) ?? 9*60;
  const out = [];
  day.items.forEach((item, idx)=>{
    let start = cur;
    if(item.fix != null) start = toMin(item.fix);
    const end = start + (item.stay || 0);
    let min = 0;
    const nx = day.items[idx+1];
    if(nx){
      const A = item.lat!=null ? [item.lat,item.lng] : null;
      const B = nx.lat!=null ? [nx.lat,nx.lng] : null;
      const lg = leg(A, B, item.move);
      min = lg.min || 0;
    }
    cur = end + min;
    out.push(start);
  });
  return out;
}

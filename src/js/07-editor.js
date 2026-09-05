/* 브라우저가 순서대로 로드하는 일반 스크립트입니다.
   ES 모듈이 아니므로 import/export를 쓰지 마세요 - file:// 에서도 열려야 합니다.
   최상위 const/let/function 은 스크립트 간에 공유됩니다. 순서는 index.html 이 결정합니다. */

/* ══════════════ 시트 ══════════════ */
const scrim=document.getElementById('scrim');
function openSheet(id){ scrim.classList.add('on'); document.getElementById(id).classList.add('on'); }
function closeSheets(){ scrim.classList.remove('on'); document.querySelectorAll('.sheet').forEach(s=>s.classList.remove('on')); }
scrim.onclick=closeSheets;
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeSheets);

/* ══════════════ 인라인 편집 폼 ══════════════ */
// 편집 폼은 시트가 아니라 목록 안에서 해당 카드만 펼쳐 보여준다 - 다른 일정이 계속 보여야
// 앞뒤 시간을 확인하면서 고칠 수 있기 때문이다. edBody 노드 하나를 렌더할 때마다 카드 안으로
// 옮겨 넣는 방식이라, 다시 그려도 입력 중이던 값이 그대로 남는다.
const edBody = document.getElementById('edBody');
function edGoHome(){ document.getElementById('edHome').appendChild(edBody); }
function closeEdit(){ abortPick(false); editOpen=false; edGoHome(); render(); }

function openEdit(item, keepCoords, insertPos){
  if(!canEdit()) return toast('조회 전용입니다. 편집 링크로 열어주세요');
  curItem = item || {id:null,name:'',lat:null,lng:null,stay:60,fix:null,note:''};
  const isNew = !item || !item.id;
  // keepCoords는 지도 찍기 후 같은 폼으로 되돌아오는 경우다. 이때는 직전에 정한
  // 삽입 위치(insertAt)를 그대로 유지해야 한다 - 아니면 지도로 위치를 찍는 순간
  // "일정 사이에 추가"가 "맨 뒤에 추가"로 바뀌는 버그가 생긴다.
  if(!keepCoords) insertAt = (isNew && insertPos!=null) ? insertPos : null;
  document.getElementById('edTitle').textContent = isNew?'일정 추가':'일정 편집';
  // keepCoords일 때는 fLat/fLng 말고는 아무 것도 다시 채우지 않는다. 예전엔 지도로
  // 위치를 찍고 돌아오면 방금 입력해 둔 이름·체류시간까지 curItem 의 초기값으로
  // 덮어써져 사라지는 버그가 있었다 - "지도 찍기 버튼이 불편하다"는 게 사실 이거였다.
  if(!keepCoords){
    document.getElementById('fName').value = curItem.name||'';
    document.getElementById('fLat').value = curItem.lat??'';
    document.getElementById('fLng').value = curItem.lng??'';
    document.getElementById('fStay').value = curItem.stay??60;
    const mv = curItem.move || 'auto';
    document.querySelectorAll('[data-move]').forEach(b=>b.setAttribute('aria-pressed', b.dataset.move===mv));
    document.getElementById('fNote').value = curItem.note||'';
    const on = !!curItem.fix;
    document.getElementById('fFixOn').setAttribute('aria-pressed', on);
    document.getElementById('fixWrap').style.display = on?'block':'none';
    document.getElementById('fFix').value = curItem.fix||'';
    document.getElementById('results').style.display='none';
    document.getElementById('fSearch').value='';
  }
  document.getElementById('btnDel').style.display = isNew?'none':'block';
  updateLocStat();
  updateEdWhen();
  editOpen = true;
  render();   // 렌더가 edBody 를 해당 카드 안으로 옮겨 펼친다
  scrollBelowPinned(document.querySelector('.card.open'));
}

// 헤더와 지도가 화면 위에 고정돼 있으므로 scrollIntoView 를 그냥 쓰면 카드가 그 밑에
// 가려진 채 "보인다"고 판정된다. 고정 영역 높이를 빼고 직접 스크롤 위치를 잡는다.
function scrollBelowPinned(el){
  if(!el) return;
  const pinned = document.querySelector('header').getBoundingClientRect().height
               + document.getElementById('mapWrap').getBoundingClientRect().height;
  const r = el.getBoundingClientRect();
  if(r.top < pinned + 4 || r.top > window.innerHeight - 80)
    window.scrollTo({top: window.scrollY + r.top - pinned - 8, behavior:'smooth'});
}

/* ── 앞 일정에서 계산된 시각 ──
   목록에는 계산된 시각이 나오지만 편집 폼에는 없어서, 고정 시각을 넣으려면 앞 일정이
   몇 시에 끝나는지 사용자가 직접 따져야 했다. 폼 위에 그 시각을 보여주고,
   "시각 고정"을 켤 때 이 값을 미리 채운다. */
const hhmm = m => {
  m = ((Math.round(m) % 1440) + 1440) % 1440;   // 자정을 넘겨도 time 입력칸이 받는 형식으로
  return String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0');
};

// 이 일정이 앞 일정 기준으로 시작되는 시각(분). 새 일정이면 끼워 넣을 자리의 앞 일정이
// 끝나는 시각을 쓴다 (좌표가 아직 없어 이동시간은 더하지 못한다).
function scheduledStart(){
  const day = S.days[curDay], sc = schedule(day);
  if(curItem && curItem.id){
    const r = sc.rows.find(x => x.item.id === curItem.id);
    if(r) return {min:r.start, late:r.late, exact:true};
  }
  const idx = (insertAt==null) ? sc.rows.length : Math.max(0, Math.min(insertAt, sc.rows.length));
  if(idx <= 0) return {min: toMin(day.start) ?? 9*60, late:0, exact:false};
  const prev = sc.rows[idx-1];
  return {min: prev ? prev.end : (toMin(day.start) ?? 9*60), late:0, exact:false};
}

function updateEdWhen(){
  const el = document.getElementById('edWhen');
  const s = scheduledStart();
  const fixOn = document.getElementById('fFixOn').getAttribute('aria-pressed')==='true';
  const fixVal = document.getElementById('fFix').value;
  if(fixOn && fixVal){
    el.innerHTML = `<b>${fixVal}</b> 에 고정된 일정입니다` +
      (s.late ? ` · <span class="warn">앞 일정이 ${dur(s.late)} 늦게 끝납니다</span>` : '');
  }else if(s.exact){
    el.innerHTML = `앞 일정 기준 <b>${fmt(s.min)}</b> 시작`;
  }else{
    el.innerHTML = `앞 일정이 <b>${fmt(s.min)}</b> 에 끝납니다 <span style="color:var(--mute)">· 이동시간 별도</span>`;
  }
}

// 좌표 입력칸을 없앤 대신(숫자를 직접 볼 필요가 없다), 위치가 있는지·어디인지를
// 한 줄로 보여주고 지우는 버튼만 남긴다. 검색/지도 찍기로 fLat·fLng 값이 바뀔 때마다 호출한다.
function updateLocStat(){
  const lat=document.getElementById('fLat').value, lng=document.getElementById('fLng').value;
  const has = lat!=='' && lng!=='';
  document.getElementById('locStatTxt').textContent = has
    ? `위치 지정됨 · ${(+lat).toFixed(4)}, ${(+lng).toFixed(4)}`
    : '위치 미지정 — 이동시간 계산에서 제외됩니다';
  document.getElementById('btnLocClear').hidden = !has;
}
document.getElementById('btnLocClear').onclick=()=>{
  document.getElementById('fLat').value=''; document.getElementById('fLng').value='';
  updateLocStat();
};

document.getElementById('fFixOn').onclick=e=>{
  const on = e.currentTarget.getAttribute('aria-pressed')!=='true';
  e.currentTarget.setAttribute('aria-pressed', on);
  document.getElementById('fixWrap').style.display = on?'block':'none';
  // 켤 때 비어 있으면 앞 일정에서 계산된 시각을 넣어준다. 직접 계산해 타이핑할 필요가 없다.
  const f = document.getElementById('fFix');
  if(on && !f.value) f.value = hhmm(scheduledStart().min);
  updateEdWhen();
};
document.getElementById('fFix').onchange=updateEdWhen;
document.querySelectorAll('[data-stay]').forEach(b=>b.onclick=()=>{
  document.getElementById('fStay').value=b.dataset.stay;
});
document.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('[data-move]').forEach(x=>x.setAttribute('aria-pressed', x===b));
});

document.getElementById('btnSave').onclick=()=>{
  abortPick(true);   // 지도에서 고르던 중이었다면 그 좌표까지 반영하고 찍기 모드를 끝낸다
  const name=document.getElementById('fName').value.trim();
  if(!name) return toast('이름을 입력하세요');
  const lat=parseFloat(document.getElementById('fLat').value);
  const lng=parseFloat(document.getElementById('fLng').value);
  const fixOn=document.getElementById('fFixOn').getAttribute('aria-pressed')==='true';
  const o={
    id: curItem.id||uid(), name,
    lat: isFinite(lat)?lat:null, lng: isFinite(lng)?lng:null,
    stay: Math.max(0, parseInt(document.getElementById('fStay').value)||0),
    fix: fixOn ? (document.getElementById('fFix').value||null) : null,
    move: (document.querySelector('[data-move][aria-pressed="true"]')||{dataset:{move:'auto'}}).dataset.move,
    note: document.getElementById('fNote').value.trim()
  };
  const arr=S.days[curDay].items;
  const idx=arr.findIndex(x=>x.id===o.id);
  if(idx>=0) arr[idx]=o;
  else if(insertAt!=null && insertAt>=0 && insertAt<=arr.length) arr.splice(insertAt,0,o);
  else arr.push(o);
  insertAt=null;
  curItem=o; editOpen=false; edGoHome();
  save(); render(true); refreshOsrm();
  toast(idx>=0?'수정했습니다':'추가했습니다');
};
document.getElementById('btnCancel').onclick=()=>{ insertAt=null; curItem=null; closeEdit(); };
document.getElementById('btnDel').onclick=()=>{
  abortPick(false);
  const arr=S.days[curDay].items;
  const idx=arr.findIndex(x=>x.id===curItem.id);
  if(idx>=0) arr.splice(idx,1);
  curItem=null; editOpen=false; edGoHome();
  save(); render(true); toast('삭제했습니다');
};

/* 검색 (Nominatim) */
document.getElementById('btnSearch').onclick=doSearch;
document.getElementById('fSearch').addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();doSearch();} });
// 제주(여행지)와 수도권(집·출발지)만 검색 대상으로 삼는다. 노미나팀 viewbox는 한 개의
// 사각형만 지정할 수 있어, 두 지역을 각각 bounded=1로 조회해 합친다.
// 두 번째 상자는 원래 서울 시계에 딱 맞춰뒀는데, 경기·인천(김포공항 가는 길목)이 통째로
// 빠져 집 주소가 검색되지 않는 일이 있었다. 수도권 전체로 넓혔다.
const SEARCH_AREAS=[
  '126.10,33.60,126.99,33.10', // 제주
  '126.35,37.95,127.55,37.10'  // 수도권 (서울·인천·경기)
];
async function doSearch(){
  const q=document.getElementById('fSearch').value.trim();
  if(!q) return;
  const box=document.getElementById('results');
  box.style.display='block'; box.innerHTML='<button>검색 중…</button>';
  // "금호로140"처럼 도로명에 번지를 붙여 쓰면 노미나팀 토큰화가 깨져 0건이 나온다.
  // 한글 뒤에 바로 오는 숫자 사이에 공백을 끼워 "금호로 140"으로 보정한다.
  const qFixed=q.replace(/([가-힣])(\d)/g,'$1 $2');
  try{
    const lists=await Promise.all(SEARCH_AREAS.map(async vb=>{
      const u='https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=ko&countrycodes=kr'
        + '&bounded=1&viewbox='+vb+'&q='+encodeURIComponent(qFixed);
      try{ return await (await fetch(u,{headers:{'Accept':'application/json'}})).json(); }
      catch(e){ return []; }
    }));
    const seen=new Set(), r=[];
    lists.forEach(list=>list.forEach(x=>{ if(!seen.has(x.place_id)){ seen.add(x.place_id); r.push(x); } }));
    r.sort((a,b)=>b.importance-a.importance);
    r.length=Math.min(r.length,6);
    if(!r.length){ box.innerHTML='<button>결과가 없습니다. 다른 이름으로 검색하거나 지도를 눌러 지정하세요.</button>'; return; }
    box.innerHTML='';
    r.forEach(x=>{
      const b=document.createElement('button');
      b.innerHTML=`<div class="rn">${esc(x.display_name.split(',')[0])}</div><div class="ra">${esc(x.display_name)}</div>`;
      b.onclick=()=>{
        document.getElementById('fLat').value=(+x.lat).toFixed(5);
        document.getElementById('fLng').value=(+x.lon).toFixed(5);
        updateLocStat();
        if(!document.getElementById('fName').value.trim())
          document.getElementById('fName').value=x.display_name.split(',')[0];
        box.style.display='none';
        MAP.setView([+x.lat,+x.lon], 14);
      };
      box.appendChild(b);
    });
  }catch(e){ box.innerHTML='<button>검색에 실패했습니다. 지도를 눌러 직접 지정하세요.</button>'; }
}

/* 지도에서 위치 찍기 */
// 지도가 화면 위에 고정돼 있어 스크롤을 옮길 필요 없이 그 자리에서 바로 찍으면 된다.
// 픽 시작 시점의 편집 대상을 pickItem 에 따로 잡아둔다 - 픽 도중 날짜 탭을 눌러
// curItem 이 바뀌어도(=null) 원래 편집하던 항목으로 정확히 돌아가기 위해서다.
let pickItem = null;
let pickLL = null;   // 마지막으로 지도에서 누른 좌표 (아직 확정 전일 수 있다)

function startPick(){
  pickMode=true; pickItem=curItem;
  // 핀 위를 누르면 그 핀의 항목이 선택돼 버려 위치 지정이 먹히지 않았다.
  // 찍는 동안에는 핀이 클릭을 가로채지 않게 해 지도가 직접 받도록 한다.
  document.body.classList.add('picking');
  // 이미 좌표가 있으면 거기서부터 시작한다 (저장된 상태이므로 버튼은 흐리게).
  const lat=parseFloat(document.getElementById('fLat').value);
  const lng=parseFloat(document.getElementById('fLng').value);
  if(isFinite(lat)&&isFinite(lng)){
    pickLL={lat,lng}; MAP.setPickMarker([lat,lng]); markPickSaved(true);
  }else{
    pickLL=null; MAP.clearPickMarker(); markPickSaved(false);
  }
  hintEl=document.createElement('div');
  hintEl.className='maphint';
  hintEl.innerHTML='<span>지도를 눌러 위치를 고르세요</span><button type="button">완료</button>';
  hintEl.querySelector('button').onclick=e=>{ e.stopPropagation(); finishPick(); };
  document.getElementById('map').appendChild(hintEl);
}

// 지도를 누를 때마다 미리보기 핀만 옮긴다. 몇 번이든 다시 눌러 조정할 수 있다.
function onPickMapClick(ll){
  pickLL = {lat:ll.lat, lng:ll.lng};
  MAP.setPickMarker([ll.lat, ll.lng]);
  markPickSaved(false);   // 아직 확정 전 → 버튼을 진하게
}

// 고른 좌표를 폼에 확정만 한다 (화면 전환 없음).
function commitPick(){
  if(!pickLL) return false;
  document.getElementById('fLat').value = pickLL.lat.toFixed(5);
  document.getElementById('fLng').value = pickLL.lng.toFixed(5);
  updateLocStat();
  return true;
}

// 지도 우측 "위치 저장" 버튼. 확정한 뒤 잠깐 흐려진 버튼을 보여주고 찍기 모드를 끝낸다
// (안내 문구·저장 버튼·미리보기 핀이 모두 사라지고 편집 폼으로 돌아간다).
let pickCloseT = null;
function savePickedLocation(){
  if(!commitPick()) return toast('먼저 지도를 눌러 위치를 고르세요');
  markPickSaved(true);
  toast('위치를 저장했습니다');
  const it = pickItem;
  clearTimeout(pickCloseT);
  pickCloseT = setTimeout(()=>{ if(pickMode){ endPick(); openEdit(it, true); } }, 500);
}

// 완료: 확정 안 한 좌표가 남아 있으면 같이 확정하고 편집 폼으로 돌아간다
// (눌러만 두고 저장을 깜빡했을 때 조용히 잃지 않도록).
function finishPick(){
  commitPick();
  const it=pickItem; endPick(); openEdit(it, true);
}

// 폼에서 저장/삭제/닫기를 누르거나 날짜를 바꾸면 찍기 모드도 같이 끝나야 한다.
// 안 그러면 안내 문구와 "위치 저장" 버튼이 지도에 그대로 남는다.
// keep=true 면 아직 확정 안 한 좌표를 먼저 폼에 반영한다 (폼 저장 직전에 쓴다).
function abortPick(keep){
  if(!pickMode) return;
  if(keep) commitPick();
  endPick();
}

function endPick(){
  clearTimeout(pickCloseT);
  pickMode=null; pickItem=null; pickLL=null;
  document.body.classList.remove('picking');
  MAP.clearPickMarker(); markPickSaved(false);
  if(hintEl){hintEl.remove();hintEl=null;}
}
document.getElementById('btnPickHere').onclick=startPick;

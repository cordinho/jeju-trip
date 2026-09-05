/* 브라우저가 순서대로 로드하는 일반 스크립트입니다.
   ES 모듈이 아니므로 import/export를 쓰지 마세요 - file:// 에서도 열려야 합니다.
   최상위 const/let/function 은 스크립트 간에 공유됩니다. 순서는 index.html 이 결정합니다. */

/* ══════════════ 시트 ══════════════ */
const scrim=document.getElementById('scrim');
function openSheet(id){
  // 편집 시트만 스크림 없이 연다 - 항목을 눌렀을 때 지도가 어두워지지 않고 계속 보이게 하려고.
  if(id!=='sheetEdit') scrim.classList.add('on');
  document.getElementById(id).classList.add('on');
}
function closeSheets(){ scrim.classList.remove('on'); document.querySelectorAll('.sheet').forEach(s=>s.classList.remove('on')); }
scrim.onclick=closeSheets;
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeSheets);

// 편집 시트가 지도를 가리지 않도록, 지도 아래 남는 공간만큼만 시트 높이를 잡는다.
// 지도 크기를 드래그/전체화면으로 바꿀 때도 다시 불러야 해서(05-map.js 의 setH) 전역 함수로 둔다.
function fitSheetToMap(){
  const sheet = document.getElementById('sheetEdit');
  const mapBottom = mapEl.getBoundingClientRect().bottom;
  const avail = window.innerHeight - mapBottom - 8;
  sheet.style.maxHeight = Math.max(240, Math.min(avail, window.innerHeight*.7)) + 'px';
}

function openEdit(item, keepCoords, insertPos){
  if(!canEdit()) return toast('조회 전용입니다. 편집 링크로 열어주세요');
  curItem = item || {id:null,name:'',lat:null,lng:null,stay:60,fix:null,note:''};
  const isNew = !item || !item.id;
  // keepCoords는 지도 찍기 후 같은 시트를 다시 여는 경우다. 이때는 직전에 정한
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
  // 목록을 스크롤해서 아래쪽 항목을 눌렀을 수도 있으니, 시트를 열 때 맨 위(지도)로 먼저
  // 되돌린 다음에 fitSheetToMap 을 불러야 한다 - 스크롤 전에 재면 지도가 화면 밖에 있어서
  // "남는 공간"을 잘못 계산해 시트가 지도를 도로 덮어버린다. behavior:'smooth' 를 안 쓰는
  // 것도 같은 이유 - 애니메이션 도중 위치를 재면 또 틀어진다.
  window.scrollTo(0, 0);
  fitSheetToMap();
  openSheet('sheetEdit');
  render();
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
};
document.querySelectorAll('[data-stay]').forEach(b=>b.onclick=()=>{
  document.getElementById('fStay').value=b.dataset.stay;
});
document.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('[data-move]').forEach(x=>x.setAttribute('aria-pressed', x===b));
});

document.getElementById('btnSave').onclick=()=>{
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
  curItem=o; save(); closeSheets(); render(true); refreshOsrm();
  toast(idx>=0?'수정했습니다':'추가했습니다');
};
document.getElementById('btnDel').onclick=()=>{
  const arr=S.days[curDay].items;
  const idx=arr.findIndex(x=>x.id===curItem.id);
  if(idx>=0) arr.splice(idx,1);
  curItem=null; save(); closeSheets(); render(true); toast('삭제했습니다');
};

/* 검색 (Nominatim) */
document.getElementById('btnSearch').onclick=doSearch;
document.getElementById('fSearch').addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();doSearch();} });
// 제주(여행지)와 서울(집)만 검색 대상으로 삼는다. 노미나팀 viewbox는 한 개의
// 사각형만 지정할 수 있어, 두 지역을 각각 bounded=1로 조회해 합친다.
const SEARCH_AREAS=[
  '126.10,33.60,126.99,33.10', // 제주
  '126.70,37.72,127.20,37.40'  // 서울
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
// 시트를 닫고 지도를 탭하게 하는데, 원래는 되돌아갈 방법이 없었다 - 지도를 보다가
// 마음이 바뀌어도 아무 데나 눌러야만 편집 시트로 돌아갈 수 있었다. 취소 버튼을 추가하고,
// 픽 시작 시점의 편집 대상을 pickItem 에 따로 잡아둔다 - 픽 도중 날짜 탭을 눌러
// curItem 이 바뀌어도(=null) 원래 편집하던 항목으로 정확히 돌아가기 위해서다.
let pickItem = null;
function startPick(){
  pickMode=true; pickItem=curItem; closeSheets();
  hintEl=document.createElement('div');
  hintEl.className='maphint';
  hintEl.innerHTML='<span>지도를 눌러 위치를 지정하세요</span><button type="button">취소</button>';
  hintEl.querySelector('button').onclick=e=>{ e.stopPropagation(); cancelPick(); };
  document.getElementById('map').appendChild(hintEl);
}
function cancelPick(){ const it=pickItem; endPick(); openEdit(it, true); }
function endPick(){ pickMode=null; pickItem=null; if(hintEl){hintEl.remove();hintEl=null;} }
document.getElementById('btnPickHere').onclick=startPick;

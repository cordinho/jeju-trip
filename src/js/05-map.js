/* 브라우저가 순서대로 로드하는 일반 스크립트입니다.
   ES 모듈이 아니므로 import/export를 쓰지 마세요 - file:// 에서도 열려야 합니다.
   최상위 const/let/function 은 스크립트 간에 공유됩니다. 순서는 index.html 이 결정합니다. */

/* ══════════════ 지도 (Leaflet) ══════════════ */
// 휴대폰이 항상 온라인이라는 전제로 자체 벡터 엔진을 걷어내고 Leaflet + 실제 타일로 바꿨다.
// Leaflet은 CDN이 아니라 src/vendor/leaflet.js 로 로컬에 내려받아 번들에 포함한다 - CLAUDE.md
// 절대 규칙 1(외부 스크립트 금지)의 취지는 "원격에서 받아오지 않는다"이지 "라이브러리 금지"가
// 아니게 됐다. 타일 이미지 자체는 온라인이 전제이므로 실패 시 대체 지도는 없다 (의도된 트레이드오프).
const mapEl = document.getElementById('map');

const leafletMap = L.map(mapEl, { center: [STAY[0], STAY[1]], zoom: 11, attributionControl: true });
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
}).addTo(leafletMap);
L.control.scale({ imperial: false }).addTo(leafletMap);

const fitCtl = L.control({ position: 'topright' });
fitCtl.onAdd = () => {
  const d = L.DomUtil.create('div', 'leaflet-bar mapfit');
  d.innerHTML = '<a href="#" title="전체 동선 보기" role="button">⤢</a>';
  L.DomEvent.disableClickPropagation(d);
  L.DomEvent.on(d, 'click', e => { e.preventDefault(); MAP.fitLast(); });
  return d;
};
fitCtl.addTo(leafletMap);

/* ---- 위치 지정용 "위치 저장" 버튼 (지도 우측, 찍는 동안에만 보임) ---- */
// 예전에는 지도를 한 번 누르면 곧바로 좌표가 확정되고 폼으로 돌아가 버려서, 조금 빗나가면
// 처음부터 다시 해야 했다. 지금은 몇 번이든 눌러 미리보기 핀을 옮긴 뒤 이 버튼으로 확정한다.
let pickSaveEl = null;
const pickCtl = L.control({ position: 'topright' });
pickCtl.onAdd = () => {
  const d = L.DomUtil.create('div', 'mappicksave');
  d.innerHTML = '<a href="#" role="button">위치 저장</a>';
  L.DomEvent.disableClickPropagation(d);
  L.DomEvent.on(d, 'click', e => { e.preventDefault(); savePickedLocation(); });
  pickSaveEl = d;
  return d;
};
// addTo 는 지도 높이 컨트롤(⛶) 다음에 한다 - 컨트롤은 추가한 순서대로 쌓이는데, 이 버튼은
// 위치를 고를 때만 나타나므로 중간에 끼면 나타날 때마다 아래 버튼이 밀려 내려간다.
// 확정된 상태면 버튼을 흐리게 해 "지금 좌표는 저장됨"을 보여준다.
function markPickSaved(saved){
  if(pickSaveEl) pickSaveEl.classList.toggle('saved', !!saved);
}

/* ---- 지도 높이 조절 (드래그 핸들 + 전체화면 토글) ---- */
// 기기별 화면 크기가 다르고, 지도를 크게 보고 싶을 때와 일정 목록이 더 필요할 때가 갈리므로
// 핸들로 자유롭게 조절하고 마지막 값은 window.storage 에 남긴다 (기기별 로컬 취향이라 방/공유
// 대상인 S 에는 넣지 않는다 - CLAUDE.md 규칙 4: localStorage 대신 window.storage).
(function(){
  const MAPH_KEY = 'jeju-map-h';
  const rsz = document.getElementById('mapRsz');
  const dfltH = () => mapEl.getBoundingClientRect().height;
  const minH = () => 180;
  const maxH = () => Math.round(window.innerHeight * .75);
  let savedBeforeFull = null;

  function setH(px){
    mapEl.style.height = Math.max(minH(), Math.min(maxH(), Math.round(px))) + 'px';
    leafletMap.invalidateSize();
    try{ if(window.storage) window.storage.set(MAPH_KEY, mapEl.style.height); }catch(e){}
  }

  (async function restore(){
    try{
      if(!window.storage) return;
      const r = await window.storage.get(MAPH_KEY);
      if(r && r.value){ mapEl.style.height = r.value; leafletMap.invalidateSize(); }
    }catch(e){}
  })();

  let dragging=false, startY=0, startH=0;
  rsz.addEventListener('pointerdown', e=>{
    dragging=true; startY=e.clientY; startH=mapEl.getBoundingClientRect().height;
    rsz.setPointerCapture(e.pointerId);
  });
  rsz.addEventListener('pointermove', e=>{
    if(!dragging) return;
    setH(startH + (e.clientY - startY));
  });
  const stopDrag=()=>{ dragging=false; };
  rsz.addEventListener('pointerup', stopDrag);
  rsz.addEventListener('pointercancel', stopDrag);

  const fullCtl = L.control({ position: 'topright' });
  fullCtl.onAdd = () => {
    const d = L.DomUtil.create('div', 'leaflet-bar mapfull');
    d.innerHTML = '<a href="#" title="지도 전체화면" role="button">⛶</a>';
    L.DomEvent.disableClickPropagation(d);
    L.DomEvent.on(d, 'click', e=>{
      e.preventDefault();
      if(savedBeforeFull == null){
        savedBeforeFull = mapEl.style.height || dfltH()+'px';
        setH(maxH());
        d.querySelector('a').setAttribute('title','원래 크기로');
      } else {
        mapEl.style.height = savedBeforeFull; leafletMap.invalidateSize();
        try{ if(window.storage) window.storage.set(MAPH_KEY, savedBeforeFull); }catch(err){}
        savedBeforeFull = null;
        d.querySelector('a').setAttribute('title','지도 전체화면');
      }
    });
    return d;
  };
  fullCtl.addTo(leafletMap);
})();

pickCtl.addTo(leafletMap);   // 우측 버튼 묶음의 맨 아래에 오도록 마지막에 붙인다

const MAP = (function(){
  let clickCb = null;
  const lines = [], markers = [];
  let lastBounds = null, allPts = null, pickMk = null;

  leafletMap.on('click', e => { clickCb && clickCb({ lat: e.latlng.lat, lng: e.latlng.lng }); });

  const api = {
    on(_, cb){ clickCb = cb; },
    clear(){
      lines.forEach(l => l.remove()); lines.length = 0;
      markers.forEach(m => m.remove()); markers.length = 0;
    },
    addLine(pts, o){
      lines.push(L.polyline(pts, {
        color: o.color, weight: o.w, dashArray: o.dash || null,
        lineCap: 'round', lineJoin: 'round', opacity: .9
      }).addTo(leafletMap));
    },
    addMarker(ll, html, cb, title){
      const icon = L.divIcon({ html, className: 'mm-mk', iconSize: [0, 0] });
      const mk = L.marker(ll, { icon, title: title || '' }).addTo(leafletMap);
      if(cb) mk.on('click', e => { L.DomEvent.stopPropagation(e); cb(); });
      markers.push(mk);
    },
    setView(ll, z){ leafletMap.setView(ll, z || leafletMap.getZoom()); },
    fitBounds(list, pad){
      if(!list.length) return;
      lastBounds = L.latLngBounds(list);
      if(list.length === 1){ leafletMap.setView(list[0], 15); return; }
      const size = leafletMap.getSize();
      const px = Math.round(Math.min(size.x, size.y) * (pad ?? .1));
      leafletMap.fitBounds(lastBounds, { padding: [px, px], maxZoom: 16 });
    },
    setAll(list){ allPts = list; },
    setOffscreen(n){
      const old = document.getElementById('mmOff'); if(old) old.remove();
      if(n > 0){
        const d = document.createElement('div');
        d.className = 'mm-off'; d.id = 'mmOff';
        d.textContent = `이 화면 밖 ${n}곳 · ⤢ 로 전체 보기`;
        d.onclick = () => api.fitLast();
        mapEl.appendChild(d);
      }
    },
    fitLast(){
      if(allPts && allPts.length > 1) api.fitBounds(allPts, .3);
      else if(lastBounds) leafletMap.fitBounds(lastBounds);
    },
    resize(){ leafletMap.invalidateSize(); },
    redraw(){ /* Leaflet 레이어는 addLine/addMarker 시점에 바로 반영되어 별도 재계산이 필요 없다 */ },

    // 위치를 찍는 동안 보여줄 미리보기 핀. markers 배열에 넣지 않아 clear() 로 지워지지
    // 않는다 - 찍는 도중 목록이 다시 그려져도 핀이 사라지면 안 되기 때문이다.
    setPickMarker(ll){
      if(pickMk){ pickMk.setLatLng(ll); return; }
      pickMk = L.marker(ll, {
        icon: L.divIcon({ html:'<div class="pin pick"><span>+</span></div>', className:'mm-mk', iconSize:[0,0] }),
        interactive: false, zIndexOffset: 1000
      }).addTo(leafletMap);
    },
    clearPickMarker(){ if(pickMk){ pickMk.remove(); pickMk=null; } }
  };
  return api;
})();

// 찍는 동안에는 확정하지 않고 미리보기 핀만 옮긴다. 확정은 "위치 저장" 버튼이 한다.
MAP.on('click', ll=>{ if(pickMode) onPickMapClick(ll); });

let hintEl = null;

// 일정 목록에서 항목을 누르면 편집 시트를 열면서 지도를 그 항목과 다음 항목
// 두 곳만 보이도록 좁혀준다 (전체 동선을 다시 보려면 ⤢ 버튼을 누르면 된다).
function focusItemPair(item, nextItem){
  const pts = [item, nextItem].filter(Boolean).filter(it=>it.lat!=null).map(it=>[it.lat,it.lng]);
  if(!pts.length) return;
  if(pts.length===1) MAP.setView(pts[0], 15);
  else MAP.fitBounds(pts, .35);
}

function drawMap(sc, fit){
  MAP.clear();
  // 좌표가 있는 일정만 남기되, 리스트에 표시된 원래 번호를 그대로 유지한다
  const rows = [];
  sc.rows.forEach((r,i)=>{ if(r.item.lat!=null) rows.push({r, no:i+1}); });

  for(let i=0;i<rows.length-1;i++){
    const A=[rows[i].r.item.lat, rows[i].r.item.lng], B=[rows[i+1].r.item.lat, rows[i+1].r.item.lng];
    const lg = leg(A,B,rows[i].r.item.move);
    if(lg.mode==='none') continue;
    if(lg.skip) MAP.addLine([A,B], {color:'#7C8A8B', w:1.5, dash:'3,6'});
    else MAP.addLine(lg.geo||[A,B], {
      color: lg.mode==='walk' ? '#0C7C86' : '#EE6C12',
      w: lg.mode==='walk' ? 3 : 4,
      dash: lg.mode==='walk' ? '2,7' : (lg.geo ? null : '9,7')});
  }

  // 좌표가 사실상 같은 일정만 하나로 묶는다 (약 11m 이내)
  const groups = [];
  rows.forEach(({r,no})=>{
    const k = r.item.lat.toFixed(4)+','+r.item.lng.toFixed(4);
    const g = groups.find(x=>x.k===k);
    if(g){ g.no.push(no); g.rows.push(r); }
    else groups.push({k, ll:[r.item.lat,r.item.lng], no:[no], rows:[r]});
  });
  groups.forEach(g=>{
    const sel = curItem && g.rows.some(r=>r.item.id===curItem.id);
    const lab = g.no.length>1 ? g.no[0]+'–'+g.no[g.no.length-1] : g.no[0];
    const wide = g.no.length>1 ? ' wide' : '';
    MAP.addMarker(g.ll, `<div class="pin${wide} ${sel?'sel':''}"><span>${lab}</span></div>`,
      ()=>{ curItem = g.rows[0].item; render(false); },
      g.rows.map(r=>r.item.name).join(' / '));
  });

  const all = rows.map(x=>[x.r.item.lat, x.r.item.lng]);
  MAP.setAll(all);
  if(!fit){ MAP.redraw(); return; }

  // 항공·도선 구간에서 끊어 세그먼트를 만들고 지점이 가장 많은 쪽에 맞춘다
  const segs = [[]];
  rows.forEach(({r},i)=>{
    segs[segs.length-1].push([r.item.lat, r.item.lng]);
    if(i<rows.length-1 && (r.item.move==='air'||r.item.move==='ferry')) segs.push([]);
  });
  const best = segs.filter(x=>x.length).sort((x,y)=>y.length-x.length)[0] || [];
  MAP.fitBounds(best, .3);
  MAP.setOffscreen(all.length - best.length);
}

/* 브라우저가 순서대로 로드하는 일반 스크립트입니다.
   ES 모듈이 아니므로 import/export를 쓰지 마세요 - file:// 에서도 열려야 합니다.
   최상위 const/let/function 은 스크립트 간에 공유됩니다. 순서는 index.html 이 결정합니다. */

/* ══════════════ 시간 ══════════════ */
const toMin = t => { if(!t) return null; const [h,m]=t.split(':').map(Number); return h*60+m; };
const fmt = m => { m=Math.round(m); const d=Math.floor(m/1440); const h=Math.floor((m%1440)/60), n=m%60;
  return String(h).padStart(2,'0')+':'+String(n).padStart(2,'0')+(d>0?'+'+d:''); };
const dur = m => { m=Math.round(m); if(m<60) return m+'분'; const h=Math.floor(m/60), n=m%60; return h+'시간'+(n?' '+n+'분':''); };

/* ══════════════ 거리·이동 ══════════════ */
function hav(a,b){
  const R=6371, r=Math.PI/180;
  const dLat=(b[0]-a[0])*r, dLng=(b[1]-a[1])*r;
  const x=Math.sin(dLat/2)**2 + Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));
}
const key = (a,b)=>`${a[0].toFixed(4)},${a[1].toFixed(4)}|${b[0].toFixed(4)},${b[1].toFixed(4)}`;

function leg(A,B,mv){
  const c=S.cfg;
  if(mv==='none') return {mode:'none'};
  if(!A||!B) return {mode:'none'};
  if(mv==='air' || mv==='ferry'){
    return {mode:mv, km:hav(A,B), min:0, geo:null, skip:true};
  }
  if(mv==='walk'){
    const km = hav(A,B)*1.2;
    return {mode:'walk', km, min: km/c.walkSp*60};
  }
  if(mv==='drive'){
    const ck = legCache[key(A,B)];
    if(ck) return {mode:'drive', km:ck.km, min:ck.min + c.buffer, geo:ck.geo, real:true};
    const km = hav(A,B)*c.detour;
    return {mode:'drive', km, min: km/c.driveSp*60 + c.buffer};
  }
  const straight = hav(A,B);
  if(straight < 0.02) return {mode:'walk', km:0, min:0, geo:null};
  if(straight <= c.walkKm){
    const km = straight*1.2;
    return {mode:'walk', km, min: km/c.walkSp*60, geo:null};
  }
  const ck = legCache[key(A,B)];
  if(ck) return {mode:'drive', km:ck.km, min:ck.min + c.buffer, geo:ck.geo, real:true};
  const km = straight*c.detour;
  return {mode:'drive', km, min: km/c.driveSp*60 + c.buffer, geo:null};
}

async function fetchOsrm(){
  if(!S.cfg.osrm) return false;
  const d = S.days[curDay], pts = d.items.filter(i=>i.lat!=null);
  let got=false;
  for(let i=0;i<pts.length-1;i++){
    const A=[pts[i].lat,pts[i].lng], B=[pts[i+1].lat,pts[i+1].lng];
    if(hav(A,B) <= S.cfg.walkKm) continue;
    if(['air','ferry','none','walk'].includes(pts[i].move)) continue;
    const k=key(A,B); if(legCache[k]) continue;
    try{
      const u=`https://router.project-osrm.org/route/v1/driving/${A[1]},${A[0]};${B[1]},${B[0]}?overview=full&geometries=geojson`;
      const j = await (await fetch(u)).json();
      if(j.routes && j.routes[0]){
        const r=j.routes[0];
        legCache[k]={km:r.distance/1000, min:r.duration/60, geo:r.geometry.coordinates.map(c=>[c[1],c[0]])};
        got=true;
      }
    }catch(e){ /* 네트워크 실패 → 추정치 유지 */ }
  }
  return got;
}

/* ══════════════ 스케줄 계산 ══════════════ */
function schedule(day){
  let cur = toMin(day.start) ?? 9*60;
  const out=[]; let totKm=0, totMove=0, lateN=0, airKm=0;
  day.items.forEach((item,idx)=>{
    let start=cur, late=0;
    if(item.fix!=null){
      const f=toMin(item.fix);
      if(cur > f + 5){ late = cur - f; lateN++; }
      start = f;
    }
    const end = start + (item.stay||0);
    let lg={mode:'none'};
    const nx = day.items[idx+1];
    if(nx){
      const A = item.lat!=null?[item.lat,item.lng]:null;
      const B = nx.lat!=null?[nx.lat,nx.lng]:null;
      lg = leg(A,B,item.move);
      if(lg.km && !lg.skip){ totKm+=lg.km; totMove+=lg.min; }
      if(lg.skip && lg.km) airKm += lg.km;
    }
    cur = end + (lg.min||0);
    out.push({item, start, end, late, leg:lg});
  });
  return {rows:out, endAt:cur, totKm, totMove, lateN, airKm};
}

/* 브라우저가 순서대로 로드하는 일반 스크립트입니다.
   ES 모듈이 아니므로 import/export를 쓰지 마세요 - file:// 에서도 열려야 합니다.
   최상위 const/let/function 은 스크립트 간에 공유됩니다. 순서는 index.html 이 결정합니다. */

/* ══════════════ 추천 장소 ══════════════ */
document.getElementById('btnPoi').onclick=()=>{
  if(!canEdit()) return toast('조회 전용입니다');
  const el=document.getElementById('poiList'); el.innerHTML='';
  POIS.forEach(p=>{
    const b=document.createElement('button');
    b.className='poi';
    b.innerHTML=`${esc(p[0])}<small>${esc(p[3])}</small>`;
    b.onclick=()=>{
      S.days[curDay].items.push(it(p[0],[p[1],p[2]],90,null,p[3]));
      save(); closeSheets(); render(true); refreshOsrm(); toast(`${p[0]} 추가`);
    };
    el.appendChild(b);
  });
  openSheet('sheetPoi');
};

/* ══════════════ 설정 ══════════════ */
document.getElementById('btnSet').onclick=()=>{
  const c=S.cfg;
  document.getElementById('sOsrm').setAttribute('aria-pressed', !!c.osrm);
  sWalkKm.value=c.walkKm; sWalkSp.value=c.walkSp; sDriveSp.value=c.driveSp;
  sDetour.value=c.detour; sBuffer.value=c.buffer;
  openSheet('sheetSet');
};
document.getElementById('sOsrm').onclick=e=>{
  const on=e.currentTarget.getAttribute('aria-pressed')!=='true';
  e.currentTarget.setAttribute('aria-pressed', on);
};
document.getElementById('btnSaveSet').onclick=()=>{
  S.cfg={
    osrm: document.getElementById('sOsrm').getAttribute('aria-pressed')==='true',
    walkKm:+sWalkKm.value||1, walkSp:+sWalkSp.value||4.5, driveSp:+sDriveSp.value||40,
    detour:+sDetour.value||1.35, buffer:+sBuffer.value||0
  };
  save(); closeSheets(); render(); refreshOsrm(); toast('설정을 적용했습니다');
};
document.getElementById('btnExport').onclick=()=>{
  const blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='jeju-trip.json'; a.click();
  toast('JSON을 내보냈습니다');
};
document.getElementById('btnImport').onclick=()=>document.getElementById('fileIn').click();
document.getElementById('fileIn').onchange=e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ try{ const p=JSON.parse(r.result);
      if(!p.days) throw 0; S=p; curDay=0; curItem=null; save(); closeSheets(); render(true); toast('일정을 가져왔습니다');
    }catch(err){ toast('읽을 수 없는 파일입니다'); } };
  r.readAsText(f);
};
document.getElementById('btnReset').onclick=()=>{
  S=seed(); curDay=0; curItem=null; save(); closeSheets(); render(true); toast('초기 일정으로 되돌렸습니다');
};

document.getElementById('btnAdd').onclick=()=>openEdit(null);
document.getElementById('btnAddTop').onclick=()=>openEdit(null);

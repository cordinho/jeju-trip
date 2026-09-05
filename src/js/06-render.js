/* 브라우저가 순서대로 로드하는 일반 스크립트입니다.
   ES 모듈이 아니므로 import/export를 쓰지 마세요 - file:// 에서도 열려야 합니다.
   최상위 const/let/function 은 스크립트 간에 공유됩니다. 순서는 index.html 이 결정합니다. */

/* ══════════════ 렌더 ══════════════ */
const esc = s => String(s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function renderDays(){
  const el=document.getElementById('days'); el.innerHTML='';
  S.days.forEach((d,i)=>{
    const b=document.createElement('button');
    b.className='daytab'; b.setAttribute('role','tab');
    b.setAttribute('aria-selected', i===curDay);
    b.innerHTML=`<b>${d.label}</b><small>${d.dow} · ${d.items.length}곳</small>`;
    b.onclick=()=>{ abortPick(false); curDay=i; curItem=null; render(true); refreshOsrm(); };
    el.appendChild(b);
  });
}

function render(fit){ try{ render_(fit); }catch(err){
  const L1=document.getElementById('list');
  if(L1) L1.insertAdjacentHTML('beforeend',
    `<div class="empty" style="color:var(--lava);border-color:var(--lava)">화면을 그리는 중 문제가 발생했습니다<br><small>${esc(err.message)}</small></div>`);
  console.error(err);
} }
function render_(fit){
  const day=S.days[curDay];
  const sc=schedule(day);
  renderDays();

  // 요약
  document.getElementById('sum').innerHTML =
    `<span>육상 <b>${sc.totKm?sc.totKm.toFixed(1):0}km</b></span>` +
    (sc.airKm?`<span>항공 <b>${Math.round(sc.airKm)}km</b></span>`:'') +
    `<span>이동시간 <b>${dur(sc.totMove)}</b></span>` +
    `<span>종료 <b>${fmt(sc.endAt)}</b></span>` +
    (sc.lateN?`<span class="warn">고정시각 충돌 ${sc.lateN}건</span>`:`<span style="color:var(--ok)">시간 여유 있음</span>`);

  // 리스트
  const L1=document.getElementById('list'); L1.innerHTML='';
  const head=document.createElement('div');
  head.className='dayhead';
  head.innerHTML=`<span>하루 시작</span>`;
  const ti=document.createElement('input'); ti.type='time'; ti.value=day.start;
  ti.disabled = !canEdit();
  ti.onchange=()=>{ day.start=ti.value; save(); render(); };
  head.appendChild(ti);
  head.insertAdjacentHTML('beforeend', `<span style="margin-left:auto">${sc.rows.length}개 일정</span>`);
  L1.appendChild(head);

  if(!sc.rows.length && !editOpen){
    L1.insertAdjacentHTML('beforeend', `<div class="empty">아직 비어 있는 날입니다.<br>아래 <b>일정 추가</b>나 상단 <b>추천 장소</b>로 채워보세요.</div>`);
  }

  // 편집 폼(edBody)을 목록 안 제자리에 끼워 넣는다. 기존 일정이면 그 카드를 펼치고,
  // 새 일정이면 저장될 위치(insertAt)에 빈 카드를 만들어 그 안에 넣는다.
  const newAt = (editOpen && curItem && !curItem.id)
    ? Math.max(0, Math.min(insertAt==null ? sc.rows.length : insertAt, sc.rows.length))
    : -1;
  let edPlaced = false;
  function newEditCard(){
    const w=document.createElement('div');
    w.className='card open newitem';
    w.appendChild(edBody);
    edPlaced = true;
    return w;
  }
  if(newAt === 0) L1.appendChild(newEditCard());

  sc.rows.forEach((r,i)=>{
    const c=document.createElement('div');
    c.className='card'+(curItem&&curItem.id===r.item.id?' sel':'');
    const tags=[];
    if(r.item.fix) tags.push(`<span class="tag fix">${r.item.fix} 고정</span>`);
    if(r.item.stay) tags.push(`<span class="tag">${dur(r.item.stay)} 체류</span>`);
    if(r.item.lat==null) tags.push(`<span class="tag nogeo">위치 없음</span>`);
    if(r.late) tags.push(`<span class="tag late">${dur(r.late)} 지각</span>`);
    c.innerHTML=`
      <div class="time"><div class="t">${fmt(r.start)}</div>${r.item.stay?`<div class="e">→ ${fmt(r.end)}</div>`:''}</div>
      <div class="body">
        <div class="name">${i+1}. ${esc(r.item.name)}</div>
        ${r.item.note?`<div class="meta">${esc(r.item.note)}</div>`:''}
        <div class="tags">${tags.join('')}</div>
      </div>
      <div class="ctrl">
        <button data-up ${i===0?'disabled':''}>▲</button>
        <button data-down ${i===sc.rows.length-1?'disabled':''}>▼</button>
      </div>`;
    const isOpen = editOpen && curItem && curItem.id && curItem.id===r.item.id;
    const openThis=()=>{
      if(isOpen) return closeEdit();   // 열려 있는 항목을 다시 누르면 접는다
      focusItemPair(r.item, sc.rows[i+1]&&sc.rows[i+1].item);
      openEdit(r.item);
    };
    c.querySelector('.body').onclick=openThis;
    c.querySelector('.time').onclick=openThis;
    c.querySelector('[data-up]').onclick=e=>{e.stopPropagation();move(i,-1)};
    c.querySelector('[data-down]').onclick=e=>{e.stopPropagation();move(i,1)};
    if(isOpen){ c.classList.add('open'); c.appendChild(edBody); edPlaced=true; }
    L1.appendChild(c);

    if(i<sc.rows.length-1){
      const lg=r.leg, d=document.createElement('div');
      d.className='leg '+lg.mode;
      if(lg.mode==='none') d.innerHTML=`<div class="bar"></div>이동시간 계산 제외`;
      else if(lg.skip) d.innerHTML=`<div class="bar"></div>${lg.mode==='air'?'✈️ 항공':'⛴️ 배'} <em>· ${Math.round(lg.km)}km · 시각은 아래 일정 기준</em>`;
      else d.innerHTML=`<div class="bar"></div>${lg.mode==='walk'?'🚶 도보':'🚗 자차'} <b>${dur(lg.min)}</b> <em>· ${lg.km.toFixed(lg.km<10?1:0)}km${lg.real?' · 실제 경로':''}</em>`;
      if(canEdit()){
        const idx=i+1, ib=document.createElement('button');
        ib.className='insBtn'; ib.type='button'; ib.textContent='+';
        ib.setAttribute('aria-label','이 사이에 일정 추가');
        ib.onclick=e=>{ e.stopPropagation(); openEdit(null, false, idx); };
        d.appendChild(ib);
      }
      L1.appendChild(d);
    }
    if(newAt === i+1) L1.appendChild(newEditCard());
  });

  // 편집 중이던 항목이 이 날 목록에 없으면(날짜 전환·삭제·가져오기 등) 폼을 원위치로 돌린다.
  // 안 그러면 innerHTML='' 로 떨어져 나간 채 화면 어디에도 없는 상태가 된다.
  if(editOpen && !edPlaced){ abortPick(false); editOpen=false; edGoHome(); }
  // 편집 중에는 하단 고정 버튼(추천 장소·일정 추가)을 숨긴다 - 폼이 목록 안에 있어서
  // 그대로 두면 저장·닫기 버튼 위에 겹쳐 앉는다.
  document.body.classList.toggle('editing', editOpen);

  drawMap(sc, fit);
}

function move(i,dir){
  const a=S.days[curDay].items, j=i+dir;
  if(j<0||j>=a.length) return;
  [a[i],a[j]]=[a[j],a[i]];
  save(); render();
}

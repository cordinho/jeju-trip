/* 브라우저가 순서대로 로드하는 일반 스크립트입니다.
   ES 모듈이 아니므로 import/export를 쓰지 마세요 - file:// 에서도 열려야 합니다.
   최상위 const/let/function 은 스크립트 간에 공유됩니다. 순서는 index.html 이 결정합니다. */

let tt;
function toast(m){
  const t=document.getElementById('toast'); t.textContent=m; t.classList.add('on');
  clearTimeout(tt); tt=setTimeout(()=>t.classList.remove('on'),1800);
}
async function refreshOsrm(){ if(await fetchOsrm()) render(); }

// 고정된 지도(#mapWrap)가 헤더 바로 밑에 붙도록 헤더 실제 높이를 CSS 변수로 넘긴다.
// --pinned-h(헤더+지도)는 scroll-margin-top 에 쓴다. 브라우저가 스스로 요소를 스크롤해
// 보여줄 때(입력칸에 포커스가 갈 때 등) 이게 없으면 고정된 지도 밑에 가려진다.
function measureHeader(){
  const hdr = document.querySelector('header').getBoundingClientRect().height;
  const map = document.getElementById('mapWrap').getBoundingClientRect().height;
  const st = document.documentElement.style;
  st.setProperty('--hdr-h', Math.round(hdr) + 'px');
  st.setProperty('--pinned-h', Math.round(hdr + map) + 'px');
}
measureHeader();

(async function init(){
  await load();
  await loadRoom();
  readHash();
  applyRole();
  renderSyncbar();
  render(true);
  if(ROOM.id){ await pull(false); startPolling(); applyRole(); }
  refreshOsrm();
  const inval = ()=>{ try{ MAP.resize(); measureHeader(); }catch(e){} };
  [0,120,400,900,1800].forEach(t=>setTimeout(inval,t));
  window.addEventListener('resize',inval);
  window.addEventListener('load',inval);
  window.addEventListener('orientationchange',()=>setTimeout(inval,300));
  if(window.ResizeObserver){
    new ResizeObserver(inval).observe(mapEl);
    // 헤더 자체도 줄바꿈 등으로 높이가 변할 수 있어 같이 관찰한다 (--hdr-h 가 어긋나면
    // 고정된 지도가 헤더에 파고들거나 사이가 벌어진다)
    new ResizeObserver(measureHeader).observe(document.querySelector('header'));
  }
})();

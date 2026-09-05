/* 브라우저가 순서대로 로드하는 일반 스크립트입니다.
   ES 모듈이 아니므로 import/export를 쓰지 마세요 - file:// 에서도 열려야 합니다.
   최상위 const/let/function 은 스크립트 간에 공유됩니다. 순서는 index.html 이 결정합니다. */

let tt;
function toast(m){
  const t=document.getElementById('toast'); t.textContent=m; t.classList.add('on');
  clearTimeout(tt); tt=setTimeout(()=>t.classList.remove('on'),1800);
}
async function refreshOsrm(){ if(await fetchOsrm()) render(); }

(async function init(){
  await load();
  await loadRoom();
  readHash();
  applyRole();
  renderSyncbar();
  render(true);
  if(ROOM.id){ await pull(false); startPolling(); applyRole(); }
  refreshOsrm();
  const inval = ()=>{ try{ MAP.resize(); }catch(e){} };
  [0,120,400,900,1800].forEach(t=>setTimeout(inval,t));
  window.addEventListener('resize',inval);
  window.addEventListener('load',inval);
  window.addEventListener('orientationchange',()=>setTimeout(inval,300));
  if(window.ResizeObserver) new ResizeObserver(inval).observe(mapEl);
})();

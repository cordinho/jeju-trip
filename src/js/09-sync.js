/* 브라우저가 순서대로 로드하는 일반 스크립트입니다.
   ES 모듈이 아니므로 import/export를 쓰지 마세요 - file:// 에서도 열려야 합니다.
   최상위 const/let/function 은 스크립트 간에 공유됩니다. 순서는 index.html 이 결정합니다. */

/* ══════════════ 공유 & 동기화 ══════════════ */
const RKEY = 'jeju-room-v1';
const API  = 'https://jsonblob.com/api/jsonBlob';
let ROOM = {id:null, role:'edit', pin:'', me:''};
let snapshotMode = false;   // 스냅샷 링크로 열림 → 조회 전용
let baseRev = 0, remoteInfo = null, pushT = null, pollT = null, busy = false;

const canEdit = () => !snapshotMode && (!ROOM.id || ROOM.role === 'edit');

/* base64url (유니코드 안전) */
function b64e(obj){
  const b = new TextEncoder().encode(JSON.stringify(obj));
  let s=''; for(let i=0;i<b.length;i+=8192) s += String.fromCharCode.apply(null, b.subarray(i,i+8192));
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64d(str){
  const s = atob(str.replace(/-/g,'+').replace(/_/g,'/'));
  const b = new Uint8Array(s.length); for(let i=0;i<s.length;i++) b[i]=s.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(b));
}

function baseUrl(){ return location.href.split('#')[0]; }
function linkEdit(){ return baseUrl()+'#r='+ROOM.id+'&k='+encodeURIComponent(ROOM.pin||''); }
function linkView(){ return baseUrl()+'#r='+ROOM.id; }

async function saveRoom(){ try{ if(window.storage) await window.storage.set(RKEY, JSON.stringify(ROOM)); }catch(e){} }
async function loadRoom(){
  try{ if(!window.storage) return; const r=await window.storage.get(RKEY);
    if(r&&r.value) ROOM = Object.assign(ROOM, JSON.parse(r.value)); }catch(e){}
}

function readHash(){
  const h = new URLSearchParams(location.hash.replace(/^#/,''));
  if(h.get('d')){
    try{ const p=b64d(h.get('d')); if(p&&p.days){ S=p; snapshotMode=true; } }catch(e){ toast('링크를 읽을 수 없습니다'); }
    return;
  }
  if(h.get('r')){
    ROOM.id  = h.get('r');
    ROOM.pin = h.get('k') || '';
    ROOM.role = h.get('k') ? 'edit' : 'view';
  }
}

/* ---- 방 API ---- */
async function roomRead(){
  const r = await fetch(API+'/'+ROOM.id, {headers:{'Accept':'application/json'}});
  if(!r.ok) throw new Error('read '+r.status);
  return r.json();
}
async function roomWrite(doc){
  const r = await fetch(API+'/'+ROOM.id, {
    method:'PUT', headers:{'Content-Type':'application/json','Accept':'application/json'},
    body: JSON.stringify(doc)});
  if(!r.ok) throw new Error('write '+r.status);
}
function pack(){
  return {app:'jeju-trip', pin:ROOM.pin||'', rev:baseRev+1,
          updatedAt:Date.now(), by:ROOM.me||'익명', data:S};
}

async function roomCreate(){
  const pin = String(Math.floor(1000+Math.random()*9000));
  const doc = {app:'jeju-trip', pin, rev:1, updatedAt:Date.now(), by:ROOM.me||'익명', data:S};
  const r = await fetch(API, {method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json'}, body:JSON.stringify(doc)});
  if(!r.ok) throw new Error('create '+r.status);
  const loc = r.headers.get('Location') || r.headers.get('X-jsonblob');
  if(!loc) throw new Error('noid');
  const id = loc.split('/').filter(Boolean).pop();
  ROOM = {id, role:'edit', pin, me:ROOM.me};
  baseRev = 1;
  await saveRoom();
  history.replaceState(null,'', linkEdit());
}

/* ---- 당겨오기 / 밀어넣기 ---- */
async function pull(silent){
  if(!ROOM.id || busy) return;
  busy = true;
  try{
    const doc = await roomRead();
    remoteInfo = {rev:doc.rev||0, at:doc.updatedAt, by:doc.by};
    if(ROOM.role==='edit' && doc.pin && ROOM.pin && doc.pin!==ROOM.pin) ROOM.role='view';
    if((doc.rev||0) > baseRev){
      S = doc.data; baseRev = doc.rev||0;
      await save(true);
      render(false);
      if(!silent) toast((doc.by||'누군가')+'님의 수정을 반영했습니다');
    }
    setSync('ok');
  }catch(e){ setSync('err'); }
  busy = false;
  renderSyncbar();
}

function queuePush(){
  if(!ROOM.id || !canEdit()) return;
  clearTimeout(pushT);
  pushT = setTimeout(push, 1200);
}
async function push(){
  if(!ROOM.id || !canEdit() || busy) return;
  busy = true;
  try{
    const cur = await roomRead();
    if((cur.rev||0) > baseRev){          // 남이 먼저 고침
      showConflict(cur);
      busy = false; return;
    }
    const doc = pack();
    await roomWrite(doc);
    baseRev = doc.rev; remoteInfo = {rev:doc.rev, at:doc.updatedAt, by:doc.by};
    setSync('ok');
  }catch(e){ setSync('err'); }
  busy = false;
  renderSyncbar();
}

function showConflict(cur){
  const el = document.getElementById('conflict');
  el.hidden = false;
  el.innerHTML = `<b>${esc(cur.by||'다른 사람')}님이 먼저 수정했습니다</b>
    내 변경과 충돌합니다. 한쪽을 선택하세요.
    <div style="margin-top:8px">
      <button class="pri" id="cfTake">상대 것 불러오기</button>
      <button id="cfMine">내 것으로 덮어쓰기</button>
    </div>`;
  el.querySelector('#cfTake').onclick=async()=>{
    S=cur.data; baseRev=cur.rev||0; el.hidden=true; await save(true); render(true); toast('최신 일정을 불러왔습니다');
  };
  el.querySelector('#cfMine').onclick=async()=>{
    baseRev = cur.rev||0; el.hidden=true; await push(); toast('내 일정으로 덮어썼습니다');
  };
}

let syncState='off';
function setSync(s){ syncState=s; }
function ago(ts){
  if(!ts) return '';
  const m=Math.floor((Date.now()-ts)/60000);
  if(m<1) return '방금'; if(m<60) return m+'분 전';
  const h=Math.floor(m/60); if(h<24) return h+'시간 전'; return Math.floor(h/24)+'일 전';
}
function renderSyncbar(){
  const bar=document.getElementById('syncbar');
  if(!ROOM.id && !snapshotMode){ bar.hidden=true; return; }
  bar.hidden=false;
  if(snapshotMode){
    bar.innerHTML=`<span class="dot off"></span><span class="rolechip view">스냅샷</span>
      <span class="who">받은 링크 시점의 일정입니다</span>
      <button id="sbFork">내 것으로 복사</button>`;
    bar.querySelector('#sbFork').onclick=async()=>{
      snapshotMode=false; history.replaceState(null,'',baseUrl()); await save(true);
      document.body.classList.remove('viewonly'); renderSyncbar(); render(true); toast('이제 편집할 수 있습니다');
    };
    return;
  }
  const cls = syncState==='err'?'err':(syncState==='ok'?'':'off');
  const who = remoteInfo ? `${esc(remoteInfo.by||'')} · ${ago(remoteInfo.at)} 수정` : '동기화 대기';
  bar.innerHTML=`<span class="dot ${cls}"></span>
    <span class="rolechip ${ROOM.role==='edit'?'edit':'view'}">${ROOM.role==='edit'?'편집 가능':'조회 전용'}</span>
    <span class="who">${syncState==='err'?'연결 실패 — 로컬에만 저장됨':who}</span>
    <button id="sbSync">새로고침</button>`;
  bar.querySelector('#sbSync').onclick=()=>pull(false);
}

function startPolling(){
  clearInterval(pollT);
  if(!ROOM.id) return;
  pollT = setInterval(()=>{ if(document.visibilityState==='visible') pull(true); }, 10000);
}
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') pull(true); });
window.addEventListener('focus',()=>pull(true));

function applyRole(){
  document.body.classList.toggle('viewonly', !canEdit());
}

/* ---- 공유 시트 UI ---- */
document.getElementById('btnShare').onclick=()=>{
  document.getElementById('fMe').value = ROOM.me||'';
  document.getElementById('roomNone').hidden = !!ROOM.id;
  document.getElementById('roomOn').hidden = !ROOM.id;
  if(ROOM.id){
    document.getElementById('roomIdTxt').textContent = ROOM.id;
    document.getElementById('lnkEdit').value = linkEdit();
    document.getElementById('lnkView').value = linkView();
  }
  openSheet('sheetShare');
};
document.getElementById('fMe').onchange=e=>{ ROOM.me=e.target.value.trim(); saveRoom(); };
document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{
  const i=document.getElementById(b.dataset.copy);
  if(!i.value) return toast('먼저 링크를 만드세요');
  try{ await navigator.clipboard.writeText(i.value); }catch(e){ i.select(); document.execCommand('copy'); }
  toast('복사했습니다');
});
document.getElementById('btnRoomNew').onclick=async()=>{
  ROOM.me = document.getElementById('fMe').value.trim() || ROOM.me;
  toast('방을 만드는 중…');
  try{
    await roomCreate();
    document.getElementById('btnShare').click();
    startPolling(); applyRole(); renderSyncbar();
    toast('방을 만들었습니다');
  }catch(e){
    toast('방 생성 실패 — 스냅샷 링크를 쓰세요');
  }
};
document.getElementById('btnRoomJoin').onclick=async()=>{
  const id=document.getElementById('fJoinId').value.trim().split('/').filter(Boolean).pop();
  if(!id) return toast('방 ID를 입력하세요');
  ROOM = {id, pin:document.getElementById('fJoinPin').value.trim(),
          role: document.getElementById('fJoinPin').value.trim()?'edit':'view',
          me: document.getElementById('fMe').value.trim()||ROOM.me};
  baseRev = 0;
  await saveRoom();
  history.replaceState(null,'', ROOM.role==='edit'?linkEdit():linkView());
  await pull(false);
  startPolling(); applyRole(); renderSyncbar(); closeSheets();
};
document.getElementById('btnRoomLeave').onclick=async()=>{
  ROOM={id:null, role:'edit', pin:'', me:ROOM.me}; baseRev=0; remoteInfo=null;
  clearInterval(pollT); await saveRoom(); history.replaceState(null,'',baseUrl());
  applyRole(); renderSyncbar(); closeSheets(); toast('방에서 나왔습니다 (일정은 이 기기에 남습니다)');
};
document.getElementById('btnShareNative').onclick=async()=>{
  const url = ROOM.role==='edit'?linkEdit():linkView();
  if(navigator.share){ try{ await navigator.share({title:'제주 일정', url}); }catch(e){} }
  else { try{ await navigator.clipboard.writeText(url); toast('링크를 복사했습니다'); }catch(e){} }
};
document.getElementById('btnSnapMake').onclick=()=>{
  const url = baseUrl()+'#d='+b64e(S);
  const i=document.getElementById('lnkSnap'); i.value=url;
  if(url.length>16000) toast('일정이 커서 링크가 깁니다. 공유 방을 권장합니다');
  else toast('스냅샷 링크를 만들었습니다');
};

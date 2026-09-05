/* 브라우저가 순서대로 로드하는 일반 스크립트입니다.
   ES 모듈이 아니므로 import/export를 쓰지 마세요 - file:// 에서도 열려야 합니다.
   최상위 const/let/function 은 스크립트 간에 공유됩니다. 순서는 index.html 이 결정합니다. */

/* ══════════════ 이동 경로 기록 ══════════════ */
// 여행 당일에 실제로 다닌 길을 GPS 로 남긴다. 계획 동선(주황/청록)과 구분되게 보라색으로
// 지도에 겹쳐 그린다. 날짜별로 day.track = [[lat, lng, 초단위시각], ...] 에 쌓는다.
//
// 한계를 알고 쓸 것: 브라우저는 화면이 켜져 있고 이 페이지가 떠 있을 때만 위치를 준다.
// 화면을 끄거나 다른 앱으로 가면 기록이 끊긴다 (백그라운드 추적은 웹으로 불가능하다).
// 또 위치 권한은 HTTPS 에서만 나온다 - 배포본(GitHub Pages)은 되고, 로컬 개발 서버를
// 폰에서 IP 로 열면 안 된다.

const TRACK_MIN_M = 25;      // 이보다 덜 움직였으면 점을 더하지 않는다 (제자리 흔들림 제거)
const TRACK_MAX_ACC = 100;   // 오차가 이보다 큰 측정값은 버린다 (m)

let trackWatch = null;
let trackSaveT = null;

const tracking = () => trackWatch !== null;
const dayTrack = () => S.days[curDay].track || [];

// 기록 중에는 점이 자주 들어오므로 저장을 몰아서 한다 (매 점마다 쓰면 낭비다).
function trackSaveSoon(){
  clearTimeout(trackSaveT);
  trackSaveT = setTimeout(()=>save(), 8000);
}

function trackDistKm(pts){
  let km = 0;
  for(let i=1;i<pts.length;i++) km += hav([pts[i-1][0],pts[i-1][1]], [pts[i][0],pts[i][1]]);
  return km;
}

function onTrackPos(p){
  const c = p.coords;
  if(c.accuracy != null && c.accuracy > TRACK_MAX_ACC) return;
  const day = S.days[curDay];
  const t = day.track || (day.track = []);
  const last = t[t.length-1];
  if(last && hav([last[0],last[1]], [c.latitude,c.longitude])*1000 < TRACK_MIN_M) return;
  t.push([+c.latitude.toFixed(5), +c.longitude.toFixed(5), Math.round(Date.now()/1000)]);
  MAP.setTrack(t);
  renderTrackBar();
  trackSaveSoon();
}

// 감시 중에는 신호가 잠깐 끊길 때마다 오류가 섞여 들어온다(터널·중산간 음영지역).
// 여기서 멈춰버리면 그 순간 기록이 통째로 끝나므로, 권한 거부(code 1)일 때만 중단하고
// 나머지는 감시를 유지한다 - watchPosition 은 오류 뒤에도 계속 살아 있다.
let trackErrToastAt = 0;
function onTrackErr(e){
  if(e && e.code === 1){
    stopTrack();
    toast('위치 권한이 필요합니다');
    return;
  }
  const now = Date.now();
  if(now - trackErrToastAt > 60000){   // 잔소리하지 않도록 1분에 한 번만 알린다
    trackErrToastAt = now;
    toast('위치 신호가 약합니다 · 계속 기다립니다');
  }
}

function startTrack(){
  if(!navigator.geolocation) return toast('이 브라우저는 위치 기록을 지원하지 않습니다');
  const day = S.days[curDay];
  day.track = day.track || [];
  trackWatch = navigator.geolocation.watchPosition(onTrackPos, onTrackErr,
    { enableHighAccuracy:true, maximumAge:5000, timeout:20000 });
  document.body.classList.add('tracking');
  renderTrackBar();
  toast('이동 기록을 시작합니다 · 화면이 꺼지면 멈춥니다');
}

function stopTrack(){
  if(trackWatch !== null) navigator.geolocation.clearWatch(trackWatch);
  trackWatch = null;
  document.body.classList.remove('tracking');
  clearTimeout(trackSaveT);
  save();
  renderTrackBar();
}

function toggleTrack(){ tracking() ? stopTrack() : startTrack(); }

function clearTrack(){
  const t = dayTrack();
  if(!t.length) return;
  if(!confirm(`이 날의 이동 기록 ${trackDistKm(t).toFixed(1)}km 를 지웁니다. 되돌릴 수 없습니다.`)) return;
  if(tracking()) stopTrack();
  delete S.days[curDay].track;
  MAP.setTrack(null);
  save(); renderTrackBar();
  toast('이동 기록을 지웠습니다');
}

// 기록 버튼과 요약바의 기록 거리를 갱신한다. 목록을 다시 그릴 때와, 기록 중 점이
// 들어올 때마다 부른다 (점 하나마다 화면 전체를 다시 그릴 이유는 없다).
function renderTrackBar(){
  const km = trackDistKm(dayTrack());
  const btn = document.getElementById('trackBtn');
  if(btn){
    btn.textContent = tracking() ? `기록 중 ${km.toFixed(1)}km`
                     : (km ? `기록 ${km.toFixed(1)}km` : '이동 기록');
    btn.setAttribute('aria-pressed', tracking());
  }
  const del = document.getElementById('trackDel');
  if(del) del.hidden = !dayTrack().length || tracking();
  const sum = document.getElementById('sumTrack');
  if(sum) sum.innerHTML = km ? `실제 이동 <b>${km.toFixed(1)}km</b>` : '';
}

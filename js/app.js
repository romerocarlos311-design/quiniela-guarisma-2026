// ============================================================
//  QUINIELA GUARISMA 2026 - app.js
// ============================================================

const OPENFOOTBALL_URL = "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

const NAME_MAP = {
  "Mexico":"M\u00e9xico","South Africa":"Sud\u00e1frica","South Korea":"Corea del Sur",
  "Czech Republic":"Chequia","Czechia":"Chequia","Canada":"Canad\u00e1",
  "Bosnia & Herzegovina":"Bosnia","Bosnia and Herzegovina":"Bosnia",
  "Qatar":"Catar","Switzerland":"Suiza","Brazil":"Brasil","Morocco":"Marruecos",
  "Haiti":"Hait\u00ed","Scotland":"Escocia","USA":"Estados Unidos",
  "Australia":"Australia","Turkey":"Turqu\u00eda","Germany":"Alemania",
  "Ecuador":"Ecuador","Netherlands":"Pa\u00edses Bajos","Japan":"Jap\u00f3n",
  "Sweden":"Suecia","Tunisia":"T\u00fanez","Belgium":"B\u00e9lgica","Egypt":"Egipto",
  "Iran":"Ir\u00e1n","New Zealand":"Nueva Zelanda","Spain":"Espa\u00f1a",
  "Cape Verde":"Cabo Verde","Saudi Arabia":"Arabia Saudita","Uruguay":"Uruguay",
  "France":"Francia","Senegal":"Senegal","Iraq":"Irak","Norway":"Noruega",
  "Argentina":"Argentina","Algeria":"Argelia","Austria":"Austria",
  "Jordan":"Jordania","Portugal":"Portugal","DR Congo":"RD Congo",
  "Uzbekistan":"Uzbekist\u00e1n","Colombia":"Colombia","England":"Inglaterra",
  "Croatia":"Croacia","Ghana":"Ghana","Panama":"Panam\u00e1",
  "Korea Republic":"Corea del Sur","Ivory Coast":"Costa de Marfil",
  "C\u00f4te d'Ivoire":"Costa de Marfil","Cura\u00e7ao":"Curazao"
};

function toEs(name) { return NAME_MAP[name] || name; }

let currentUser = null;
let currentView = "home";
let allMatches  = [];
let predictions = {};
let leaderboard = [];
let userData    = {};

// AUTH
auth.onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;
    try {
      const snap = await db.collection("users").doc(user.uid).get();
      if (!snap.exists) { auth.signOut(); return; }
      userData = snap.data();
      if (userData.disabled) { auth.signOut(); return; }
      document.getElementById("screen-login").classList.add("hidden");
      document.getElementById("screen-app").classList.remove("hidden");
      document.getElementById("user-display-name").textContent = userData.displayName || userData.username;
      renderUserAvatar("user-avatar-header", userData);
      loadApp();
    } catch(e) { console.error(e); }
  } else {
    currentUser = null;
    document.getElementById("screen-login").classList.remove("hidden");
    document.getElementById("screen-app").classList.add("hidden");
  }
});

function renderUserAvatar(elId, u) {
  const el = document.getElementById(elId);
  if (!el) return;
  const initial = (u.displayName || u.username || "?").charAt(0).toUpperCase();
  el.textContent = initial;
  el.style.background = u.avatarColor || "#D4A017";
  el.style.color = isLight(u.avatarColor || "#D4A017") ? "#000" : "#fff";
}

function isLight(hex) {
  try {
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return (r*299+g*587+b*114)/1000>128;
  } catch { return false; }
}

// LOGIN
document.getElementById("btn-login").addEventListener("click", handleLogin);
document.getElementById("input-password").addEventListener("keydown", e => { if(e.key==="Enter") handleLogin(); });

async function handleLogin() {
  const username = document.getElementById("input-username").value.trim().toLowerCase();
  const password = document.getElementById("input-password").value;
  const errEl    = document.getElementById("login-error");
  errEl.textContent = "";
  if (!username || !password) { errEl.textContent = "Ingresa usuario y contrase\u00f1a."; return; }
  try {
    const snap = await db.collection("users").where("username","==",username).limit(1).get();
    if (snap.empty) { errEl.textContent = "Usuario no encontrado."; return; }
    const u = snap.docs[0].data();
    if (u.disabled) { errEl.textContent = "Tu cuenta est\u00e1 desactivada."; return; }
    await auth.signInWithEmailAndPassword(u.email, password);
  } catch(e) {
    if (e.code==="auth/wrong-password"||e.code==="auth/invalid-credential") errEl.textContent="Contrase\u00f1a incorrecta.";
    else if (e.code==="auth/too-many-requests") errEl.textContent="Demasiados intentos. Espera.";
    else errEl.textContent="Error al ingresar.";
  }
}

document.getElementById("btn-logout").addEventListener("click", () => auth.signOut());

// MODAL CONTRASENA
document.getElementById("btn-change-pass").addEventListener("click", () => {
  document.getElementById("modal-pass").classList.remove("hidden");
  ["pass-current","pass-new","pass-confirm"].forEach(id => document.getElementById(id).value="");
  document.getElementById("pass-error").textContent="";
});
document.getElementById("btn-cancel-pass").addEventListener("click", () =>
  document.getElementById("modal-pass").classList.add("hidden"));
document.getElementById("modal-pass").addEventListener("click", e => {
  if (e.target===document.getElementById("modal-pass")) document.getElementById("modal-pass").classList.add("hidden");
});
document.getElementById("btn-save-pass").addEventListener("click", async () => {
  const current=document.getElementById("pass-current").value;
  const newP=document.getElementById("pass-new").value;
  const conf=document.getElementById("pass-confirm").value;
  const errEl=document.getElementById("pass-error");
  errEl.textContent="";
  if (!current||!newP||!conf){errEl.textContent="Completa todos los campos.";return;}
  if (newP.length<6){errEl.textContent="M\u00ednimo 6 caracteres.";return;}
  if (newP!==conf){errEl.textContent="Las contrase\u00f1as no coinciden.";return;}
  try {
    const cred=firebase.auth.EmailAuthProvider.credential(currentUser.email,current);
    await currentUser.reauthenticateWithCredential(cred);
    await currentUser.updatePassword(newP);
    document.getElementById("modal-pass").classList.add("hidden");
    showToast("\u2705 Contrase\u00f1a actualizada.","success");
  } catch(e) {
    errEl.textContent=(e.code==="auth/wrong-password"||e.code==="auth/invalid-credential")
      ?"La contrase\u00f1a actual es incorrecta.":"Error al cambiar.";
  }
});

// CARGAR APP
async function loadApp() {
  await Promise.all([loadMatches(), loadUserPredictions(), loadLeaderboard()]);
  renderView("home");
  syncScores();
}

async function loadMatches() {
  const snap=await db.collection("matches").orderBy("datetime").get();
  allMatches=snap.docs.map(d=>({id:d.id,...d.data()}));
  if (!allMatches.length) {
    await seedMatches();
    const s2=await db.collection("matches").orderBy("datetime").get();
    allMatches=s2.docs.map(d=>({id:d.id,...d.data()}));
  }
}

async function seedMatches() {
  const batch=db.batch();
  MATCHES_GROUP_STAGE.forEach(m=>{
    const ref=db.collection("matches").doc(m.id);
    const dt=new Date(`${m.date}T${m.time}:00-06:00`);
    batch.set(ref,{home:m.home,away:m.away,group:m.group,stage:"grupo",
      datetime:firebase.firestore.Timestamp.fromDate(dt),
      dateStr:m.date,timeStr:m.time,scoreHome:null,scoreAway:null,status:"scheduled"});
  });
  await batch.commit();
}

// SYNC OPENFOOTBALL
async function syncScores() {
  try {
    const res=await fetch(OPENFOOTBALL_URL+"?t="+Date.now());
    const data=await res.json();
    if (!data.matches) return;
    const batch=db.batch(); let changed=0;
    for (const m of data.matches) {
      if (!m.score||!m.score.ft) continue;
      const local=allMatches.find(x=>
        x.home.toLowerCase()===toEs(m.team1).toLowerCase()&&
        x.away.toLowerCase()===toEs(m.team2).toLowerCase());
      if (!local) continue;
      if (local.status==="finished"&&local.scoreHome===m.score.ft[0]&&local.scoreAway===m.score.ft[1]) continue;
      batch.update(db.collection("matches").doc(local.id),{scoreHome:m.score.ft[0],scoreAway:m.score.ft[1],status:"finished"});
      local.scoreHome=m.score.ft[0]; local.scoreAway=m.score.ft[1]; local.status="finished";
      changed++;
    }
    if (changed>0) {
      await batch.commit();
      await recalcAllPoints();
      await loadLeaderboard();
      if (currentView==="home"||currentView==="leaderboard") renderView(currentView);
      showToast("\u2705 "+changed+" resultado(s) actualizado(s)","success");
    }
  } catch(e){ console.warn("Sync error:",e); }
}

// PREDICCIONES
async function loadUserPredictions() {
  const snap=await db.collection("predictions").where("userId","==",currentUser.uid).get();
  predictions={};
  snap.docs.forEach(d=>{
    const p=d.data();
    predictions[p.matchId]={home:p.predictedHome,away:p.predictedAway,penaltyWinner:p.penaltyWinner||null,docId:d.id};
  });
}

async function savePrediction(matchId,home,away,penaltyWinner=null) {
  // ID deterministico: imposible crear duplicados
  const docId = matchId + "_" + currentUser.uid;
  const data={userId:currentUser.uid,matchId,predictedHome:home,predictedAway:away,
    penaltyWinner:penaltyWinner||null,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp(),points:0};
  await db.collection("predictions").doc(docId).set(data,{merge:true});
  predictions[matchId]={home,away,docId,penaltyWinner};
  showToast("Predicci\u00f3n guardada \u2705","success");
}

// PUNTOS con logica de penales
function calculatePoints(pred,actual) {
  if (actual.home===null||actual.away===null) return 0;
  const isKnockout = actual.penaltyWinner !== undefined && actual.penaltyWinner !== null;
  const isDrawActual = actual.home===actual.away;
  const isDrawPred   = pred.home===pred.away;

  if (!isKnockout || !isDrawActual) {
    if (pred.home===actual.home&&pred.away===actual.away) return 3;
    if (Math.sign(pred.home-pred.away)===Math.sign(actual.home-actual.away)) return 1;
    return 0;
  }
  // Eliminatoria con empate y penales
  if (!isDrawPred) return 0;
  const exactScore = pred.home===actual.home && pred.away===actual.away;
  const exactPenal = pred.penaltyWinner && pred.penaltyWinner===actual.penaltyWinner;
  if (exactScore && exactPenal) return 3;
  if (exactScore || exactPenal) return 2;
  return 1;
}

// LEADERBOARD con 5 criterios de desempate
async function loadLeaderboard() {
  const snap=await db.collection("users").where("disabled","==",false).get();
  const mSnap=await db.collection("matches").where("status","==","finished").get();
  const matchMap={}; mSnap.docs.forEach(d=>{matchMap[d.id]=d.data();});
  const pSnap=await db.collection("predictions").get();
  const predsByUser={};
  pSnap.docs.forEach(pd=>{
    const p=pd.data();
    if (!predsByUser[p.userId]) predsByUser[p.userId]=[];
    predsByUser[p.userId].push(p);
  });
  leaderboard=snap.docs.map(d=>{
    const u=d.data(); const uid=d.id;
    const preds=predsByUser[uid]||[];
    let goalDiff=0,predCount=0;
    preds.forEach(p=>{
      const m=matchMap[p.matchId];
      if (!m||m.scoreHome===null) return;
      goalDiff+=Math.abs(p.predictedHome-m.scoreHome)+Math.abs(p.predictedAway-m.scoreAway);
      predCount++;
    });
    return {uid,name:u.displayName||u.username,points:u.totalPoints||0,
            exact:u.exactPredictions||0,result:u.resultPredictions||0,
            avatarColor:u.avatarColor||"#D4A017",goalDiff,predCount};
  }).sort((a,b)=>
    b.points-a.points||b.exact-a.exact||b.result-a.result||
    a.goalDiff-b.goalDiff||b.predCount-a.predCount
  );
}

async function recalcAllPoints() {
  const finished=allMatches.filter(m=>m.status==="finished");
  const usersSnap=await db.collection("users").get();
  for (const ud of usersSnap.docs) {
    const uid=ud.id;
    const ps=await db.collection("predictions").where("userId","==",uid).get();
    let total=0,exact=0,result=0;
    for (const pd of ps.docs) {
      const p=pd.data(),match=finished.find(m=>m.id===p.matchId);
      if (!match) continue;
      const pts=calculatePoints(
        {home:p.predictedHome,away:p.predictedAway,penaltyWinner:p.penaltyWinner||null},
        {home:match.scoreHome,away:match.scoreAway,penaltyWinner:match.penaltyWinner||null}
      );
      total+=pts; if(pts===3)exact++; if(pts>=1)result++;
      db.collection("predictions").doc(pd.id).update({points:pts});
    }
    await db.collection("users").doc(uid).update({totalPoints:total,exactPredictions:exact,resultPredictions:result});
  }
}

// NAVEGACION
document.querySelectorAll("[data-view]").forEach(btn=>
  btn.addEventListener("click",()=>renderView(btn.getAttribute("data-view"))));

function renderView(view) {
  currentView=view;
  document.querySelectorAll(".view-section").forEach(s=>s.classList.add("hidden"));
  document.getElementById(`view-${view}`).classList.remove("hidden");
  document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.getAttribute("data-view")===view));
  if (view==="home")        renderHome();
  if (view==="predictions") renderPredictions();
  if (view==="leaderboard") renderLeaderboard();
  if (view==="grupos")      renderGrupos();
  if (view==="weekly")      renderWeeklyPoints();
}

// HOME
function renderHome() {
  const container=document.getElementById("matches-today");
  const todayStr=new Date().toLocaleDateString("en-CA",{timeZone:"America/El_Salvador"});
  let matches=allMatches.filter(m=>m.dateStr===todayStr);
  if (!matches.length) {
    const upcoming=allMatches.filter(m=>m.dateStr>=todayStr&&m.status!=="finished");
    if (upcoming.length){const nd=upcoming[0].dateStr;matches=upcoming.filter(m=>m.dateStr===nd);}
  }
  if (!matches.length){container.innerHTML=`<p class="empty-state">\u26BD No hay partidos por ahora.</p>`;return;}
  container.innerHTML=matches.map(m=>renderMatchCard(m,true)).join("");
  addListeners(container);
}

function renderMatchCard(m,showPred=false) {
  const pred=predictions[m.id],locked=isLocked(m);
  const isKnockout=m.stage&&m.stage!=="grupo";
  const score=m.status==="finished"
    ?`<span class="score-result">${m.scoreHome} - ${m.scoreAway}${m.penaltyWinner?" (pen: "+m.penaltyWinner+")" :""}</span>`
    :`<span class="match-time">${m.timeStr}</span>`;
  const predHtml=showPred?`
    ${isKnockout?`<div class="knockout-info">\u2139\uFE0F Eliminatoria: si predices empate, elige qui\u00e9n gana en penales.</div>`:""}
    <div class="prediction-row">
      <input type="number" min="0" max="20" class="score-input" data-match="${m.id}" data-side="home"
        value="${pred?pred.home:""}" ${locked?"disabled":""} placeholder="0">
      <span class="pred-dash">-</span>
      <input type="number" min="0" max="20" class="score-input" data-match="${m.id}" data-side="away"
        value="${pred?pred.away:""}" ${locked?"disabled":""} placeholder="0">
      ${!locked?`<button class="btn-save-pred" data-match="${m.id}">\u2713 Guardar</button>`:`<span class="lock-label">\uD83D\uDD12 Cerrado</span>`}
    </div>
    ${isKnockout?`<div class="penalty-row" id="penalty-row-${m.id}" style="display:${pred&&pred.home===pred.away?"flex":"none"}">
      <span class="penalty-label">\uD83C\uDFC6 Gana en penales:</span>
      <button class="btn-penalty ${pred&&pred.penaltyWinner===m.home?"active":""}" data-match="${m.id}" data-team="${m.home}" ${locked?"disabled":""} onclick="setPenalty('${m.id}','${m.home}',this)">${m.home}</button>
      <button class="btn-penalty ${pred&&pred.penaltyWinner===m.away?"active":""}" data-match="${m.id}" data-team="${m.away}" ${locked?"disabled":""} onclick="setPenalty('${m.id}','${m.away}',this)">${m.away}</button>
    </div>`:""}
    ${isKnockout&&!locked?`<div class="knockout-pts-legend">
      <span>&#x1F7E1; Solo empate (sin elegir penales) = 1 pt</span>
      <span>&#x1F7E0; Marcador exacto O ganador penales = 2 pts</span>
      <span>&#x1F7E2; Marcador exacto + ganador penales = 3 pts</span>
      <span class="knockout-pts-note">* Los puntos de penales aplican solo si seleccionas quién gana abajo</span>
    </div>`:""}
  `:"";
  const pts=(pred&&m.status==="finished")
    ?`<span class="pts-badge pts-${calculatePoints({home:pred.home,away:pred.away,penaltyWinner:pred.penaltyWinner},{home:m.scoreHome,away:m.scoreAway,penaltyWinner:m.penaltyWinner||null})}">${calculatePoints({home:pred.home,away:pred.away,penaltyWinner:pred.penaltyWinner},{home:m.scoreHome,away:m.scoreAway,penaltyWinner:m.penaltyWinner||null})} pts</span>`:"";
  return `
  <div class="match-card ${m.status}">
    <div class="group-badge" style="background:${GROUP_COLORS[m.group]||'#1a1f4e'}">Grupo ${m.group}</div>
    <div class="match-teams">
      <div class="team home"><span class="flag">${getFlag(m.home)}</span><span class="tname">${m.home}</span></div>
      <div class="match-center">${score}<span class="vs">VS</span></div>
      <div class="team away"><span class="tname">${m.away}</span><span class="flag">${getFlag(m.away)}</span></div>
    </div>
    ${pts}${predHtml}
  </div>`;
}

function isLocked(m) {
  const ko=m.datetime?.toDate?m.datetime.toDate():new Date(m.datetime);
  return new Date()>=new Date(ko.getTime()-30*60*1000)||m.status==="finished";
}

// PENALTY
function setPenalty(matchId,team,btn) {
  const row=document.getElementById("penalty-row-"+matchId);
  if (!row) return;
  row.querySelectorAll(".btn-penalty").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  if (!predictions[matchId]) predictions[matchId]={};
  predictions[matchId].penaltyWinner=team;
}

function updatePenaltyVisibility(matchId) {
  const homeVal=document.querySelector(`.score-input[data-match="${matchId}"][data-side="home"]`)?.value;
  const awayVal=document.querySelector(`.score-input[data-match="${matchId}"][data-side="away"]`)?.value;
  const row=document.getElementById("penalty-row-"+matchId);
  if (!row) return;
  if (homeVal!==""&&awayVal!==""&&homeVal===awayVal) {
    row.style.display="flex";
  } else {
    row.style.display="none";
    row.querySelectorAll(".btn-penalty").forEach(b=>b.classList.remove("active"));
    if (predictions[matchId]) predictions[matchId].penaltyWinner=null;
  }
}

function addListeners(container) {
  container.querySelectorAll(".score-input").forEach(input=>{
    input.addEventListener("input",()=>{
      const mid=input.getAttribute("data-match");
      updatePenaltyVisibility(mid);
    });
  });
  container.querySelectorAll(".btn-save-pred").forEach(btn=>{
    btn.addEventListener("click",async()=>{
      const mid=btn.getAttribute("data-match");
      const home=parseInt(container.querySelector(`.score-input[data-match="${mid}"][data-side="home"]`).value);
      const away=parseInt(container.querySelector(`.score-input[data-match="${mid}"][data-side="away"]`).value);
      if (isNaN(home)||isNaN(away)||home<0||away<0){showToast("Marcador inv\u00e1lido.","error");return;}
      if (isLocked(allMatches.find(m=>m.id===mid))){showToast("Ya est\u00e1 cerrado.","error");return;}
      const penWinner=predictions[mid]?.penaltyWinner||null;
      await savePrediction(mid,home,away,penWinner);
      btn.textContent="\u2713 \u00a1Guardado!";btn.style.background="#D4A017";btn.style.color="#000";
      setTimeout(()=>{btn.textContent="\u2713 Guardar";btn.style.background="";btn.style.color="";},2000);
    });
  });
}

// PREDICCIONES
function renderPredictions() {
  const container=document.getElementById("predictions-list");
  const search=(document.getElementById("pred-search")?.value||"").toLowerCase();
  const byDate={};
  allMatches.forEach(m=>{
    if (search&&!m.home.toLowerCase().includes(search)&&!m.away.toLowerCase().includes(search)) return;
    if (!byDate[m.dateStr]) byDate[m.dateStr]=[];
    byDate[m.dateStr].push(m);
  });
  let html="";
  Object.keys(byDate).sort().forEach(date=>{
    const d=new Date(date+"T12:00:00");
    const label=d.toLocaleDateString("es-SV",{weekday:"long",day:"numeric",month:"long"}).replace(/^\w/,c=>c.toUpperCase());
    html+=`<h3 class="date-header">\uD83D\uDCC5 ${label}</h3>`;
    html+=byDate[date].map(m=>renderMatchCard(m,true)).join("");
  });
  container.innerHTML=html||`<p class="empty-state">No se encontraron partidos.</p>`;
  addListeners(container);
}
document.getElementById("pred-search")?.addEventListener("input",renderPredictions);

// LEADERBOARD con footer desempate
function renderLeaderboard() {
  const list=document.getElementById("leaderboard-list");
  list.innerHTML=leaderboard.map((u,i)=>{
    const medal=i===0?"\uD83E\uDD47":i===1?"\uD83E\uDD48":i===2?"\uD83E\uDD49":`${i+1}`;
    const isMe=u.uid===currentUser.uid;
    const init=u.name.charAt(0).toUpperCase();
    const light=isLight(u.avatarColor);
    return `
    <div class="lb-row ${isMe?"lb-me":""}">
      <div class="lb-rank">${medal}</div>
      <div class="lb-avatar" style="background:${u.avatarColor};color:${light?"#000":"#fff"}">${init}</div>
      <div class="lb-name">${u.name}${isMe?` <span class="you-tag">T\u00fa</span>`:""}</div>
      <div class="lb-pts">${u.points}</div>
      <div class="lb-detail">\uD83C\uDFAF ${u.exact} &nbsp; \u2714\uFE0F ${u.result}</div>
    </div>`;
  }).join("");
  const footer=document.getElementById("leaderboard-footer");
  if (footer) {
    footer.innerHTML=`<div class="lb-footer">
      <div class="lb-footer-title">\u2696\uFE0F Criterios de desempate</div>
      <ol class="lb-footer-list">
        <li>Mayor puntaje total acumulado</li>
        <li>Mayor cantidad de marcadores exactos (\u2b50 3 pts)</li>
        <li>Mayor cantidad de resultados correctos (\u2714\uFE0F 1 pt o m\u00e1s)</li>
        <li>Menor diferencia de goles acumulada</li>
        <li>Mayor cantidad de partidos predichos</li>
      </ol>
    </div>`;
  }
}

// GRUPOS
function renderGrupos() {
  const container=document.getElementById("grupos-list");
  const groups={};
  MATCHES_GROUP_STAGE.forEach(m=>{
    if (!groups[m.group]) groups[m.group]={};
    if (!groups[m.group][m.home]) groups[m.group][m.home]={pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,pts:0};
    if (!groups[m.group][m.away]) groups[m.group][m.away]={pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,pts:0};
  });
  allMatches.filter(m=>m.status==="finished"&&m.stage==="grupo").forEach(m=>{
    if (!groups[m.group]) return;
    const h=groups[m.group][m.home],a=groups[m.group][m.away];
    if (!h||!a) return;
    h.pj++;a.pj++;h.gf+=m.scoreHome;h.gc+=m.scoreAway;a.gf+=m.scoreAway;a.gc+=m.scoreHome;
    if (m.scoreHome>m.scoreAway){h.pg++;h.pts+=3;a.pp++;}
    else if (m.scoreHome<m.scoreAway){a.pg++;a.pts+=3;h.pp++;}
    else{h.pe++;h.pts++;a.pe++;a.pts++;}
  });
  let html="";
  Object.keys(groups).sort().forEach(g=>{
    const teams=Object.entries(groups[g])
      .map(([name,s])=>({name,...s,dif:s.gf-s.gc}))
      .sort((a,b)=>b.pts-a.pts||b.dif-a.dif||b.gf-a.gf);
    html+=`
    <div class="group-table">
      <div class="group-title" style="background:${GROUP_COLORS[g]||'#1a1f4e'}">GRUPO ${g}</div>
      <table class="standings-table">
        <thead><tr><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DIF</th><th>PTS</th></tr></thead>
        <tbody>
          ${teams.map((t,i)=>`
          <tr class="${i<2?"qualify":""}">
            <td class="team-cell"><span class="flag-sm">${getFlag(t.name)}</span>${t.name}</td>
            <td>${t.pj}</td><td>${t.pg}</td><td>${t.pe}</td><td>${t.pp}</td>
            <td>${t.gf}</td><td>${t.gc}</td>
            <td class="${t.dif>0?"pos-dif":t.dif<0?"neg-dif":""}">${t.dif>0?"+":""}${t.dif}</td>
            <td class="pts-col"><strong>${t.pts}</strong></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
  });
  container.innerHTML=html;
}

// SEMANAL
async function renderWeeklyPoints() {
  const container=document.getElementById("weekly-list");
  if (!container) return;
  const today=new Date().toLocaleDateString("en-CA",{timeZone:"America/El_Salvador"});
  const weeks=[
    {label:"Semana 1",start:"2026-06-09",end:"2026-06-15"},
    {label:"Semana 2",start:"2026-06-16",end:"2026-06-22"},
    {label:"Semana 3",start:"2026-06-23",end:"2026-06-29"},
    {label:"Semana 4",start:"2026-06-30",end:"2026-07-06"},
    {label:"Semana 5",start:"2026-07-07",end:"2026-07-13"},
    {label:"Semana 6",start:"2026-07-14",end:"2026-07-19"},
  ];
  const cw=weeks.find(w=>today>=w.start&&today<=w.end)||weeks[0];
  container.innerHTML=`
    <div class="week-selector">
      <select id="weekly-week-select" onchange="changeWeek(this.value)">
        ${weeks.map(w=>`<option value='${JSON.stringify(w).replace(/'/g,"&#39;")}' ${w.label===cw.label?"selected":""}>${w.label} &bull; ${w.start} al ${w.end}</option>`).join("")}
      </select>
    </div>
    <div id="weekly-table-container"><p class="empty-state">Calculando&hellip;</p></div>`;
  await renderWeekTable(cw);
}

async function changeWeek(val) { await renderWeekTable(JSON.parse(val)); }

async function renderWeekTable(week) {
  const tc=document.getElementById("weekly-table-container");
  if (!tc) return;
  tc.innerHTML=`<p class="empty-state">Calculando\u2026</p>`;
  const mSnap=await db.collection("matches").where("status","==","finished").get();
  const weekIds=new Set(),matchMap={};
  mSnap.docs.forEach(d=>{const m=d.data();if(m.dateStr>=week.start&&m.dateStr<=week.end){weekIds.add(d.id);matchMap[d.id]=m;}});
  if (!weekIds.size){tc.innerHTML=`<p class="empty-state">No hay partidos finalizados en ${week.label}.</p>`;return;}
  const pSnap=await db.collection("predictions").get();
  const uSnap=await db.collection("users").where("disabled","==",false).get();
  const wp={};
  pSnap.docs.forEach(pd=>{
    const p=pd.data(); if(!weekIds.has(p.matchId)) return;
    const m=matchMap[p.matchId]; if(!m) return;
    const pts=calculatePoints(
      {home:p.predictedHome,away:p.predictedAway,penaltyWinner:p.penaltyWinner||null},
      {home:m.scoreHome,away:m.scoreAway,penaltyWinner:m.penaltyWinner||null}
    );
    if (!wp[p.userId]) wp[p.userId]={pts:0,exact:0,result:0};
    wp[p.userId].pts+=pts; if(pts===3)wp[p.userId].exact++; if(pts>=1)wp[p.userId].result++;
  });
  const rows=uSnap.docs.map(d=>{
    const u=d.data(),w=wp[d.id]||{pts:0,exact:0,result:0};
    return {uid:d.id,name:u.displayName||u.username,avatarColor:u.avatarColor||"#D4A017",...w};
  }).sort((a,b)=>b.pts-a.pts||b.exact-a.exact||b.result-a.result);
  tc.innerHTML=`
    <p style="font-size:.75rem;color:var(--silver);margin-bottom:.75rem">${weekIds.size} partido(s) &bull; ${week.label}</p>
    <div id="weekly-rows">
      ${rows.map((u,i)=>{
        const medal=i===0?"\uD83E\uDD47":i===1?"\uD83E\uDD48":i===2?"\uD83E\uDD49":`${i+1}`;
        const isMe=u.uid===currentUser.uid;
        const init=u.name.charAt(0).toUpperCase();
        const light=isLight(u.avatarColor);
        return `<div class="lb-row ${isMe?"lb-me":""}">
          <div class="lb-rank">${medal}</div>
          <div class="lb-avatar" style="background:${u.avatarColor};color:${light?"#000":"#fff"}">${init}</div>
          <div class="lb-name">${u.name}${isMe?` <span class="you-tag">T\u00fa</span>`:""}</div>
          <div class="lb-pts">${u.pts}</div>
          <div class="lb-detail">\uD83C\uDFAF ${u.exact} &nbsp; \u2714\uFE0F ${u.result}</div>
        </div>`;
      }).join("")}
    </div>`;
}

// TOAST
function showToast(msg,type="info") {
  const t=document.getElementById("toast");
  t.textContent=msg; t.className=`toast show ${type}`;
  setTimeout(()=>t.classList.remove("show"),3000);
}

setInterval(syncScores,15*60*1000);

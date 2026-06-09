// ============================================================
//  QUINIELA GUARISMA 2026 — Admin
// ============================================================

const AVATAR_COLORS_ADMIN = [
  "#D4A017","#1a1f4e","#e63946","#06d6a0","#f4a261",
  "#457b9d","#a8dadc","#8338ec","#fb5607","#3a86ff",
  "#ffbe0b","#b5838d","#6d6875","#2ec4b6","#e76f51"
];

auth.onAuthStateChanged(async user => {
  if (!user) { window.location.href = "../index.html"; return; }
  const snap = await db.collection("users").doc(user.uid).get();
  if (!snap.exists || !snap.data().isAdmin) { window.location.href = "../index.html"; return; }
  document.getElementById("admin-name").textContent = snap.data().displayName || snap.data().username;
  initAdmin();
});

document.querySelectorAll(".admin-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach(t=>t.classList.remove("active"));
    document.querySelectorAll(".admin-panel").forEach(p=>p.classList.add("hidden"));
    tab.classList.add("active");
    document.getElementById(`panel-${tab.dataset.tab}`).classList.remove("hidden");
    if (tab.dataset.tab==="actividad") loadActividad();
    if (tab.dataset.tab==="stats")     loadStats();
  });
});

async function initAdmin() {
  await Promise.all([loadAdminUsers(), loadAdminMatches()]);
}

// ============================================================
//  USUARIOS
// ============================================================
async function loadAdminUsers() {
  const snap  = await db.collection("users").orderBy("displayName").get();
  const tbody = document.getElementById("users-table-body");
  tbody.innerHTML = snap.docs.map(doc => {
    const u = doc.data();
    const dotStyle = `width:14px;height:14px;border-radius:50%;background:${u.avatarColor||"#D4A017"};display:inline-block;vertical-align:middle;margin-right:6px;border:1px solid rgba(255,255,255,.2)`;
    return `
    <tr>
      <td><span style="${dotStyle}"></span>${u.displayName||"-"}</td>
      <td><code>${u.username}</code></td>
      <td>${u.email}</td>
      <td><span class="badge ${u.isAdmin?"badge-admin":"badge-user"}">${u.isAdmin?"Admin":"Usuario"}</span></td>
      <td><span class="badge ${u.disabled?"badge-off":"badge-on"}">${u.disabled?"Inactivo":"Activo"}</span></td>
      <td>${u.totalPoints||0} pts</td>
      <td class="actions-cell">
        <button class="btn-sm btn-edit" onclick="editUser('${doc.id}')">Editar</button>
        <button class="btn-sm btn-reset" onclick="resetPass('${u.email}')">Reset</button>
      </td>
    </tr>`;
  }).join("");
}

document.getElementById("btn-new-user").addEventListener("click", () => {
  document.getElementById("user-modal").classList.remove("hidden");
  document.getElementById("modal-user-title").textContent = "Nuevo Usuario";
  document.getElementById("user-form").reset();
  document.getElementById("user-uid").value = "";
  renderColorPicker("user-color-picker", "#D4A017", "user-avatar-color");
});

document.getElementById("btn-cancel-user").addEventListener("click", () =>
  document.getElementById("user-modal").classList.add("hidden"));

document.getElementById("user-form").addEventListener("submit", async e => {
  e.preventDefault();
  const uid         = document.getElementById("user-uid").value;
  const displayName = document.getElementById("user-display-name").value.trim();
  const username    = document.getElementById("user-username").value.trim().toLowerCase();
  const email       = document.getElementById("user-email").value.trim();
  const password    = document.getElementById("user-password").value;
  const isAdmin     = document.getElementById("user-is-admin").checked;
  const disabled    = document.getElementById("user-disabled").checked;
  const avatarColor = document.getElementById("user-avatar-color").value || "#D4A017";

  try {
    if (!uid) {
      const adminEmail    = auth.currentUser.email;
      const adminPassword = prompt("Ingresa tu contrase\u00f1a de admin:");
      await auth.signInWithEmailAndPassword(adminEmail, adminPassword);
      const newUser = await auth.createUserWithEmailAndPassword(email, password || "Guarisma2026!");
      await db.collection("users").doc(newUser.user.uid).set({
        displayName, username, email, isAdmin, disabled, avatarColor,
        totalPoints:0, exactPredictions:0, resultPredictions:0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await auth.signInWithEmailAndPassword(adminEmail, adminPassword);
      showAdminToast("Usuario creado.", "success");
    } else {
      await db.collection("users").doc(uid).update({ displayName, username, isAdmin, disabled, avatarColor });
      showAdminToast("Usuario actualizado.", "success");
    }
    document.getElementById("user-modal").classList.add("hidden");
    await loadAdminUsers();
  } catch(err) { showAdminToast("Error: " + err.message, "error"); }
});

async function editUser(uid) {
  const doc  = await db.collection("users").doc(uid).get();
  const u    = doc.data();
  document.getElementById("user-modal").classList.remove("hidden");
  document.getElementById("modal-user-title").textContent = "Editar Usuario";
  document.getElementById("user-uid").value = uid;
  document.getElementById("user-display-name").value = u.displayName || "";
  document.getElementById("user-username").value = u.username || "";
  document.getElementById("user-email").value = u.email || "";
  document.getElementById("user-is-admin").checked = u.isAdmin || false;
  document.getElementById("user-disabled").checked = u.disabled || false;
  document.getElementById("user-password").value = "";
  renderColorPicker("user-color-picker", u.avatarColor||"#D4A017", "user-avatar-color");
}

async function resetPass(email) {
  if (!confirm(`\u00bfEnviar reset a ${email}?`)) return;
  try { await auth.sendPasswordResetEmail(email); showAdminToast("Reset enviado.", "success"); }
  catch(e) { showAdminToast("Error: "+e.message, "error"); }
}

// Color picker de avatares
function renderColorPicker(containerId, selected, hiddenId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = AVATAR_COLORS_ADMIN.map(c => `
    <div onclick="selectColor('${c}','${hiddenId}')"
      style="width:24px;height:24px;border-radius:50%;background:${c};cursor:pointer;
             border:2px solid ${c===selected?'#fff':'transparent'};transition:all .15s"
      data-color="${c}" id="cp-${c.replace('#','')}"></div>
  `).join("");
  document.getElementById(hiddenId).value = selected;
}

function selectColor(color, hiddenId) {
  document.querySelectorAll(`[data-color]`).forEach(el => {
    el.style.border = el.dataset.color===color ? "2px solid #fff" : "2px solid transparent";
  });
  document.getElementById(hiddenId).value = color;
}

// ============================================================
//  PARTIDOS
// ============================================================
async function loadAdminMatches() {
  const snap  = await db.collection("matches").orderBy("datetime").get();
  const tbody = document.getElementById("matches-table-body");
  tbody.innerHTML = snap.docs.map(doc => {
    const m = doc.data();
    const dtStr = m.datetime?.toDate
      ? m.datetime.toDate().toLocaleString("es-SV",{timeZone:"America/El_Salvador",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})
      : "-";
    const scoreStr = m.status==="finished" ? `${m.scoreHome}-${m.scoreAway}` : "-";
    const badge = {scheduled:"\uD83D\uDD52 Programado",live:"\uD83D\uDFE2 En vivo",finished:"\u2705 Finalizado"};
    return `
    <tr>
      <td>${dtStr}</td>
      <td>${m.home} vs ${m.away}</td>
      <td>Grupo ${m.group}</td>
      <td>${badge[m.status]||m.status}</td>
      <td>${scoreStr}</td>
      <td>
        <button class="btn-sm btn-edit" onclick="editMatch('${doc.id}')">Editar</button>
        ${m.status!=="finished"?`<button class="btn-sm btn-score" onclick="enterScore('${doc.id}','${m.home}','${m.away}')">Resultado</button>`:""}
      </td>
    </tr>`;
  }).join("");
}

document.getElementById("btn-new-match").addEventListener("click", () => {
  document.getElementById("match-modal").classList.remove("hidden");
  document.getElementById("match-form").reset();
  document.getElementById("match-uid").value = "";
});
document.getElementById("btn-cancel-match").addEventListener("click", () =>
  document.getElementById("match-modal").classList.add("hidden"));

document.getElementById("match-form").addEventListener("submit", async e => {
  e.preventDefault();
  const uid   = document.getElementById("match-uid").value;
  const home  = document.getElementById("match-home").value.trim();
  const away  = document.getElementById("match-away").value.trim();
  const group = document.getElementById("match-group").value.trim().toUpperCase();
  const stage = document.getElementById("match-stage").value;
  const dtVal = document.getElementById("match-datetime").value;
  if (!home||!away||!dtVal) { showAdminToast("Completa todos los campos.","error"); return; }
  const payload = {
    home, away, group, stage,
    datetime: firebase.firestore.Timestamp.fromDate(new Date(dtVal)),
    dateStr: dtVal.substring(0,10), timeStr: dtVal.substring(11,16),
    scoreHome:null, scoreAway:null, status:"scheduled"
  };
  try {
    if (!uid) { await db.collection("matches").add(payload); showAdminToast("Partido agregado.","success"); }
    else      { await db.collection("matches").doc(uid).update(payload); showAdminToast("Partido actualizado.","success"); }
    document.getElementById("match-modal").classList.add("hidden");
    await loadAdminMatches();
  } catch(err) { showAdminToast("Error: "+err.message,"error"); }
});

async function editMatch(matchId) {
  const doc = await db.collection("matches").doc(matchId).get();
  const m   = doc.data();
  const dt  = m.datetime.toDate();
  const pad = n => String(n).padStart(2,"0");
  document.getElementById("match-modal").classList.remove("hidden");
  document.getElementById("match-uid").value = matchId;
  document.getElementById("match-home").value = m.home;
  document.getElementById("match-away").value = m.away;
  document.getElementById("match-group").value = m.group;
  document.getElementById("match-stage").value = m.stage;
  document.getElementById("match-datetime").value =
    `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

async function enterScore(matchId, home, away) {
  const hs = parseInt(prompt(`Goles de ${home}:`));
  const as = parseInt(prompt(`Goles de ${away}:`));
  if (isNaN(hs)||isNaN(as)) { showAdminToast("Resultado inv\u00e1lido.","error"); return; }
  await db.collection("matches").doc(matchId).update({ scoreHome:hs, scoreAway:as, status:"finished" });
  showAdminToast("Resultado guardado. Calculando puntos...","success");
  // Recalcular puntos para este partido
  const pSnap = await db.collection("predictions").where("matchId","==",matchId).get();
  const batch = db.batch();
  const updates = {};
  pSnap.docs.forEach(pd => {
    const p = pd.data();
    const pts = calcPts({home:p.predictedHome,away:p.predictedAway},{home:hs,away:as});
    batch.update(pd.ref,{points:pts});
    updates[p.userId] = (updates[p.userId]||0) + pts;
  });
  await batch.commit();
  for (const [uid,pts] of Object.entries(updates)) {
    await db.collection("users").doc(uid).update({totalPoints:firebase.firestore.FieldValue.increment(pts)});
  }
  showAdminToast("Puntos actualizados.","success");
  await loadAdminMatches();
}

function calcPts(pred, actual) {
  if (pred.home===actual.home&&pred.away===actual.away) return 3;
  return Math.sign(pred.home-pred.away)===Math.sign(actual.home-actual.away) ? 1 : 0;
}

// ============================================================
//  ACTIVIDAD
// ============================================================
async function loadActividad() {
  const tbody = document.getElementById("actividad-table-body");
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:#888">Cargando\u2026</td></tr>`;

  const usersSnap   = await db.collection("users").where("disabled","==",false).get();
  const predsSnap   = await db.collection("predictions").get();
  const matchesSnap = await db.collection("matches").get();
  const totalM      = matchesSnap.size;

  const predCount = {};
  predsSnap.docs.forEach(d => {
    const uid = d.data().userId;
    predCount[uid] = (predCount[uid]||0) + 1;
  });

  const rows = usersSnap.docs.map(d => {
    const u = d.data();
    return { name:u.displayName||u.username, count:predCount[d.id]||0,
             points:u.totalPoints||0, color:u.avatarColor||"#D4A017" };
  }).sort((a,b)=>b.count-a.count||b.points-a.points);

  const activos = rows.filter(r=>r.count>0).length;
  document.getElementById("stat-act-total").textContent   = rows.length;
  document.getElementById("stat-act-activos").textContent = activos;
  document.getElementById("stat-act-inactivos").textContent = rows.length - activos;

  tbody.innerHTML = rows.map((r,i) => {
    const pct = totalM>0 ? Math.round((r.count/totalM)*100) : 0;
    const barColor = r.count===0 ? "#222" : pct>=50 ? "#D4A017" : "#457b9d";
    const badge = r.count===0
      ? `<span class="badge badge-off">Sin actividad</span>`
      : `<span class="badge badge-on">Activo</span>`;
    const init = r.name.charAt(0).toUpperCase();
    const light = isLight(r.color);
    return `
    <tr>
      <td style="color:#888;font-size:.8rem">${i+1}</td>
      <td>
        <div style="display:flex;align-items:center;gap:.5rem">
          <div style="width:26px;height:26px;border-radius:50%;background:${r.color};color:${light?"#000":"#fff"};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.8rem;flex-shrink:0">${init}</div>
          <strong>${r.name}</strong>
        </div>
      </td>
      <td style="text-align:center">
        <strong style="color:${r.count===0?"#888":"#fff"}">${r.count}</strong>
        <span style="color:#888;font-size:.75rem"> / ${totalM}</span>
      </td>
      <td>
        <div style="background:#1a1a1a;height:6px;border-radius:3px;overflow:hidden;width:100%;min-width:80px">
          <div style="background:${barColor};height:6px;width:${pct}%"></div>
        </div>
        <span style="font-size:.68rem;color:#888">${pct}%</span>
      </td>
      <td>${badge}</td>
    </tr>`;
  }).join("");
}

function isLight(hex) {
  try {
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return (r*299+g*587+b*114)/1000>128;
  } catch { return false; }
}

// ============================================================
//  STATS
// ============================================================
async function loadStats() {
  const u = await db.collection("users").where("disabled","==",false).get();
  const m = await db.collection("matches").where("status","==","finished").get();
  const p = await db.collection("predictions").get();
  document.getElementById("stat-users").textContent = u.size;
  document.getElementById("stat-matches-done").textContent = m.size;
  document.getElementById("stat-predictions").textContent = p.size;
  const sorted = u.docs.map(d=>d.data()).sort((a,b)=>(b.totalPoints||0)-(a.totalPoints||0));
  if (sorted.length)
    document.getElementById("stat-leader").textContent = `${sorted[0].displayName||sorted[0].username} (${sorted[0].totalPoints||0} pts)`;
}

// ============================================================
//  UTILS
// ============================================================
function showAdminToast(msg, type="info") {
  const t = document.getElementById("admin-toast");
  t.textContent=msg; t.className=`toast show ${type}`;
  setTimeout(()=>t.classList.remove("show"),3500);
}

document.getElementById("btn-admin-logout").addEventListener("click", () =>
  auth.signOut().then(()=>window.location.href="../index.html"));

// ============================================================
// طبيّة — app.js  v2.0
// Student app shell: lectures, profile, streak, settings
// Auth guard redirects admin → admin.html, teacher → teacher.html
// ============================================================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("sw.js").catch(() => {})
  );
}

let currentUser    = null;
let currentProfile = null;
let currentSubject = null;
let currentSubTab  = "lectures";

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

// ── Page / Nav stack ────────────────────────────────────────
let navStack = ["page-lectures"];

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => switchPage(btn.dataset.page));
});

function switchPage(pageId) {
  navStack = [pageId];
  renderActivePage(pageId, { pushHistory: true, reset: true });
  document.querySelectorAll(".nav-item").forEach(n =>
    n.classList.toggle("active", n.dataset.page === pageId));
  if (currentUser) Api.logActivity(currentUser.uid, "view_" + pageId);
}

function openSubpage(pageId) {
  navStack.push(pageId);
  renderActivePage(pageId, { pushHistory: true });
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
}

function goBack() {
  if (navStack.length > 1) {
    navStack.pop();
    const prev = navStack[navStack.length - 1];
    renderActivePage(prev, { pushHistory: false });
    document.querySelectorAll(".nav-item").forEach(n =>
      n.classList.toggle("active", n.dataset.page === prev));
  } else {
    switchPage("page-lectures");
  }
}

function renderActivePage(pageId, { pushHistory = false } = {}) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");
  if (pushHistory) history.pushState({ tibbiyaPage: pageId }, "", "#" + pageId);
}

document.querySelectorAll("[data-back]").forEach(btn =>
  btn.addEventListener("click", goBack)
);
window.addEventListener("popstate", () => {
  if (navStack.length > 1) {
    navStack.pop();
    const prev = navStack[navStack.length - 1];
    renderActivePage(prev, { pushHistory: false });
    document.querySelectorAll(".nav-item").forEach(n =>
      n.classList.toggle("active", n.dataset.page === prev));
  }
});

// ── Drawer ───────────────────────────────────────────────────
const drawer        = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawerOverlay");
const openDrawer  = () => { drawer.classList.add("open"); drawerOverlay.classList.add("open"); };
const closeDrawer = () => { drawer.classList.remove("open"); drawerOverlay.classList.remove("open"); };
document.getElementById("openDrawerBtn").addEventListener("click", openDrawer);
document.getElementById("closeDrawerBtn").addEventListener("click", closeDrawer);
drawerOverlay.addEventListener("click", closeDrawer);

document.querySelectorAll(".drawer-list [data-action]").forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    closeDrawer();
    const a = link.dataset.action;
    if (a === "settings")  return switchPage("page-settings");
    if (a === "support")   return switchPage("page-contact");
    if (a === "archive")   return openArchivePage();
    if (a === "downloads") return openDownloadsPage();
    if (a === "subs")      return openSubscriptionsPage();
    if (a === "qr")        return openQrPage();
  });
});

// ── Settings toggles ────────────────────────────────────────
document.querySelectorAll(".switch").forEach(sw =>
  sw.addEventListener("click", () => sw.classList.toggle("on"))
);
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await Auth.signOut();
  window.location.href = "index.html";
});

// ── QR banner ────────────────────────────────────────────────
document.getElementById("qrBanner").addEventListener("click", () => {
  openQrPage();
  if (currentUser) Api.logActivity(currentUser.uid, "qr_open");
});

// ── Profile edit modal ────────────────────────────────────────
const profileModal      = document.getElementById("profileModal");
const avatarEditPreview = document.getElementById("avatarEditPreview");
const avatarFileInput   = document.getElementById("avatarFileInput");
const avatarProgressTrack = document.getElementById("avatarProgressTrack");
const avatarProgressFill  = document.getElementById("avatarProgressFill");
let pendingAvatarFile = null;

function paintAvatarEverywhere(url, initial) {
  const img = document.getElementById("avatarImg");
  const fb  = document.getElementById("avatarFallback");
  if (url) {
    img.src = url;
    img.style.display = "block";
    fb.style.display  = "none";
  } else {
    img.style.display = "none";
    fb.style.display  = "flex";
    fb.textContent    = initial || "ط";
  }
  const da = document.getElementById("drawerAvatar");
  if (da) {
    da.style.backgroundImage = url ? `url(${url})` : "none";
    da.textContent = url ? "" : (initial || "ط");
  }
  if (avatarEditPreview) {
    avatarEditPreview.style.backgroundImage = url ? `url(${url})` : "none";
    avatarEditPreview.textContent = url ? "" : (initial || "ط");
  }
}

document.getElementById("editProfileBtn").addEventListener("click", () => {
  if (currentProfile) {
    document.getElementById("editNameInput").value = currentProfile.full_name || "";
  }
  profileModal.classList.add("open");
});
document.getElementById("profileModalClose").addEventListener("click", () =>
  profileModal.classList.remove("open")
);
document.getElementById("profileModalCancel").addEventListener("click", () =>
  profileModal.classList.remove("open")
);

document.getElementById("chooseAvatarBtn").addEventListener("click", () =>
  avatarFileInput.click()
);
avatarFileInput.addEventListener("change", () => {
  pendingAvatarFile = avatarFileInput.files[0] || null;
  if (pendingAvatarFile) {
    const url = URL.createObjectURL(pendingAvatarFile);
    avatarEditPreview.style.backgroundImage = `url(${url})`;
    avatarEditPreview.textContent = "";
  }
});

document.getElementById("saveNameBtn").addEventListener("click", async () => {
  if (!currentUser) return;
  const fullName = document.getElementById("editNameInput").value.trim();
  if (!fullName) { showToast("يرجى إدخال الاسم"); return; }
  try {
    if (pendingAvatarFile) {
      avatarProgressTrack.style.display = "block";
      const avatarUrl = await Api.uploadAvatar(currentUser.uid, pendingAvatarFile, pct => {
        avatarProgressFill.style.width = pct + "%";
      });
      paintAvatarEverywhere(avatarUrl, fullName[0]);
      avatarProgressTrack.style.display = "none";
      pendingAvatarFile = null;
    }
    await Api.updateProfile(currentUser.uid, { full_name: fullName });
    document.getElementById("profileName").textContent = fullName;
    document.getElementById("drawerName").textContent  = fullName;
    currentProfile.full_name = fullName;
    showToast("✅ تم حفظ التغييرات");
    profileModal.classList.remove("open");
  } catch (e) { showToast("خطأ: " + e.message); }
});

// Password change
document.getElementById("changePassBtn").addEventListener("click", async () => {
  const current = document.getElementById("currentPassInput").value;
  const next    = document.getElementById("newPassInput").value;
  const confirm = document.getElementById("confirmPassInput").value;
  const errEl   = document.getElementById("passError");
  errEl.textContent = "";
  if (!current || !next || !confirm) { errEl.textContent = "يرجى ملء جميع الحقول"; return; }
  if (next.length < 6) { errEl.textContent = "كلمة المرور يجب أن تكون 6 أحرف على الأقل"; return; }
  if (next !== confirm) { errEl.textContent = "كلمتا المرور غير متطابقتين"; return; }
  try {
    const { error } = await Auth.changePassword(current, next);
    if (error) throw error;
    showToast("✅ تم تغيير كلمة المرور");
    document.getElementById("currentPassInput").value = "";
    document.getElementById("newPassInput").value     = "";
    document.getElementById("confirmPassInput").value = "";
    profileModal.classList.remove("open");
  } catch (e) {
    errEl.textContent = e.code === "auth/wrong-password"
      ? "كلمة المرور الحالية غير صحيحة"
      : ("خطأ: " + e.message);
  }
});

// ── Welcome overlay ───────────────────────────────────────────
const welcomeOverlay = document.getElementById("welcomeOverlay");
document.getElementById("welcomeCloseBtn").addEventListener("click", async () => {
  welcomeOverlay.classList.remove("open");
  if (currentUser) {
    await Api.updateProfile(currentUser.uid, { welcomed: true });
  }
});

// ── Sub-pages ─────────────────────────────────────────────────
async function openArchivePage() {
  const el = document.getElementById("archiveContent");
  el.innerHTML = `<div class="empty-state"><div class="e-icon">📦</div><p class="e-title">لا توجد عناصر محفوظة</p><p class="e-sub">ستظهر المحاضرات والأسئلة المحفوظة هنا.</p></div>`;
  openSubpage("page-archive");
}

function openDownloadsPage() {
  document.getElementById("downloadsContent").innerHTML = `<div class="empty-state"><div class="e-icon">⬇️</div><p class="e-title">لا توجد تنزيلات حتى الآن</p><p class="e-sub">التنزيلات غير متاحة في المتصفح.</p></div>`;
  openSubpage("page-downloads");
}

function openSubscriptionsPage() {
  document.getElementById("subscriptionsContent").innerHTML = `
    <div class="plan-card">
      <p class="p-name">الخطة المجانية</p>
      <p class="p-desc">وصول كامل للمحاضرات والملازم المتاحة والرمز QR.</p>
    </div>`;
  openSubpage("page-subscriptions");
}

function openQrPage() {
  document.getElementById("qrContent").innerHTML = `
    <div class="qr-big-card">
      <div class="qr-square">▦</div>
      <p>اعرض هذا الرمز في المحاضرات الحضورية لتسجيل حضورك.</p>
    </div>`;
  openSubpage("page-qr");
}

// ── Subject Grid ──────────────────────────────────────────────
const TILE_COLORS = ["#14304A", "#3FA796", "#F4A340", "#C1440E"];
function renderSubjects(subjects) {
  const grid = document.getElementById("subjectGrid");
  grid.innerHTML = "";
  if (!subjects.length) {
    grid.innerHTML = `<div class="empty-state"><div class="e-icon">📚</div><p class="e-title">لا توجد مواد بعد</p></div>`;
    return;
  }
  subjects.forEach((s, i) => {
    const card = document.createElement("button");
    card.className = "subject-card";
    const col = s.color || TILE_COLORS[i % 4];
    card.innerHTML = `
      <div class="tile-icon" style="background:${col}22; color:${col}">${s.icon || "📘"}</div>
      <div class="tile-title">${s.title}</div>
      <div class="tile-meta">${s.lectureCount ?? 0} محاضرة</div>
    `;
    card.addEventListener("click", () => openSubjectDetail(s));
    grid.appendChild(card);
  });
}

// ── Subject Detail ────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])
  );
}

async function openSubjectDetail(subject) {
  currentSubject = subject;
  currentSubTab  = "lectures";
  document.getElementById("subjectDetailTitle").textContent = subject.title;
  document.getElementById("tabLectures").classList.add("active");
  document.getElementById("tabMaterials").classList.remove("active");
  openSubpage("page-subject-detail");
  if (currentUser) Api.logActivity(currentUser.uid, "lecture_view");
  await renderSubjectTab();
}

async function renderSubjectTab() {
  const el = document.getElementById("subjectDetailContent");
  if (!currentSubject) return;
  el.innerHTML = `<div class="empty-state"><div class="e-icon">⏳</div><p class="e-sub">جاري التحميل...</p></div>`;
  try {
    if (currentSubTab === "lectures") {
      const lectures = await Api.getLectures(currentSubject.id);
      if (!lectures.length) {
        el.innerHTML = `<div class="empty-state"><div class="e-icon">🎬</div><p class="e-title">لا توجد محاضرات بعد</p><p class="e-sub">ستُضاف محاضرات "${escHtml(currentSubject.title)}" قريباً.</p></div>`;
        return;
      }
      el.innerHTML = `<div class="lecture-list">` + lectures.map(l => `
        <a class="lecture-item" href="${l.youtube_url ? escHtml(l.youtube_url) : (l.file_url ? escHtml(l.file_url) : "#")}" target="_blank" rel="noopener noreferrer">
          <div class="l-icon">🎬</div>
          <div>
            <p class="l-title">${escHtml(l.title)}</p>
            <p class="l-meta">${l.youtube_url ? "YouTube" : (l.file_url ? "ملف فيديو" : "")}</p>
          </div>
        </a>`).join("") + `</div>`;
    } else {
      const materials = await Api.getMaterials(currentSubject.id);
      if (!materials.length) {
        el.innerHTML = `<div class="empty-state"><div class="e-icon">📄</div><p class="e-title">لا توجد ملازم بعد</p><p class="e-sub">ستُضاف ملازم "${escHtml(currentSubject.title)}" قريباً.</p></div>`;
        return;
      }
      el.innerHTML = `<div class="lecture-list">` + materials.map(m => `
        <a class="material-item" href="${m.file_url ? escHtml(m.file_url) : "#"}" target="_blank" rel="noopener noreferrer">
          <div class="l-icon">📄</div>
          <div>
            <p class="l-title">${escHtml(m.title)}</p>
            <p class="l-meta">PDF</p>
          </div>
          <span class="dl-arrow">⬇️</span>
        </a>`).join("") + `</div>`;
    }
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><div class="e-icon">⚠️</div><p class="e-title">خطأ في التحميل</p></div>`;
  }
}

document.getElementById("tabLectures").addEventListener("click", () => {
  currentSubTab = "lectures";
  document.getElementById("tabLectures").classList.add("active");
  document.getElementById("tabMaterials").classList.remove("active");
  renderSubjectTab();
});
document.getElementById("tabMaterials").addEventListener("click", () => {
  currentSubTab = "materials";
  document.getElementById("tabMaterials").classList.add("active");
  document.getElementById("tabLectures").classList.remove("active");
  renderSubjectTab();
});

// ── Streak ring ───────────────────────────────────────────────
function paintStreakRing(current) {
  const ring = document.getElementById("streakRing");
  if (!ring) return;
  const capped = Math.min(current, 30);
  ring.style.strokeDashoffset = 364 - (capped / 30) * 364;
}

// ── Bootstrap (Auth Guard) ────────────────────────────────────
async function bootstrap() {
  await new Promise(r => setTimeout(r, 300));
  if (!window.Auth) { window.location.href = "index.html"; return; }

  const user = await new Promise(resolve =>
    window.Auth.onAuthStateChanged(u => resolve(u))
  );
  if (!user) { window.location.href = "index.html"; return; }

  currentUser = user;

  const profile = await Api.getProfile(user.uid);
  currentProfile = profile;

  // Role-based redirect
  if (profile?.role === "admin")   { window.location.href = "admin.html";   return; }
  if (profile?.role === "teacher") { window.location.href = "teacher.html"; return; }

  if (profile) {
    document.getElementById("profileName").textContent    = profile.full_name || "طالب";
    document.getElementById("profileUsername").textContent = "@" + (profile.username || "");
    document.getElementById("drawerName").textContent     = profile.full_name || "طالب";
    const initial = (profile.full_name || "ط")[0];
    paintAvatarEverywhere(profile.avatar_url, initial);

    if (profile.welcomed === false) {
      document.getElementById("welcomeName").textContent = `مرحباً ${profile.full_name || "بك"}!`;
      welcomeOverlay.classList.add("open");
    }
  }

  // Streak
  try {
    const streak = await Api.getStreak(user.uid);
    document.getElementById("currentStreak").textContent = streak.current_streak ?? 0;
    document.getElementById("longestStreak").textContent = streak.longest_streak ?? 0;
    paintStreakRing(streak.current_streak ?? 0);
  } catch (_) {}

  // Log activity
  try { await Api.logActivity(user.uid, "login"); } catch (_) {}

  // Load subjects
  try {
    const subjects = await Api.getSubjectsWithLectureCounts();
    renderSubjects(subjects);
  } catch (_) {}
}

bootstrap();

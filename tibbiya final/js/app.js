// ============================================================
// طبيّة — app.js
// Powers app.html: student home (subjects grid) + the
// lectures/materials modal for a selected subject.
// ============================================================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

let currentUser = null;
let currentProfile = null;
let currentSubject = null;

function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = "toast show " + type;
  setTimeout(() => t.classList.remove("show"), 2600);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- subjects grid ----------
const TILE_COLORS = ["#14304A", "#3FA796", "#F4A340", "#C1440E"];
function renderSubjects(subjects) {
  const grid = document.getElementById("subjectsGrid");
  grid.innerHTML = "";
  if (!subjects.length) {
    grid.innerHTML = `<div class="empty-state">
      <div class="e-icon">📚</div>
      <p class="e-title">لا توجد مواد بعد</p>
      <p class="e-sub">راح تظهر المواد الدراسية هنا أول ما تضيفها الإدارة.</p>
    </div>`;
    return;
  }
  subjects.forEach((s, i) => {
    const card = document.createElement("button");
    card.className = "subject-card";
    card.innerHTML = `
      <div class="tile-icon" style="background:${escapeHtml(s.color || TILE_COLORS[i % 4])}22; color:${escapeHtml(s.color || TILE_COLORS[i % 4])}">
        ${escapeHtml(s.icon || "📘")}
      </div>
      <div class="tile-title">${escapeHtml(s.title)}</div>
      <div class="tile-meta">${s.lectureCount ?? 0} محاضرة · ${s.materialCount ?? 0} ملزمة</div>
    `;
    card.addEventListener("click", () => openSubjectModal(s));
    grid.appendChild(card);
  });
}

// ---------- subject modal (المحاضرات / الملازم) ----------
const subjectModal = document.getElementById("subjectModal");
const modalTitle = document.getElementById("modalTitle");

function switchModalTab(tabId) {
  document.querySelectorAll(".admin-tab[data-msubtab]").forEach((b) => b.classList.toggle("active", b.dataset.msubtab === tabId));
  document.querySelectorAll(".modal-body.admin-subtab").forEach((p) => p.classList.toggle("active", p.id === tabId));
}
document.querySelectorAll(".admin-tab[data-msubtab]").forEach((btn) => {
  btn.addEventListener("click", () => switchModalTab(btn.dataset.msubtab));
});

function contentLink(item) {
  return item.file_url || item.youtube_url || item.url || "#";
}

async function openSubjectModal(subject) {
  currentSubject = subject;
  modalTitle.textContent = subject.title;
  switchModalTab("sub-lec");
  subjectModal.style.display = "flex";

  const lecEl = document.getElementById("modalLecturesList");
  const matEl = document.getElementById("modalMaterialsList");
  lecEl.innerHTML = `<div class="admin-loading">جاري التحميل...</div>`;
  matEl.innerHTML = `<div class="admin-loading">جاري التحميل...</div>`;

  if (currentUser) window.Api.logActivity(currentUser.id, "subject_open", subject.id);

  try {
    const [lectures, materials] = await Promise.all([
      window.Api.getLecturesForSubject(subject.id),
      window.Api.getMaterialsForSubject(subject.id)
    ]);

    lecEl.innerHTML = lectures.length
      ? `<div class="lecture-list">${lectures.map((l) => `
          <a class="lecture-item" href="${escapeHtml(contentLink(l))}" target="_blank" rel="noopener">
            <div class="l-icon">🎬</div>
            <div><p class="l-title">${escapeHtml(l.title) || "محاضرة"}</p><p class="l-meta">فيديو</p></div>
          </a>`).join("")}</div>`
      : `<div class="empty-state"><div class="e-icon">📘</div><p class="e-title">لا توجد محاضرات بعد</p><p class="e-sub">راح تظهر هنا أول ما يرفعها الأستاذ.</p></div>`;

    matEl.innerHTML = materials.length
      ? `<div class="lecture-list">${materials.map((m) => `
          <a class="material-item" href="${escapeHtml(contentLink(m))}" target="_blank" rel="noopener">
            <div class="l-icon">📑</div>
            <div><p class="l-title">${escapeHtml(m.title) || "ملزمة"}</p><p class="l-meta">PDF</p></div>
            <span class="dl-arrow">⬇</span>
          </a>`).join("")}</div>`
      : `<div class="empty-state"><div class="e-icon">📑</div><p class="e-title">لا توجد ملازم بعد</p><p class="e-sub">راح تظهر هنا أول ما يرفعها الأستاذ.</p></div>`;
  } catch (e) {
    lecEl.innerHTML = `<div class="admin-error">تعذر تحميل المحتوى</div>`;
    matEl.innerHTML = `<div class="admin-error">تعذر تحميل المحتوى</div>`;
  }
}

function closeSubjectModal() {
  subjectModal.style.display = "none";
  currentSubject = null;
}
document.getElementById("closeModal").addEventListener("click", closeSubjectModal);
subjectModal.addEventListener("click", (e) => { if (e.target === subjectModal) closeSubjectModal(); });

// ---------- header: user avatar / name / logout ----------
function paintUser(profile) {
  const nameEl = document.getElementById("userName");
  const avatarEl = document.getElementById("userAvatar");
  const welcomeEl = document.getElementById("welcomeText");
  const initial = (profile.full_name || "ط").trim().charAt(0);

  nameEl.textContent = profile.full_name || "طالب";
  welcomeEl.textContent = `مرحباً بك، ${profile.full_name || "بيك"}! 👋`;

  if (profile.avatar_url) {
    avatarEl.innerHTML = `<img src="${escapeHtml(profile.avatar_url)}" alt="">`;
  } else {
    avatarEl.textContent = initial;
  }
}

document.getElementById("btnLogout").addEventListener("click", async () => {
  await window.Auth.signOut();
  window.location.href = "index.html";
});

// ---------- bootstrap ----------
async function bootstrap() {
  currentUser = await window.Auth.getUser();
  if (!currentUser) {
    window.location.href = "index.html";
    return;
  }

  const profile = await window.Api.getProfile(currentUser.id);
  currentProfile = profile;
  if (!profile) {
    showToast("تعذر تحميل بيانات الحساب", "error");
    return;
  }

  // Teachers/admins landing on app.html are redirected to their own dashboards.
  if (profile.role === "admin") { window.location.href = "admin.html"; return; }
  if (profile.role === "teacher") { window.location.href = "teacher.html"; return; }

  paintUser(profile);
  window.Api.logActivity(currentUser.id, "login");

  document.getElementById("authGuard").style.display = "none";
  document.getElementById("appShell").style.display = "block";

  try {
    const subjects = await window.Api.getSubjectsWithLectureCounts();
    renderSubjects(subjects);
  } catch (e) {
    document.getElementById("subjectsGrid").innerHTML = `<div class="admin-error">تعذر تحميل المواد</div>`;
  }
}

if (window.Api && window.Auth) {
  bootstrap();
} else {
  window.addEventListener("firebase-ready", bootstrap, { once: true });
}

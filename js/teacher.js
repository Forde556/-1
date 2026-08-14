// ============================================================
// طبيّة | لوحة الاستاذ — teacher.js
// Publishing side of "قسم الملازم": pick a subject, publish a video
// lecture or a ملزمة (PDF), see/delete what's already published.
// Guarded client-side by profile.role — and again server-side by
// firestore.rules / storage.rules, so this page is safe even if
// someone bypasses the UI check.
// ============================================================

let currentUser = null;
let subjects = [];
let selectedSubjectId = null;

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- file-drop labels (video + PDF) ----------
function wireFileDrop(dropId, inputId, acceptLabel) {
  const drop = document.getElementById(dropId);
  const input = document.getElementById(inputId);
  input.addEventListener("change", () => {
    if (input.files[0]) {
      drop.classList.add("has-file");
      drop.childNodes[0].textContent = `📎 ${input.files[0].name}`;
    } else {
      drop.classList.remove("has-file");
      drop.childNodes[0].textContent = acceptLabel;
    }
  });
}
wireFileDrop("lecDrop", "lecFile", "📎 اختياري: اختر ملف فيديو من جهازك ليُرفع مباشرة");
wireFileDrop("matDrop", "matFile", "📎 اختر ملف PDF ليُرفع مباشرة");

// ---------- subject picker ----------
async function loadSubjects() {
  subjects = await Api.getSubjectsWithLectureCounts();
  const select = document.getElementById("subjectSelect");
  if (!subjects.length) {
    select.innerHTML = `<option>لا توجد مواد مضافة بعد — أضفها من Firestore</option>`;
    return;
  }
  select.innerHTML = subjects.map(s => `<option value="${s.id}">${escapeHtml(s.icon || "📘")} ${escapeHtml(s.title)}</option>`).join("");
  selectedSubjectId = subjects[0].id;
  await loadContentList();
}
document.getElementById("subjectSelect").addEventListener("change", async (e) => {
  selectedSubjectId = e.target.value;
  await loadContentList();
});

// ---------- manage list for the selected subject ----------
async function loadContentList() {
  const el = document.getElementById("contentManageList");
  if (!selectedSubjectId) return;
  el.innerHTML = `<div class="empty-state"><div class="e-icon">⏳</div><p class="e-sub">جاري التحميل...</p></div>`;
  const items = await Api.getAllContentForSubject(selectedSubjectId);
  if (!items.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="e-icon">📭</div>
      <p class="e-title">لا يوجد محتوى منشور لهذه المادة بعد</p>
      <p class="e-sub">أضف محاضرة أو ملزمة من الأعلى وتظهر هنا فورًا.</p>
    </div>`;
    return;
  }
  el.innerHTML = items.map(it => `
    <div class="content-row">
      <div class="c-type">${it.content_type === "note" ? "📑" : "🎬"}</div>
      <div class="c-info">
        <p class="c-title">${escapeHtml(it.title)}</p>
        <p class="c-meta">${it.content_type === "note" ? "ملزمة" : "محاضرة"} ${it.lecture_number ?? ""}</p>
      </div>
      <button class="c-delete" data-id="${it.id}" data-path="${it.file_path || ""}" aria-label="حذف">🗑️</button>
    </div>
  `).join("");
  el.querySelectorAll(".c-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("حذف هذا العنصر نهائيًا؟")) return;
      btn.disabled = true;
      await Api.deleteContent(btn.dataset.id, btn.dataset.path || null);
      showToast("تم الحذف");
      loadContentList();
    });
  });
}

// ---------- publish a video lecture ----------
document.getElementById("lecSubmitBtn").addEventListener("click", async () => {
  const title = document.getElementById("lecTitle").value.trim();
  const number = document.getElementById("lecNumber").value;
  const url = document.getElementById("lecUrl").value.trim();
  const file = document.getElementById("lecFile").files[0];

  if (!selectedSubjectId) return showToast("اختر مادة أولاً");
  if (!title) return showToast("اكتب عنوان المحاضرة");
  if (!url && !file) return showToast("ضع رابط فيديو أو اختر ملف");

  const btn = document.getElementById("lecSubmitBtn");
  btn.disabled = true;
  try {
    let finalUrl = url, filePath = null;
    if (file) {
      const track = document.getElementById("lecProgressTrack");
      const fill = document.getElementById("lecProgressFill");
      track.classList.add("show");
      const path = `materials/${selectedSubjectId}/${Date.now()}_${file.name}`;
      const res = await Api.uploadFile(path, file, (pct) => { fill.style.width = pct + "%"; });
      finalUrl = res.url; filePath = res.path;
      track.classList.remove("show"); fill.style.width = "0%";
    }
    await Api.addContent(selectedSubjectId, {
      title, lecture_number: number, content_type: "video", url: finalUrl, file_path: filePath
    });
    document.getElementById("lecTitle").value = "";
    document.getElementById("lecNumber").value = "";
    document.getElementById("lecUrl").value = "";
    document.getElementById("lecFile").value = "";
    document.getElementById("lecDrop").classList.remove("has-file");
    document.getElementById("lecDrop").childNodes[0].textContent = "📎 اختياري: اختر ملف فيديو من جهازك ليُرفع مباشرة";
    showToast("تم نشر المحاضرة ✅");
    loadContentList();
  } catch (err) {
    showToast("تعذّر النشر، حاول مجددًا");
  } finally {
    btn.disabled = false;
  }
});

// ---------- publish a ملزمة (PDF) ----------
document.getElementById("matSubmitBtn").addEventListener("click", async () => {
  const title = document.getElementById("matTitle").value.trim();
  const number = document.getElementById("matNumber").value;
  const url = document.getElementById("matUrl").value.trim();
  const file = document.getElementById("matFile").files[0];

  if (!selectedSubjectId) return showToast("اختر مادة أولاً");
  if (!title) return showToast("اكتب عنوان الملزمة");
  if (!url && !file) return showToast("ضع رابط ملف أو اختر PDF");

  const btn = document.getElementById("matSubmitBtn");
  btn.disabled = true;
  try {
    let finalUrl = url, filePath = null;
    if (file) {
      const track = document.getElementById("matProgressTrack");
      const fill = document.getElementById("matProgressFill");
      track.classList.add("show");
      const path = `materials/${selectedSubjectId}/${Date.now()}_${file.name}`;
      const res = await Api.uploadFile(path, file, (pct) => { fill.style.width = pct + "%"; });
      finalUrl = res.url; filePath = res.path;
      track.classList.remove("show"); fill.style.width = "0%";
    }
    await Api.addContent(selectedSubjectId, {
      title, lecture_number: number, content_type: "note", url: finalUrl, file_path: filePath
    });
    document.getElementById("matTitle").value = "";
    document.getElementById("matNumber").value = "";
    document.getElementById("matUrl").value = "";
    document.getElementById("matFile").value = "";
    document.getElementById("matDrop").classList.remove("has-file");
    document.getElementById("matDrop").childNodes[0].textContent = "📎 اختر ملف PDF ليُرفع مباشرة";
    showToast("تم نشر الملزمة ✅");
    loadContentList();
  } catch (err) {
    showToast("تعذّر النشر، حاول مجددًا");
  } finally {
    btn.disabled = false;
  }
});

// ---------- boot: guard by role, then load everything ----------
async function bootstrap() {
  currentUser = await Auth.getUser();
  if (!currentUser) {
    window.location.href = "index.html";
    return;
  }
  const profile = await Api.getProfile(currentUser.id);
  if (!profile || profile.role !== "teacher") {
    document.getElementById("teacherGuard").style.display = "block";
    return;
  }
  document.getElementById("teacherShell").style.display = "block";
  await loadSubjects();
}

bootstrap();

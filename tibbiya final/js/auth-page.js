// ============================================================
// طبيّة — auth-page.js
// Powers index.html: tab switching (دخول / حساب طالب / انضم كأستاذ),
// email+password sign-in / sign-up, teacher-request submission,
// role-based redirect, and the live "registered students" counter.
// ============================================================

function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = "toast show " + type;
  setTimeout(() => t.classList.remove("show"), 3000);
}

const ERROR_MESSAGES = {
  "auth/email-already-in-use": "البريد الإلكتروني مستخدم بالفعل",
  "auth/invalid-email": "البريد الإلكتروني غير صحيح",
  "auth/weak-password": "كلمة المرور ضعيفة جداً",
  "auth/user-not-found": "لا يوجد حساب بهذا البريد الإلكتروني",
  "auth/wrong-password": "كلمة المرور غير صحيحة",
  "auth/invalid-credential": "البريد الإلكتروني أو كلمة المرور غير صحيحة",
  "auth/too-many-requests": "محاولات كثيرة جداً — حاول لاحقاً"
};
function friendlyError(err) {
  if (!err) return "حدث خطأ غير متوقع";
  return ERROR_MESSAGES[err.code] || err.message || "حدث خطأ غير متوقع";
}

// ---------- tab switching ----------
const tabs = document.querySelectorAll(".auth-tab");
const forms = {
  login: document.getElementById("form-login"),
  student: document.getElementById("form-student"),
  teacher: document.getElementById("form-teacher")
};
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    Object.entries(forms).forEach(([key, form]) => {
      form.style.display = key === tab.dataset.tab ? "block" : "none";
    });
  });
});

// ---------- redirect helper: send a signed-in user to the right home ----------
async function routeUser(uid) {
  const profile = await window.Api.getProfile(uid);
  if (profile?.role === "admin") return (window.location.href = "admin.html");
  if (profile?.role === "teacher") return (window.location.href = "teacher.html");
  return (window.location.href = "app.html");
}

// ---------- login ----------
document.getElementById("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("lEmail").value.trim();
  const password = document.getElementById("lPass").value;
  const btn = document.getElementById("btnLogin");

  if (!email || !password) return showToast("يرجى ملء جميع الحقول", "error");

  btn.disabled = true; btn.textContent = "جاري الدخول...";
  const { data, error } = await window.Auth.signInWithEmail(email, password);
  if (error) {
    showToast(friendlyError(error), "error");
    btn.disabled = false; btn.textContent = "دخول";
    return;
  }
  await routeUser(data.user.uid);
});

// ---------- student sign-up ----------
document.getElementById("form-student").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fullName = document.getElementById("sName").value.trim();
  const email = document.getElementById("sEmail").value.trim();
  const password = document.getElementById("sPass").value;
  const terms = document.getElementById("sTerms").checked;
  const btn = document.getElementById("btnStudent");

  if (!fullName || !email || !password) return showToast("يرجى ملء جميع الحقول", "error");
  if (password.length < 6) return showToast("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "error");
  if (!terms) return showToast("يجب الموافقة على شروط الاستخدام", "error");

  btn.disabled = true; btn.textContent = "جاري إنشاء الحساب...";
  const username = "user_" + Math.random().toString(36).slice(2, 8);
  const { data, error } = await window.Auth.signUpWithEmail(email, password, fullName, username);
  if (error) {
    showToast(friendlyError(error), "error");
    btn.disabled = false; btn.textContent = "إنشاء حساب طالب";
    return;
  }
  window.location.href = "app.html";
  void data;
});

// ---------- teacher join request ----------
document.getElementById("form-teacher").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fullName = document.getElementById("tName").value.trim();
  const email = document.getElementById("tEmail").value.trim();
  const password = document.getElementById("tPass").value;
  const specialty = document.getElementById("tSpecialty").value.trim();
  const terms = document.getElementById("tTerms").checked;
  const btn = document.getElementById("btnTeacher");

  if (!fullName || !email || !password || !specialty) return showToast("يرجى ملء جميع الحقول", "error");
  if (password.length < 6) return showToast("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "error");
  if (!terms) return showToast("يجب الموافقة على شروط الاستخدام", "error");

  btn.disabled = true; btn.textContent = "جاري الإرسال...";
  try {
    const { data, error } = await window.Auth.signUpWithEmail(email, password, fullName, "");
    if (error) throw error;

    await window.Api.submitTeacherRequest(data.user.uid, { full_name: fullName, email, specialty, bio: "" });
    await window.Auth.signOut();

    document.getElementById("form-teacher").querySelectorAll("input, button[type=submit]").forEach((el) => (el.style.display = "none"));
    document.getElementById("teacherSuccess").style.display = "block";
    showToast("✅ تم إرسال طلبك بنجاح", "success");
  } catch (error) {
    showToast(friendlyError(error), "error");
    btn.disabled = false; btn.textContent = "إرسال طلب الانضمام";
  }
});

// ---------- if already signed in, skip straight to the right home ----------
function bootstrapAuthCheck() {
  window.Auth.getUser().then((user) => {
    if (user) routeUser(user.id);
  });
}
if (window.Api && window.Auth) {
  bootstrapAuthCheck();
} else {
  window.addEventListener("firebase-ready", bootstrapAuthCheck, { once: true });
}

// ---------- live "registered students" counter ----------
function animateCount(el, target) {
  const duration = 900;
  const startTime = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - startTime) / duration);
    const val = Math.round(target * p);
    el.textContent = `${val.toLocaleString("ar")} طالب مسجّل بالمنصة`;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

async function loadStudentCounter() {
  const el = document.getElementById("liveCounterText");
  if (!el || !window.Api) return;
  const count = await window.Api.getStudentCount();
  animateCount(el, count);
}

if (window.Api) {
  loadStudentCounter();
} else {
  window.addEventListener("firebase-ready", loadStudentCounter, { once: true });
}

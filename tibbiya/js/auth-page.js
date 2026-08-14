// ============================================================
// طبيّة — auth-page.js  v2.0
// Email + Password ONLY — no Google / Apple
// ============================================================

function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show " + type;
  setTimeout(() => t.classList.remove("show"), 3000);
}

// ── Redirect if already logged in ──────────────────────────
window.__authUnsub = null;
function waitForAuth() {
  return new Promise(resolve => {
    // Auth is exposed globally from firebase-client.js
    const unsub = window.Auth
      ? window.Auth.onAuthStateChanged(user => { unsub(); resolve(user); })
      : null;
    if (!unsub) resolve(null); // fallback
  });
}

(async () => {
  // Small delay to let firebase-client module initialise
  await new Promise(r => setTimeout(r, 200));
  if (!window.Auth) return;

  const user = await waitForAuth();
  if (user) {
    // Check role & redirect accordingly
    const profile = await window.Api.getProfile(user.uid);
    const role = profile?.role || "student";
    if (role === "admin")   { window.location.href = "admin.html";   return; }
    if (role === "teacher") { window.location.href = "teacher.html"; return; }
    window.location.href = "app.html";
  }
})();

// ── Student counter ─────────────────────────────────────────
(async () => {
  await new Promise(r => setTimeout(r, 300));
  if (!window.Api) return;
  try {
    const count = await window.Api.getStudentCount();
    const el = document.getElementById("counterNum");
    if (el) el.textContent = count.toLocaleString("ar");
  } catch (_) {}
})();

// ── Mode toggling (login ↔ register) ────────────────────────
const nameFields    = document.getElementById("nameFields");
const usernameField = document.getElementById("usernameField");
const emailSubmit   = document.getElementById("emailSubmit");
const toggleModeBtn = document.getElementById("toggleMode");
const eyeBtn        = document.getElementById("eyeBtn");
const passwordInput = document.getElementById("passwordInput");
let isRegisterMode  = false;

function setMode(register) {
  isRegisterMode = register;
  nameFields.style.display    = register ? "block" : "none";
  usernameField.style.display = register ? "block" : "none";
  emailSubmit.textContent     = register ? "إنشاء الحساب" : "دخول";
  toggleModeBtn.textContent   = register
    ? "لديك حساب؟ سجّل الدخول"
    : "ليس لديك حساب؟ أنشئ حساباً جديداً";
  document.getElementById("passwordInput").autocomplete =
    register ? "new-password" : "current-password";
}

toggleModeBtn.addEventListener("click", () => setMode(!isRegisterMode));

// ── Password visibility ──────────────────────────────────────
eyeBtn.addEventListener("click", () => {
  const isPass = passwordInput.type === "password";
  passwordInput.type = isPass ? "text" : "password";
  eyeBtn.textContent = isPass ? "🙈" : "👁️";
});

// ── Form submit ──────────────────────────────────────────────
document.getElementById("emailForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!window.Auth) { showToast("جاري التحميل... حاول مجدداً", "error"); return; }

  const email    = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value;
  const btn      = document.getElementById("emailSubmit");

  if (!email || !password) {
    showToast("يرجى ملء جميع الحقول", "error");
    return;
  }
  if (password.length < 6) {
    showToast("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "error");
    return;
  }

  btn.disabled    = true;
  btn.textContent = "جاري...";

  try {
    if (isRegisterMode) {
      // ── Register ──────────────────────────────────────────
      const fullName = document.getElementById("fullName").value.trim();
      const username = document.getElementById("username").value.trim();
      if (!fullName) { showToast("يرجى إدخال الاسم الكامل", "error"); return; }

      const { data, error } = await window.Auth.signUpWithEmail(email, password, fullName, username);
      if (error) throw error;

      showToast("✅ تم إنشاء الحساب بنجاح");
      setTimeout(() => { window.location.href = "app.html"; }, 800);

    } else {
      // ── Login ─────────────────────────────────────────────
      const { data, error } = await window.Auth.signInWithEmail(email, password);
      if (error) throw error;

      const profile = await window.Api.getProfile(data.user.uid);
      const role    = profile?.role || "student";

      showToast("✅ مرحباً بك!");
      setTimeout(() => {
        if (role === "admin")   { window.location.href = "admin.html";   return; }
        if (role === "teacher") { window.location.href = "teacher.html"; return; }
        window.location.href = "app.html";
      }, 600);
    }
  } catch (err) {
    const msgs = {
      "auth/wrong-password":      "كلمة المرور غير صحيحة",
      "auth/user-not-found":      "البريد الإلكتروني غير مسجّل",
      "auth/invalid-email":       "البريد الإلكتروني غير صحيح",
      "auth/email-already-in-use":"البريد الإلكتروني مستخدم بالفعل",
      "auth/too-many-requests":   "محاولات كثيرة — حاول لاحقاً",
      "auth/invalid-credential":  "البريد أو كلمة المرور غير صحيحة"
    };
    showToast(msgs[err.code] || ("خطأ: " + err.message), "error");
  } finally {
    btn.disabled    = false;
    btn.textContent = isRegisterMode ? "إنشاء الحساب" : "دخول";
  }
});

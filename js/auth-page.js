function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

const providerButtons = document.getElementById("providerButtons");
const emailForm = document.getElementById("emailForm");
const nameFields = document.getElementById("nameFields");
const emailSubmit = document.getElementById("emailSubmit");
const toggleModeBtn = document.getElementById("toggleMode");
let isRegisterMode = false;

function setMode(register) {
  isRegisterMode = register;
  nameFields.style.display = register ? "block" : "none";
  emailSubmit.textContent = register ? "إنشاء الحساب" : "دخول";
  toggleModeBtn.textContent = register
    ? "لديك حساب؟ سجّل الدخول"
    : "ليس لديك حساب؟ أنشئ حساب جديد";
}

function openEmailForm(register = false) {
  providerButtons.style.display = "none";
  emailForm.style.display = "block";
  setMode(register);
}

document.getElementById("btnEmail").addEventListener("click", () => openEmailForm(false));
document.getElementById("openCreate").addEventListener("click", (e) => {
  e.preventDefault();
  openEmailForm(true);
});
document.getElementById("toggleMode").addEventListener("click", () => setMode(!isRegisterMode));
document.getElementById("backToProviders").addEventListener("click", () => {
  emailForm.style.display = "none";
  providerButtons.style.display = "block";
});

document.getElementById("btnGoogle").addEventListener("click", async () => {
  const { error } = await Auth.signInWithGoogle();
  if (error) showToast("تعذّر الدخول عبر Google");
});

document.getElementById("btnApple").addEventListener("click", async () => {
  const { error } = await Auth.signInWithApple();
  if (error) showToast("تعذّر الدخول عبر Apple");
});

document.getElementById("btnWhatsapp").addEventListener("click", async () => {
  const phone = prompt("أدخل رقم الواتساب مع رمز الدولة (مثال: 9647xxxxxxxx):");
  if (!phone) return;
  const { error } = await Auth.requestWhatsAppOtp(phone);
  if (error) return showToast("تعذّر إرسال رمز التحقق");
  const code = prompt("أدخل رمز التحقق المرسل عبر واتساب:");
  if (!code) return;
  const { error: verifyErr } = await Auth.verifyWhatsAppOtp(phone, code);
  if (verifyErr) return showToast("رمز التحقق غير صحيح");
  window.location.href = "app.html";
});

emailForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passInput").value;
  const fullName = document.getElementById("nameInput").value.trim();

  if (isRegisterMode) {
    const username = "user_" + Math.random().toString(36).slice(2, 8);
    const { error } = await Auth.signUpWithEmail(email, password, fullName || "طالب جديد", username);
    if (error) return showToast(error.message);
    showToast("تم إنشاء الحساب! تحقق من بريدك للتأكيد.");
  } else {
    const { error } = await Auth.signInWithEmail(email, password);
    if (error) return showToast(error.message);
    window.location.href = "app.html";
  }
});

// If already signed in, skip straight to the app
Auth.getUser().then(user => {
  if (user) window.location.href = "app.html";
});

// ---------- live "registered students" counter ----------
// Reads the public meta/stats.studentCount doc (see firestore.rules —
// it's the one doc readable without being signed in) and animates it
// counting up so the number feels alive rather than just printed.
function animateCount(el, target) {
  const start = 0;
  const duration = 900;
  const startTime = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - startTime) / duration);
    el.textContent = Math.round(start + (target - start) * p).toLocaleString("ar");
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

async function loadStudentCounter() {
  const el = document.getElementById("studentCountNum");
  if (!el || !window.Api) return;
  const count = await Api.getStudentCount();
  animateCount(el, count);
}

if (window.Api) {
  loadStudentCounter();
} else {
  window.addEventListener("firebase-ready", loadStudentCounter, { once: true });
}

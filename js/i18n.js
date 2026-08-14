// Minimal AR/EN dictionary. Extend freely — every translatable
// string in the UI carries a data-i18n="key" attribute.
const I18N = {
  ar: {
    welcome: "أهلاً بعودتك!",
    subtitle: "سجّل دخولك لمتابعة محاضراتك وتفاعلك اليومي في طبيّة.",
    viaWhatsapp: "دخول عن طريق الواتساب",
    viaGoogle: "دخول عن طريق Google",
    viaEmail: "دخول عن طريق البريد الالكتروني",
    viaApple: "دخول عن طريق Apple",
    emailLabel: "البريد الالكتروني",
    passLabel: "كلمة السر",
    nameLabel: "الاسم الكامل",
    login: "دخول",
    noAccountShort: "ليس لديك حساب؟ أنشئ حساب جديد",
    back: "رجوع",
    noAccount: "ليس لديك حساب؟",
    createAccount: "افتح حساب جديد",
    legalPre: "باستخدامك هذا التطبيق فإنك توافق على",
    terms: "شروط الاستخدام",
    and: "و",
    privacy: "اتفاقية الخصوصية"
  },
  en: {
    welcome: "Welcome back!",
    subtitle: "Sign in to keep up with your lectures and daily activity on Tibbiya.",
    viaWhatsapp: "Continue with WhatsApp",
    viaGoogle: "Continue with Google",
    viaEmail: "Continue with Email",
    viaApple: "Continue with Apple",
    emailLabel: "Email",
    passLabel: "Password",
    nameLabel: "Full name",
    login: "Sign in",
    noAccountShort: "No account? Create one",
    back: "Back",
    noAccount: "Don't have an account?",
    createAccount: "Create new account",
    legalPre: "By using this app you agree to the",
    terms: "Terms of Use",
    and: "and",
    privacy: "Privacy Policy"
  }
};

function applyLang(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (I18N[lang][key]) el.textContent = I18N[lang][key];
  });
  localStorage.setItem("tibbiya_lang", lang);
}

document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("tibbiya_lang") || "ar";
  applyLang(saved);
  const langLabel = document.getElementById("langLabel");
  if (langLabel) langLabel.textContent = saved === "ar" ? "العربية" : "English";

  const toggle = document.getElementById("langToggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const current = localStorage.getItem("tibbiya_lang") || "ar";
      const next = current === "ar" ? "en" : "ar";
      applyLang(next);
      langLabel.textContent = next === "ar" ? "العربية" : "English";
    });
  }
});

// ============================================================
// طبيّة — theme.js
// Shared dark/light mode toggle for every page.
// The initial theme is already applied by an inline script in
// <head> (before first paint, to avoid a flash of the wrong
// theme) — this file only wires up the toggle button(s) and
// keeps the choice in localStorage.
// ============================================================
(function () {
  const STORAGE_KEY = "tibbiya-theme";

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function paintButtons() {
    const isDark = currentTheme() === "dark";
    document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
      btn.textContent = isDark ? "☀️" : "🌙";
      btn.setAttribute("aria-label", isDark ? "التبديل للنمط الفاتح" : "التبديل للنمط الداكن");
    });
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
    paintButtons();
  }

  function toggleTheme() {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
  }

  function init() {
    paintButtons();
    document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", toggleTheme);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

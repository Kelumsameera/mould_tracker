// Theme toggle, sidebar filter and Mermaid rendering for the docs site.
const THEME_KEY = "mt-docs-theme";
const LANGUAGE_KEY = "mt-docs-language";
const systemDark = () => matchMedia("(prefers-color-scheme: dark)").matches;
try { const saved = localStorage.getItem(THEME_KEY); if (saved) document.documentElement.dataset.theme = saved; } catch {}
const isDark = () => (document.documentElement.dataset.theme || (systemDark() ? "dark" : "light")) === "dark";

function toggleTheme() {
  const next = isDark() ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(THEME_KEY, next); } catch {}
  location.reload(); // re-render diagrams in the new theme
}

function filterNav(text) {
  const q = text.trim().toLowerCase();
  for (const sec of document.querySelectorAll(".nav-sec")) {
    let shown = 0;
    for (const a of sec.querySelectorAll(".nav-a")) {
      const label = a.querySelector(`[data-doc-lang="${document.documentElement.lang}"]`);
      const hit = !q || (label?.textContent || a.textContent).toLowerCase().includes(q);
      a.style.display = hit ? "" : "none";
      if (hit) shown++;
    }
    sec.style.display = shown ? "" : "none";
  }
}

function setLanguage(language) {
  const lang = language === "si" ? "si" : "en";
  document.documentElement.lang = lang;
  const button = document.querySelector(".language");
  button.textContent = lang === "si" ? "English" : "සිංහල";
  button.setAttribute("aria-label", lang === "si" ? "Switch to English" : "සිංහලට මාරු කරන්න");
  document.querySelectorAll("[data-label-en]").forEach(node => {
    node.setAttribute("aria-label", node.dataset[lang === "si" ? "labelSi" : "labelEn"]);
  });
  const filter = document.querySelector(".filter");
  filter.placeholder = lang === "si" ? "පිටු සොයන්න…" : "Filter pages…";
  filter.setAttribute("aria-label", filter.placeholder);
  filterNav(filter.value);
  const title = document.querySelector("title");
  document.title = title.dataset[lang === "si" ? "titleSi" : "titleEn"] + " · Mould Tracker";
  try { localStorage.setItem(LANGUAGE_KEY, lang); } catch {}
}

function toggleLanguage() {
  setLanguage(document.documentElement.lang === "si" ? "en" : "si");
}

setLanguage(document.documentElement.lang);

document.querySelector(".nav-a.on")?.scrollIntoView({ block: "center" });
document.querySelectorAll(".main").forEach(main => main.addEventListener("click", () => document.body.classList.remove("nav-open")));
if (window.mermaid) {
  mermaid.initialize({ startOnLoad: false, theme: isDark() ? "dark" : "default", securityLevel: "strict" });
  mermaid.run({ querySelector: "pre.mermaid" });
}

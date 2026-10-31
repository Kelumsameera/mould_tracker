// Theme toggle, sidebar filter and Mermaid rendering for the docs site.
const THEME_KEY = "mt-docs-theme";
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
      const hit = !q || a.textContent.toLowerCase().includes(q);
      a.style.display = hit ? "" : "none";
      if (hit) shown++;
    }
    sec.style.display = shown ? "" : "none";
  }
}

document.querySelector(".nav-a.on")?.scrollIntoView({ block: "center" });
document.querySelector(".main")?.addEventListener("click", () => document.body.classList.remove("nav-open"));
if (window.mermaid) {
  mermaid.initialize({ startOnLoad: false, theme: isDark() ? "dark" : "default", securityLevel: "strict" });
  mermaid.run({ querySelector: "pre.mermaid" });
}

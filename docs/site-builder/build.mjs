// Builds only the explicitly approved user guide into docs/site/.
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { DOCS } from "./pages.mjs";
import { loadPublicPages } from "./public-pages.mjs";

const OUT = path.join(DOCS, "site");
const toHtml = (r) => r.replace(/(^|\/)README\.md$/, "$1index.html").replace(/\.md$/, ".html");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const { pages, byRel, sections } = loadPublicPages();

const slug = (t) => t.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{M}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-");
const bilingual = (en, si) => `<span data-doc-lang="en">${esc(en)}</span><span data-doc-lang="si" lang="si">${esc(si)}</span>`;
const sectionLabels = { Start: "ආරම්භය", "Getting started": "මුල් පියවර", "User guide": "භාවිත උපදෙස්", Support: "උදව්" };

function render(page) {
  const depth = page.rel.split("/").length - 1;
  const up = "../".repeat(depth);
  const toc = [];
  const renderer = new marked.Renderer();
  renderer.heading = (text, level) => {
    const id = slug(text);
    if (level === 2 || level === 3) toc.push({ level, text: text.replace(/<[^>]+>/g, ""), id });
    return `<h${level} id="${id}"><a class="anchor" href="#${id}">#</a>${text}</h${level}>`;
  };
  renderer.code = (code, lang) => lang === "mermaid"
    ? `<pre class="mermaid">${esc(code)}</pre>`
    : `<pre><code class="lang-${esc(lang || "")}">${esc(code)}</code></pre>`;
  renderer.link = (href, title, text) => {
    let h = href || "";
    if (!/^(https?:|#|mailto:)/.test(h)) {
      const [p, hash] = h.split("#");
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(page.rel), p || ""));
      if (p && byRel.has(target)) h = path.posix.relative(path.posix.dirname(page.rel) || ".", toHtml(target)) + (hash ? `#${hash}` : "");
      else if (p && p.endsWith("/") && byRel.has(target + "/README.md")) h = p + "index.html";
      else if (p && !byRel.has(target) && /\.md$/.test(p)) h = "https://github.com/"; // outside docs: keep text, drop link
    }
    return h === "https://github.com/" ? `<code>${text}</code>` : `<a href="${esc(h)}">${text}</a>`;
  };
  renderer.blockquote = (quote) => {
    const kind = /Screenshot needed/.test(quote) ? "shot" : /⚠️|Risk|Never|Production safety/.test(quote) ? "warn" : "note";
    return `<blockquote class="${kind}">${quote}</blockquote>`;
  };
  const [english, sinhala] = page.body.split(/^## සිංහල\s*$/m);
  if (!sinhala) throw new Error(`Missing Sinhala guide: ${page.rel}`);
  const content = [
    ["en", english.replace(/^# .*$/m, `# ${page.meta.title}`)],
    ["si", `# ${page.meta.titleSi}\n\n${sinhala}`],
  ].map(([lang, body]) => {
    toc.length = 0;
    const html = marked.parse(body, { renderer, gfm: true });
    // Prefix anchors so each language has unique IDs, including shared product names.
    const article = html.replace(/(id|href)="(#?)([^"]+)"/g, (match, attribute, hash, value) =>
      attribute === "id" || hash ? `${attribute}="${hash}${lang}-${value}"` : match);
    const contents = toc.length > 2 ? `<nav class="toc" aria-label="${lang === "si" ? "මෙම පිටුවේ" : "On this page"}"><div class="toc-h">${lang === "si" ? "මෙම පිටුවේ" : "On this page"}</div>${toc.map(t => `<a class="l${t.level}" href="#${lang}-${t.id}">${esc(t.text)}</a>`).join("")}</nav>` : "";
    return `<main class="main" data-doc-lang="${lang}" lang="${lang}"><article class="doc">${article}<footer class="foot">${lang === "si" ? "Mould Tracker භාවිත මාර්ගෝපදේශය" : "Mould Tracker user guide"}</footer></article>${contents}</main>`;
  }).join("");
  const title = page.meta.title || page.rel;
  const nav = sections.map(([name, list]) => `<div class="nav-sec"><div class="nav-h">${bilingual(name, sectionLabels[name])}</div>${list.map((r) =>
    `<a class="nav-a${r === page.rel ? " on" : ""}" href="${up}${toHtml(r)}">${bilingual(byRel.get(r).meta.title, byRel.get(r).meta.titleSi)}</a>`).join("")}</div>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title data-title-en="${esc(title)}" data-title-si="${esc(page.meta.titleSi)}">${esc(title)} · Mould Tracker Docs</title><meta name="description" content="${esc(page.meta.description || "")}">
<script>try { if (localStorage.getItem('mt-docs-language') === 'si') document.documentElement.lang = 'si'; } catch {}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Semi+Condensed:wght@600;700&display=swap"><link rel="stylesheet" href="${up}assets/docs.css"></head><body>
<header class="top"><button class="menu" data-label-en="Menu" data-label-si="මෙනුව" aria-label="Menu" onclick="document.body.classList.toggle('nav-open')">☰</button>
<a class="brand" href="${up}index.html"><span class="logo">◆</span> Mould Tracker ${bilingual("Docs", "උපදෙස්")}</a>
<div class="header-actions"><button class="language" type="button" aria-label="සිංහලට මාරු කරන්න" onclick="toggleLanguage()">සිංහල</button><button class="theme" data-label-en="Toggle theme" data-label-si="පෙනුම වෙනස් කරන්න" aria-label="Toggle theme" onclick="toggleTheme()">◐</button></div></header>
<aside class="side"><input class="filter" type="search" placeholder="Filter pages…" aria-label="Filter pages" oninput="filterNav(this.value)">${nav}</aside>
${content}
<script src="${up}assets/docs.js"></script></body></html>`;
}

fs.rmSync(OUT, { recursive: true, force: true });
for (const p of pages) {
  const target = path.join(OUT, toHtml(p.rel));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, render(p));
}
fs.mkdirSync(path.join(OUT, "assets"), { recursive: true });
for (const f of ["docs.css", "docs.js"]) fs.copyFileSync(path.join(DOCS, "site-builder", f), path.join(OUT, "assets", f));
console.log(`Built ${pages.length} pages into ${path.relative(process.cwd(), OUT) || OUT}`);

// Ship the approved guide with the frontend, including standalone Docker builds.
const frontendDocs = path.resolve(DOCS, "../frontend/public/docs");
fs.rmSync(frontendDocs, { recursive: true, force: true });
fs.cpSync(OUT, frontendDocs, { recursive: true });

// Builds docs/*.md into a static website at docs/site/. Run: cd docs/site-builder && npm install && npm run build
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { DOCS, loadPages } from "./pages.mjs";

const OUT = path.join(DOCS, "site");
const toHtml = (r) => r.replace(/(^|\/)README\.md$/, "$1index.html").replace(/\.md$/, ".html");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const { pages, byRel, sections } = loadPages();

const slug = (t) => t.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

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
  const html = marked.parse(page.body, { renderer, gfm: true });
  const title = page.meta.title || page.rel;
  const nav = sections.map(([name, list]) => `<div class="nav-sec"><div class="nav-h">${esc(name)}</div>${list.map((r) =>
    `<a class="nav-a${r === page.rel ? " on" : ""}" href="${up}${toHtml(r)}">${esc(byRel.get(r).meta.title || r)}</a>`).join("")}</div>`).join("");
  const status = page.meta.status || "";
  const tone = /^Verified/.test(status) ? "ok" : /Partial|partially|proposed|Planned|Open/i.test(status) ? "warn" : "info";
  const chips = [
    page.meta.audience && `<span class="chip">👥 ${esc(page.meta.audience)}</span>`,
    status && `<span class="chip ${tone}">${esc(status)}</span>`,
    page.meta.last_verified && `<span class="chip">Verified ${esc(page.meta.last_verified)}</span>`,
    page.meta.app_version && `<span class="chip">${esc(page.meta.app_version)}</span>`
  ].filter(Boolean).join("");
  const tocHtml = toc.length > 2 ? `<nav class="toc"><div class="toc-h">On this page</div>${toc.map((t) => `<a class="l${t.level}" href="#${t.id}">${esc(t.text)}</a>`).join("")}</nav>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Mould Tracker Docs</title><meta name="description" content="${esc(page.meta.description || "")}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Semi+Condensed:wght@600;700&display=swap"><link rel="stylesheet" href="${up}assets/docs.css"></head><body>
<header class="top"><button class="menu" aria-label="Menu" onclick="document.body.classList.toggle('nav-open')">☰</button>
<a class="brand" href="${up}index.html"><span class="logo">◆</span> Mould Tracker <span>Docs</span></a>
<button class="theme" aria-label="Toggle theme" onclick="toggleTheme()">◐</button></header>
<aside class="side"><input class="filter" type="search" placeholder="Filter pages…" oninput="filterNav(this.value)">${nav}</aside>
<main class="main"><article class="doc">${html.replace("</h1>", `</h1>${page.meta.description ? `<p class="lead">${esc(page.meta.description)}</p>` : ""}<div class="chips">${chips}</div>`)}
<footer class="foot">Source: <code>docs/${esc(page.rel)}</code></footer></article>${tocHtml}</main>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
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

import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { DOCS, loadPages } from "./pages.mjs";
import { PUBLIC_PAGES, loadPublicPages } from "./public-pages.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(DOCS, "site");
const htmlPath = rel => rel.replace(/(^|\/)README\.md$/, "$1index.html").replace(/\.md$/, ".html");
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
before(() => execFileSync(process.execPath, [path.join(dir, "build.mjs")], { cwd: dir }));

test("public output contains exactly the approved user guides and assets", () => {
  const actual = walk(out).map(f => path.relative(out, f).split(path.sep).join("/")).sort();
  const expected = [...PUBLIC_PAGES.map(([, rel]) => htmlPath(rel)), "assets/docs.css", "assets/docs.js"].sort();
  assert.deepEqual(actual, expected);
  assert.ok(loadPages().pages.some(p => p.rel === "technical/api-reference.md"), "internal source remains available locally");
  assert.ok(!loadPublicPages().pages.some(p => p.rel.startsWith("technical/")));
});

test("public pages do not include technical details, internal paths or credential material", () => {
  const forbidden = /\/api\/|\b(?:API|MongoDB|Coolify|Docker|JWT|Supabase|permissionOverrides|MONGODB_URI|JWT_SECRET|repository|database|system_admin|System Administrator)\b|(?:backend|frontend)\/(?:src|controllers|lib|models)|\b(?:192\.168\.|localhost|127\.0\.0\.1)|\.env\b|-----BEGIN.*PRIVATE KEY|\b(?:sk-[a-zA-Z0-9_-]{20,}|gh[pousr]_[a-zA-Z0-9]{20,})\b/i;
  for (const file of walk(out).filter(f => f.endsWith(".html"))) {
    const html = fs.readFileSync(file, "utf8");
    assert.equal(forbidden.test(html), false, `Private content in ${path.relative(out, file)}`);
    assert.equal(html.includes("Source: <code>docs/"), false);
  }
});

test("every local public link resolves inside the public output", () => {
  for (const file of walk(out).filter(f => f.endsWith(".html"))) {
    const html = fs.readFileSync(file, "utf8");
    for (const [, link] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(?:https?:|#|\/|mailto:)/.test(link)) continue;
      const target = path.resolve(path.dirname(file), link.split("#")[0]);
      assert.ok(target.startsWith(out + path.sep), `Link escapes public site: ${link}`);
      assert.ok(fs.existsSync(target), `Missing public link: ${link}`);
    }
  }
});

test("frontend ships the approved guide at the sidebar documentation URL", () => {
  const bundled = path.resolve(DOCS, "../frontend/public/docs");
  const files = walk(out).map(file => path.relative(out, file)).sort();
  assert.deepEqual(walk(bundled).map(file => path.relative(bundled, file)).sort(), files);
  for (const file of files) {
    assert.deepEqual(fs.readFileSync(path.join(bundled, file)), fs.readFileSync(path.join(out, file)));
  }
  const sidebar = fs.readFileSync(path.resolve(DOCS, "../frontend/src/components/Sidebar.tsx"), "utf8");
  assert.ok(sidebar.includes('href="/docs/index.html"'));
  assert.ok(fs.existsSync(path.join(bundled, "index.html")));
});

test("every public guide has complete language views and a header toggle", () => {
  for (const page of loadPublicPages().pages) {
    assert.match(page.body, /^## සිංහල$/m, page.rel);
    const sinhala = page.body.split("## සිංහල")[1];
    assert.ok(sinhala.length > 300, `Missing Sinhala instructions in ${page.rel}`);
    const html = fs.readFileSync(path.join(out, htmlPath(page.rel)), "utf8");
    assert.match(html, /class="header-actions"><button class="language"/, page.rel);
    assert.match(html, /<main class="main" data-doc-lang="en" lang="en">/, page.rel);
    assert.match(html, /<main class="main" data-doc-lang="si" lang="si">/, page.rel);
    assert.ok(!html.includes('href="#සිංහල"'), page.rel);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, `Duplicate anchors in ${page.rel}`);
    for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) {
      assert.ok(ids.includes(anchor), `Missing anchor ${anchor} in ${page.rel}`);
    }
    assert.ok(!html.includes("\uFFFD"), page.rel);
  }
});

test("language toggle updates labels and persists across page loads with theme preserved", () => {
  const saved = new Map([["mt-docs-theme", "dark"]]);
  function openPage() {
    const button = { setAttribute(name, value) { this[name] = value; } };
    const filter = { value: "", setAttribute() {} };
    const theme = { dataset: { labelEn: "Toggle theme", labelSi: "පෙනුම වෙනස් කරන්න" }, setAttribute(name, value) { this[name] = value; } };
    const title = { dataset: { titleEn: "Sign in", titleSi: "පද්ධතියට ඇතුළු වීම" } };
    const document = {
      documentElement: { lang: saved.get("mt-docs-language") || "en", dataset: {} },
      querySelector: selector => ({ ".language": button, ".filter": filter, title })[selector],
      querySelectorAll: selector => selector === "[data-label-en]" ? [theme] : [],
    };
    const context = vm.createContext({ document, window: {}, localStorage: {
      getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value),
    } });
    vm.runInContext(fs.readFileSync(path.join(dir, "docs.js"), "utf8"), context);
    return { document, button, filter, theme, context };
  }
  const page = openPage();
  assert.equal(page.document.documentElement.lang, "en");
  vm.runInContext("toggleLanguage()", page.context);
  assert.equal(page.document.documentElement.lang, "si");
  assert.equal(page.button.textContent, "English");
  assert.equal(page.filter.placeholder, "පිටු සොයන්න…");
  assert.equal(page.theme["aria-label"], "පෙනුම වෙනස් කරන්න");
  assert.equal(saved.get("mt-docs-language"), "si");
  const nextPage = openPage();
  assert.equal(nextPage.document.documentElement.lang, "si");
  assert.equal(nextPage.document.documentElement.dataset.theme, "dark");
  vm.runInContext("toggleLanguage()", nextPage.context);
  assert.equal(nextPage.document.documentElement.lang, "en");
  assert.equal(nextPage.filter.placeholder, "Filter pages…");
  assert.equal(saved.get("mt-docs-language"), "en");
  const css = fs.readFileSync(path.join(out, "assets/docs.css"), "utf8");
  assert.match(css, /html:lang\(en\) \[data-doc-lang="si"\]/);
  assert.match(css, /html:lang\(si\) \[data-doc-lang="en"\]/);
});

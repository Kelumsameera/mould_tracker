import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
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

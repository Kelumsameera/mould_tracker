// Shared by build.mjs (website) and build-docx.mjs (Word): finds the docs pages and their reading order.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DOCS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["site", "site-builder", "node_modules", "export"]);

// Sidebar / chapter order; files not listed here go into "Other".
const NAV = [
  ["Start", ["README.md", "MOULD-TRACKER-COMPLETE-GUIDE.md", "introduction.md", "product-overview.md", "glossary.md"]],
  ["Getting started", ["getting-started/prerequisites.md", "getting-started/first-login.md", "getting-started/quick-start.md", "getting-started/navigation-tour.md"]],
  ["User guide", "user-guide/"],
  ["Roles", ["roles/overview.md", "roles/permissions-matrix.md", "roles/super-admin.md", "roles/admin.md", "roles/production-supervisor.md", "roles/mould-technician.md", "roles/mould-maker.md", "roles/system-administrator.md"]],
  ["Workflows", ["workflows/overview.md", "workflows/mould-lifecycle.md", "workflows/mount-and-unmount.md", "workflows/shot-count-and-service.md", "workflows/problem-to-repair.md", "workflows/workshop-repair-cycle.md", "workflows/out-of-service.md", "workflows/data-import.md"]],
  ["Demonstrations", ["demonstrations/five-minute-tour.md", "demonstrations/fifteen-minute-demo.md", "demonstrations/admin-technical-demo.md", "demonstrations/demo-data-and-reset.md"]],
  ["Administration", "administration/"],
  ["Technical", ["technical/architecture.md", "technical/repository-structure.md", "technical/local-development.md", "technical/database-reference.md", "technical/api-reference.md", "technical/integrations.md", "technical/deployment.md"]],
  ["Support", ["support/troubleshooting.md", "support/faq.md", "support/known-limitations.md"]],
  ["Evidence", ["analysis/EVIDENCE-MATRIX.md", "analysis/GAPS-AND-QUESTIONS.md", "DOCUMENTATION-CHANGELOG.md"]]
];

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? (SKIP.has(e.name) ? [] : walk(path.join(dir, e.name))) : e.name.endsWith(".md") ? [path.join(dir, e.name)] : []);
const rel = (f) => path.relative(DOCS, f).split(path.sep).join("/");

function parse(file) {
  const raw = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n/.exec(raw);
  const meta = {};
  if (m) for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
  return { meta, body: m ? raw.slice(m[0].length) : raw };
}

export function loadPages() {
  const pages = walk(DOCS).map((f) => ({ file: f, rel: rel(f), ...parse(f) }));
  const byRel = new Map(pages.map((p) => [p.rel, p]));
  const sections = NAV.map(([title, list]) => [title,
    (typeof list === "string"
      ? pages.filter((p) => p.rel.startsWith(list)).map((p) => p.rel).sort((a, b) => a.endsWith("README.md") ? -1 : b.endsWith("README.md") ? 1 : a.localeCompare(b))
      : list).filter((r) => byRel.has(r))]);
  const listed = new Set(sections.flatMap(([, l]) => l));
  const other = pages.map((p) => p.rel).filter((r) => !listed.has(r));
  if (other.length) sections.push(["Other", other]);
  return { pages, byRel, sections };
}

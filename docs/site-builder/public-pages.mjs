import fs from "node:fs";
import path from "node:path";
import { DOCS } from "./pages.mjs";

// Publication is opt-in. Internal documents are never discovered or copied here.
export const PUBLIC_PAGES = [
  ["Start", "README.md", "Mould Tracker user guide"],
  ["Getting started", "getting-started/first-login.md", "Sign in"],
  ["Getting started", "getting-started/quick-start.md", "Quick start"],
  ["User guide", "user-guide/README.md", "Using Mould Tracker"],
  ["User guide", "user-guide/find-a-mould.md", "Find a mould"],
  ["User guide", "user-guide/move-a-mould.md", "Move a mould"],
  ["User guide", "user-guide/rack-view.md", "Find a storage position"],
  ["User guide", "user-guide/workshop-queue.md", "Workshop queue"],
  ["User guide", "user-guide/work-log.md", "Record work"],
  ["User guide", "user-guide/report-a-problem.md", "Report a problem"],
  ["User guide", "user-guide/record-shots.md", "Record shots"],
  ["User guide", "user-guide/account-and-passkeys.md", "Your account and passkeys"],
  ["User guide", "user-guide/app-settings-and-install.md", "Install and personalise the app"],
  ["Support", "support/troubleshooting.md", "Troubleshooting"],
  ["Support", "support/faq.md", "Frequently asked questions"],
];

export function loadPublicPages() {
  const pages = PUBLIC_PAGES.map(([, rel, title]) => ({
    rel,
    meta: { title },
    body: fs.readFileSync(path.join(DOCS, "public", rel), "utf8"),
  }));
  const sections = [...new Set(PUBLIC_PAGES.map(([section]) => section))].map(section => [
    section, PUBLIC_PAGES.filter(([name]) => name === section).map(([, rel]) => rel),
  ]);
  return { pages, byRel: new Map(pages.map(page => [page.rel, page])), sections };
}

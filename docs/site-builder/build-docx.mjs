// Exports every docs page into one Word file: docs/export/Mould-Tracker-Documentation.docx
// Run: cd docs/site-builder && npm install && npm run docx
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, LevelFormat, PageBreak, PageNumber,
  Packer, Paragraph, ShadingType, Table, TableCell, TableOfContents, TableRow, TextRun, WidthType
} from "docx";
import { DOCS, loadPages } from "./pages.mjs";

const OUT_DIR = path.join(DOCS, "export");
const OUT_FILE = process.env.DOCX_OUT || path.join(OUT_DIR, "Mould-Tracker-Documentation.docx");
const CONTENT_WIDTH = 9026; // A4 width minus 1" margins, in DXA
const BRAND = "1E6E78"; // teal (action colour in the app)
const STEEL = "17232C";
const ACCENT = "F5B800"; // safety yellow
const SIGN = "Bahnschrift"; // DIN-style signage face shipped with Windows
const MONO = "Consolas";

const { byRel, sections } = loadPages();
const version = byRel.get("README.md")?.meta.app_version || "Unversioned";
const verified = byRel.get("README.md")?.meta.last_verified || "";

const decode = (s) => String(s ?? "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

// ---- Inline tokens -> TextRuns ----
function runs(tokens = [], style = {}) {
  const out = [];
  for (const t of tokens) {
    switch (t.type) {
      case "strong": out.push(...runs(t.tokens, { ...style, bold: true })); break;
      case "em": out.push(...runs(t.tokens, { ...style, italics: true })); break;
      case "del": out.push(...runs(t.tokens, { ...style, strike: true })); break;
      case "codespan":
        out.push(new TextRun({ ...style, text: decode(t.text), font: MONO, size: style.size ? style.size - 1 : 19,
          shading: { type: ShadingType.CLEAR, fill: "EEF1F5", color: "auto" } }));
        break;
      case "link": out.push(...runs(t.tokens, { ...style, color: BRAND })); break; // links don't work across one file; keep the text
      case "br": out.push(new TextRun({ ...style, break: 1 })); break;
      case "html": break;
      case "text": case "escape":
        if (t.tokens?.length) out.push(...runs(t.tokens, style));
        else out.push(new TextRun({ ...style, text: decode(t.text) }));
        break;
      default: if (t.text) out.push(new TextRun({ ...style, text: decode(t.text) }));
    }
  }
  return out;
}

const plain = (tokens = []) => tokens.map((t) => (t.tokens ? plain(t.tokens) : decode(t.text ?? ""))).join("");

// ---- Block tokens -> Paragraphs / Tables ----
let listInstance = 0;
const HEADING = { 1: HeadingLevel.HEADING_2, 2: HeadingLevel.HEADING_3, 3: HeadingLevel.HEADING_4, 4: HeadingLevel.HEADING_5 };

function codeBlock(text, label) {
  const lines = String(text).split("\n");
  const box = { type: ShadingType.CLEAR, fill: "F3F5F8", color: "auto" };
  const out = [];
  if (label) out.push(new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: label, italics: true, size: 18, color: "5A6676" })] }));
  lines.forEach((line, i) => out.push(new Paragraph({
    shading: box, spacing: { before: i === 0 && !label ? 120 : 0, after: i === lines.length - 1 ? 160 : 0 }, keepLines: true,
    children: [new TextRun({ text: line || " ", font: MONO, size: 17 })]
  })));
  return out;
}

function table(t) {
  const cols = t.header.length;
  const lengths = Array.from({ length: cols }, (_, c) =>
    Math.min(45, Math.max(6, ...[t.header[c], ...t.rows.map((r) => r[c])].map((cell) => plain(cell?.tokens).length))));
  const total = lengths.reduce((a, b) => a + b, 0);
  const widths = lengths.map((l) => Math.floor((l / total) * CONTENT_WIDTH));
  widths[widths.length - 1] += CONTENT_WIDTH - widths.reduce((a, b) => a + b, 0);
  const border = { style: BorderStyle.SINGLE, size: 4, color: "D5DBE3" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (c, i, header) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA }, borders,
    shading: header ? { type: ShadingType.CLEAR, fill: STEEL, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [new Paragraph({ children: runs(c?.tokens, header ? { size: 17, bold: true, color: "FFFFFF" } : { size: 17 }) })]
  });
  return [new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA }, columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: t.header.map((c, i) => cell(c, i, true)) }),
      ...t.rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false)) }))
    ]
  }), new Paragraph({ spacing: { after: 80 }, children: [] })];
}

function list(t, level = 0, instance = ++listInstance) {
  const out = [];
  for (const item of t.items) {
    const blocks = item.tokens || [];
    let first = true;
    for (const b of blocks) {
      if (b.type === "list") { out.push(...list(b, Math.min(level + 1, 2))); continue; }
      const inline = b.tokens || [{ type: "text", text: b.text }];
      const prefix = first && item.task ? [new TextRun({ text: item.checked ? "☑ " : "☐ " })] : [];
      out.push(new Paragraph({
        numbering: first ? { reference: t.ordered ? "numbers" : "bullets", level, instance: t.ordered ? instance : undefined } : undefined,
        indent: first ? undefined : { left: 720 * (level + 1) },
        spacing: { after: 60 },
        children: [...prefix, ...runs(inline)]
      }));
      first = false;
    }
  }
  return out;
}

function quote(t) {
  const text = plain(t.tokens);
  const tone = /Screenshot needed/.test(text) ? ["6B4FA8", "EFE9FA"] : /⚠️|Risk|Never|Production safety/.test(text) ? ["9A5B00", "FDF1DC"] : ["3D5A80", "E8EEF6"];
  return (t.tokens || []).flatMap((b) => b.type === "paragraph" ? [new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: tone[1], color: "auto" },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: tone[0], space: 8 } },
    indent: { left: 200 }, spacing: { before: 80, after: 80 },
    children: runs(b.tokens, { size: 19 })
  })] : blocks([b]));
}

function blocks(tokens) {
  const out = [];
  for (const t of tokens) {
    switch (t.type) {
      case "heading":
        out.push(new Paragraph({ heading: HEADING[t.depth] || HeadingLevel.HEADING_5, keepNext: true, children: runs(t.tokens) }));
        break;
      case "paragraph": out.push(new Paragraph({ spacing: { after: 120 }, children: runs(t.tokens) })); break;
      case "list": out.push(...list(t)); break;
      case "table": out.push(...table(t)); break;
      case "blockquote": out.push(...quote(t)); break;
      case "code": out.push(...codeBlock(t.text, t.lang === "mermaid" ? "Diagram (Mermaid source; shown as a picture in the website version)" : null)); break;
      case "hr": out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "D5DBE3", space: 4 } }, children: [] })); break;
      case "space": case "html": break;
      default: if (t.text) out.push(new Paragraph({ children: [new TextRun(decode(t.text))] }));
    }
  }
  return out;
}

function pageContent(page) {
  const tokens = marked.lexer(page.body, { gfm: true });
  const meta = [page.meta.audience && `Audience: ${page.meta.audience}`, page.meta.status && `Status: ${page.meta.status}`, `Source: docs/${page.rel}`].filter(Boolean).join("   ·   ");
  const out = blocks(tokens);
  const titleIndex = out.findIndex(Boolean);
  // Put the page summary and metadata right under the page title.
  out.splice(titleIndex + 1, 0,
    ...(page.meta.description ? [new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: page.meta.description, size: 22, color: "5A6676" })] })] : []),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: meta, size: 16, color: "7A8696", italics: true })] }));
  return out;
}

// ---- Document ----
const titlePage = [
  new Paragraph({ spacing: { before: 3200 }, children: [new TextRun({ text: "Mould Tracker", bold: true, size: 72, color: STEEL, font: SIGN })] }),
  new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: "System documentation", size: 36, color: BRAND, font: SIGN })] }),
  new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 36, color: ACCENT, space: 6 } }, children: [] }),
  new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: `Version: ${version}`, size: 22 })] }),
  new Paragraph({ children: [new TextRun({ text: `Last verified: ${verified}`, size: 22 })] }),
  new Paragraph({ children: [new TextRun({ text: "Audience: operators, supervisors, maintenance, administrators, management, IT, developers, auditors", size: 22 })] }),
  new Paragraph({ spacing: { before: 600 }, children: [new TextRun({ text: "Generated from docs/*.md. Edit the Markdown files and rebuild; do not edit this file by hand.", italics: true, size: 18, color: "7A8696" })] }),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: "Contents", bold: true, size: 44, color: STEEL, font: SIGN })] }),
  new Paragraph({ children: [new TextRun({ text: "If the contents are empty, right-click here and choose Update Field (or press F9).", italics: true, size: 18, color: "7A8696" })] }),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" })
];

const body = [];
for (const [chapter, list] of sections) {
  body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(chapter)] }));
  list.forEach((r, i) => {
    const content = pageContent(byRel.get(r));
    if (i > 0 && content[0] instanceof Paragraph) body.push(new Paragraph({ children: [new PageBreak()] }));
    body.push(...content);
  });
}

const heading = (size, color, before) => ({ run: { size, bold: true, color, font: SIGN }, paragraph: { spacing: { before, after: 120 } } });
const doc = new Document({
  creator: "Mould Tracker documentation build",
  title: "Mould Tracker — System documentation",
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: "Calibri", size: 21, color: "1B2430" } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, ...heading(44, STEEL, 0), paragraph: { spacing: { after: 300 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: ACCENT, space: 6 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, ...heading(34, STEEL, 120), paragraph: { spacing: { before: 120, after: 60 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, ...heading(26, BRAND, 280), paragraph: { spacing: { before: 280, after: 100 }, outlineLevel: 2 } },
      { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true, ...heading(22, "1B2430", 200), paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 3 } },
      { id: "Heading5", name: "Heading 5", basedOn: "Normal", next: "Normal", quickFormat: true, ...heading(21, "5A6676", 160), paragraph: { spacing: { before: 160, after: 60 }, outlineLevel: 4 } }
    ]
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [0, 1, 2].map((level) => ({ level, format: LevelFormat.BULLET, text: ["•", "◦", "▪"][level], alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } } })) },
      { reference: "numbers", levels: [0, 1, 2].map((level) => ({ level, format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level], text: `%${level + 1}.`, alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } } })) }
    ]
  },
  sections: [{
    properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Mould Tracker — System documentation", size: 16, color: "7A8696" })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
      new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 16, color: "7A8696" })] })] }) },
    children: [...titlePage, ...body]
  }]
});

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, await Packer.toBuffer(doc));
console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)} (${sections.reduce((n, [, l]) => n + l.length, 0)} pages)`);

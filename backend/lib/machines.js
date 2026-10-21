// One spelling for injection machine codes everywhere: "inj 3", "INJ_03", "INJ- 3" -> "INJ-03".
// Codes that are not INJ machines are only trimmed and upper-cased.
export function normalizeMachineCode(raw) {
  const s = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  const inj = s.match(/^INJ[\s_-]*0*(\d+)$/);
  return inj ? `INJ-${inj[1].padStart(2, "0")}` : s;
}

// "INJ-03/INJ-04/ INJ-05", "INJ-01/INJ-02 INJ-03/" or "N/A" -> codes + anything that is not a machine.
export function parseCapableMachines(raw) {
  const text = String(raw ?? "").trim();
  if (!text || /^n\/?a$/i.test(text)) return { codes: [], unknown: [] };
  const tokens = text.split(/[\/,;]|\s+(?=INJ)/i).map((t) => t.trim()).filter(Boolean);
  const codes = [], unknown = [];
  for (const t of tokens) (/^INJ[\s_-]*\d+$/i.test(t) ? codes : unknown).push(t);
  return { codes: [...new Set(codes.map(normalizeMachineCode))], unknown };
}

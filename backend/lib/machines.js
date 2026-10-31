// One spelling for machine codes everywhere: injection "inj 3", "INJ_03", "INJ- 3" -> "INJ-03";
// extrusion "ex 2", "EX_02" -> "EX02" (the tools list writes extruders without a dash).
// Other codes are only trimmed and upper-cased.
export function normalizeMachineCode(raw) {
  const s = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  const inj = s.match(/^INJ[\s_-]*0*(\d+)$/);
  if (inj) return `INJ-${inj[1].padStart(2, "0")}`;
  const ex = s.match(/^EX[\s_-]*0*(\d+)$/);
  return ex ? `EX${ex[1].padStart(2, "0")}` : s;
}

const MACHINE_TOKEN = /^(INJ|EX)[\s_-]*\d+$/i;

// "INJ-03/INJ-04/ INJ-05", "INJ-01/INJ-02 INJ-03/", "EX02" or "N/A" -> codes + anything that is not a machine.
export function parseCapableMachines(raw) {
  const text = String(raw ?? "").trim();
  if (!text || /^n\/?a$/i.test(text)) return { codes: [], unknown: [] };
  const tokens = text.split(/[\/,;]|\s+(?=INJ|EX\d)/i).map((t) => t.trim()).filter(Boolean);
  const codes = [], unknown = [];
  for (const t of tokens) (MACHINE_TOKEN.test(t) ? codes : unknown).push(t);
  return { codes: [...new Set(codes.map(normalizeMachineCode))], unknown };
}

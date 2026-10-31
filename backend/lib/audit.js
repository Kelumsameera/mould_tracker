import AuditLog from "../models/AuditLog.js";

// Writes one audit entry for the signed-in user, inside the caller's transaction when given.
export function audit(req, entry, session) {
  const doc = { actorId: req.user?._id ?? null, actorName: req.user?.name ?? "system", ip: req.ip ?? null, ...entry };
  return session ? AuditLog.create([doc], { session }) : AuditLog.create(doc);
}

// Only the fields that changed, as { before, after }.
export function changes(before, after, fields) {
  const b = {}, a = {};
  for (const f of fields) {
    if (JSON.stringify(before?.[f] ?? null) !== JSON.stringify(after?.[f] ?? null)) {
      b[f] = before?.[f] ?? null;
      a[f] = after?.[f] ?? null;
    }
  }
  return { before: b, after: a, fields: Object.keys(a) };
}

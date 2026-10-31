// Project identities at the API boundary; keep the original audit/history in storage.
export const PRIVATE_PERSON = Object.freeze({ id: null, name: "Private user", role: null });
const idOf = value => value == null ? null : String(value._id ?? value);

export function accountPrivacy(viewer, accounts = [], snapshots = []) {
  const ownId = idOf(viewer?._id);
  const hidden = accounts.filter(account => idOf(account._id) !== ownId);
  const ids = new Set(hidden.map(account => idOf(account._id)));
  const names = new Set(hidden.flatMap(account => [account.name, account.email]).filter(Boolean));
  for (const person of snapshots) {
    if (idOf(person.userId) !== ownId && (person.role === "system_admin" || ids.has(idOf(person.userId)))) {
      ids.add(idOf(person.userId));
      if (person.name) names.add(person.name);
    }
  }
  const isHidden = person => person && (
    ids.has(idOf(person.userId ?? person.id ?? person._id)) ||
    (person.role === "system_admin" && idOf(person.userId ?? person.id ?? person._id) !== ownId)
  );
  function project(value, key = "") {
    if (value == null || value instanceof Date) return value;
    // Preserve BSON IDs for the file-export path; JSON payloads are normalized first.
    if (value._bsontype === "ObjectId") return ids.has(String(value)) ? null : value;
    if (Array.isArray(value)) return value.map(entry => project(entry, key));
    if (typeof value === "object") {
      if (isHidden(value)) {
        return "userId" in value ? { userId: null, name: PRIVATE_PERSON.name, role: null } : { ...PRIVATE_PERSON };
      }
      return Object.fromEntries(Object.entries(value).map(([field, entry]) => [field, project(entry, field)]));
    }
    if (typeof value === "string") {
      if (ids.has(value)) return null;
      if (["name", "names", "email", "actorName", "reportedBy", "doneBy"].includes(key) && names.has(value)) return PRIVATE_PERSON.name;
    }
    return value;
  }
  return { ids: [...ids], isHidden, project };
}

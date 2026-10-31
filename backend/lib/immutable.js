// Mongoose plugin for append-only collections (Movement, AuditLog): inserts only.
const BLOCKED = [
  "updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace",
  "deleteOne", "deleteMany", "findOneAndDelete"
];

export function immutable(schema, { name }) {
  const refuse = () => {
    throw new Error(`${name} records are immutable`);
  };
  schema.pre(BLOCKED, { document: false, query: true }, refuse);
  schema.pre("deleteOne", { document: true, query: false }, refuse);
  schema.pre("save", function () {
    if (!this.isNew) refuse();
  });
}

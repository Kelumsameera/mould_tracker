const admin = db.getSiblingDB("admin");
if (!admin.auth("root", process.env.MONGO_INITDB_ROOT_PASSWORD)) quit(1);
try {
  rs.status();
} catch (error) {
  if (error.code !== 94) throw error;
  rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongo:27017" }] });
}
quit(admin.hello().isWritablePrimary ? 0 : 1);

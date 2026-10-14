const admin = db.getSiblingDB("admin");
if (!admin.auth("root", process.env.MONGO_ROOT_PASSWORD)) quit(1);
const app = db.getSiblingDB("tooltracker");
if (!app.getUser("tooltracker")) {
  app.createUser({
    user: "tooltracker",
    pwd: process.env.MONGO_APP_PASSWORD,
    roles: [{ role: "readWrite", db: "tooltracker" }],
  });
}
print("Tool Tracker database user ready");

import User from "../models/User.js";
import WorkLog from "../models/WorkLog.js";
import { accountPrivacy } from "../lib/accountPrivacy.js";

export async function protectAccounts(req, res, next) {
  const accounts = await User.find({ role: "system_admin", _id: { $ne: req.user._id } }, { name: 1, email: 1 }).lean();
  // Snapshots retain old names after a profile rename. Include them in name-only summaries.
  let snapshots = [];
  if (accounts.length) {
    const ids = accounts.map(account => account._id);
    const logs = await WorkLog.find({ $or: [{ "doneBy.userId": { $in: ids } }, { "recordedBy.userId": { $in: ids } }] }, { doneBy: 1, recordedBy: 1 }).lean();
    snapshots = logs.flatMap(log => [...(log.doneBy || []), log.recordedBy].filter(Boolean));
  }
  req.accountPrivacy = accountPrivacy(req.user, accounts, snapshots);
  const json = res.json.bind(res);
  res.json = body => json(req.accountPrivacy.project(JSON.parse(JSON.stringify(body))));
  next();
}

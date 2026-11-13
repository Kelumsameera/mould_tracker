import * as c from "../controllers/settingsController.js";
import * as s from "../validators/schemas.js";
import { routerFrom } from "./table.js";

const READ = ["settings.manage", "config.manage"];
const WRITE = ["settings.manage"]; // System Administrator only; never grantable

export const settingsRouteTable = [
  ["get", "/", READ, c.listSettings],
  ["put", "/values/:key", WRITE, c.putSetting, s.settingValueSchema],
  ["delete", "/values/:key", WRITE, c.resetSetting],
  ["put", "/lists/:list", WRITE, c.putList, s.settingListSchema],
  ["delete", "/lists/:list", WRITE, c.resetList],
  ["put", "/texts/:key", WRITE, c.putText, s.settingTextSchema],
  ["delete", "/texts/:key", WRITE, c.resetText],
  ["get", "/texts-export", WRITE, c.exportTexts],
  ["post", "/texts-import", WRITE, c.importTexts, s.settingTextsImportSchema]
];

export default routerFrom(settingsRouteTable);

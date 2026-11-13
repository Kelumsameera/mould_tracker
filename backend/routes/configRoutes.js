import * as c from "../controllers/configController.js";
import * as s from "../validators/schemas.js";
import { routerFrom, SIGNED_IN } from "./table.js";

// config.manage: System Administrator only, never grantable. Reading the published config: everyone signed in.
const MANAGE = ["config.manage"];
const VIEW = MANAGE; // workflow screens (incl. versions/diff) are System Administrator only

export const configRouteTable = [
  ["get", "/", SIGNED_IN, c.getPublishedConfig],
  ["get", "/versions", VIEW, c.listVersions],
  ["get", "/versions/:version", VIEW, c.getVersion],
  ["get", "/diff", VIEW, c.diff],
  ["post", "/simulate", ["mould.view"], c.simulate, s.simulateSchema],
  ["put", "/draft", MANAGE, c.saveDraft, s.configDraftSchema],
  ["delete", "/draft", MANAGE, c.discardDraft, s.optionalReasonSchema],
  ["post", "/validate", MANAGE, c.validate, s.configValidateSchema],
  ["post", "/publish", MANAGE, c.publish, s.configPublishSchema],
  ["post", "/rollback", MANAGE, c.rollback, s.configRollbackSchema],
  ["get", "/export", MANAGE, c.exportConfig],
  ["post", "/import", MANAGE, c.importConfig, s.configImportSchema]
];

export default routerFrom(configRouteTable);

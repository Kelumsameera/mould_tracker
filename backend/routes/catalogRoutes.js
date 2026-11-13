import * as c from "../controllers/catalogController.js";
import * as s from "../validators/schemas.js";
import { routerFrom } from "./table.js";

const VIEW = ["catalog.view"];

export const catalogRouteTable = [
  ["get", "/summary", VIEW, c.catalogSummary, null, s.catalogQuery],
  ["get", "/moulds", VIEW, c.catalogMoulds, null, s.catalogQuery],
  ["get", "/products", VIEW, c.catalogProducts, null, s.catalogQuery],
  ["get", "/products/:itemId", VIEW, c.catalogProduct],
  ["get", "/export", ["export.run"], c.catalogExport, null, s.catalogExportQuery]
];

export default routerFrom(catalogRouteTable);

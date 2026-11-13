import { fail } from "../utils/ApiError.js";
import { imageKey } from "./images.js";
import { setting } from "./settings.js";

// Pure rules for an item's picture list. Each returns a NEW array; the controller stores it and audits.
const keysOf = (images) => images.map((i) => imageKey(i.path));

function indexOf(images, key) {
  const index = keysOf(images).indexOf(key);
  if (index < 0) fail(404, "NOT_FOUND", "Picture not found");
  return index;
}
function rejectDuplicate(images, saved, except = -1) {
  if (images.some((i, j) => j !== except && i.path === saved.path)) fail(409, "DUPLICATE_IMAGE", "This picture is already on the item");
}

export function addImage(images, saved) {
  const max = setting("limits.maxItemImages"); // Settings > Thresholds & limits
  if (images.length >= max) fail(400, "TOO_MANY_IMAGES", `An item can have at most ${max} pictures`, { max });
  rejectDuplicate(images, saved);
  return [...images, saved];
}

// A replaced picture has no sheet source, so the importer never overwrites it.
export function replaceImage(images, key, saved) {
  const index = indexOf(images, key);
  rejectDuplicate(images, saved, index);
  return images.map((i, j) => (j === index ? saved : i));
}

export function removeImage(images, key) {
  const index = indexOf(images, key);
  return images.filter((_, j) => j !== index);
}

export function reorderImages(images, order) {
  const keys = keysOf(images);
  if (order.length !== keys.length || new Set(order).size !== order.length || order.some((k) => !keys.includes(k)))
    fail(400, "INVALID_ORDER", "The order must list every picture of the item once");
  if (order.every((k, j) => k === keys[j])) fail(400, "NO_CHANGE", "Nothing changed");
  return order.map((k) => images[keys.indexOf(k)]);
}

export { keysOf };

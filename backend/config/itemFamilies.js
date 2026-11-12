// Product families for the Catalog: the letters an Item ID starts with (before the first dash/number),
// e.g. GP0001-130 -> GP. Add a label here to name a family; unknown prefixes show the prefix itself.
export const ITEM_FAMILIES = {
  GP: "GP",
  CP: "CP"
};

// Family code of an Item ID ("" when it does not start with letters).
export const familyOf = (itemId) => (String(itemId ?? "").toUpperCase().match(/^[A-Z]+/)?.[0] ?? "");
export const familyLabel = (code) => ITEM_FAMILIES[code] ?? code;

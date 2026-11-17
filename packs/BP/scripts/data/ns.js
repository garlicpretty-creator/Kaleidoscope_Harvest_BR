// The add-on namespace and id helpers. Plain data: no @minecraft imports.

export const NAMESPACE = "kaleidoscope_harvest";

/** "napa_cabbage" → "kaleidoscope_harvest:napa_cabbage"; ids that already have a namespace pass through. */
export const rid = (id) => (id.includes(":") ? id : `${NAMESPACE}:${id}`);

/** Name of one of Harvest's block states. */
export const state = (name) => `${NAMESPACE}:${name}`;

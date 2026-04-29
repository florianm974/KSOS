// js/logic.js

export function parseItemDate(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

// 7 jours en millisecondes
const NEW_ITEM_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export function isItemNew(item) {
  const created = parseItemDate(item.createdAt);
  if (created === null) return false;
  return Date.now() - created <= NEW_ITEM_THRESHOLD_MS;
}

export function getItemTimestamp(item) {
  const createdTime = parseItemDate(item.createdAt);
  const updatedTime = parseItemDate(item.updatedAt);

  // Si l'item est nouveau (< 7 jours) → afficher createdAt
  if (isItemNew(item) && createdTime !== null) {
    return createdTime;
  }

  // Si l'item est vieux (>= 7 jours) → afficher updatedAt (dernier push)
  if (updatedTime !== null) {
    return updatedTime;
  }

  // Fallback : createdAt
  return createdTime || parseItemDate(item.date);
}

export function normalizeAuthorKey(author) {
  return String(author || "")
    .trim()
    .toLowerCase();
}

export function buildAuthorOptions(appData, itemCollectionKey) {
  const catalog = new Map();

  (appData.members || []).forEach((member) => {
    const name = String(member.name || "").trim();
    const key = normalizeAuthorKey(name);
    if (key && !catalog.has(key)) {
      catalog.set(key, name);
    }
  });

  (appData[itemCollectionKey] || []).forEach((item) => {
    const name = String(item.author || "").trim();
    const key = normalizeAuthorKey(name);
    if (key && !catalog.has(key)) {
      catalog.set(key, name);
    }
  });

  return Array.from(catalog.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) =>
      a.label.localeCompare(b.label, "fr", { sensitivity: "base" }),
    );
}

export function sortAndFilterItems(
  items,
  criteria,
  order,
  authorFilter,
  searchQuery,
) {
  const normalizedFilter = normalizeAuthorKey(authorFilter || "all");
  const normalizedSearch = normalizeAuthorKey(searchQuery || "");

  const filtered = items
    .map((item, index) => ({ ...item, __index: index }))
    .filter((item) => {
      const authorMatches =
        normalizedFilter === "all" ||
        normalizeAuthorKey(item.author) === normalizedFilter;
      if (!authorMatches) return false;

      if (!normalizedSearch) return true;
      const searchableText = `${item.title || ""} ${item.desc || ""}`
        .toLowerCase()
        .trim();
      return searchableText.includes(normalizedSearch);
    });

  filtered.sort((a, b) => {
    if (criteria === "title") {
      return (a.title || "").localeCompare(b.title || "", "fr", {
        sensitivity: "base",
      });
    }

    if (criteria === "author") {
      const authorCompare = (a.author || "").localeCompare(
        b.author || "",
        "fr",
        { sensitivity: "base" },
      );
      if (authorCompare !== 0) return authorCompare;
      return (a.title || "").localeCompare(b.title || "", "fr", {
        sensitivity: "base",
      });
    }

    if (criteria === "recent") {
      const timeA = getItemTimestamp(a);
      const timeB = getItemTimestamp(b);

      if (timeA === null && timeB === null) return a.__index - b.__index;
      if (timeA === null) return 1;
      if (timeB === null) return -1;
      return timeB - timeA;
    }

    return a.__index - b.__index;
  });

  if (order === "desc") {
    filtered.reverse();
  }

  return filtered;
}

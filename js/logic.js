// js/logic.js

export function parseItemDate(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function getItemTimestamp(item) {
  // Correction ici : updatedAt (GitHub) en priorité
  return (
    parseItemDate(item.updatedAt) ||
    parseItemDate(item.createdAt) ||
    parseItemDate(item.date)
  );
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

// js/logic.js

import Fuse from "https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.mjs";

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

  // 1. Filtrer par auteur en mappant l'index d'origine
  let filtered = items
    .map((item, index) => ({ ...item, __index: index }))
    .filter((item) => {
      const authorMatches =
        normalizedFilter === "all" ||
        normalizeAuthorKey(item.author) === normalizedFilter;
      return authorMatches;
    });

  // 2. Recherche floue (Fuzzy Search) avec Fuse.js
  if (searchQuery && searchQuery.trim() !== "") {
    const fuse = new Fuse(filtered, {
      keys: [
        { name: "title", weight: 2 },
        { name: "desc", weight: 1 },
        { name: "techs", weight: 1 },
        { name: "author", weight: 0.5 },
        { name: "tagText", weight: 0.5 },
      ],
      threshold: 0.3, // Autorise les petites fautes de frappe
      ignoreLocation: true,
    });
    filtered = fuse.search(searchQuery).map((result) => result.item);
  }

  // 3. Tri
  filtered.sort((a, b) => {
    // Si on a une recherche, on garde l'ordre de pertinence de Fuse (sauf si un tri spé est demandé)
    if (searchQuery && searchQuery.trim() !== "" && criteria === "default") {
      return 0; // Fuse garde les meilleurs résultats en premier
    }

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

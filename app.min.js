const REPO_DATE_CACHE_KEY = "ksosRepoDatesCacheV1";
const REPO_DATE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const INTRO_SEEN_KEY = "ksosIntroSeen";

async function fetchAppData() {
  const response = await fetch("./data.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Impossible de charger data.json");
  }
  return response.json();
}

function extractGithubRepoSlug(url) {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname !== "github.com" &&
      parsed.hostname !== "www.github.com"
    ) {
      return null;
    }
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return null;

    const owner = segments[0];
    const repo = segments[1].replace(/\.git$/i, "");
    if (!owner || !repo) return null;

    return `${owner}/${repo}`;
  } catch (_) {
    return null;
  }
}

function readRepoDateCache() {
  try {
    const raw = localStorage.getItem(REPO_DATE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeRepoDateCache(cache) {
  try {
    localStorage.setItem(REPO_DATE_CACHE_KEY, JSON.stringify(cache));
  } catch (_) {
    // Ignore storage write failures.
  }
}

function clearRepoDateCache() {
  try {
    localStorage.removeItem(REPO_DATE_CACHE_KEY);
  } catch (_) {
    // Ignore storage remove failures.
  }
}

const REPO_FAIL_CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure avant de réessayer un échec

function getCachedRepoDate(cache, slug) {
  const entry = cache[slug];
  if (!entry || !entry.fetchedAt) {
    return null;
  }
  // Si c'est un échec récent, on ne réessaie pas
  if (entry.failedAt) {
    const isRecentFail =
      Date.now() - Number(entry.failedAt) < REPO_FAIL_CACHE_TTL_MS;
    return isRecentFail ? "FAILED" : null;
  }
  if (typeof entry.pushedAt !== "string") {
    return null;
  }
  const isFresh = Date.now() - Number(entry.fetchedAt) < REPO_DATE_CACHE_TTL_MS;
  return isFresh ? entry.pushedAt : null;
}

async function fetchRepoPushedAt(slug) {
  try {
    const response = await fetch(`https://api.github.com/repos/${slug}`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.pushed_at === "string" ? data.pushed_at : null;
  } catch (_) {
    return null;
  }
}

async function enrichItemsWithGithubDates(items, cache) {
  const clonedItems = (items || []).map((item) => ({ ...item }));
  const slugs = Array.from(
    new Set(
      clonedItems
        .map((item) => extractGithubRepoSlug(item.github))
        .filter(Boolean),
    ),
  );

  const datesBySlug = {};
  const missingSlugs = [];

  slugs.forEach((slug) => {
    const cachedDate = getCachedRepoDate(cache, slug);
    if (cachedDate === "FAILED") {
      return; // Ne pas réessayer tout de suite
    }
    if (cachedDate) {
      datesBySlug[slug] = cachedDate;
    } else {
      missingSlugs.push(slug);
    }
  });

  const fetchedEntries = await Promise.all(
    missingSlugs.map(async (slug) => {
      const pushedAt = await fetchRepoPushedAt(slug);
      return { slug, pushedAt };
    }),
  );

  fetchedEntries.forEach(({ slug, pushedAt }) => {
    if (!pushedAt) {
      // Stocker l'échec pour éviter de re-fetcher trop souvent
      cache[slug] = { failedAt: Date.now(), fetchedAt: Date.now() };
      return;
    }
    datesBySlug[slug] = pushedAt;
    cache[slug] = { pushedAt, fetchedAt: Date.now() };
  });

  return clonedItems.map((item) => {
    const slug = extractGithubRepoSlug(item.github);
    const pushedAt = slug ? datesBySlug[slug] : null;
    if (!pushedAt) return item;

    return { ...item, updatedAt: pushedAt };
  });
}

async function enrichAppDataWithGithubDates(appData) {
  const cache = readRepoDateCache();
  const games = await enrichItemsWithGithubDates(appData.games || [], cache);
  const projects = await enrichItemsWithGithubDates(
    appData.projects || [],
    cache,
  );

  writeRepoDateCache(cache);

  return { ...appData, games, projects };
}
function parseItemDate(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

// 7 jours en millisecondes
const NEW_ITEM_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

function isItemNew(item) {
  const created = parseItemDate(item.createdAt);
  if (created === null) return false;
  return Date.now() - created <= NEW_ITEM_THRESHOLD_MS;
}

function getItemTimestamp(item) {
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

function normalizeAuthorKey(author) {
  return String(author || "")
    .trim()
    .toLowerCase();
}

function buildAuthorOptions(appData, itemCollectionKey) {
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

function sortAndFilterItems(items, criteria, order, authorFilter, searchQuery) {
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

  // 2. Recherche améliorée (accent insensible, fuzzy)
  if (searchQuery && searchQuery.trim() !== "") {
    const normalize = (s) =>
      String(s)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const terms = normalize(searchQuery)
      .split(/\s+/)
      .filter(Boolean);
    filtered = filtered.filter((item) => {
      const searchable = normalize(
        [
          item.title,
          item.desc,
          ...(Array.isArray(item.techs) ? item.techs : []),
          item.author,
          item.tagText,
        ]
          .filter(Boolean)
          .join(" "),
      );
      return terms.every((term) => searchable.includes(term));
    });
  }

  // 3. Tri
  filtered.sort((a, b) => {
    // Si on a une recherche, on garde l'ordre original (pertinence implicite)
    if (searchQuery && searchQuery.trim() !== "" && criteria === "default") {
      return 0;
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
const SVG_NS = "http://www.w3.org/2000/svg";
const AVATAR_FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%23121726'/%3E%3Cpath d='M32 34c8.3 0 15 6.7 15 15H17c0-8.3 6.7-15 15-15zm0-18a9 9 0 110 18 9 9 0 010-18z' fill='%23d1d5db'/%3E%3C/svg%3E";

function safeExternalUrl(url) {
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.href;
    }
  } catch (_) {}
  return "#";
}

function clearElement(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function createGithubIcon() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute(
    "d",
    "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22",
  );
  svg.appendChild(path);
  return svg;
}

function createExternalLinkIcon() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute(
    "d",
    "M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
  );
  svg.appendChild(path);
  return svg;
}

const CARD_ACCENTS = [
  { color: "#d8ff5f", rgb: "216, 255, 95" },
  { color: "#ff8e72", rgb: "255, 142, 114" },
  { color: "#74dbff", rgb: "116, 219, 255" },
  { color: "#ffcf63", rgb: "255, 207, 99" },
];

function getCardAccent(item) {
  const key = String(item?.author || item?.title || "KSOS");
  const hash = Array.from(key).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return CARD_ACCENTS[hash % CARD_ACCENTS.length];
}

function createCardElement(item, options = {}) {
  const isFavorite = Boolean(options.isFavorite);
  const onToggleFavorite =
    typeof options.onToggleFavorite === "function"
      ? options.onToggleFavorite
      : null;

  const card = document.createElement("article");
  card.tabIndex = 0;
  card.className =
    "bg-darkCard catalog-card group flex flex-col p-6 md:p-8 h-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40";
  const accent = getCardAccent(item);
  card.style.setProperty("--card-accent", accent.color);
  card.style.setProperty("--card-accent-rgb", accent.rgb);

  const header = document.createElement("div");
  header.className =
    "catalog-card__header flex items-start justify-between mb-4 relative z-10";

  const headerLeft = document.createElement("div");
  headerLeft.className = "catalog-card__intro flex items-center gap-4";

  const icon = document.createElement("div");
  icon.className =
    "catalog-card__icon w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform duration-300";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = item.icon || "🧩";

  const titleWrapper = document.createElement("div");
  titleWrapper.className = "catalog-card__heading";

  const titleLink = document.createElement("a");
  titleLink.href = safeExternalUrl(item.url);
  titleLink.target = "_blank";
  titleLink.rel = "noopener noreferrer";
  titleLink.className = `catalog-card__title text-xl md:text-2xl font-black font-display text-white ${item.hoverClass || ""} transition-colors leading-tight card-title-link before:absolute before:inset-0 before:z-0`;
  titleLink.textContent = item.title || "Projet";

  const byline = document.createElement("p");
  byline.className =
    "catalog-card__byline text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1";
  byline.textContent = `par ${item.author || "inconnu"}`;

  titleWrapper.appendChild(titleLink);
  titleWrapper.appendChild(byline);
  headerLeft.appendChild(icon);
  headerLeft.appendChild(titleWrapper);
  header.appendChild(headerLeft);

  const headerRight = document.createElement("div");
  headerRight.className = "catalog-card__meta flex items-center gap-2";

  const favoriteButton = document.createElement("button");
  favoriteButton.type = "button";
  favoriteButton.className = "favorite-toggle";
  favoriteButton.setAttribute(
    "aria-label",
    `${isFavorite ? "Retirer des" : "Ajouter aux"} favoris: ${item.title || "ce projet"}`,
  );
  favoriteButton.setAttribute("aria-pressed", String(isFavorite));
  if (isFavorite) {
    favoriteButton.classList.add("is-active");
  }

  const favoriteStar = document.createElement("span");
  favoriteStar.className = "favorite-toggle-star";
  favoriteStar.textContent = "★";
  favoriteButton.appendChild(favoriteStar);

  favoriteButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    favoriteButton.classList.remove("is-popping");
    // Force reflow so rapid clicks replay the pop animation reliably.
    void favoriteButton.offsetWidth;
    favoriteButton.classList.add("is-popping");

    if (onToggleFavorite) {
      onToggleFavorite(item);
    }
  });

  favoriteButton.addEventListener("animationend", () => {
    favoriteButton.classList.remove("is-popping");
  });

  headerRight.appendChild(favoriteButton);

  // Correction ici : On sépare la date d'affichage (updatedAt) de la date de création (createdAt)
  const itemTimestamp = getItemTimestamp(item);

  if (itemTimestamp !== null) {
    const datePill = document.createElement("span");
    const isNewItem = isItemNew(item);

    datePill.className = isNewItem
      ? "catalog-card__date px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
      : "catalog-card__date px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 text-gray-400 border border-white/10";

    datePill.textContent = isNewItem
      ? "Nouveau"
      : new Intl.DateTimeFormat("fr-FR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(itemTimestamp);
    headerRight.appendChild(datePill);
  }

  header.appendChild(headerRight);

  const description = document.createElement("p");
  description.className =
    "catalog-card__description text-gray-400 text-sm md:text-base leading-relaxed flex-1 relative z-10 mb-4 pointer-events-none";
  description.textContent = item.desc || "";

  const techList = document.createElement("div");
  techList.className =
    "catalog-card__tech-list flex flex-wrap gap-2 mb-6 relative z-10";

  // Dictionnaire d'icônes par technologie
  const techIcons = {
    html: "🌐",
    css: "🎨",
    javascript: "⚡",
    react: "⚛️",
    vue: "🟢",
    python: "🐍",
    node: "🟩",
    godot: "🤖",
    svelte: "🟢",
    typescript: "📘",
    tailwind: "🌊",
  };

  const techs = Array.isArray(item.techs) ? item.techs : [];
  techs.forEach((tech) => {
    const chip = document.createElement("span");
    chip.setAttribute("aria-label", `Technologie utilisée : ${tech}`);
    chip.className =
      "catalog-card__tech px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5";

    const iconKey = String(tech).toLowerCase().trim();
    const icon = techIcons[iconKey];

    chip.innerHTML = icon
      ? `<span aria-hidden="true">${icon}</span> ${tech}`
      : String(tech);
    techList.appendChild(chip);
  });

  const bottom = document.createElement("div");
  bottom.className =
    "catalog-card__footer flex items-center justify-between gap-4 relative z-10 pt-6 border-t border-white/5 card-actions";

  const badge = document.createElement("span");
  badge.className = `catalog-card__category px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${item.badgeClass || ""}`;
  badge.textContent = item.tagText || "Projet";

  const actionLinks = document.createElement("div");
  actionLinks.className = "catalog-card__links flex items-center gap-2 card-links";

  const openLink = document.createElement("a");
  openLink.href = safeExternalUrl(item.url);
  openLink.target = "_blank";
  openLink.rel = "noopener noreferrer";
  openLink.className =
    "catalog-card__action card-action-link card-action-primary text-xs font-bold uppercase tracking-widest flex items-center gap-2";
  openLink.setAttribute(
    "aria-label",
    `Ouvrir ${item.title || "ce projet"}`,
  );
  openLink.appendChild(createExternalLinkIcon());
  openLink.appendChild(document.createTextNode("Ouvrir"));

  const codeLink = document.createElement("a");
  codeLink.href = safeExternalUrl(item.github);
  codeLink.target = "_blank";
  codeLink.rel = "noopener noreferrer";
  codeLink.className =
    "catalog-card__action card-action-link text-xs font-bold uppercase tracking-widest flex items-center gap-2";
  codeLink.setAttribute(
    "aria-label",
    `Voir le code de ${item.title || "ce projet"}`,
  );
  codeLink.appendChild(createGithubIcon());
  codeLink.appendChild(document.createTextNode("Code"));

  actionLinks.appendChild(openLink);
  actionLinks.appendChild(codeLink);

  bottom.appendChild(badge);
  bottom.appendChild(actionLinks);

  card.appendChild(header);
  card.appendChild(description);
  card.appendChild(techList);
  card.appendChild(bottom);
  return card;
}

function createMemberBadgeElement(member) {
  const username = /^[a-zA-Z0-9-]{1,39}$/.test(member.github)
    ? member.github
    : null;
  const profileUrl = username ? `https://github.com/${username}` : "#";

  const anchor = document.createElement("a");
  anchor.href = profileUrl;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.className =
    "glass-pill rounded-full flex items-center gap-3 pr-4 pl-1.5 py-1.5 group";

  const img = document.createElement("img");
  img.src = username ? `https://github.com/${username}.png` : AVATAR_FALLBACK;
  img.alt = `Avatar ${member.name || "membre"}`;
  img.loading = "lazy";
  img.decoding = "async";
  img.width = 32;
  img.height = 32;
  img.className = "w-8 h-8 rounded-full border border-white/20 object-cover";
  img.addEventListener(
    "error",
    () => {
      img.src = AVATAR_FALLBACK;
    },
    { once: true },
  );

  const text = document.createElement("span");
  text.className =
    "text-sm font-bold text-gray-300 group-hover:text-white transition-colors";
  text.textContent = member.name || "Membre";

  anchor.appendChild(img);
  anchor.appendChild(text);
  return anchor;
}

function renderFooterLinks(members, container) {
  clearElement(container);
  members.forEach((member, index) => {
    if (index > 0) {
      const separator = document.createElement("span");
      separator.className = "opacity-50";
      separator.textContent = "·";
      container.appendChild(separator);
    }
    const link = document.createElement("a");
    link.href = safeExternalUrl(`https://github.com/${member.github || ""}`);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "hover:text-white transition-colors";
    link.textContent = member.name || "Membre";
    container.appendChild(link);
  });
}

function renderLoadError(elements, retryHandler) {
  const {
    gamesContainer,
    favoritesContainer,
    projectsContainer,
    membersContainer,
    footerLinks,
  } = elements;
  clearElement(membersContainer);
  clearElement(footerLinks);
  clearElement(gamesContainer);
  if (favoritesContainer) clearElement(favoritesContainer);
  clearElement(projectsContainer);

  const errorCard = document.createElement("div");
  errorCard.className = "bg-darkCard p-6 md:p-8 text-gray-300 space-y-4";
  const message = document.createElement("p");
  message.textContent =
    "Impossible de charger les données du portail. Vérifie la présence de data.json.";
  const retryButton = document.createElement("button");
  retryButton.type = "button";
  retryButton.className =
    "px-4 py-2 rounded-lg bg-white/10 border border-white/20 font-bold text-xs uppercase tracking-wider hover:bg-white/20 transition-colors";
  retryButton.textContent = "Réessayer";
  retryButton.addEventListener("click", retryHandler);

  errorCard.appendChild(message);
  errorCard.appendChild(retryButton);
  gamesContainer.appendChild(errorCard);
}

function createEmptyStateCard(message) {
  const card = document.createElement("div");
  card.className = "bg-darkCard p-6 md:p-8 text-gray-300 md:col-span-2";
  card.textContent = message;
  return card;
}

function buildResultsLabel(count, noun) {
  return count <= 1 ? `${count} ${noun} trouvé` : `${count} ${noun}s trouvés`;
}

// Utility: debounce function to reduce rerenders
const debounce = (fn, ms) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

window.addEventListener("DOMContentLoaded", async () => {
  const membersContainer = document.getElementById("members-container");
  const gamesContainer = document.getElementById("games-container");
  const favoritesSection = document.getElementById("favorites-section");
  const favoritesContainer = document.getElementById("favorites-container");
  const projectsContainer = document.getElementById("projects-container");
  const footerLinks = document.getElementById("footer-links");
  const currentYear = document.getElementById("current-year");
  const gamesSection = document.getElementById("games-section");
  const projectsSection = document.getElementById("projects-section");

  // --- Contrôles globaux ---
  const globalSortSelect = document.getElementById("global-sort");
  const globalAuthorFilterSelect = document.getElementById(
    "global-author-filter",
  );
  const globalSearchInput = document.getElementById("global-search");
  const globalOrderToggle = document.getElementById("global-order-toggle");
  const globalResetFiltersButton = document.getElementById(
    "global-reset-filters",
  );
  const globalFavoritesOnlyToggle = document.getElementById(
    "global-favorites-only-toggle",
  );

  const gamesRecentNote = document.getElementById("games-recent-note");
  const gamesResultsCount = document.getElementById("games-results-count");
  const favoritesRecentNote = document.getElementById("favorites-recent-note");
  const favoritesResultsCount = document.getElementById(
    "favorites-results-count",
  );
  const projectsRecentNote = document.getElementById("projects-recent-note");
  const projectsResultsCount = document.getElementById(
    "projects-results-count",
  );

  if (
    !membersContainer ||
    !gamesContainer ||
    !favoritesContainer ||
    !projectsContainer ||
    !footerLinks ||
    !currentYear
  ) {
    return;
  }

  currentYear.textContent = String(new Date().getFullYear());

  let cachedAppData = null;
  const FAVORITES_STORAGE_KEY = "ksosFavorites";

  const readFavorites = () => {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]",
      );
      return Array.isArray(parsed)
        ? parsed.filter((value) => typeof value === "string")
        : [];
    } catch (_) {
      return [];
    }
  };

  const buildFavoriteKey = (item) => {
    if (item && item.id) return String(item.id);
    const title = String(item.title || "")
      .trim()
      .toLowerCase();
    const author = String(item.author || "")
      .trim()
      .toLowerCase();
    const github = String(item.github || "")
      .trim()
      .toLowerCase();
    const url = String(item.url || "")
      .trim()
      .toLowerCase();
    return `${author}::${title}::${github || url}`;
  };

  let favoriteKeys = new Set(readFavorites());

  const saveFavorites = () => {
    localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(Array.from(favoriteKeys)),
    );
  };

  const isFavorite = (item) => favoriteKeys.has(buildFavoriteKey(item));

  const computeOldKey = (item) => {
    const title = String(item.title || "")
      .trim()
      .toLowerCase();
    const author = String(item.author || "")
      .trim()
      .toLowerCase();
    const github = String(item.github || "")
      .trim()
      .toLowerCase();
    const url = String(item.url || "")
      .trim()
      .toLowerCase();
    return `${author}::${title}::${github || url}`;
  };

  const isFavoriteWithFallback = (item) => {
    const key = buildFavoriteKey(item);
    if (favoriteKeys.has(key)) return true;
    // fallback: check old-style key
    const oldKey = computeOldKey(item);
    return favoriteKeys.has(oldKey);
  };

  const toggleFavorite = (item) => {
    const key = buildFavoriteKey(item);
    if (!key) return;

    if (favoriteKeys.has(key)) {
      favoriteKeys.delete(key);
    } else {
      favoriteKeys.add(key);
    }

    saveFavorites();
    renderAll();
  };

  // Migrate stored favorites from old composite keys to the new `id` when possible
  const migrateFavorites = (appData) => {
    try {
      const stored = readFavorites();
      const items = [...(appData.games || []), ...(appData.projects || [])];
      const idToItem = new Map();
      items.forEach((it) => {
        if (it && it.id) idToItem.set(String(it.id), it);
      });

      const oldKeyToId = new Map();
      items.forEach((it) => {
        const oldKey = computeOldKey(it);
        if (it && it.id) oldKeyToId.set(oldKey, String(it.id));
      });

      let changed = false;
      const newSet = new Set();
      stored.forEach((k) => {
        if (!k) return;
        if (idToItem.has(k)) {
          newSet.add(k);
          return;
        }
        if (oldKeyToId.has(k)) {
          newSet.add(oldKeyToId.get(k));
          changed = true;
          return;
        }
        // keep unknown entries as-is (avoid data loss)
        newSet.add(k);
      });

      favoriteKeys = new Set(newSet);
      if (changed) saveFavorites();
    } catch (_) {
      // ignore
    }
  };

  // État global unique
  let sortCriteria = localStorage.getItem("ksosSort") || "default";
  let sortOrder = localStorage.getItem("ksosOrder") || "asc";
  let authorFilter = localStorage.getItem("ksosAuthor") || "all";
  let searchQuery = localStorage.getItem("ksosSearch") || "";
  let showOnlyFavorites = localStorage.getItem("ksosShowOnlyFavorites") === "1";

  let controlsBound = false;

  const updateOrderToggleLabel = () => {
    if (!globalOrderToggle) return;
    const isDesc = sortOrder === "desc";
    globalOrderToggle.textContent = isDesc ? "Ordre: Desc" : "Ordre: Asc";
    globalOrderToggle.setAttribute("aria-pressed", String(isDesc));
  };

  const initializeFavoritesOnlyToggle = () => {
    if (!globalFavoritesOnlyToggle) return;

    globalFavoritesOnlyToggle.setAttribute(
      "aria-pressed",
      String(showOnlyFavorites),
    );

    if (controlsBound) return;

    globalFavoritesOnlyToggle.addEventListener("click", () => {
      showOnlyFavorites = !showOnlyFavorites;
      localStorage.setItem(
        "ksosShowOnlyFavorites",
        showOnlyFavorites ? "1" : "0",
      );
      globalFavoritesOnlyToggle.setAttribute(
        "aria-pressed",
        String(showOnlyFavorites),
      );
      renderAll();
    });
  };

  // Rend les deux sections avec le même filtre
  const renderAll = () => {
    if (!cachedAppData) return;

    // Toggle visibility of Games and Projects sections when showing favorites only
    if (gamesSection) {
      gamesSection.classList.toggle("hidden", showOnlyFavorites);
    }
    if (projectsSection) {
      projectsSection.classList.toggle("hidden", showOnlyFavorites);
    }

    const criteria = globalSortSelect?.value || sortCriteria;
    const filterValue = globalAuthorFilterSelect?.value || authorFilter;
    const query = globalSearchInput?.value ?? searchQuery;

    const createCatalogCard = (item) =>
      createCardElement(item, {
        isFavorite: isFavoriteWithFallback(item),
        onToggleFavorite: toggleFavorite,
      });

    // --- Jeux ---
    const allGames = Array.isArray(cachedAppData.games)
      ? cachedAppData.games
      : [];
    const allProjects = Array.isArray(cachedAppData.projects)
      ? cachedAppData.projects
      : [];

    if (!showOnlyFavorites) {
      const processedGames = sortAndFilterItems(
        allGames,
        criteria,
        sortOrder,
        filterValue,
        query,
      );

      clearElement(gamesContainer);
      if (processedGames.length === 0) {
        gamesContainer.appendChild(
          createEmptyStateCard("Aucun jeu ne correspond à votre recherche."),
        );
      } else {
        processedGames.forEach((game) =>
          gamesContainer.appendChild(createCatalogCard(game)),
        );
      }

      if (gamesRecentNote) {
        const hasDates = allGames.some((g) => getItemTimestamp(g) !== null);
        gamesRecentNote.classList.toggle(
          "hidden",
          !(criteria === "recent" && !hasDates),
        );
      }
      if (gamesResultsCount) {
        gamesResultsCount.textContent = buildResultsLabel(
          processedGames.length,
          "jeu",
        );
      }
    } else {
      clearElement(gamesContainer);
      if (gamesRecentNote) gamesRecentNote.classList.add("hidden");
      if (gamesResultsCount) gamesResultsCount.textContent = "";
    }

    // --- Favoris ---
    const dedupedCatalog = new Map();
    [...allGames, ...allProjects].forEach((item) => {
      dedupedCatalog.set(buildFavoriteKey(item), item);
    });

    const favoriteItems = Array.from(dedupedCatalog.values()).filter((item) =>
      isFavorite(item),
    );

    const shouldShowFavorites = favoriteItems.length > 0;
    if (favoritesSection) {
      favoritesSection.classList.toggle("hidden", !shouldShowFavorites);
    }

    if (!shouldShowFavorites) {
      clearElement(favoritesContainer);
      if (favoritesRecentNote) favoritesRecentNote.classList.add("hidden");
      if (favoritesResultsCount) favoritesResultsCount.textContent = "";
    } else {
      const processedFavorites = sortAndFilterItems(
        favoriteItems,
        criteria,
        sortOrder,
        filterValue,
        query,
      );

      clearElement(favoritesContainer);
      if (processedFavorites.length === 0) {
        favoritesContainer.appendChild(
          createEmptyStateCard("Aucun favori ne correspond a votre recherche."),
        );
      } else {
        processedFavorites.forEach((favorite) =>
          favoritesContainer.appendChild(createCatalogCard(favorite)),
        );
      }

      if (favoritesRecentNote) {
        const hasDates = favoriteItems.some(
          (item) => getItemTimestamp(item) !== null,
        );
        favoritesRecentNote.classList.toggle(
          "hidden",
          !(criteria === "recent" && !hasDates),
        );
      }
      if (favoritesResultsCount) {
        favoritesResultsCount.textContent = buildResultsLabel(
          processedFavorites.length,
          "favori",
        );
      }
    }

    // --- Projets ---
    if (!showOnlyFavorites) {
      const processedProjects = sortAndFilterItems(
        allProjects,
        criteria,
        sortOrder,
        filterValue,
        query,
      );

      clearElement(projectsContainer);
      if (processedProjects.length === 0) {
        projectsContainer.appendChild(
          createEmptyStateCard("Aucun projet ne correspond à votre recherche."),
        );
      } else {
        processedProjects.forEach((project) =>
          projectsContainer.appendChild(createCatalogCard(project)),
        );
      }

      if (projectsRecentNote) {
        const hasDates = allProjects.some((p) => getItemTimestamp(p) !== null);
        projectsRecentNote.classList.toggle(
          "hidden",
          !(criteria === "recent" && !hasDates),
        );
      }
      if (projectsResultsCount) {
        projectsResultsCount.textContent = buildResultsLabel(
          processedProjects.length,
          "projet",
        );
      }
    } else {
      clearElement(projectsContainer);
      if (projectsRecentNote) projectsRecentNote.classList.add("hidden");
      if (projectsResultsCount) projectsResultsCount.textContent = "";
    }
    observeCards();
  };

  const observeCards = () => {
    const cardObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("card-visible");
            cardObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    document
      .querySelectorAll(".bento-grid > article, #projects-container > article")
      .forEach((card) => {
        if (!card.classList.contains("card-visible")) {
          card.classList.add("card-enter");
          cardObserver.observe(card);
        }
      });
  };

  const setupControls = (appData) => {
    // Initialize favorites-only toggle independently, before checking other controls
    initializeFavoritesOnlyToggle();

    if (!globalSortSelect || !globalAuthorFilterSelect || !globalOrderToggle)
      return;

    // Construire les options d'auteurs à partir des deux collections
    const allAuthors = buildAuthorOptions(
      {
        members: appData.members,
        games: [...(appData.games || []), ...(appData.projects || [])],
      },
      "games",
    );

    clearElement(globalAuthorFilterSelect);
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "Tous";
    globalAuthorFilterSelect.appendChild(allOption);

    allAuthors.forEach((author) => {
      const option = document.createElement("option");
      option.value = author.key;
      option.textContent = author.label;
      globalAuthorFilterSelect.appendChild(option);
    });

    // Restaurer l'état sauvegardé
    if (globalSortSelect.querySelector(`option[value="${sortCriteria}"]`)) {
      globalSortSelect.value = sortCriteria;
    } else {
      sortCriteria = "default";
      globalSortSelect.value = "default";
    }

    if (
      globalAuthorFilterSelect.querySelector(`option[value="${authorFilter}"]`)
    ) {
      globalAuthorFilterSelect.value = authorFilter;
    } else {
      authorFilter = "all";
      globalAuthorFilterSelect.value = "all";
    }

    if (globalSearchInput) globalSearchInput.value = searchQuery;

    updateOrderToggleLabel();

    if (!controlsBound) {
      globalSortSelect.addEventListener("change", (e) => {
        sortCriteria = e.target.value;
        localStorage.setItem("ksosSort", sortCriteria);
        renderAll();
      });

      globalAuthorFilterSelect.addEventListener("change", (e) => {
        authorFilter = e.target.value;
        localStorage.setItem("ksosAuthor", authorFilter);
        renderAll();
      });

      if (globalSearchInput) {
        const debouncedSearch = debounce(() => {
          localStorage.setItem("ksosSearch", searchQuery);
          renderAll();
        }, 150);
        globalSearchInput.addEventListener("input", (e) => {
          searchQuery = e.target.value;
          debouncedSearch();
        });
      }

      globalOrderToggle.addEventListener("click", () => {
        sortOrder = sortOrder === "asc" ? "desc" : "asc";
        localStorage.setItem("ksosOrder", sortOrder);
        updateOrderToggleLabel();
        renderAll();
      });

      if (globalResetFiltersButton) {
        globalResetFiltersButton.addEventListener("click", () => {
          sortCriteria = "default";
          sortOrder = "asc";
          authorFilter = "all";
          searchQuery = "";
          showOnlyFavorites = false;

          localStorage.setItem("ksosShowOnlyFavorites", "0");
          localStorage.setItem("ksosSort", sortCriteria);
          localStorage.setItem("ksosOrder", sortOrder);
          localStorage.setItem("ksosAuthor", authorFilter);
          localStorage.setItem("ksosSearch", searchQuery);

          globalSortSelect.value = "default";
          globalAuthorFilterSelect.value = "all";
          if (globalSearchInput) globalSearchInput.value = "";
          if (globalFavoritesOnlyToggle) {
            globalFavoritesOnlyToggle.setAttribute("aria-pressed", "false");
          }
          updateOrderToggleLabel();
          renderAll();
        });
      }

      controlsBound = true;
    }
  };

  const refreshRepoDatesLast = document.getElementById(
    "refresh-repo-dates-last",
  );
  const githubDot = document.getElementById("github-dot");
  function formatLastChecked(timestamp) {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days}j`;
  }

  function updateGithubSyncUI(success) {
    if (success) {
      if (githubDot) {
        githubDot.className = "w-2 h-2 rounded-full bg-emerald-400";
      }
    } else {
      if (githubDot) {
        githubDot.className = "w-2 h-2 rounded-full bg-gray-500";
      }
    }
    if (refreshRepoDatesLast) {
      const stored = localStorage.getItem(REPO_DATE_CACHE_KEY);
      if (stored) {
        try {
          const cache = JSON.parse(stored);
          const times = Object.values(cache).map(
            (e) => Number(e.fetchedAt) || 0,
          );
          const latest = Math.max(...times, 0);
          if (latest > 0) {
            refreshRepoDatesLast.textContent = `Dernière vérification : ${formatLastChecked(latest)}`;
          }
        } catch (_) {}
      }
    }
  }

  const renderData = async () => {
    const appData = await fetchAppData();
    cachedAppData = await enrichAppDataWithGithubDates(appData);
    // Attempt migration of existing favorites to item `id` when possible
    migrateFavorites(cachedAppData);

    clearElement(membersContainer);
    clearElement(favoritesContainer);
    clearElement(projectsContainer);

    (cachedAppData.members || []).forEach((member) => {
      membersContainer.appendChild(createMemberBadgeElement(member));
    });

    setupControls(cachedAppData);
    renderAll();

    renderFooterLinks(cachedAppData.members || [], footerLinks);
  };

  try {
    await renderData();
  } catch (error) {
    console.error(error);
    renderLoadError(
      {
        gamesContainer,
        favoritesContainer,
        projectsContainer,
        membersContainer,
        footerLinks,
      },
      async () => {
        try {
          await renderData();
        } catch (retryError) {
          console.error(retryError);
        }
      },
    );
  }

  updateGithubSyncUI(true);

  // --- Logique Modale et Paramètres ---
  const notch = document.getElementById("settings-notch");
  const settingsOverlay = document.getElementById("settings-modal-overlay");
  const settingsModal = settingsOverlay?.querySelector(".custom-modal");
  const closeSettings = document.getElementById("close-settings");
  const themeToggle = document.getElementById("theme-toggle");
  const themeLabel = document.getElementById("theme-label");
  const introToggle = document.getElementById("intro-toggle");
  const refreshRepoDatesButton = document.getElementById("refresh-repo-dates");
  const refreshRepoDatesStatus = document.getElementById(
    "refresh-repo-dates-status",
  );
  const themeRadios = document.querySelectorAll('input[name="color-theme"]');
  const mainContent = document.getElementById("main-content");

  if (
    !notch ||
    !settingsOverlay ||
    !settingsModal ||
    !closeSettings ||
    !themeToggle ||
    !themeLabel
  )
    return;

  const focusableSelector =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  let lastFocusedElement = null;
  let modalOpen = false;

  const getFocusableInModal = () =>
    Array.from(settingsModal.querySelectorAll(focusableSelector)).filter(
      (el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"),
    );

  const openSettings = () => {
    if (modalOpen) return;
    modalOpen = true;
    lastFocusedElement = document.activeElement;

    settingsOverlay.classList.remove("opacity-0", "pointer-events-none");
    settingsOverlay.classList.add("opacity-100", "pointer-events-auto");
    settingsModal.classList.add("scale-100");
    settingsOverlay.setAttribute("aria-hidden", "false");
    notch.setAttribute("aria-expanded", "true");
    if (mainContent) mainContent.setAttribute("inert", "");

    const [firstFocusable] = getFocusableInModal();
    if (firstFocusable) firstFocusable.focus();
  };

  const closeModal = () => {
    if (!modalOpen) return;
    modalOpen = false;

    settingsOverlay.classList.remove("opacity-100", "pointer-events-auto");
    settingsOverlay.classList.add("opacity-0", "pointer-events-none");
    settingsModal.classList.remove("scale-100");
    settingsOverlay.setAttribute("aria-hidden", "true");
    notch.setAttribute("aria-expanded", "false");
    if (mainContent) mainContent.removeAttribute("inert");

    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
  };

  notch.addEventListener("click", openSettings);
  closeSettings.addEventListener("click", closeModal);

  settingsOverlay.addEventListener("click", (event) => {
    if (event.target === settingsOverlay) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (!modalOpen) return;
    if (event.key === "Escape") {
      closeModal();
      return;
    }
    if (event.key === "Tab") {
      const focusable = getFocusableInModal();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  const setThemeLabel = (isLight) => {
    themeLabel.textContent = isLight ? "Mode Clair ☀️" : "Mode Sombre 🌙";
  };

  const isLightTheme = localStorage.getItem("ksosTheme") === "light";
  themeToggle.checked = isLightTheme;
  setThemeLabel(isLightTheme);

  themeToggle.addEventListener("change", (event) => {
    if (event.target.checked) {
      document.documentElement.classList.add("light-mode");
      localStorage.setItem("ksosTheme", "light");
      setThemeLabel(true);
    } else {
      document.documentElement.classList.remove("light-mode");
      localStorage.setItem("ksosTheme", "dark");
      setThemeLabel(false);
    }
  });

  if (introToggle) {
    const introEveryVisit = localStorage.getItem("ksosIntroEnabled") === "1";
    introToggle.checked = introEveryVisit;

    introToggle.addEventListener("change", (event) => {
      localStorage.setItem(
        "ksosIntroEnabled",
        event.target.checked ? "1" : "0",
      );
    });
  }

  function triggerGithubRefresh() {
    if (!refreshRepoDatesButton) return;
    refreshRepoDatesButton.disabled = true;
    refreshRepoDatesButton.classList.add("opacity-50", "cursor-not-allowed");
    if (refreshRepoDatesStatus) {
      refreshRepoDatesStatus.textContent = "Vérification en cours...";
    }

    clearRepoDateCache();
    renderData()
      .then(() => {
        if (refreshRepoDatesStatus) {
          refreshRepoDatesStatus.textContent = "Dates mises à jour ✓";
        }
        updateGithubSyncUI(true);
      })
      .catch((error) => {
        console.error(error);
        if (refreshRepoDatesStatus) {
          refreshRepoDatesStatus.textContent =
            "Échec — les dates en cache ont été conservées.";
        }
        updateGithubSyncUI(false);
      })
      .finally(() => {
        refreshRepoDatesButton.disabled = false;
        refreshRepoDatesButton.classList.remove(
          "opacity-50",
          "cursor-not-allowed",
        );
      });
  }

  if (refreshRepoDatesButton) {
    refreshRepoDatesButton.addEventListener("click", triggerGithubRefresh);
  }

  const updateThemeOptionSelection = () => {
    themeRadios.forEach((radio) => {
      if (radio.parentElement) {
        radio.parentElement.classList.toggle(
          "theme-option-selected",
          radio.checked,
        );
      }
    });
  };

  const activeColorTheme = localStorage.getItem("ksosColorTheme") || "default";
  const activeRadio = document.querySelector(
    `input[name="color-theme"][value="${activeColorTheme}"]`,
  );
  if (activeRadio) activeRadio.checked = true;
  updateThemeOptionSelection();

  themeRadios.forEach((radio) => {
    radio.addEventListener("change", (event) => {
      const selected = event.target.value;
      document.documentElement.setAttribute("data-theme", selected);
      localStorage.setItem("ksosColorTheme", selected);
      updateThemeOptionSelection();
    });
  });

  // --- Logique Splash Screen ---
  const splashScreen = document.getElementById("splash-screen");
  const skipSplashButton = document.getElementById("skip-splash");
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const introPreference = localStorage.getItem("ksosIntroEnabled");
  const introAlreadySeen = localStorage.getItem(INTRO_SEEN_KEY) === "1";
  const introEnabled =
    introPreference === "1" || (introPreference === null && !introAlreadySeen);
  const splashTimers = [];

  const clearSplashTimers = () => {
    splashTimers.forEach((timer) => clearTimeout(timer));
    splashTimers.length = 0;
  };

  const revealMainContent = () => {
    if (!mainContent) return;
    mainContent.classList.add("animate-fade-in");
    mainContent.classList.remove("opacity-0");
  };

  const removeSplash = () => {
    clearSplashTimers();
    localStorage.setItem(INTRO_SEEN_KEY, "1");
    if (splashScreen) splashScreen.remove();
    document.body.style.overflow = "";
  };

  if (!splashScreen || prefersReducedMotion || !introEnabled) {
    revealMainContent();
    removeSplash();
    return;
  }

  const skipSplash = () => {
    revealMainContent();
    removeSplash();
  };

  if (skipSplashButton) skipSplashButton.addEventListener("click", skipSplash);

  document.body.style.overflow = "hidden";
  window.scrollTo(0, 0);

  splashTimers.push(
    setTimeout(() => splashScreen.classList.add("splash-step-2"), 500),
  );
  splashTimers.push(
    setTimeout(() => {
      splashScreen.classList.add("splash-step-3");
      revealMainContent();
    }, 1800),
  );
  splashTimers.push(setTimeout(() => removeSplash(), 2800));
});

const SVG_NS = "http://www.w3.org/2000/svg";
const AVATAR_FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%23121726'/%3E%3Cpath d='M32 34c8.3 0 15 6.7 15 15H17c0-8.3 6.7-15 15-15zm0-18a9 9 0 110 18 9 9 0 010-18z' fill='%23d1d5db'/%3E%3C/svg%3E";
const REPO_DATE_CACHE_KEY = "ksosRepoDatesCacheV1";
const REPO_DATE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const DATE_SYNC_STATUS = {
  rateLimited: false,
  fetchFailures: 0,
  githubDatesApplied: 0,
};

function safeExternalUrl(url) {
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.href;
    }
  } catch (_) {
    // Ignore malformed URLs and fallback to '#'.
  }
  return "#";
}

function clearElement(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function debounce(fn, delayMs) {
  let timeoutId;

  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

function delayToNextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
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

function getCachedRepoDate(cache, slug) {
  const entry = cache[slug];
  if (!entry || typeof entry.pushedAt !== "string" || !entry.fetchedAt) {
    return null;
  }

  const isFresh = Date.now() - Number(entry.fetchedAt) < REPO_DATE_CACHE_TTL_MS;
  return isFresh ? entry.pushedAt : null;
}

async function fetchRepoPushedAt(slug) {
  try {
    const response = await fetch(`https://api.github.com/repos/${slug}`, {
      headers: {
        Accept: "application/vnd.github+json",
      },
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
    if (!pushedAt) return;
    datesBySlug[slug] = pushedAt;
    cache[slug] = {
      pushedAt,
      fetchedAt: Date.now(),
    };
  });

  return clonedItems.map((item) => {
    const slug = extractGithubRepoSlug(item.github);
    const pushedAt = slug ? datesBySlug[slug] : null;
    if (!pushedAt) return item;

    return {
      ...item,
      updatedAt: pushedAt,
    };
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

  return {
    ...appData,
    games,
    projects,
  };
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

function createCardElement(item) {
  const card = document.createElement("article");
  card.className = "bg-darkCard group flex flex-col p-6 md:p-8 h-full";

  const header = document.createElement("div");
  header.className = "flex items-start justify-between mb-4 relative z-10";

  const headerLeft = document.createElement("div");
  headerLeft.className = "flex items-center gap-4";

  const icon = document.createElement("div");
  icon.className =
    "w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform duration-300";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = item.icon || "🧩";

  const titleWrapper = document.createElement("div");

  const titleLink = document.createElement("a");
  titleLink.href = safeExternalUrl(item.url);
  titleLink.target = "_blank";
  titleLink.rel = "noopener noreferrer";
  titleLink.className = `text-xl md:text-2xl font-black font-display text-white ${item.hoverClass || ""} transition-colors flex items-center gap-2`;
  titleLink.textContent = item.title || "Projet";

  const extMark = document.createElement("span");
  extMark.className =
    "opacity-50 group-hover:opacity-100 transform -translate-x-1 translate-y-1 group-hover:translate-x-0 group-hover:translate-y-0 transition-all text-sm";
  extMark.textContent = "↗";
  titleLink.appendChild(document.createTextNode(" "));
  titleLink.appendChild(extMark);

  const byline = document.createElement("p");
  byline.className =
    "text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1";
  byline.textContent = `par ${item.author || "inconnu"}`;

  titleWrapper.appendChild(titleLink);
  titleWrapper.appendChild(byline);

  headerLeft.appendChild(icon);
  headerLeft.appendChild(titleWrapper);
  header.appendChild(headerLeft);

  const itemTimestamp = getItemTimestamp(item);
  if (itemTimestamp !== null) {
    const datePill = document.createElement("span");
    const isNew = Date.now() - itemTimestamp <= 30 * 24 * 60 * 60 * 1000;
    datePill.className = isNew
      ? "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
      : "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 text-gray-400 border border-white/10";
    datePill.textContent = isNew
      ? "Nouveau"
      : new Intl.DateTimeFormat("fr-FR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(itemTimestamp);
    header.appendChild(datePill);
  }

  const description = document.createElement("p");
  description.className =
    "text-gray-400 text-sm md:text-base leading-relaxed flex-1 relative z-10 mb-4";
  description.textContent = item.desc || "";

  const techList = document.createElement("div");
  techList.className = "flex flex-wrap gap-2 mb-6 relative z-10";
  const techs = Array.isArray(item.techs) ? item.techs : [];
  techs.forEach((tech) => {
    const chip = document.createElement("span");
    chip.className =
      "px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] font-bold text-gray-400 uppercase tracking-wider";
    chip.textContent = String(tech);
    techList.appendChild(chip);
  });

  const bottom = document.createElement("div");
  bottom.className =
    "flex items-center justify-between relative z-10 pt-6 border-t border-white/5";

  const badge = document.createElement("span");
  badge.className = `px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${item.badgeClass || ""}`;
  badge.textContent = item.tagText || "Projet";

  const codeLink = document.createElement("a");
  codeLink.href = safeExternalUrl(item.github);
  codeLink.target = "_blank";
  codeLink.rel = "noopener noreferrer";
  codeLink.className =
    "text-xs font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-widest flex items-center gap-2";
  codeLink.setAttribute(
    "aria-label",
    `Voir le code de ${item.title || "ce projet"}`,
  );
  codeLink.appendChild(createGithubIcon());
  codeLink.appendChild(document.createTextNode("Code"));

  bottom.appendChild(badge);
  bottom.appendChild(codeLink);

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

async function fetchAppData() {
  const response = await fetch("./data.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Impossible de charger data.json");
  }
  return response.json();
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
  const { gamesContainer, projectsContainer, membersContainer, footerLinks } =
    elements;

  clearElement(membersContainer);
  clearElement(footerLinks);
  clearElement(gamesContainer);
  clearElement(projectsContainer);

  const errorCard = document.createElement("div");
  errorCard.className = "bg-darkCard p-6 md:p-8 text-gray-300 space-y-4";

  const message = document.createElement("p");
  message.textContent =
    "Impossible de charger les donnees du portail. Verifie la presence de data.json.";

  const retryButton = document.createElement("button");
  retryButton.type = "button";
  retryButton.className =
    "px-4 py-2 rounded-lg bg-white/10 border border-white/20 font-bold text-xs uppercase tracking-wider hover:bg-white/20 transition-colors";
  retryButton.textContent = "Reessayer";
  retryButton.addEventListener("click", retryHandler);

  errorCard.appendChild(message);
  errorCard.appendChild(retryButton);
  gamesContainer.appendChild(errorCard);
}

function parseItemDate(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getItemTimestamp(item) {
  return (
    parseItemDate(item.updatedAt) || // Priorité 1 : Date de dernière modification GitHub
    parseItemDate(item.createdAt) || // Priorité 2 : Date de création manuelle (fallback)
    parseItemDate(item.date)
  );
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

function createEmptyStateCard(message) {
  const card = document.createElement("div");
  card.className = "bg-darkCard p-6 md:p-8 text-gray-300 md:col-span-2";
  card.textContent = message;
  return card;
}

function buildResultsLabel(count, noun) {
  return count <= 1 ? `${count} ${noun} trouve` : `${count} ${noun} trouves`;
}

function sortAndFilterItems(items, criteria, order, authorFilter, searchQuery) {
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
        {
          sensitivity: "base",
        },
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

window.addEventListener("DOMContentLoaded", async () => {
  const membersContainer = document.getElementById("members-container");
  const gamesContainer = document.getElementById("games-container");
  const projectsContainer = document.getElementById("projects-container");
  const footerLinks = document.getElementById("footer-links");
  const currentYear = document.getElementById("current-year");
  const gamesSortSelect = document.getElementById("games-sort");
  const gamesAuthorFilterSelect = document.getElementById(
    "games-author-filter",
  );
  const gamesOrderToggle = document.getElementById("games-order-toggle");
  const gamesRecentNote = document.getElementById("games-recent-note");
  const gamesResultsCount = document.getElementById("games-results-count");
  const gamesSearchInput = document.getElementById("games-search");
  const gamesResetFiltersButton = document.getElementById(
    "games-reset-filters",
  );
  const projectsSortSelect = document.getElementById("projects-sort");
  const projectsAuthorFilterSelect = document.getElementById(
    "projects-author-filter",
  );
  const projectsOrderToggle = document.getElementById("projects-order-toggle");
  const projectsRecentNote = document.getElementById("projects-recent-note");
  const projectsResultsCount = document.getElementById(
    "projects-results-count",
  );
  const projectsSearchInput = document.getElementById("projects-search");
  const projectsResetFiltersButton = document.getElementById(
    "projects-reset-filters",
  );

  if (
    !membersContainer ||
    !gamesContainer ||
    !projectsContainer ||
    !footerLinks ||
    !currentYear
  ) {
    return;
  }

  currentYear.textContent = String(new Date().getFullYear());

  let cachedAppData = null;
  let gamesSortCriteria = localStorage.getItem("ksosGamesSort") || "default";
  let gamesSortOrder = localStorage.getItem("ksosGamesOrder") || "asc";
  let gamesAuthorFilter = localStorage.getItem("ksosGamesAuthor") || "all";
  let gamesSearchQuery = localStorage.getItem("ksosGamesSearch") || "";
  let projectsSortCriteria =
    localStorage.getItem("ksosProjectsSort") || "default";
  let projectsSortOrder = localStorage.getItem("ksosProjectsOrder") || "asc";
  let projectsAuthorFilter =
    localStorage.getItem("ksosProjectsAuthor") || "all";
  let projectsSearchQuery = localStorage.getItem("ksosProjectsSearch") || "";
  let gamesControlsBound = false;
  let projectsControlsBound = false;

  const updateOrderToggleLabel = () => {
    if (!gamesOrderToggle) return;
    const isDesc = gamesSortOrder === "desc";
    gamesOrderToggle.textContent = isDesc ? "Ordre: Desc" : "Ordre: Asc";
    gamesOrderToggle.setAttribute("aria-pressed", String(isDesc));
  };

  const renderGames = () => {
    if (!cachedAppData) return;

    const allGames = Array.isArray(cachedAppData.games)
      ? cachedAppData.games
      : [];
    const criteria = gamesSortSelect?.value || gamesSortCriteria;
    const filterValue = gamesAuthorFilterSelect?.value || gamesAuthorFilter;
    const searchQuery = gamesSearchInput?.value ?? gamesSearchQuery;

    const processedGames = sortAndFilterItems(
      allGames,
      criteria,
      gamesSortOrder,
      filterValue,
      searchQuery,
    );

    clearElement(gamesContainer);
    if (processedGames.length === 0) {
      gamesContainer.appendChild(
        createEmptyStateCard("Aucun jeu ne correspond a votre recherche."),
      );
    } else {
      processedGames.forEach((game) => {
        gamesContainer.appendChild(createCardElement(game));
      });
    }

    if (gamesRecentNote) {
      const hasDates = allGames.some((game) => getItemTimestamp(game) !== null);
      const showNote = criteria === "recent" && !hasDates;
      gamesRecentNote.classList.toggle("hidden", !showNote);
    }

    if (gamesResultsCount) {
      gamesResultsCount.textContent = buildResultsLabel(
        processedGames.length,
        "jeu",
      );
    }
  };

  const updateProjectsOrderToggleLabel = () => {
    if (!projectsOrderToggle) return;
    const isDesc = projectsSortOrder === "desc";
    projectsOrderToggle.textContent = isDesc ? "Ordre: Desc" : "Ordre: Asc";
    projectsOrderToggle.setAttribute("aria-pressed", String(isDesc));
  };

  const renderProjects = () => {
    if (!cachedAppData) return;

    const allProjects = Array.isArray(cachedAppData.projects)
      ? cachedAppData.projects
      : [];
    const criteria = projectsSortSelect?.value || projectsSortCriteria;
    const filterValue =
      projectsAuthorFilterSelect?.value || projectsAuthorFilter;
    const searchQuery = projectsSearchInput?.value ?? projectsSearchQuery;

    const processedProjects = sortAndFilterItems(
      allProjects,
      criteria,
      projectsSortOrder,
      filterValue,
      searchQuery,
    );

    clearElement(projectsContainer);
    if (processedProjects.length === 0) {
      projectsContainer.appendChild(
        createEmptyStateCard("Aucun projet ne correspond a votre recherche."),
      );
    } else {
      processedProjects.forEach((project) => {
        projectsContainer.appendChild(createCardElement(project));
      });
    }

    if (projectsRecentNote) {
      const hasDates = allProjects.some(
        (project) => getItemTimestamp(project) !== null,
      );
      const showNote = criteria === "recent" && !hasDates;
      projectsRecentNote.classList.toggle("hidden", !showNote);
    }

    if (projectsResultsCount) {
      projectsResultsCount.textContent = buildResultsLabel(
        processedProjects.length,
        "projet",
      );
    }
  };

  const setupGamesControls = (appData) => {
    if (!gamesSortSelect || !gamesAuthorFilterSelect || !gamesOrderToggle) {
      return;
    }

    const availableAuthors = buildAuthorOptions(appData, "games");

    clearElement(gamesAuthorFilterSelect);
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "Tous";
    gamesAuthorFilterSelect.appendChild(allOption);

    availableAuthors.forEach((author) => {
      const option = document.createElement("option");
      option.value = author.key;
      option.textContent = author.label;
      gamesAuthorFilterSelect.appendChild(option);
    });

    if (gamesSortSelect.querySelector(`option[value="${gamesSortCriteria}"]`)) {
      gamesSortSelect.value = gamesSortCriteria;
    } else {
      gamesSortCriteria = "default";
      gamesSortSelect.value = "default";
    }

    if (
      gamesAuthorFilterSelect.querySelector(
        `option[value="${gamesAuthorFilter}"]`,
      )
    ) {
      gamesAuthorFilterSelect.value = gamesAuthorFilter;
    } else {
      gamesAuthorFilter = "all";
      gamesAuthorFilterSelect.value = "all";
    }

    if (gamesSearchInput) {
      gamesSearchInput.value = gamesSearchQuery;
    }

    updateOrderToggleLabel();

    if (!gamesControlsBound) {
      gamesSortSelect.addEventListener("change", (event) => {
        gamesSortCriteria = event.target.value;
        localStorage.setItem("ksosGamesSort", gamesSortCriteria);
        renderGames();
      });

      gamesAuthorFilterSelect.addEventListener("change", (event) => {
        gamesAuthorFilter = event.target.value;
        localStorage.setItem("ksosGamesAuthor", gamesAuthorFilter);
        renderGames();
      });

      if (gamesSearchInput) {
        gamesSearchInput.addEventListener("input", (event) => {
          gamesSearchQuery = event.target.value;
          localStorage.setItem("ksosGamesSearch", gamesSearchQuery);
          renderGames();
        });
      }

      gamesOrderToggle.addEventListener("click", () => {
        gamesSortOrder = gamesSortOrder === "asc" ? "desc" : "asc";
        localStorage.setItem("ksosGamesOrder", gamesSortOrder);
        updateOrderToggleLabel();
        renderGames();
      });

      if (gamesResetFiltersButton) {
        gamesResetFiltersButton.addEventListener("click", () => {
          gamesSortCriteria = "default";
          gamesSortOrder = "asc";
          gamesAuthorFilter = "all";
          gamesSearchQuery = "";

          localStorage.setItem("ksosGamesSort", gamesSortCriteria);
          localStorage.setItem("ksosGamesOrder", gamesSortOrder);
          localStorage.setItem("ksosGamesAuthor", gamesAuthorFilter);
          localStorage.setItem("ksosGamesSearch", gamesSearchQuery);

          gamesSortSelect.value = gamesSortCriteria;
          gamesAuthorFilterSelect.value = gamesAuthorFilter;
          if (gamesSearchInput) gamesSearchInput.value = "";
          updateOrderToggleLabel();
          renderGames();
        });
      }

      gamesControlsBound = true;
    }
  };

  const setupProjectsControls = (appData) => {
    if (
      !projectsSortSelect ||
      !projectsAuthorFilterSelect ||
      !projectsOrderToggle
    ) {
      return;
    }

    const availableAuthors = buildAuthorOptions(appData, "projects");

    clearElement(projectsAuthorFilterSelect);
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "Tous";
    projectsAuthorFilterSelect.appendChild(allOption);

    availableAuthors.forEach((author) => {
      const option = document.createElement("option");
      option.value = author.key;
      option.textContent = author.label;
      projectsAuthorFilterSelect.appendChild(option);
    });

    if (
      projectsSortSelect.querySelector(
        `option[value="${projectsSortCriteria}"]`,
      )
    ) {
      projectsSortSelect.value = projectsSortCriteria;
    } else {
      projectsSortCriteria = "default";
      projectsSortSelect.value = "default";
    }

    if (
      projectsAuthorFilterSelect.querySelector(
        `option[value="${projectsAuthorFilter}"]`,
      )
    ) {
      projectsAuthorFilterSelect.value = projectsAuthorFilter;
    } else {
      projectsAuthorFilter = "all";
      projectsAuthorFilterSelect.value = "all";
    }

    if (projectsSearchInput) {
      projectsSearchInput.value = projectsSearchQuery;
    }

    updateProjectsOrderToggleLabel();

    if (!projectsControlsBound) {
      projectsSortSelect.addEventListener("change", (event) => {
        projectsSortCriteria = event.target.value;
        localStorage.setItem("ksosProjectsSort", projectsSortCriteria);
        renderProjects();
      });

      projectsAuthorFilterSelect.addEventListener("change", (event) => {
        projectsAuthorFilter = event.target.value;
        localStorage.setItem("ksosProjectsAuthor", projectsAuthorFilter);
        renderProjects();
      });

      if (projectsSearchInput) {
        projectsSearchInput.addEventListener("input", (event) => {
          projectsSearchQuery = event.target.value;
          localStorage.setItem("ksosProjectsSearch", projectsSearchQuery);
          renderProjects();
        });
      }

      projectsOrderToggle.addEventListener("click", () => {
        projectsSortOrder = projectsSortOrder === "asc" ? "desc" : "asc";
        localStorage.setItem("ksosProjectsOrder", projectsSortOrder);
        updateProjectsOrderToggleLabel();
        renderProjects();
      });

      if (projectsResetFiltersButton) {
        projectsResetFiltersButton.addEventListener("click", () => {
          projectsSortCriteria = "default";
          projectsSortOrder = "asc";
          projectsAuthorFilter = "all";
          projectsSearchQuery = "";

          localStorage.setItem("ksosProjectsSort", projectsSortCriteria);
          localStorage.setItem("ksosProjectsOrder", projectsSortOrder);
          localStorage.setItem("ksosProjectsAuthor", projectsAuthorFilter);
          localStorage.setItem("ksosProjectsSearch", projectsSearchQuery);

          projectsSortSelect.value = projectsSortCriteria;
          projectsAuthorFilterSelect.value = projectsAuthorFilter;
          if (projectsSearchInput) projectsSearchInput.value = "";
          updateProjectsOrderToggleLabel();
          renderProjects();
        });
      }

      projectsControlsBound = true;
    }
  };

  const renderData = async () => {
    const appData = await fetchAppData();
    cachedAppData = await enrichAppDataWithGithubDates(appData);

    clearElement(membersContainer);
    clearElement(projectsContainer);

    (cachedAppData.members || []).forEach((member) => {
      membersContainer.appendChild(createMemberBadgeElement(member));
    });

    setupGamesControls(cachedAppData);
    renderGames();

    setupProjectsControls(cachedAppData);
    renderProjects();

    renderFooterLinks(cachedAppData.members || [], footerLinks);
  };

  try {
    await renderData();
  } catch (error) {
    console.error(error);
    renderLoadError(
      {
        gamesContainer,
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
  ) {
    return;
  }

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
    if (event.target === settingsOverlay) {
      closeModal();
    }
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
    const introEnabled = localStorage.getItem("ksosIntroEnabled") !== "0";
    introToggle.checked = introEnabled;

    introToggle.addEventListener("change", (event) => {
      localStorage.setItem(
        "ksosIntroEnabled",
        event.target.checked ? "1" : "0",
      );
    });
  }

  if (refreshRepoDatesButton) {
    refreshRepoDatesButton.addEventListener("click", async () => {
      refreshRepoDatesButton.disabled = true;
      refreshRepoDatesButton.classList.add("opacity-50", "cursor-not-allowed");
      if (refreshRepoDatesStatus) {
        refreshRepoDatesStatus.textContent =
          "Mise a jour en cours depuis GitHub...";
      }

      try {
        clearRepoDateCache();
        await renderData();
        if (refreshRepoDatesStatus) {
          refreshRepoDatesStatus.textContent =
            "Dates mises a jour depuis GitHub.";
        }
      } catch (error) {
        console.error(error);
        if (refreshRepoDatesStatus) {
          refreshRepoDatesStatus.textContent =
            "Echec du refresh. Les dates existantes ont ete conservees.";
        }
      } finally {
        refreshRepoDatesButton.disabled = false;
        refreshRepoDatesButton.classList.remove(
          "opacity-50",
          "cursor-not-allowed",
        );
      }
    });
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
  if (activeRadio) {
    activeRadio.checked = true;
  }
  updateThemeOptionSelection();

  themeRadios.forEach((radio) => {
    radio.addEventListener("change", (event) => {
      const selected = event.target.value;
      document.documentElement.setAttribute("data-theme", selected);
      localStorage.setItem("ksosColorTheme", selected);
      updateThemeOptionSelection();
    });
  });

  const splashScreen = document.getElementById("splash-screen");
  const skipSplashButton = document.getElementById("skip-splash");
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const introEnabled = localStorage.getItem("ksosIntroEnabled") !== "0";
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
    if (splashScreen) {
      splashScreen.remove();
    }
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

  if (skipSplashButton) {
    skipSplashButton.addEventListener("click", skipSplash);
  }

  document.body.style.overflow = "hidden";
  window.scrollTo(0, 0);

  splashTimers.push(
    setTimeout(() => {
      splashScreen.classList.add("splash-step-2");
    }, 800),
  );

  splashTimers.push(
    setTimeout(() => {
      splashScreen.classList.add("splash-step-3");
      revealMainContent();
    }, 2600),
  );

  splashTimers.push(
    setTimeout(() => {
      removeSplash();
    }, 4000),
  );
});

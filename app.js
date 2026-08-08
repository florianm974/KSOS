// KSOS — Portail de jeux & projets (app.js)
"use strict";

const SVG_NS = "http://www.w3.org/2000/svg";
const AVATAR_FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%2312101d'/%3E%3Cpath d='M32 34c8.3 0 15 6.7 15 15H17c0-8.3 6.7-15 15-15zm0-18a9 9 0 110 18 9 9 0 010-18z' fill='%239b98ad'/%3E%3C/svg%3E";

const REPO_DATE_CACHE_KEY = "ksosRepoDatesCacheV1";
const REPO_DATE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const NEW_ITEM_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

function clearElement(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function safeExternalUrl(url) {
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.href;
    }
  } catch (_) {}
  return "#";
}

function parseItemDate(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function extractGithubRepoSlug(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com" && parsed.hostname !== "www.github.com") {
      return null;
    }
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return null;
    return `${segments[0]}/${segments[1].replace(/\.git$/i, "")}`;
  } catch (_) {
    return null;
  }
}

function readRepoDateCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(REPO_DATE_CACHE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeRepoDateCache(cache) {
  try {
    localStorage.setItem(REPO_DATE_CACHE_KEY, JSON.stringify(cache));
  } catch (_) {}
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

async function enrichWithGithubDate(item, cache) {
  const slug = extractGithubRepoSlug(item.github);
  if (!slug) return item;

  const entry = cache[slug];
  const cachedDate =
    entry &&
    typeof entry.pushedAt === "string" &&
    Date.now() - Number(entry.fetchedAt) < REPO_DATE_CACHE_TTL_MS
      ? entry.pushedAt
      : null;

  if (cachedDate) {
    return { ...item, pushedAt: cachedDate };
  }

  const pushedAt = await fetchRepoPushedAt(slug);
  if (pushedAt) {
    cache[slug] = { pushedAt, fetchedAt: Date.now() };
    writeRepoDateCache(cache);
    return { ...item, pushedAt };
  }

  return item;
}

function createGithubIcon() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
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

function createMemberBadge(member) {
  const username = /^[a-zA-Z0-9-]{1,39}$/.test(member.github)
    ? member.github
    : null;
  const anchor = document.createElement("a");
  anchor.href = username ? `https://github.com/${username}` : "#";
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.className = "member-pill";

  const img = document.createElement("img");
  img.src = username ? `https://github.com/${username}.png` : AVATAR_FALLBACK;
  img.alt = `Avatar ${member.name || "membre"}`;
  img.loading = "lazy";
  img.decoding = "async";
  img.width = 30;
  img.height = 30;
  img.addEventListener("error", () => { img.src = AVATAR_FALLBACK; }, { once: true });

  const span = document.createElement("span");
  span.textContent = member.name || "Membre";

  anchor.appendChild(img);
  anchor.appendChild(span);
  return anchor;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(timestamp);
}

function getDisplayTime(item) {
  const created = parseItemDate(item.createdAt);
  const pushed = parseItemDate(item.pushedAt);
  const isNew = created !== null && Date.now() - created <= NEW_ITEM_THRESHOLD_MS;
  if (isNew && created !== null) return created;
  return pushed || created;
}

function isItemNew(item) {
  const created = parseItemDate(item.createdAt);
  return created !== null && Date.now() - created <= NEW_ITEM_THRESHOLD_MS;
}

function createCard(item) {
  const card = document.createElement("article");
  card.className = "card";

  // Carte entière cliquable
  const cardUrl = safeExternalUrl(item.url);
  card.addEventListener("click", () => {
    if (cardUrl && cardUrl !== "#") {
      window.open(cardUrl, "_blank", "noopener,noreferrer");
    }
  });

  // Bannière visuelle (gradient + icône)
  if (item.gradient) {
    const preview = document.createElement("div");
    preview.className = "card-preview";
    preview.style.background = item.gradient;
    const previewIcon = document.createElement("span");
    previewIcon.className = "card-preview-icon";
    previewIcon.setAttribute("aria-hidden", "true");
    previewIcon.textContent = item.icon || "🧩";
    preview.appendChild(previewIcon);
    card.appendChild(preview);
  }

  const top = document.createElement("div");
  top.className = "card-top";

  const icon = document.createElement("div");
  icon.className = "card-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = item.icon || "🧩";

  const titleWrap = document.createElement("div");
  titleWrap.className = "card-titlewrap";

  const title = document.createElement("a");
  title.href = safeExternalUrl(item.url);
  title.target = "_blank";
  title.rel = "noopener noreferrer";
  title.className = "card-title";
  title.textContent = item.title || "Projet";
  title.title = `Ouvrir ${item.title || "ce projet"}`;

  const author = document.createElement("p");
  author.className = "card-author";
  author.textContent = `par ${item.author || "inconnu"}`;

  titleWrap.appendChild(title);
  titleWrap.appendChild(author);

  const badge = document.createElement("span");
  badge.className = "card-badge";
  badge.textContent = item.tagText || "Projet";

  const meta = document.createElement("div");
  meta.className = "card-meta";
  meta.appendChild(badge);

  top.appendChild(icon);
  top.appendChild(titleWrap);
  top.appendChild(meta);
  card.appendChild(top);

  // Date discrète (dernier push GitHub ou création)
  const displayTime = getDisplayTime(item);

  if (displayTime !== null) {
    const datePill = document.createElement("span");
    datePill.className = isItemNew(item) ? "card-date is-new" : "card-date";
    datePill.textContent = isItemNew(item) ? "Nouveau" : formatDate(displayTime);
    meta.appendChild(datePill);
  }

  const techs = Array.isArray(item.techs) ? item.techs : [];
  const desc = document.createElement("p");
  desc.className = "card-desc";
  desc.textContent = item.desc || "";
  if (techs.length > 0) {
    const sep = desc.textContent ? " — " : "";
    desc.textContent += sep + techs.join(" · ");
  }
  card.appendChild(desc);

  const bottom = document.createElement("div");
  bottom.className = "card-bottom";

  const playLink = document.createElement("a");
  playLink.href = safeExternalUrl(item.url);
  playLink.target = "_blank";
  playLink.rel = "noopener noreferrer";
  playLink.className = "card-link";
  playLink.setAttribute("aria-label", `Ouvrir ${item.title || "ce projet"}`);
  playLink.title = `Ouvrir ${item.title || "ce projet"}`;
  playLink.textContent = "Jouer →";
  playLink.addEventListener("click", (event) => event.stopPropagation());

  const codeLink = document.createElement("a");
  codeLink.href = safeExternalUrl(item.github);
  codeLink.target = "_blank";
  codeLink.rel = "noopener noreferrer";
  codeLink.className = "card-link";
  codeLink.setAttribute("aria-label", `Voir le code de ${item.title || "ce projet"}`);
  codeLink.title = `Voir le code de ${item.title || "ce projet"}`;
  codeLink.appendChild(createGithubIcon());
  codeLink.appendChild(document.createTextNode("Code"));
  codeLink.addEventListener("click", (event) => event.stopPropagation());

  bottom.appendChild(playLink);
  bottom.appendChild(codeLink);
  card.appendChild(bottom);

  return card;
}

function renderGrid(container, items) {
  clearElement(container);
  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Aucun résultat.";
    container.appendChild(empty);
    return;
  }
  items.forEach((item) => container.appendChild(createCard(item)));
}

function normalizeForSearch(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchQuery(item, query) {
  if (!query) return true;
  const terms = query.split(/\s+/).filter(Boolean);
  const searchable = normalizeForSearch(
    [item.title, item.desc, item.author, item.tagText, ...(Array.isArray(item.techs) ? item.techs : [])]
      .filter(Boolean)
      .join(" "),
  );
  return terms.every((term) => searchable.includes(term));
}

function createSkeletonCard() {
  const card = document.createElement("div");
  card.className = "skeleton-card";
  card.setAttribute("aria-hidden", "true");

  const preview = document.createElement("div");
  preview.className = "skeleton-block skeleton-preview";

  const line1 = document.createElement("div");
  line1.className = "skeleton-block skeleton-line wide";

  const line2 = document.createElement("div");
  line2.className = "skeleton-block skeleton-line short";

  const desc1 = document.createElement("div");
  desc1.className = "skeleton-block skeleton-line";
  const desc2 = document.createElement("div");
  desc2.className = "skeleton-block skeleton-line short";

  const chips = document.createElement("div");
  chips.className = "skeleton-chip-row";
  for (let i = 0; i < 3; i++) {
    const chip = document.createElement("div");
    chip.className = "skeleton-block skeleton-chip";
    chips.appendChild(chip);
  }

  card.appendChild(preview);
  card.appendChild(line1);
  card.appendChild(line2);
  card.appendChild(desc1);
  card.appendChild(desc2);
  card.appendChild(chips);
  return card;
}

function showSkeletons(containers, count) {
  containers.forEach((container) => {
    clearElement(container);
    for (let i = 0; i < count; i++) {
      container.appendChild(createSkeletonCard());
    }
  });
}

function createChip(label, isActive) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = isActive ? "chip is-active" : "chip";
  chip.setAttribute("aria-pressed", String(Boolean(isActive)));
  chip.textContent = label;
  return chip;
}

function buildChips(container, categories, state, onUpdate) {
  const renderChips = () => {
    const chips = [
      createChip("Tous", !state.filterTag),
      ...categories.map((cat) => createChip(cat, state.filterTag === cat)),
    ];
    chips.forEach((chip, index) => {
      const tag = index === 0 ? null : categories[index - 1];
      chip.addEventListener("click", () => {
        state.filterTag = tag;
        renderChips();
        onUpdate();
      });
    });
    clearElement(container);
    chips.forEach((chip) => container.appendChild(chip));
  };

  return renderChips;
}

async function init() {
  const membersContainer = document.getElementById("members-container");
  const gamesContainer = document.getElementById("games-container");
  const projectsContainer = document.getElementById("projects-container");
  const gamesChipsContainer = document.getElementById("games-chips");
  const gamesCount = document.getElementById("games-count");
  const projectsCount = document.getElementById("projects-count");
  const gamesResults = document.getElementById("games-results");
  const projectsResults = document.getElementById("projects-results");
  const searchInput = document.getElementById("search");
  const footerLinks = document.getElementById("footer-links");
  const currentYear = document.getElementById("current-year");

  if (!gamesContainer || !projectsContainer || !currentYear) return;

  currentYear.textContent = String(new Date().getFullYear());

  const state = {
    filterTag: null,
    games: [],
    projects: [],
  };

  // Skeletons pendant le chargement
  showSkeletons([gamesContainer, projectsContainer], 3);

  let appData;
  try {
    const response = await fetch("./data.json", { cache: "no-store" });
    if (!response.ok) throw new Error("data.json injoignable");
    appData = await response.json();
  } catch (_) {
    const msg = document.createElement("p");
    msg.className = "empty-state";
    msg.textContent = "Impossible de charger les données du portail. Vérifie la présence de data.json.";
    gamesContainer.appendChild(msg);
    clearElement(projectsContainer);
    return;
  }

  const members = Array.isArray(appData.members) ? appData.members : [];
  const games = Array.isArray(appData.games) ? appData.games : [];
  const projects = Array.isArray(appData.projects) ? appData.projects : [];

  // Membres
  if (membersContainer) {
    members.forEach((m) => membersContainer.appendChild(createMemberBadge(m)));
  }

  // Footer
  if (footerLinks) {
    members.forEach((m, i) => {
      if (i > 0) footerLinks.appendChild(document.createTextNode("·"));
      const link = document.createElement("a");
      link.href = safeExternalUrl(`https://github.com/${m.github || ""}`);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = m.name || "Membre";
      footerLinks.appendChild(link);
    });
  }

  // Tri + rendu
  const sortByDateDesc = (items) =>
    [...items].sort((a, b) => {
      const timeA = getDisplayTime(a);
      const timeB = getDisplayTime(b);
      if (timeA === null && timeB === null) return 0;
      if (timeA === null) return 1;
      if (timeB === null) return -1;
      return timeB - timeA;
    });

  const pluralize = (count, singular) => {
    if (count <= 1) return `${count} ${singular}`;
    const exceptions = { "jeu": "jeux", "jeu trouvé": "jeux trouvés" };
    return `${count} ${exceptions[singular] || `${singular}s`}`;
  };

  const cache = readRepoDateCache();

  const applyCachedDate = (item) => {
    const slug = extractGithubRepoSlug(item.github);
    const entry = slug ? cache[slug] : null;
    if (
      entry &&
      typeof entry.pushedAt === "string" &&
      Date.now() - Number(entry.fetchedAt) < REPO_DATE_CACHE_TTL_MS
    ) {
      return { ...item, pushedAt: entry.pushedAt };
    }
    return item;
  };

  state.games = sortByDateDesc(games.map(applyCachedDate));
  state.projects = sortByDateDesc(projects.map(applyCachedDate));

  function update() {
    const query = searchInput ? searchInput.value.trim() : "";
    const filteredGames = state.games.filter(
      (g) =>
        (!state.filterTag || g.tagText === state.filterTag) &&
        matchQuery(g, query),
    );
    const filteredProjects = state.projects.filter((p) => matchQuery(p, query));

    renderGrid(gamesContainer, filteredGames);
    renderGrid(projectsContainer, filteredProjects);

    if (gamesCount) gamesCount.textContent = pluralize(filteredGames.length, "jeu");
    if (projectsCount) projectsCount.textContent = pluralize(filteredProjects.length, "outil");

    const filtering = Boolean(query) || Boolean(state.filterTag);
    if (gamesResults) {
      gamesResults.textContent = filtering
        ? pluralize(filteredGames.length, "jeu trouvé")
        : "";
    }
    if (projectsResults) {
      projectsResults.textContent = query
        ? pluralize(filteredProjects.length, "outil trouvé")
        : "";
    }
  }

  // Chips de catégories (jeux)
  if (gamesChipsContainer) {
    const categories = Array.from(
      new Set(state.games.map((g) => g.tagText).filter(Boolean)),
    );
    const renderChips = buildChips(gamesChipsContainer, categories, state, update);
    renderChips();
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(update._timer);
      update._timer = setTimeout(update, 150);
    });
  }

  // Premier rendu immédiat (dates en cache ou createdAt)
  update();

  // Enrichissement GitHub en arrière-plan, puis re-tri et re-rendu
  (async () => {
    const [enrichedGames, enrichedProjects] = await Promise.all([
      Promise.all(games.map((g) => enrichWithGithubDate(g, cache))),
      Promise.all(projects.map((p) => enrichWithGithubDate(p, cache))),
    ]);
    state.games = sortByDateDesc(enrichedGames);
    state.projects = sortByDateDesc(enrichedProjects);
    update();
  })();
}

document.addEventListener("DOMContentLoaded", init);

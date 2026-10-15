// KSOS — Portail de jeux & projets (app.js)
"use strict";

const SVG_NS = "http://www.w3.org/2000/svg";
const AVATAR_FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%2312101d'/%3E%3Cpath d='M32 34c8.3 0 15 6.7 15 15H17c0-8.3 6.7-15 15-15zm0-18a9 9 0 110 18 9 9 0 010-18z' fill='%239b98ad'/%3E%3C/svg%3E";

const THEME_KEY = "ksos-theme";
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

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(timestamp);
}

function isRecent(timestamp) {
  return timestamp !== null && Date.now() - timestamp <= NEW_ITEM_THRESHOLD_MS;
}

function pluralize(count, singular) {
  if (count <= 1) return `${count} ${singular}`;
  const exceptions = { jeu: "jeux" };
  return `${count} ${exceptions[singular] || `${singular}s`}`;
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

  const link = document.createElement("a");
  link.href = username ? `https://github.com/${username}` : "#";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.className = "member-pill";

  const avatar = document.createElement("span");
  avatar.className = "member-avatar";

  const img = document.createElement("img");
  img.src = username ? `https://github.com/${username}.png` : AVATAR_FALLBACK;
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  img.width = 30;
  img.height = 30;
  img.addEventListener("error", () => { img.src = AVATAR_FALLBACK; }, { once: true });
  avatar.appendChild(img);

  const name = document.createElement("span");
  name.textContent = member.name || "Membre";

  link.appendChild(avatar);
  link.appendChild(name);
  return link;
}

function createCard(item, type) {
  const card = document.createElement("article");
  card.className = "card";

  const actionLabel = type === "game" ? "Jouer" : "Ouvrir";
  const titleText = item.title || "Projet";

  const top = document.createElement("div");
  top.className = "card-top";

  const icon = document.createElement("div");
  icon.className = "card-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = item.icon || "🧩";
  top.appendChild(icon);

  const titleWrap = document.createElement("div");
  titleWrap.className = "card-titlewrap";

  const titleLink = document.createElement("a");
  titleLink.href = safeExternalUrl(item.url);
  titleLink.target = "_blank";
  titleLink.rel = "noopener noreferrer";
  titleLink.className = "card-title";
  titleLink.textContent = titleText;
  titleLink.title = `${actionLabel} ${titleText}`;

  const author = document.createElement("p");
  author.className = "card-author";
  author.textContent = `par ${item.author || "inconnu"}`;

  titleWrap.appendChild(titleLink);
  titleWrap.appendChild(author);

  const badge = document.createElement("span");
  badge.className = "card-badge";
  badge.textContent = item.tagText || "Projet";

  const meta = document.createElement("div");
  meta.className = "card-meta";
  meta.appendChild(badge);

  // Date discrète + état « Nouveau »
  const created = parseItemDate(item.createdAt);
  if (created !== null) {
    const recent = isRecent(created);
    const datePill = document.createElement("span");
    datePill.className = recent ? "card-date is-new" : "card-date";
    datePill.textContent = recent ? "Nouveau" : formatDate(created);
    meta.appendChild(datePill);
  }

  top.appendChild(titleWrap);
  top.appendChild(meta);
  card.appendChild(top);

  const desc = document.createElement("p");
  desc.className = "card-desc";
  desc.textContent = item.desc || "";
  card.appendChild(desc);

  // Badges de technologies
  const techs = Array.isArray(item.techs) ? item.techs : [];
  if (techs.length > 0) {
    const techsWrap = document.createElement("div");
    techsWrap.className = "card-techs";
    techs.forEach((tech) => {
      const tag = document.createElement("span");
      tag.className = "tech-tag";
      tag.textContent = tech;
      techsWrap.appendChild(tag);
    });
    card.appendChild(techsWrap);
  }

  const bottom = document.createElement("div");
  bottom.className = "card-bottom";

  const playLink = document.createElement("a");
  playLink.href = safeExternalUrl(item.url);
  playLink.target = "_blank";
  playLink.rel = "noopener noreferrer";
  playLink.className = "card-link";
  playLink.setAttribute("aria-label", `${actionLabel} ${titleText}`);
  playLink.title = `${actionLabel} ${titleText}`;
  playLink.textContent = `${actionLabel} →`;

  const codeLink = document.createElement("a");
  codeLink.href = safeExternalUrl(item.github);
  codeLink.target = "_blank";
  codeLink.rel = "noopener noreferrer";
  codeLink.className = "card-link";
  codeLink.setAttribute("aria-label", `Voir le code de ${titleText}`);
  codeLink.title = `Voir le code de ${titleText}`;
  codeLink.appendChild(createGithubIcon());
  codeLink.appendChild(document.createTextNode("Code"));

  bottom.appendChild(playLink);
  bottom.appendChild(codeLink);
  card.appendChild(bottom);

  return card;
}

function renderGrid(container, items, type) {
  clearElement(container);
  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Aucun contenu pour le moment.";
    container.appendChild(empty);
    return;
  }
  items.forEach((item, index) => {
    const card = createCard(item, type);
    card.style.setProperty("--i", String(index));
    container.appendChild(card);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "light" ? "#f5f6fb" : "#08080d");
  }

  const toggle = document.getElementById("theme-toggle");
  if (toggle) {
    const toLight = theme !== "light";
    toggle.textContent = toLight ? "☀️" : "🌙";
    toggle.setAttribute(
      "aria-label",
      toLight ? "Passer au thème clair" : "Passer au thème sombre",
    );
  }
}

function initTheme() {
  let stored = null;
  try {
    stored = localStorage.getItem(THEME_KEY);
  } catch (_) {}

  const theme =
    stored === "light" || stored === "dark"
      ? stored
      : document.documentElement.getAttribute("data-theme") || "dark";

  applyTheme(theme);

  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    const next =
      document.documentElement.getAttribute("data-theme") === "light"
        ? "dark"
        : "light";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (_) {}
    applyTheme(next);
  });
}

function initSpotlight() {
  const glow = document.querySelector(".cursor-glow");
  if (!glow) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let frame = 0;
  let x = 0;
  let y = 0;

  window.addEventListener(
    "mousemove",
    (event) => {
      x = event.clientX;
      y = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        document.documentElement.style.setProperty("--mx", `${x}px`);
        document.documentElement.style.setProperty("--my", `${y}px`);
      });
    },
    { passive: true },
  );
}

async function init() {
  const membersContainer = document.getElementById("members-container");
  const gamesContainer = document.getElementById("games-container");
  const projectsContainer = document.getElementById("projects-container");
  const gamesCount = document.getElementById("games-count");
  const projectsCount = document.getElementById("projects-count");
  const footerLinks = document.getElementById("footer-links");
  const currentYear = document.getElementById("current-year");

  if (!gamesContainer || !projectsContainer || !currentYear) return;

  currentYear.textContent = String(new Date().getFullYear());

  let appData;
  try {
    const response = await fetch("./data.json");
    if (!response.ok) throw new Error("data.json injoignable");
    appData = await response.json();
  } catch (_) {
    clearElement(gamesContainer);
    clearElement(projectsContainer);

    const message = document.createElement("div");
    message.className = "empty-state";

    const text = document.createElement("p");
    text.className = "empty-message";
    text.textContent =
      "Impossible de charger les données. Ouvre le site via un serveur local (ex. python -m http.server).";

    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "retry-btn";
    retry.textContent = "Réessayer";
    retry.addEventListener("click", () => init());

    message.appendChild(text);
    message.appendChild(retry);
    gamesContainer.appendChild(message);
    return;
  }

  const members = Array.isArray(appData.members) ? appData.members : [];
  const games = Array.isArray(appData.games) ? appData.games : [];
  const projects = Array.isArray(appData.projects) ? appData.projects : [];

  // Membres
  if (membersContainer) {
    members.forEach((member, index) => {
      const badge = createMemberBadge(member);
      badge.style.setProperty("--i", String(index));
      membersContainer.appendChild(badge);
    });
  }

  // Footer (liens GitHub directs)
  if (footerLinks) {
    members.forEach((member, index) => {
      if (index > 0) footerLinks.appendChild(document.createTextNode("·"));
      const link = document.createElement("a");
      link.href = safeExternalUrl(`https://github.com/${member.github || ""}`);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = member.name || "Membre";
      footerLinks.appendChild(link);
    });
  }

  // Rendu des listes
  renderGrid(gamesContainer, games, "game");
  renderGrid(projectsContainer, projects, "project");

  if (gamesCount) gamesCount.textContent = pluralize(games.length, "jeu");
  if (projectsCount) projectsCount.textContent = pluralize(projects.length, "outil");
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initSpotlight();
  init();
});

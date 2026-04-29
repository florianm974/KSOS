// js/dom.js

import { getItemTimestamp, parseItemDate, isItemNew } from "./logic.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const AVATAR_FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%23121726'/%3E%3Cpath d='M32 34c8.3 0 15 6.7 15 15H17c0-8.3 6.7-15 15-15zm0-18a9 9 0 110 18 9 9 0 010-18z' fill='%23d1d5db'/%3E%3C/svg%3E";

export function safeExternalUrl(url) {
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.href;
    }
  } catch (_) {}
  return "#";
}

export function clearElement(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

export function createGithubIcon() {
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

export function createCardElement(item) {
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

  // Correction ici : On sépare la date d'affichage (updatedAt) de la date de création (createdAt)
  const itemTimestamp = getItemTimestamp(item);

  if (itemTimestamp !== null) {
    const datePill = document.createElement("span");
    const isNewItem = isItemNew(item);

    datePill.className = isNewItem
      ? "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
      : "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 text-gray-400 border border-white/10";

    datePill.textContent = isNewItem
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

export function createMemberBadgeElement(member) {
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

export function renderFooterLinks(members, container) {
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

export function renderLoadError(elements, retryHandler) {
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

export function createEmptyStateCard(message) {
  const card = document.createElement("div");
  card.className = "bg-darkCard p-6 md:p-8 text-gray-300 md:col-span-2";
  card.textContent = message;
  return card;
}

export function buildResultsLabel(count, noun) {
  return count <= 1 ? `${count} ${noun} trouve` : `${count} ${noun} trouves`;
}

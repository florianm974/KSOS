// js/api.js

export const REPO_DATE_CACHE_KEY = "ksosRepoDatesCacheV1";
const REPO_DATE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

export async function fetchAppData() {
  const response = await fetch("./data.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Impossible de charger data.json");
  }
  return response.json();
}

export function extractGithubRepoSlug(url) {
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

export function readRepoDateCache() {
  try {
    const raw = localStorage.getItem(REPO_DATE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

export function writeRepoDateCache(cache) {
  try {
    localStorage.setItem(REPO_DATE_CACHE_KEY, JSON.stringify(cache));
  } catch (_) {
    // Ignore storage write failures.
  }
}

export function clearRepoDateCache() {
  try {
    localStorage.removeItem(REPO_DATE_CACHE_KEY);
  } catch (_) {
    // Ignore storage remove failures.
  }
}

export function getCachedRepoDate(cache, slug) {
  const entry = cache[slug];
  if (!entry || typeof entry.pushedAt !== "string" || !entry.fetchedAt) {
    return null;
  }
  const isFresh = Date.now() - Number(entry.fetchedAt) < REPO_DATE_CACHE_TTL_MS;
  return isFresh ? entry.pushedAt : null;
}

export async function fetchRepoPushedAt(slug) {
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

export async function enrichItemsWithGithubDates(items, cache) {
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
    cache[slug] = { pushedAt, fetchedAt: Date.now() };
  });

  return clonedItems.map((item) => {
    const slug = extractGithubRepoSlug(item.github);
    const pushedAt = slug ? datesBySlug[slug] : null;
    if (!pushedAt) return item;

    return { ...item, updatedAt: pushedAt };
  });
}

export async function enrichAppDataWithGithubDates(appData) {
  const cache = readRepoDateCache();
  const games = await enrichItemsWithGithubDates(appData.games || [], cache);
  const projects = await enrichItemsWithGithubDates(
    appData.projects || [],
    cache,
  );

  writeRepoDateCache(cache);

  return { ...appData, games, projects };
}

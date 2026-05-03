// js/main.js

import {
  fetchAppData,
  enrichAppDataWithGithubDates,
  clearRepoDateCache,
} from "./api.js";
import {
  sortAndFilterItems,
  buildAuthorOptions,
  getItemTimestamp,
} from "./logic.js";
import {
  clearElement,
  createCardElement,
  createMemberBadgeElement,
  renderFooterLinks,
  renderLoadError,
  createEmptyStateCard,
  buildResultsLabel,
} from "./dom.js";

window.addEventListener("DOMContentLoaded", async () => {
  const membersContainer = document.getElementById("members-container");
  const gamesContainer = document.getElementById("games-container");
  const favoritesSection = document.getElementById("favorites-section");
  const favoritesContainer = document.getElementById("favorites-container");
  const projectsContainer = document.getElementById("projects-container");
  const footerLinks = document.getElementById("footer-links");
  const currentYear = document.getElementById("current-year");

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

  // État global unique
  let sortCriteria = localStorage.getItem("ksosSort") || "default";
  let sortOrder = localStorage.getItem("ksosOrder") || "asc";
  let authorFilter = localStorage.getItem("ksosAuthor") || "all";
  let searchQuery = localStorage.getItem("ksosSearch") || "";

  let controlsBound = false;

  const updateOrderToggleLabel = () => {
    if (!globalOrderToggle) return;
    const isDesc = sortOrder === "desc";
    globalOrderToggle.textContent = isDesc ? "Ordre: Desc" : "Ordre: Asc";
    globalOrderToggle.setAttribute("aria-pressed", String(isDesc));
  };

  // Rend les deux sections avec le même filtre
  const renderAll = () => {
    if (!cachedAppData) return;

    const criteria = globalSortSelect?.value || sortCriteria;
    const filterValue = globalAuthorFilterSelect?.value || authorFilter;
    const query = globalSearchInput?.value ?? searchQuery;

    const createCatalogCard = (item) =>
      createCardElement(item, {
        isFavorite: isFavorite(item),
        onToggleFavorite: toggleFavorite,
      });

    // --- Jeux ---
    const allGames = Array.isArray(cachedAppData.games)
      ? cachedAppData.games
      : [];
    const allProjects = Array.isArray(cachedAppData.projects)
      ? cachedAppData.projects
      : [];
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
  };

  const setupControls = (appData) => {
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
        globalSearchInput.addEventListener("input", (e) => {
          searchQuery = e.target.value;
          localStorage.setItem("ksosSearch", searchQuery);
          renderAll();
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

          localStorage.setItem("ksosSort", sortCriteria);
          localStorage.setItem("ksosOrder", sortOrder);
          localStorage.setItem("ksosAuthor", authorFilter);
          localStorage.setItem("ksosSearch", searchQuery);

          globalSortSelect.value = "default";
          globalAuthorFilterSelect.value = "all";
          if (globalSearchInput) globalSearchInput.value = "";
          updateOrderToggleLabel();
          renderAll();
        });
      }

      controlsBound = true;
    }
  };

  const renderData = async () => {
    const appData = await fetchAppData();
    cachedAppData = await enrichAppDataWithGithubDates(appData);

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
    setTimeout(() => splashScreen.classList.add("splash-step-2"), 800),
  );
  splashTimers.push(
    setTimeout(() => {
      splashScreen.classList.add("splash-step-3");
      revealMainContent();
    }, 2600),
  );
  splashTimers.push(setTimeout(() => removeSplash(), 4000));
});

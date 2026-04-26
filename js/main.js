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
      processedGames.forEach((game) =>
        gamesContainer.appendChild(createCardElement(game)),
      );
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
      processedProjects.forEach((project) =>
        projectsContainer.appendChild(createCardElement(project)),
      );
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
    if (!gamesSortSelect || !gamesAuthorFilterSelect || !gamesOrderToggle)
      return;

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

    if (gamesSearchInput) gamesSearchInput.value = gamesSearchQuery;

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
    )
      return;

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

    if (projectsSearchInput) projectsSearchInput.value = projectsSearchQuery;

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
      { gamesContainer, projectsContainer, membersContainer, footerLinks },
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

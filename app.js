async function fetchAppData() {
  const response = await fetch("./data.json");
  if (!response.ok) {
    throw new Error("Impossible de charger data.json");
  }
  return response.json();
}

function createCardHTML(item) {
  return `
    <div class="bg-darkCard group flex flex-col p-6 md:p-8 h-full">
      <div class="flex items-start justify-between mb-4 relative z-10">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform duration-300" aria-hidden="true">${item.icon}</div>
          <div>
            <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="text-xl md:text-2xl font-black font-display text-white ${item.hoverClass} transition-colors flex items-center gap-2">
              ${item.title} <span class="opacity-50 group-hover:opacity-100 transform -translate-x-1 translate-y-1 group-hover:translate-x-0 group-hover:translate-y-0 transition-all text-sm">↗</span>
            </a>
            <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">par ${item.author}</p>
          </div>
        </div>
      </div>
      <p class="text-gray-400 text-sm md:text-base leading-relaxed flex-1 relative z-10 mb-4">
        ${item.desc}
      </p>
      <div class="flex flex-wrap gap-2 mb-6 relative z-10">
        ${item.techs.map((tech) => `<span class="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] font-bold text-gray-400 uppercase tracking-wider">${tech}</span>`).join("")}
      </div>
      <div class="flex items-center justify-between relative z-10 pt-6 border-t border-white/5">
        <span class="px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${item.badgeClass}">${item.tagText}</span>
        <a href="${item.github}" target="_blank" rel="noopener noreferrer" class="text-xs font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-widest flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
          Code
        </a>
      </div>
    </div>
  `;
}

function createMemberBadge(member) {
  return `
    <a href="https://github.com/${member.github}" target="_blank" rel="noopener noreferrer" class="glass-pill rounded-full flex items-center gap-3 pr-4 pl-1.5 py-1.5 group">
      <img src="https://github.com/${member.github}.png" alt="Avatar ${member.name}" loading="lazy" class="w-8 h-8 rounded-full border border-white/20 object-cover">
      <span class="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">${member.name}</span>
    </a>
  `;
}

function renderLoadError() {
  const gamesContainer = document.getElementById("games-container");
  const projectsContainer = document.getElementById("projects-container");
  const membersContainer = document.getElementById("members-container");
  const footerLinks = document.getElementById("footer-links");

  membersContainer.innerHTML = "";
  footerLinks.innerHTML = "";
  const errorCard = `
    <div class="bg-darkCard p-6 md:p-8 text-gray-300">
      Impossible de charger les donnees du portail. Verifie la presence de <code>data.json</code>.
    </div>
  `;
  gamesContainer.innerHTML = errorCard;
  projectsContainer.innerHTML = "";
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const appData = await fetchAppData();

    document.getElementById("members-container").innerHTML = appData.members
      .map(createMemberBadge)
      .join("");
    document.getElementById("games-container").innerHTML = appData.games
      .map(createCardHTML)
      .join("");
    document.getElementById("projects-container").innerHTML = appData.projects
      .map(createCardHTML)
      .join("");
    document.getElementById("current-year").textContent = new Date().getFullYear();

    const footerLinks = appData.members.map(
      (m) =>
        `<a href="https://github.com/${m.github}" target="_blank" rel="noopener noreferrer" class="hover:text-white transition-colors">${m.name}</a>`,
    );
    document.getElementById("footer-links").innerHTML = footerLinks.join(
      ' <span class="opacity-50">·</span> ',
    );
  } catch (error) {
    console.error(error);
    renderLoadError();
    document.getElementById("current-year").textContent = new Date().getFullYear();
  }

  const notch = document.getElementById("settings-notch");
  const settingsOverlay = document.getElementById("settings-modal-overlay");
  const closeSettings = document.getElementById("close-settings");
  const themeToggle = document.getElementById("theme-toggle");
  const themeLabel = document.getElementById("theme-label");
  const themeRadios = document.querySelectorAll('input[name="color-theme"]');

  notch.addEventListener("click", () => {
    settingsOverlay.classList.remove("opacity-0", "pointer-events-none");
    settingsOverlay.classList.add("opacity-100", "pointer-events-auto");
    settingsOverlay.querySelector(".custom-modal").classList.add("scale-100");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      settingsOverlay.classList.remove("opacity-100", "pointer-events-auto");
      settingsOverlay.classList.add("opacity-0", "pointer-events-none");
      settingsOverlay.querySelector(".custom-modal").classList.remove("scale-100");
    }
  });

  closeSettings.addEventListener("click", () => {
    settingsOverlay.classList.remove("opacity-100", "pointer-events-auto");
    settingsOverlay.classList.add("opacity-0", "pointer-events-none");
    settingsOverlay.querySelector(".custom-modal").classList.remove("scale-100");
  });

  if (localStorage.getItem("ksosTheme") === "light") {
    themeToggle.checked = true;
    themeLabel.innerText = "Mode Clair ☀️";
  }

  themeToggle.addEventListener("change", (e) => {
    if (e.target.checked) {
      document.documentElement.classList.add("light-mode");
      localStorage.setItem("ksosTheme", "light");
      themeLabel.innerText = "Mode Clair ☀️";
    } else {
      document.documentElement.classList.remove("light-mode");
      localStorage.setItem("ksosTheme", "dark");
      themeLabel.innerText = "Mode Sombre 🌙";
    }
  });

  const activeColorTheme = localStorage.getItem("ksosColorTheme") || "default";
  const activeRadio = document.querySelector(
    `input[name="color-theme"][value="${activeColorTheme}"]`,
  );
  if (activeRadio) activeRadio.checked = true;

  themeRadios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const selected = e.target.value;
      document.documentElement.setAttribute("data-theme", selected);
      localStorage.setItem("ksosColorTheme", selected);
    });
  });

  const splashScreen = document.getElementById("splash-screen");
  const mainContent = document.getElementById("main-content");

  document.body.style.overflow = "hidden";
  window.scrollTo(0, 0);

  setTimeout(() => {
    splashScreen.classList.add("splash-step-2");
  }, 800);

  setTimeout(() => {
    splashScreen.classList.add("splash-step-3");
    mainContent.classList.add("animate-fade-in");
    mainContent.classList.remove("opacity-0");
  }, 2600);

  setTimeout(() => {
    if (splashScreen) splashScreen.remove();
    document.body.style.overflow = "";
  }, 4000);
});

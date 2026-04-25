# KSOS

Collective portal for the KSOS dev group — games and personal projects in one place.

**Live →** [florianm974.github.io/KSOS](https://florianm974.github.io/KSOS/)

---

## Overview

> A shared hub for four developers, centralizing all our projects — games, tools and personal work — in a single page.

---

## The Team

| Member                                        | Projects |
| --------------------------------------------- | -------- |
| [fall974](https://github.com/fall974)         |
| [AlbarKun222](https://github.com/AlbarKun222) |
| [Infinity974](https://github.com/Infinity974) |
| [florianm974](https://github.com/florianm974) |

---

## Projects

### Games

- **Le Petit Bac** — Digital adaptation of the classic word category game
- **VroomDle** — Wordle-style car guessing game
- **Undercover** — Hidden role party game with secret words
- **Mamie Moule Maki** — A chaotic party game with a Réunion Island flavor

### Personal Projects

- **florian-links** — Personal link page
- **Prompt-Forge** — AI prompt builder for chatbots and image generation

---

## Features

- **Light / dark theme** — auto-detects system preference with a manual toggle, stored in `localStorage`
- **Multiple color themes** — 4 palettes to choose from (Original, Cyberpunk, Toxic, Synthwave)
- **Responsive design** — optimized for mobile, tablet and desktop via CSS Grid and Flexbox
- **Data-driven architecture** — project cards are generated dynamically from an external `data.json` file, making it trivial to add new content
- **Dynamic avatars** — profile pictures fetched automatically via the GitHub API

---

## Adding a Project

No HTML or JavaScript editing required. Open `data.json` and add a new object to the `"games"` or `"projects"` array:

```json
{
  "title": "Project name",
  "author": "Username",
  "url": "https://link-to-the-site.com",
  "github": "https://github.com/Username/repo",
  "desc": "Short project description...",
  "icon": "🎮",
  "tagText": "Project type",
  "techs": ["HTML", "JS", "CSS"],
  "hoverClass": "group-hover:text-purple-400",
  "badgeClass": "bg-purple-500/10 text-purple-400 border-purple-500/20"
}
```

---

## Stack

- HTML / CSS / JavaScript (vanilla, no frontend framework)
- Tailwind CSS CLI (build of `style.css` from `src/input.css`)
- Data: external `data.json` loaded via `fetch`
- Hosted on GitHub Pages

---

## License

MIT — see [LICENSE](LICENSE)

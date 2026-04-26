# KSOS

Collective portal for the KSOS dev group — games and personal projects in one place.

**Live →** [florianm974.github.io/KSOS](https://florianm974.github.io/KSOS/)

---

## Overview

> A shared hub for four developers, centralizing all our projects — games, tools and personal work — in a single page.

---

## Local Development

```bash
npm install
npm run dev
```

## Quality Checks

```bash
npm run lint
npm run build
```

## Technical Notes

- Data rendering is done with safe DOM APIs (no direct HTML injection from JSON content).
- Settings modal includes dialog semantics, focus trap, Escape/overlay close, and focus restore.
- Splash intro supports skip, is auto-disabled for reduced-motion users, and is shown once per user.
- Member avatars use lazy loading with a local SVG fallback when GitHub image loading fails.
- CI workflow runs install, build, and lint checks on push and pull requests.

---

## The Team

| Member                                        |
| --------------------------------------------- |
| [fall974](https://github.com/fall974)         |
| [AlbarKun222](https://github.com/AlbarKun222) |
| [Infinity974](https://github.com/Infinity974) |
| [florianm974](https://github.com/florianm974) |

---

## License

MIT — see [LICENSE](LICENSE)
# KSOS
# KSOS

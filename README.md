# 🎮 KSOS — Portail de Jeux & Projets

**Live →** [Ksos-game-portal](https://florianm974.github.io/Ksos-game-portal/)

Bienvenue sur le portail officiel de **KSOS**, un collectif de 4 développeurs. Ce dépôt héberge la page vitrine centralisant l'ensemble de nos projets (jeux vidéo, outils IA, pages de liens, etc.) en un seul endroit.

## 🚀 Le Collectif

Notre équipe est composée de 4 membres, chacun apportant ses propres projets au hub :

- [**fall974**](https://github.com/fall974) — Créateur de _Le Petit Bac_
- [**AlbarKun222**](https://github.com/AlbarKun222) — Créateur de _VroomDle_
- [**Infinity974**](https://github.com/Infinity974) — Créateur de _Undercover_ & _Mamie Moule Maki_
- [**florianm974**](https://github.com/florianm974) — Créateur de _Prompt Forge_ & _florian-links_

## 🕹️ Les Projets présentés

Le portail est divisé en deux grandes catégories :

### Jeux

- 🔤 **Le Petit Bac** : Adaptation du célèbre jeu de société (Quiz).
- 🏎️ **VroomDle** : Jeu de déduction automobile dans l'esprit Wordle.
- 🕵️ **Undercover** : Adaptation du jeu de rôles cachés et de mots secrets (Party game).
- 🍣 **Mamie Moule Maki** : Un jeu d'ambiance délirant aux saveurs réunionnaises.

### Projets Perso

- 🔗 **florian-links** : Page de liens personnalisée regroupant profils et réseaux.
- ⚙️ **Prompt Forge** : Outil d'ingénierie et d'affinage de prompts IA.

## 🛠️ Technique & Fonctionnalités

Ce portail a été conçu pour être performant, maintenable et accessible. Il est développé avec une approche moderne sans framework lourd.

- 🌙 **Mode Sombre Interactif** : Détection automatique du thème système et bouton de bascule manuel avec sauvegarde des préférences via `localStorage`.
- 🎨 **Thèmes Multiples** : Glassmorphism premium avec 4 palettes de couleurs au choix (Original, Cyberpunk, Toxique, Synthwave).
- 📱 **Responsive Design** : Interface adaptative optimisée pour mobiles, tablettes et ordinateurs via CSS Grid et Flexbox.
- ⚡ **Architecture Data-Driven (API locale)** : Les cartes de projets sont générées dynamiquement en JavaScript (via `fetch`) à partir d'un fichier JSON externe, rendant l'ajout de nouveaux contenus extrêmement simple.
- 🖼️ **Avatars Dynamiques** : Récupération automatique des photos de profil via l'API GitHub.

## 📝 Comment ajouter un nouveau projet ?

L'architecture du site permet d'ajouter un projet en quelques secondes **sans jamais toucher au code HTML ou JavaScript** :

1. Ouvrez le fichier **`data.json`**.
2. Ajoutez un nouvel objet dans le tableau `"games"` ou `"projects"` suivant ce modèle :

```json
{
  "title": "Nom du projet",
  "author": "Pseudo",
  "url": "[https://lien-vers-le-site.fr](https://lien-vers-le-site.fr)",
  "github": "[https://github.com/Pseudo/repo](https://github.com/Pseudo/repo)",
  "desc": "Description courte du projet...",
  "icon": "🎮",
  "tagText": "Type de projet",
  "techs": ["HTML", "JS", "CSS"],
  "hoverClass": "group-hover:text-purple-400",
  "badgeClass": "bg-purple-500/10 text-purple-400 border-purple-500/20"
}

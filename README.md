# How Many — Experiences

Application mobile et web pour noter et partager tes expériences (films, restos, voyages, musique…) avec tes amis.

---

## Fonctionnalités

- **Connexion / Inscription** — pseudo + mot de passe (hashé avec bcrypt)
- **Publier une note** — catégorie, titre, note globale ⭐ + critères techniques
- **Photos** — jusqu'à 4 photos par note
- **Visibilité** — 🌍 Public / 👥 Amis / 🔒 Privé, modifiable à tout moment
- **Feed global** — toutes les notes publiques
- **Feed amis** — notes publiques + "amis" de tes amis
- **Profil** — photo de profil modifiable, journal de bord complet (public + amis + privé)
- **Amis** — envoyer / accepter / retirer des demandes d'ami
- **Profil public** — voir les expériences d'un autre utilisateur

---

## Stack technique

| Couche | Techno |
|---|---|
| App | React Native (Expo) + TypeScript |
| Web | React Native Web / Vercel |
| Serveur | Node.js + Express |
| Base de données | PostgreSQL (Supabase) |
| Images | expo-image-picker |

---

## Structure du projet

```
how-many-app/
├── app/
│   └── (tabs)/
│       └── index.tsx      # Écran principal (toute l'app)
├── serveur/
│   └── server.js          # API REST Express
├── assets/
│   └── images/
└── constants/
    └── theme.ts
```

---

## Lancer le projet en local

### Prérequis
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)

### App
```bash
npm install
npx expo start
```

### Serveur
```bash
cd serveur
npm install
# Créer un fichier .env avec :
# DB_PASSWORD=ton_mot_de_passe_supabase
node server.js
```

---

## API — Endpoints principaux

| Méthode | Route | Description |
|---|---|---|
| POST | `/login` | Connexion ou inscription |
| GET | `/experiences` | Feed global (public) |
| GET | `/experiences/friends/:userId` | Feed amis |
| POST | `/experience` | Publier une note |
| DELETE | `/experience/:id` | Supprimer une note |
| PUT | `/experience/:id/visibility` | Changer la visibilité |
| GET | `/user/:id/profile` | Profil public |
| GET | `/user/:id/experiences` | Expériences d'un utilisateur |
| PUT | `/user/:id/avatar` | Mettre à jour la photo de profil |
| POST | `/friendship/request` | Envoyer une demande d'ami |
| PUT | `/friendship/accept` | Accepter une demande |
| DELETE | `/friendship` | Retirer un ami |
| GET | `/user/:id/friends` | Liste d'amis |
| GET | `/user/:id/friend-requests` | Demandes reçues |

---

## Déploiement

- **App web** → [Vercel](https://vercel.com) (déploiement automatique depuis GitHub)
- **Serveur** → [Render](https://render.com)
- **Base de données** → [Supabase](https://supabase.com)

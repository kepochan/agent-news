# News Agent Frontend

React frontend pour l'application News Agent, construit avec Refine, React Router et ShadCN UI.

## Fonctionnalités

- **Gestion des Topics (CRUD)** : Créer, lire, modifier et supprimer des topics de surveillance
- **Lancement et suivi des jobs** : Démarrer des traitements et suivre leur progression
- **Historique des runs** : Voir tous les runs avec résultats, logs et réponses OpenAI
- **Pages détaillées par topic** : Historique des messages OpenAI et statistiques
- **Interface temps réel** : Suivi des runs en cours avec statuts

## Technologies

- **React 18** avec TypeScript
- **Refine** pour le framework admin/CRUD
- **React Router v6** pour la navigation
- **ShadCN UI** + **Tailwind CSS** pour l'interface
- **Vite** pour le build et développement
- **Lucide React** pour les icônes

## Structure

```
src/
├── components/
│   ├── layout.tsx          # Layout principal avec navigation
│   └── ui/                 # Composants ShadCN UI
├── pages/
│   ├── topics/
│   │   ├── list.tsx        # Liste des topics
│   │   ├── show.tsx        # Détails d'un topic
│   │   ├── edit.tsx        # Edition d'un topic
│   │   └── create.tsx      # Création d'un topic
│   └── runs/
│       ├── list.tsx        # Historique des runs
│       └── show.tsx        # Détails d'un run
├── lib/
│   └── utils.ts            # Utilitaires (cn function)
└── App.tsx                 # Configuration Refine
```

## Développement

```bash
npm install
npm run dev
```

L'application sera accessible sur http://localhost:3000

## Docker

```bash
# Démarrer avec docker-compose depuis la racine
docker-compose up frontend
```

## API Backend

Le frontend communique avec l'API backend sur le port 8000:
- `GET /topics` - Liste des topics
- `GET /topics/:slug` - Détails d'un topic
- `POST /topics/:slug/process` - Lancer un traitement
- `GET /runs` - Liste des runs
- `GET /runs/:id` - Détails d'un run
- `GET /tasks` - Liste des tâches en cours
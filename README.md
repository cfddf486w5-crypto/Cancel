# Annulation Commandes – Temps Réel

Application Web Azure pour gérer des demandes d’annulation (commande complète), avec validation superviseur, audit, archives, pièces jointes, et notifications.

## Stack
- **Frontend**: React + Vite + TypeScript (`web/`)
- **API**: Azure Functions Node/TypeScript (`api/`)
- **Stockage**:
  - mode dev par défaut: mémoire + fichiers locaux (`STORAGE_MODE=mock`)
  - mode Azure: Blob Storage pour pièces jointes
- **Déploiement cible**: Azure Static Web Apps + Azure Functions

## Fonctionnalités livrées
- Auth PIN avec rôles (1111 requester, 2222 approver, 3333 viewer)
- Vues Dashboard, Kanban, Liste, Archives
- Création demande complète avec validations métier
- Workflow statuts: Nouveau → En validation → Approuvé/Refusé → Exécuté → **Archivé auto**
- Audit events pour toutes actions (création, statut, commentaire, pièce jointe)
- Pièces jointes uploadées vers Blob (ou fichiers locaux mock)
- Notifications branchées (Teams/Email) avec fallback « Notifications désactivées (config manquante) »
- Polling configurable (10–30 sec), bouton rafraîchir, « dernière sync »
- Export CSV

## Arborescence
```
repo/
  web/
  api/
  infra/
  README.md
  .env.example
```

## Installation locale
### Prérequis
- Node.js 20+
- npm 10+
- Azure Functions Core Tools (optionnel si vous utilisez `npm run dev -w api`)

### Setup
```bash
npm install
cp .env.example .env
```

### Lancer l’API
```bash
cd api
cp local.settings.json.example local.settings.json
npm install
npm run dev
```

### Lancer le frontend
```bash
cd web
npm install
npm run dev
```

Frontend: http://localhost:5173
API locale: http://localhost:7071/api

## Variables d’environnement
Voir `.env.example`.

### API
- `JWT_SECRET`
- `POLL_INTERVAL_SECONDS` (défaut 20)
- `STORAGE_MODE` = `mock` | `azure`
- `AZURE_STORAGE_CONNECTION_STRING`
- `BLOB_CONTAINER`
- `TEAMS_WEBHOOK_URL`
- `SENDGRID_API_KEY`
- `EMAIL_TO_DEFAULT`

### Frontend
- `VITE_API_BASE_URL`
- `VITE_TEAMS_WEBHOOK_URL`

## Déploiement Azure (Static Web Apps)
1. Créer les ressources (optionnel via `infra/main.bicep`)
2. Connecter le repo à Azure Static Web Apps
3. Build frontend:
   - app location: `web`
   - output location: `dist`
4. API location: `api`
5. Configurer les variables d’environnement dans SWA/API
6. Déployer

## Endpoints API
- `POST /api/auth/pin`
- `GET /api/me`
- `POST /api/requests`
- `GET /api/requests?updatedSince=...`
- `GET /api/requests/{id}`
- `PATCH /api/requests/{id}`
- `POST /api/requests/{id}/attachments`
- `POST /api/requests/{id}/comment`
- `GET /api/requests/{id}/audit`
- `GET /api/exports/requests.csv`

## Règles métier implémentées
- Refus exige motif
- Exécuté déclenche archivage auto
- Viewer en lecture seule
- Requester peut créer/commenter/ajouter pièces jointes
- Approver peut prendre en charge, approuver/refuser, marquer exécuté

## Remarque importante
L’application **ne pousse aucune annulation automatique vers Vision/Indago**. Le statut « Exécuté » reflète une action humaine externe.

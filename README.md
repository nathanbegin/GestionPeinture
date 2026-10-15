# Gestion Peinture

Registre de couleurs et de peinture pour la maison, pièce par pièce.

## Fonctionnalités

- Plusieurs maisons (une par défaut), avec nom et adresse, renommables
- Ajout, modification, renommage et suppression des pièces
- Par pièce : couleur (nom, code, aperçu), surface (murs, plafond, boiseries, moulures, portes…), marque, modèle de peinture, fini
- Date de la dernière application de peinture
- Indicateur « il m'en reste en stock » avec quantité restante
- Planchers et céramique (type, marque, modèle, couleur, date d'installation) en option
- Rapport PDF par maison (pièces au choix, avec pastilles de couleur, option « en stock seulement »)
- Sauvegarde automatique dans le navigateur, export/import JSON

## Architecture

- Interface : React + Vite (statique)
- API : fonctions serverless Vercel dans `api/` (`/api/session` connexion, `/api/data` lecture/écriture)
- Base de données : Postgres (Neon via le Marketplace Vercel), une table `registre` créée automatiquement
- Accès protégé par un mot de passe unique (variable `APP_PASSWORD`), cookie HttpOnly de 30 jours
- Verrou optimiste : si les données sont modifiées sur un autre appareil, l'application le signale au lieu d'écraser

## Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | Ajoutée automatiquement par l'intégration Neon |
| `APP_PASSWORD` | Mot de passe de l'application (changer sa valeur déconnecte tous les appareils) |

## Démarrage

```bash
npm install
npx vercel dev   # interface + API en local (nécessite `vercel link` et `vercel env pull`)
npm run build    # production
```

Au premier chargement, les données de l'ancienne version (navigateur) sont migrées automatiquement vers la base.

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

## Démarrage

```bash
npm install
npm run dev     # développement
npm run build   # production (dossier dist/)
```

Les données sont stockées localement (localStorage) : pensez à utiliser « Exporter (JSON) » pour faire des copies de sauvegarde.

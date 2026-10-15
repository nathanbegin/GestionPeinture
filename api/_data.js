import { checkPassword, ensureTable, isAuthed, sleep } from './_lib.js';

const ID = 'main';

/**
 * GET : lit le registre — PUT : enregistre { data, version, confirmPassword? } (verrou optimiste).
 * Supprimer une maison (ou remplacer toutes les données) exige le mot de passe de l'application
 * dans `confirmPassword`. Un mot de passe fourni est toujours vérifié.
 */
export function createDataHandler(getSql) {
  return async function handler(req, res) {
    try {
      if (!isAuthed(req)) return res.status(401).json({ error: 'Non autorisé' });
      const sql = getSql();
      await ensureTable(sql);

      if (req.method === 'GET') {
        const rows = await sql`SELECT data, version FROM registre WHERE id = ${ID}`;
        return res.status(200).json(rows[0] ?? { data: null, version: 0 });
      }

      if (req.method === 'PUT') {
        const { data, version, confirmPassword } = req.body ?? {};
        if (!data || !Array.isArray(data.houses) || !data.houses.length || !Number.isInteger(version)) {
          return res.status(400).json({ error: 'Données invalides' });
        }

        const passwordGiven = confirmPassword !== undefined && confirmPassword !== null;
        let passwordOk = passwordGiven && checkPassword(String(confirmPassword));
        if (version !== 0) {
          const [current] = await sql`SELECT data FROM registre WHERE id = ${ID}`;
          const kept = new Set(data.houses.map((h) => h?.id));
          const removesHouse = (current?.data?.houses ?? []).some((h) => !kept.has(h.id));
          if ((removesHouse && !passwordOk) || (passwordGiven && !passwordOk)) {
            await sleep(700); // ralentit les essais répétés
            return res.status(403).json({ error: 'Mot de passe requis ou incorrect' });
          }
        }

        const json = JSON.stringify(data);
        const rows = version === 0
          ? await sql`INSERT INTO registre (id, data, version) VALUES (${ID}, ${json}::jsonb, 1)
                      ON CONFLICT (id) DO NOTHING RETURNING version`
          : await sql`UPDATE registre SET data = ${json}::jsonb, version = version + 1, updated_at = now()
                      WHERE id = ${ID} AND version = ${version} RETURNING version`;
        if (!rows.length) return res.status(409).json({ error: 'Conflit : données modifiées ailleurs' });
        return res.status(200).json({ version: rows[0].version });
      }

      res.setHeader('Allow', 'GET, PUT');
      return res.status(405).end();
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  };
}

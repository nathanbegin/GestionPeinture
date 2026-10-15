import { db, ensureTable, isAuthed } from './_lib.js';

const ID = 'main';

// GET : lit le registre — PUT : enregistre { data, version } (verrou optimiste)
export default async function handler(req, res) {
  try {
    if (!isAuthed(req)) return res.status(401).json({ error: 'Non autorisé' });
    const sql = db();
    await ensureTable(sql);

    if (req.method === 'GET') {
      const rows = await sql`SELECT data, version FROM registre WHERE id = ${ID}`;
      return res.status(200).json(rows[0] ?? { data: null, version: 0 });
    }

    if (req.method === 'PUT') {
      const { data, version } = req.body ?? {};
      if (!data || !Array.isArray(data.houses) || !data.houses.length || !Number.isInteger(version)) {
        return res.status(400).json({ error: 'Données invalides' });
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
}

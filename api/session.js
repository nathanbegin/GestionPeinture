import { checkPassword, isAuthed, sessionCookie, sleep } from './_lib.js';

// GET : état de la session — POST : connexion — DELETE : déconnexion
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return res.status(isAuthed(req) ? 200 : 401).json({ ok: isAuthed(req) });
    if (req.method === 'POST') {
      if (checkPassword(req.body?.password)) {
        res.setHeader('Set-Cookie', sessionCookie(true));
        return res.status(200).json({ ok: true });
      }
      await sleep(700); // ralentit les essais répétés
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }
    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', sessionCookie(false));
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).end();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erreur serveur (APP_PASSWORD défini ?)' });
  }
}

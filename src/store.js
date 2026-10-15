import { useCallback, useEffect, useRef, useState } from 'react';

const KEY = 'registre-peinture:v1';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const SURFACES = [
  { value: 'murs', label: 'Murs' },
  { value: 'plafond', label: 'Plafond' },
  { value: 'boiseries', label: 'Boiseries' },
  { value: 'moulures', label: 'Moulures' },
  { value: 'portes', label: 'Portes' },
  { value: 'autre', label: 'Autre' },
];
export const FINISHES = ['Mat', 'Coquille d’œuf', 'Satiné', 'Semi-lustré', 'Lustré', 'Autre'];
export const FLOOR_TYPES = ['Plancher', 'Céramique', 'Vinyle', 'Tapis', 'Autre'];

export const surfaceLabel = (v) => SURFACES.find((s) => s.value === v)?.label ?? v;

export const newHouse = (name = 'Ma maison', address = '') => ({ id: uid(), name, address, rooms: [] });
export const newRoom = (name, floor = '') => ({ id: uid(), name, floor, notes: '', surfaces: [], floors: [] });
export const newSurface = (kind = 'murs') => ({
  id: uid(), kind, label: '', colorName: '', colorCode: '', hex: '#cccccc',
  brand: '', model: '', finish: '', lastApplied: '', inStock: false, stockNote: '', notes: '',
});
export const newFloor = () => ({
  id: uid(), type: 'Plancher', brand: '', model: '', color: '', installedOn: '', notes: '',
});

export const FLOORS = ['Rez-de-chaussée', 'Étage', 'Sous-sol', 'Autre'];

// [nom, étage]
export const DEFAULT_ROOMS = [
  ['Entrée avant', 'Rez-de-chaussée'], ['Salle à manger', 'Rez-de-chaussée'], ['Cuisine', 'Rez-de-chaussée'],
  ['Boudoir', 'Rez-de-chaussée'], ['Salon', 'Rez-de-chaussée'], ['Cage d’escalier (rez-de-chaussée)', 'Rez-de-chaussée'],
  ['Cage d’escalier (étage)', 'Étage'], ['Salle de bain (étage)', 'Étage'], ['Chambre des maîtres', 'Étage'],
  ['Chambre Léa', 'Étage'], ['Chambre de musique', 'Étage'],
  ['Cage d’escalier (sous-sol)', 'Sous-sol'], ['Salle de bain (sous-sol)', 'Sous-sol'], ['Salle d’eau', 'Sous-sol'],
  ['Salle de lavage', 'Sous-sol'], ['Cinéma maison', 'Sous-sol'], ['Chambre Nathan', 'Sous-sol'], ['Chambre invitée', 'Sous-sol'],
  ['Garage', 'Autre'],
];
const DEFAULT_FLOOR_BY_NAME = Object.fromEntries(DEFAULT_ROOMS);

/** Pièces regroupées par étage, dans l'ordre de FLOORS (sans étage à la fin). Groupes vides omis. */
export function groupByFloor(rooms) {
  const groups = [...FLOORS, ''].map((f) => ({ floor: f, rooms: rooms.filter((r) => (r.floor || '') === f) }));
  const known = new Set(FLOORS);
  const stray = rooms.filter((r) => r.floor && !known.has(r.floor));
  groups[groups.length - 1].rooms.push(...stray);
  return groups.filter((g) => g.rooms.length);
}

// Ajoute l'étage aux pièces créées avant l'existence de ce champ. Retourne [données, modifié?].
function addMissingFloors(data) {
  let changed = false;
  const houses = data.houses.map((h) => ({
    ...h,
    rooms: h.rooms.map((r) => {
      if (r.floor !== undefined) return r;
      changed = true;
      return { ...r, floor: DEFAULT_FLOOR_BY_NAME[r.name] ?? '' };
    }),
  }));
  return [{ ...data, houses }, changed];
}

const defaultState = () => {
  const house = newHouse();
  house.rooms = DEFAULT_ROOMS.map(([name, floor]) => newRoom(name, floor));
  return { houses: [house], currentId: house.id };
};

// Maison par défaut encore vierge (jamais modifiée) : on y ajoute les pièces de base.
const isPristine = (d) =>
  d.houses.length === 1 && d.houses[0].name === 'Ma maison' && !d.houses[0].address && !d.houses[0].rooms.length;

// Anciennes données (version 100 % navigateur) : migrées vers la base au premier chargement.
function legacyState() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw?.houses?.length) return raw;
  } catch { /* données absentes ou corrompues */ }
  return null;
}

async function api(method, body) {
  const r = await fetch('/api/data', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  return r;
}

/**
 * Charge et sauvegarde le registre via /api/data.
 * status : loading | login | ready | error — saveState : saved | saving | error | conflict
 */
export function useStore() {
  const [status, setStatus] = useState('loading');
  const [state, setStateRaw] = useState(null);
  const [saveState, setSaveState] = useState('saved');
  const version = useRef(0);
  const latest = useRef(null);
  const dirty = useRef(false);
  const saving = useRef(false);
  const timer = useRef(null);

  const flush = useCallback(async () => {
    if (saving.current || !dirty.current) return;
    saving.current = true;
    dirty.current = false;
    setSaveState('saving');
    try {
      const r = await api('PUT', { data: latest.current, version: version.current });
      if (r.status === 409) { setSaveState('conflict'); return; }
      if (r.status === 401) { setStatus('login'); return; }
      if (!r.ok) throw new Error();
      version.current = (await r.json()).version;
      setSaveState(dirty.current ? 'saving' : 'saved');
    } catch {
      dirty.current = true;
      setSaveState('error');
      return;
    } finally {
      saving.current = false;
    }
    if (dirty.current) flush();
  }, []);

  const schedule = useCallback((delay = 600) => {
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, delay);
  }, [flush]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const r = await api('GET');
      if (r.status === 401) return setStatus('login');
      if (!r.ok) throw new Error();
      const { data, version: v } = await r.json();
      version.current = v;
      let initial = data ?? legacyState() ?? defaultState();
      let seed = !!data && isPristine(data);
      if (seed) initial = defaultState();
      const [withFloors, migrated] = addMissingFloors(initial);
      initial = withFloors;
      seed = seed || migrated;
      latest.current = initial;
      setStateRaw(initial);
      setSaveState('saved');
      setStatus('ready');
      if (!data || seed) schedule(0); // premier enregistrement (migration ou pièces par défaut)
    } catch {
      setStatus('error');
    }
  }, [schedule]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const warn = (e) => { if (dirty.current || saving.current) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const setState = useCallback((u) => {
    setStateRaw((prev) => {
      const next = typeof u === 'function' ? u(prev) : u;
      latest.current = next;
      return next;
    });
    schedule();
  }, [schedule]);

  const login = async (password) => {
    const r = await fetch('/api/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
    });
    if (!r.ok) return false;
    await load();
    return true;
  };
  const logout = async () => {
    await fetch('/api/session', { method: 'DELETE' });
    setStateRaw(null);
    setStatus('login');
  };

  return { state, setState, status, saveState, login, logout, reload: load, retrySave: () => schedule(0) };
}

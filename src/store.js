import { useEffect, useState } from 'react';

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
export const newRoom = (name) => ({ id: uid(), name, notes: '', surfaces: [], floors: [] });
export const newSurface = (kind = 'murs') => ({
  id: uid(), kind, label: '', colorName: '', colorCode: '', hex: '#cccccc',
  brand: '', model: '', finish: '', lastApplied: '', inStock: false, stockNote: '', notes: '',
});
export const newFloor = () => ({
  id: uid(), type: 'Plancher', brand: '', model: '', color: '', installedOn: '', notes: '',
});

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw?.houses?.length) return raw;
  } catch { /* données absentes ou corrompues */ }
  const house = newHouse();
  return { houses: [house], currentId: house.id };
}

export function useStore() {
  const [state, setState] = useState(load);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* stockage plein ou bloqué */ }
  }, [state]);
  return [state, setState];
}

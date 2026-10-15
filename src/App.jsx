import { useState } from 'react';
import {
  useStore, newHouse, newRoom, newSurface, newFloor, uid,
  SURFACES, FINISHES, FLOOR_TYPES, surfaceLabel,
} from './store.js';
import { downloadReport } from './pdf.js';

const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-CA') : '—');

function Field({ label, children, className }) {
  return <label className={className}>{label}{children}</label>;
}

function SurfaceForm({ value, onSave, onCancel }) {
  const [s, setS] = useState(value);
  const set = (k) => (e) => setS({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return (
    <div className="form">
      <Field label="Surface">
        <select value={s.kind} onChange={set('kind')}>
          {SURFACES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Précision (ex. mur accent)"><input value={s.label} onChange={set('label')} /></Field>
      <Field label="Nom de la couleur"><input value={s.colorName} onChange={set('colorName')} /></Field>
      <Field label="Code couleur"><input value={s.colorCode} onChange={set('colorCode')} /></Field>
      <Field label="Aperçu"><input type="color" value={s.hex} onChange={set('hex')} /></Field>
      <Field label="Marque"><input value={s.brand} onChange={set('brand')} /></Field>
      <Field label="Modèle / gamme de peinture"><input value={s.model} onChange={set('model')} /></Field>
      <Field label="Fini">
        <select value={s.finish} onChange={set('finish')}>
          <option value="">—</option>
          {FINISHES.map((f) => <option key={f}>{f}</option>)}
        </select>
      </Field>
      <Field label="Dernière application"><input type="date" value={s.lastApplied} onChange={set('lastApplied')} /></Field>
      <Field label="" className="chk">
        <input type="checkbox" checked={s.inStock} onChange={set('inStock')} /> Il m’en reste en stock
      </Field>
      {s.inStock && <Field label="Quantité / contenant restant"><input value={s.stockNote} onChange={set('stockNote')} placeholder="ex. ½ gallon" /></Field>}
      <Field label="Notes" className="full"><textarea rows={2} value={s.notes} onChange={set('notes')} /></Field>
      <div className="row full">
        <button className="primary" onClick={() => onSave(s)}>Enregistrer</button>
        <button onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}

function FloorForm({ value, onSave, onCancel }) {
  const [f, setF] = useState(value);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="form">
      <Field label="Type">
        <select value={f.type} onChange={set('type')}>{FLOOR_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
      </Field>
      <Field label="Marque"><input value={f.brand} onChange={set('brand')} /></Field>
      <Field label="Modèle"><input value={f.model} onChange={set('model')} /></Field>
      <Field label="Couleur"><input value={f.color} onChange={set('color')} /></Field>
      <Field label="Date d’installation"><input type="date" value={f.installedOn} onChange={set('installedOn')} /></Field>
      <Field label="Notes" className="full"><textarea rows={2} value={f.notes} onChange={set('notes')} /></Field>
      <div className="row full">
        <button className="primary" onClick={() => onSave(f)}>Enregistrer</button>
        <button onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}

function Room({ room, update, remove }) {
  // editing: { type: 'surface' | 'floor', item } ou null
  const [editing, setEditing] = useState(null);

  const upsert = (list, item) => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]);
  const saveItem = (item) => {
    const key = editing.type === 'surface' ? 'surfaces' : 'floors';
    update({ ...room, [key]: upsert(room[key], item) });
    setEditing(null);
  };
  const rename = () => {
    const name = prompt('Nouveau nom de la pièce', room.name);
    if (name?.trim()) update({ ...room, name: name.trim() });
  };
  const editNotes = () => {
    const notes = prompt('Notes de la pièce', room.notes);
    if (notes !== null) update({ ...room, notes });
  };

  return (
    <section className="card">
      <div className="row">
        <h2 className="grow">{room.name}</h2>
        <button className="link" onClick={rename}>Renommer</button>
        <button className="link" onClick={editNotes}>Notes</button>
        <button className="link danger" onClick={() => confirm(`Supprimer « ${room.name} » ?`) && remove()}>Supprimer</button>
      </div>
      {room.notes && <p className="meta">{room.notes}</p>}

      <h3>Peinture et couleurs</h3>
      {room.surfaces.length === 0 && <p className="meta">Aucune surface enregistrée.</p>}
      {room.surfaces.map((s) => (
        <div className="surface" key={s.id}>
          <div className="swatch" style={{ background: s.hex }} title={s.hex} />
          <div className="grow">
            <strong>{surfaceLabel(s.kind)}{s.label && ` (${s.label})`}</strong>{' '}
            — {[s.colorName, s.colorCode].filter(Boolean).join(' · ') || 'couleur non précisée'}
            <div className="meta">
              {[s.brand, s.model, s.finish].filter(Boolean).join(' · ') || 'Marque non précisée'}
              {' · '}Appliquée : {fmtDate(s.lastApplied)}
            </div>
            <span className={`tag ${s.inStock ? 'ok' : 'no'}`}>
              {s.inStock ? `En stock${s.stockNote ? ` : ${s.stockNote}` : ''}` : 'Plus de stock'}
            </span>
            {s.notes && <div className="meta">{s.notes}</div>}
          </div>
          <button className="link" onClick={() => setEditing({ type: 'surface', item: s })}>Modifier</button>
          <button className="link danger" onClick={() => update({ ...room, surfaces: room.surfaces.filter((x) => x.id !== s.id) })}>✕</button>
        </div>
      ))}

      {room.floors.length > 0 && <h3>Planchers et céramique</h3>}
      {room.floors.map((f) => (
        <div className="surface" key={f.id}>
          <div className="grow">
            <strong>{f.type}</strong> — {[f.brand, f.model, f.color].filter(Boolean).join(' · ') || 'non précisé'}
            <div className="meta">Installé : {fmtDate(f.installedOn)}{f.notes && ` · ${f.notes}`}</div>
          </div>
          <button className="link" onClick={() => setEditing({ type: 'floor', item: f })}>Modifier</button>
          <button className="link danger" onClick={() => update({ ...room, floors: room.floors.filter((x) => x.id !== f.id) })}>✕</button>
        </div>
      ))}

      {editing ? (
        <div className="surface" style={{ display: 'block' }}>
          {editing.type === 'surface'
            ? <SurfaceForm value={editing.item} onSave={saveItem} onCancel={() => setEditing(null)} />
            : <FloorForm value={editing.item} onSave={saveItem} onCancel={() => setEditing(null)} />}
        </div>
      ) : (
        <div className="row" style={{ marginTop: 10 }}>
          <button onClick={() => setEditing({ type: 'surface', item: newSurface() })}>+ Ajouter une couleur</button>
          <button onClick={() => setEditing({ type: 'floor', item: newFloor() })}>+ Plancher / céramique</button>
        </div>
      )}
    </section>
  );
}

function ReportModal({ house, onClose }) {
  const [ids, setIds] = useState(house.rooms.map((r) => r.id));
  const [includeFloors, setFloors] = useState(true);
  const [onlyInStock, setStock] = useState(false);
  const toggle = (id) => setIds(ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Rapport PDF — {house.name}</h2>
        <h3>Pièces à inclure</h3>
        {house.rooms.map((r) => (
          <div key={r.id}><label><input type="checkbox" checked={ids.includes(r.id)} onChange={() => toggle(r.id)} /> {r.name}</label></div>
        ))}
        <h3>Options</h3>
        <div><label><input type="checkbox" checked={includeFloors} onChange={(e) => setFloors(e.target.checked)} /> Inclure planchers et céramique</label></div>
        <div><label><input type="checkbox" checked={onlyInStock} onChange={(e) => setStock(e.target.checked)} /> Seulement les peintures encore en stock</label></div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="primary" disabled={!ids.length} onClick={() => { downloadReport(house, { roomIds: ids, includeFloors, onlyInStock }); onClose(); }}>Générer le PDF</button>
          <button onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useStore();
  const [report, setReport] = useState(false);
  const house = state.houses.find((h) => h.id === state.currentId) ?? state.houses[0];

  const updateHouse = (patch) => setState((st) => ({ ...st, houses: st.houses.map((h) => (h.id === house.id ? { ...h, ...patch } : h)) }));
  const updateRoom = (room) => updateHouse({ rooms: house.rooms.map((r) => (r.id === room.id ? room : r)) });

  const addHouse = () => {
    const name = prompt('Nom de la maison');
    if (!name?.trim()) return;
    const h = newHouse(name.trim(), prompt('Adresse (optionnel)') ?? '');
    setState((st) => ({ houses: [...st.houses, h], currentId: h.id }));
  };
  const editHouse = () => {
    const name = prompt('Nom de la maison', house.name);
    if (!name?.trim()) return;
    updateHouse({ name: name.trim(), address: prompt('Adresse', house.address) ?? house.address });
  };
  const deleteHouse = () => {
    if (state.houses.length < 2) return alert('Il faut garder au moins une maison.');
    if (!confirm(`Supprimer « ${house.name} » et toutes ses pièces ?`)) return;
    setState((st) => {
      const houses = st.houses.filter((h) => h.id !== house.id);
      return { houses, currentId: houses[0].id };
    });
  };
  const addRoom = () => {
    const name = prompt('Nom de la pièce (ex. Salon, Chambre des maîtres)');
    if (name?.trim()) updateHouse({ rooms: [...house.rooms, newRoom(name.trim())] });
  };

  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: 'registre-peinture.json' }).click();
    URL.revokeObjectURL(url);
  };
  const importJson = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then((t) => {
      try {
        const data = JSON.parse(t);
        if (!Array.isArray(data.houses) || !data.houses.length) throw new Error();
        if (confirm('Remplacer les données actuelles par ce fichier ?')) setState({ houses: data.houses, currentId: data.houses[0].id });
      } catch { alert('Fichier invalide.'); }
    });
    e.target.value = '';
  };

  return (
    <div className="wrap">
      <header className="top">
        <h1>🎨 Registre de peinture</h1>
        <div className="row">
          <select value={house.id} onChange={(e) => setState({ ...state, currentId: e.target.value })}>
            {state.houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <button onClick={addHouse}>+ Maison</button>
          <button onClick={editHouse}>Renommer / adresse</button>
          <button className="danger" onClick={deleteHouse}>Supprimer</button>
        </div>
      </header>

      <div className="card row">
        <div className="grow">
          <h2>{house.name}</h2>
          <div className="meta">{house.address || 'Aucune adresse'} · {house.rooms.length} pièce(s)</div>
        </div>
        <button className="primary" onClick={addRoom}>+ Pièce</button>
        <button onClick={() => setReport(true)} disabled={!house.rooms.length}>Rapport PDF</button>
        <button onClick={exportJson}>Exporter (JSON)</button>
        <label className="row" style={{ cursor: 'pointer' }}>
          <span className="tag">Importer</span>
          <input type="file" accept="application/json" onChange={importJson} hidden />
        </label>
      </div>

      {house.rooms.length === 0 && <p className="meta">Aucune pièce. Commencez par en ajouter une.</p>}
      {house.rooms.map((r) => (
        <Room key={r.id} room={r} update={updateRoom} remove={() => updateHouse({ rooms: house.rooms.filter((x) => x.id !== r.id) })} />
      ))}

      {report && <ReportModal house={house} onClose={() => setReport(false)} />}
    </div>
  );
}

import { useState } from 'react';
import {
  useStore, newHouse, newRoom, newSurface, newFloor, uid,
  SURFACES, FINISHES, FLOOR_TYPES, FLOORS, DEFAULT_ROOMS, groupByFloor, surfaceLabel, fmtMonth, toMonthValue, missingKinds, isChosen, colorSources,
} from './store.js';
import { downloadReport } from './pdf.js';


function Field({ label, children, className }) {
  return <label className={className}>{label}{children}</label>;
}

const THE = { murs: 'les murs', plafond: 'le plafond', moulures: 'les moulures' };
const sourceLabel = (src) =>
  `${src.kinds.map((k) => THE[k]).join(' et ')} (${[src.fields.colorCode, src.fields.colorName].filter(Boolean).join(' ')})`;
const sameColorNote = (src) => `Même couleur que ${src.kinds.map((k) => THE[k]).join(' et ')} : produit et fini à préciser`;

// Ajoute une surface à la pièce; une entrée vide du même type (sans couleur choisie) est remplacée plutôt que doublée.
function withSurface(room, item) {
  const blank = room.surfaces.findIndex((x) => x.kind === item.kind && !isChosen(x));
  return { ...room, surfaces: blank < 0 ? [...room.surfaces, item] : room.surfaces.map((x, i) => (i === blank ? { ...item, id: x.id } : x)) };
}

// Champs repris d'une autre pièce : couleur et produit (pas la date, le stock ni les notes du pot).
const COPY_FIELDS = ['colorName', 'colorCode', 'hex', 'brand', 'model', 'finish'];

/** Couleurs déjà utilisées dans les autres pièces, regroupées quand elles sont identiques. */
function copySources(otherRooms) {
  const map = new Map();
  for (const room of otherRooms) {
    for (const surf of room.surfaces) {
      const key = [surf.kind, ...COPY_FIELDS.map((f) => surf[f])].join('|');
      if (!map.has(key)) map.set(key, { key, kind: surf.kind, surf, rooms: [] });
      map.get(key).rooms.push(room.name);
    }
  }
  return [...map.values()];
}

function CopyPicker({ kind, otherRooms, onPick }) {
  const [all, setAll] = useState(false);
  const sources = copySources(otherRooms).filter((o) => all || o.kind === kind);
  if (!copySources(otherRooms).length) return null;
  return (
    <div className="full copy-picker">
      <Field label={`Copier la couleur d’une autre pièce (${all ? 'toutes les surfaces' : surfaceLabel(kind).toLowerCase()})`}>
        <select value="" onChange={(e) => { const o = sources.find((x) => x.key === e.target.value); if (o) onPick(o.surf); }}>
          <option value="">{sources.length ? '— Choisir une couleur existante —' : 'Aucune couleur de ce type ailleurs'}</option>
          {sources.map((o) => (
            <option key={o.key} value={o.key}>
              {[o.surf.colorCode, o.surf.colorName].filter(Boolean).join(' ') || 'Sans code'} — {[o.surf.brand, o.surf.model, o.surf.finish].filter(Boolean).join(' · ') || 'produit non précisé'}
              {' '}({o.rooms.join(', ')})
            </option>
          ))}
        </select>
      </Field>
      <label className="chk meta"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Montrer toutes les surfaces</label>
    </div>
  );
}

function SurfaceForm({ value, onSave, onCancel, otherRooms = [], sameColor = [], isNew = false, saveLabel = 'Enregistrer', cancelLabel = 'Annuler' }) {
  const [s, setS] = useState(value);
  const set = (k) => (e) => setS({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const copyFrom = (src) => setS({ ...s, ...Object.fromEntries(COPY_FIELDS.map((f) => [f, src[f]])) });
  return (
    <div className="form">
      {isNew && sameColor.filter((src) => !src.kinds.every((k) => k === s.kind)).length > 0 && (
        <div className="full copy-picker">
          <span className="meta">Même couleur que :</span>
          {sameColor.filter((src) => !src.kinds.every((k) => k === s.kind)).map((src) => (
            <button key={src.key} type="button" onClick={() => setS({ ...s, ...src.fields, notes: s.notes || sameColorNote(src) })}>
              {sourceLabel(src)}
            </button>
          ))}
        </div>
      )}
      {isNew && <CopyPicker kind={s.kind} otherRooms={otherRooms} onPick={copyFrom} />}
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
      <Field label="Dernière application (mois)"><input type="month" value={toMonthValue(s.lastApplied)} onChange={set('lastApplied')} /></Field>
      <Field label="" className="chk">
        <input type="checkbox" checked={s.inStock} onChange={set('inStock')} /> Il m’en reste en stock
      </Field>
      {s.inStock && <Field label="Quantité / contenant restant"><input value={s.stockNote} onChange={set('stockNote')} placeholder="ex. ½ gallon" /></Field>}
      <Field label="Notes" className="full"><textarea rows={2} value={s.notes} onChange={set('notes')} /></Field>
      <div className="row full">
        <button className="primary" onClick={() => onSave(s)}>{saveLabel}</button>
        <button onClick={onCancel}>{cancelLabel}</button>
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
      <Field label="Installation (mois)"><input type="month" value={toMonthValue(f.installedOn)} onChange={set('installedOn')} /></Field>
      <Field label="Notes" className="full"><textarea rows={2} value={f.notes} onChange={set('notes')} /></Field>
      <div className="row full">
        <button className="primary" onClick={() => onSave(f)}>Enregistrer</button>
        <button onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}

function SaveStatus({ saveState, reload, retrySave }) {
  if (saveState === 'conflict') {
    return <span className="tag" style={{ color: 'var(--bad)' }}>Modifié ailleurs — <button className="link" onClick={reload}>recharger</button> (vos dernières modifications seront perdues)</span>;
  }
  if (saveState === 'error') {
    return <span className="tag" style={{ color: 'var(--bad)' }}>Échec de l’enregistrement — <button className="link" onClick={retrySave}>réessayer</button></span>;
  }
  return <span className="tag meta">{saveState === 'saving' ? 'Enregistrement…' : 'Enregistré'}</span>;
}

function Room({ room, otherRooms, update, remove }) {
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
        {missingKinds(room).length > 0 && (
          <span className="tag warn" title="Prérequis : au moins un mur, le plafond et les moulures">
            ⚠ Manque : {missingKinds(room).map((k) => surfaceLabel(k).toLowerCase()).join(', ')}
          </span>
        )}
        <select value={room.floor || ''} onChange={(e) => update({ ...room, floor: e.target.value })} aria-label="Étage">
          <option value="">Sans étage</option>
          {FLOORS.map((f) => <option key={f}>{f}</option>)}
        </select>
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
              {' · '}Appliquée : {fmtMonth(s.lastApplied)}
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
            <div className="meta">Installé : {fmtMonth(f.installedOn)}{f.notes && ` · ${f.notes}`}</div>
          </div>
          <button className="link" onClick={() => setEditing({ type: 'floor', item: f })}>Modifier</button>
          <button className="link danger" onClick={() => update({ ...room, floors: room.floors.filter((x) => x.id !== f.id) })}>✕</button>
        </div>
      ))}

      {editing ? (
        <div className="surface" style={{ display: 'block' }}>
          {editing.type === 'surface'
            ? <SurfaceForm value={editing.item} onSave={saveItem} onCancel={() => setEditing(null)} otherRooms={otherRooms} sameColor={colorSources(room)} isNew={!room.surfaces.some((x) => x.id === editing.item.id)} />
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

/** Parcourt les pièces incomplètes et propose de combler chaque vide (nouvelle couleur ou copie d'une autre pièce). */
function FillGaps({ house, updateHouse, onClose }) {
  const [skipped, setSkipped] = useState([]);
  const [applyAll, setApplyAll] = useState(false);
  const tasks = house.rooms.flatMap((room) => missingKinds(room).map((kind) => ({ room, kind, key: `${room.id}:${kind}` })));
  const pending = tasks.filter((t) => !skipped.includes(t.key));
  const task = pending[0];
  const sameKind = task ? pending.filter((t) => t.kind === task.kind) : [];

  const save = (surf) => {
    // « Même couleur partout » : copie couleur et produit dans les autres pièces où ce type manque aussi.
    const targets = applyAll && surf.kind === task.kind ? sameKind : [task];
    updateHouse({
      rooms: house.rooms.map((r) => {
        if (!targets.some((t) => t.room.id === r.id)) return r;
        const item = r.id === task.room.id
          ? surf
          : { ...newSurface(surf.kind), label: surf.label, ...Object.fromEntries(COPY_FIELDS.map((f) => [f, surf[f]])) };
        return withSurface(r, item);
      }),
    });
    setApplyAll(false);
  };

  // « Même couleur » automatique : seulement dans les pièces où une seule couleur est déjà choisie
  // (sinon on ne sait pas laquelle reprendre : le choix se fait à l'étape de la pièce).
  const auto = house.rooms.filter((r) => missingKinds(r).length && colorSources(r).length === 1);
  const autoCount = auto.reduce((n, r) => n + missingKinds(r).length, 0);
  const fillSameColor = () => {
    updateHouse({
      rooms: house.rooms.map((r) => {
        if (!auto.includes(r)) return r;
        const [src] = colorSources(r);
        return missingKinds(r).reduce(
          (room, kind) => withSurface(room, { ...newSurface(kind), ...src.fields, notes: sameColorNote(src) }),
          r,
        );
      }),
    });
  };

  return (
    <div className="overlay">
      <div className="modal">
        <h2>Compléter les pièces</h2>
        {!task ? (
          <>
            <p>{skipped.length ? `${skipped.length} élément(s) passé(s).` : '✓ Toutes les pièces sont complètes.'}</p>
            <div className="row">
              {skipped.length > 0 && <button onClick={() => setSkipped([])}>Revoir les éléments passés</button>}
              <button className="primary" onClick={onClose}>Fermer</button>
            </div>
          </>
        ) : (
          <>
            <p className="meta">
              Reste {pending.length} élément(s) dans {new Set(pending.map((t) => t.room.id)).size} pièce(s).
            </p>
            {autoCount > 0 && (
              <div className="card row" style={{ marginBottom: 10 }}>
                <span className="grow meta">
                  {auto.length} pièce(s) n’ont qu’une seule couleur : les {autoCount} vide(s) peuvent reprendre cette couleur (produit et fini à préciser ensuite).
                </span>
                <button className="primary" onClick={fillSameColor}>Même couleur partout ({autoCount})</button>
              </div>
            )}
            <h3>{task.room.name} — manque : {surfaceLabel(task.kind).toLowerCase()}</h3>
            <SurfaceForm
              key={task.key}
              value={newSurface(task.kind)}
              otherRooms={house.rooms.filter((r) => r.id !== task.room.id)}
              sameColor={colorSources(task.room)}
              isNew
              onSave={save}
              onCancel={() => setSkipped([...skipped, task.key])}
              saveLabel="Enregistrer et suivant"
              cancelLabel="Passer"
            />
            {sameKind.length > 1 && (
              <label className="row" style={{ marginTop: 10 }}>
                <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
                Appliquer la même couleur aux {sameKind.length - 1} autre(s) pièce(s) où manque : {surfaceLabel(task.kind).toLowerCase()}
              </label>
            )}
            <div className="row" style={{ marginTop: 14 }}><button onClick={onClose}>Fermer</button></div>
          </>
        )}
      </div>
    </div>
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
        {groupByFloor(house.rooms).flatMap((g) => g.rooms).map((r) => (
          <div key={r.id}><label><input type="checkbox" checked={ids.includes(r.id)} onChange={() => toggle(r.id)} /> {r.name}{r.floor ? ` — ${r.floor}` : ''}</label></div>
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

function Main({ state, setState, saveState, logout, reload, retrySave }) {
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
  // Pièces de base pas encore présentes dans cette maison (comparaison par nom)
  const missingRooms = DEFAULT_ROOMS.filter(([name]) => !house.rooms.some((r) => r.name === name));
  const addDefaultRooms = () => updateHouse({ rooms: [...house.rooms, ...missingRooms.map(([n, f]) => newRoom(n, f))] });
  const [filling, setFilling] = useState(false);
  const incompleteRooms = house.rooms.filter((r) => missingKinds(r).length);
  const [adding, setAdding] = useState(null); // { name, floor } ou null
  const addRoom = () => {
    if (!adding.name.trim()) return;
    updateHouse({ rooms: [...house.rooms, newRoom(adding.name.trim(), adding.floor)] });
    setAdding(null);
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
          <SaveStatus saveState={saveState} reload={reload} retrySave={retrySave} />
          <button className="link" onClick={logout}>Déconnexion</button>
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
          {house.rooms.length > 0 && (incompleteRooms.length
            ? <div className="warn-text">⚠ {incompleteRooms.length} pièce(s) incomplète(s) : il faut au moins un mur, le plafond et les moulures.</div>
            : <div className="meta">✓ Toutes les pièces sont complètes.</div>)}
        </div>
        {incompleteRooms.length > 0 && <button className="primary" onClick={() => setFilling(true)}>Compléter ({incompleteRooms.length})</button>}
        <button className={incompleteRooms.length ? '' : 'primary'} onClick={() => setAdding({ name: '', floor: FLOORS[0] })}>+ Pièce</button>
        {missingRooms.length > 0 && (
          <button onClick={addDefaultRooms} title="Ajoute les pièces de base absentes de cette maison">+ Pièces de base ({missingRooms.length})</button>
        )}
        <button onClick={() => setReport(true)} disabled={!house.rooms.length}>Rapport PDF</button>
        <button onClick={exportJson}>Exporter (JSON)</button>
        <label className="row" style={{ cursor: 'pointer' }}>
          <span className="tag">Importer</span>
          <input type="file" accept="application/json" onChange={importJson} hidden />
        </label>
      </div>

      {adding && (
        <form className="card row" onSubmit={(e) => { e.preventDefault(); addRoom(); }}>
          <input className="grow" autoFocus placeholder="Nom de la pièce" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} />
          <select value={adding.floor} onChange={(e) => setAdding({ ...adding, floor: e.target.value })}>
            {FLOORS.map((f) => <option key={f}>{f}</option>)}
          </select>
          <button className="primary" disabled={!adding.name.trim()}>Ajouter</button>
          <button type="button" onClick={() => setAdding(null)}>Annuler</button>
        </form>
      )}

      {house.rooms.length === 0 && <p className="meta">Aucune pièce. Commencez par en ajouter une.</p>}
      {groupByFloor(house.rooms).map((g) => (
        <div key={g.floor}>
          <h3>{g.floor || 'Sans étage'}</h3>
          {g.rooms.map((r) => (
            <Room key={r.id} room={r} otherRooms={house.rooms.filter((x) => x.id !== r.id)} update={updateRoom} remove={() => updateHouse({ rooms: house.rooms.filter((x) => x.id !== r.id) })} />
          ))}
        </div>
      ))}

      {filling && <FillGaps house={house} updateHouse={updateHouse} onClose={() => setFilling(false)} />}
      {report && <ReportModal house={house} onClose={() => setReport(false)} />}
    </div>
  );
}

function Login({ onLogin }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr((await onLogin(pw)) ? '' : 'Mot de passe incorrect');
    setBusy(false);
  };
  return (
    <div className="wrap">
      <form className="card form" onSubmit={submit} style={{ maxWidth: 360, margin: '80px auto' }}>
        <h1 className="full">🎨 Registre de peinture</h1>
        <Field label="Mot de passe" className="full">
          <input type="password" autoFocus autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        {err && <div className="full" style={{ color: 'var(--bad)' }}>{err}</div>}
        <button className="primary full" disabled={busy || !pw}>Se connecter</button>
      </form>
    </div>
  );
}

export default function App() {
  const store = useStore();
  const { status, state } = store;
  if (status === 'login') return <Login onLogin={store.login} />;
  if (status === 'error') {
    return (
      <div className="wrap">
        <p>Impossible de joindre le serveur.</p>
        <button onClick={store.reload}>Réessayer</button>
      </div>
    );
  }
  if (status === 'loading' || !state) return <div className="wrap meta">Chargement…</div>;
  return <Main {...store} />;
}

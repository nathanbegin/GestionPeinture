import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { surfaceLabel, groupByFloor, fmtMonth } from './store.js';

const hexToRgb = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return [204, 204, 204];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Génère le PDF d'une maison. roomIds: pièces à inclure (null = toutes). */
export function buildReport(house, { roomIds = null, includeFloors = true, onlyInStock = false } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 40;
  const rooms = house.rooms.filter((r) => !roomIds || roomIds.includes(r.id));

  doc.setFontSize(20);
  doc.text(`Registre de peinture — ${house.name}`, margin, 50);
  doc.setFontSize(10);
  doc.setTextColor(100);
  if (house.address) doc.text(house.address, margin, 68);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-CA')}`, margin, house.address ? 82 : 68);
  doc.setTextColor(0);

  let y = house.address ? 105 : 90;
  if (!rooms.length) doc.text('Aucune pièce à afficher.', margin, y);

  const ordered = groupByFloor(rooms).flatMap((g) => g.rooms.map((room, i) => ({ room, heading: i === 0 ? g.floor || 'Sans étage' : null })));

  for (const { room, heading } of ordered) {
    if (heading) {
      if (y > 640) { doc.addPage(); y = 50; }
      doc.setFontSize(16);
      doc.setTextColor(55, 65, 81);
      doc.text(heading, margin, y);
      doc.setDrawColor(55, 65, 81);
      doc.line(margin, y + 4, 572, y + 4);
      doc.setTextColor(0);
      y += 24;
    }
    const surfaces = room.surfaces.filter((s) => !onlyInStock || s.inStock);
    if (y > 680) { doc.addPage(); y = 50; }
    doc.setFontSize(14);
    doc.text(room.name, margin, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['', 'Surface', 'Couleur', 'Marque / modèle', 'Fini', 'Dernière application', 'En stock']],
      body: surfaces.map((s) => [
        '',
        s.label ? `${surfaceLabel(s.kind)} (${s.label})` : surfaceLabel(s.kind),
        [s.colorName, s.colorCode].filter(Boolean).join(' — ') || '—',
        [s.brand, s.model].filter(Boolean).join(' ') || '—',
        s.finish || '—',
        fmtMonth(s.lastApplied),
        s.inStock ? `Oui${s.stockNote ? ` (${s.stockNote})` : ''}` : 'Non',
      ]),
      styles: { fontSize: 9, cellPadding: 4, minCellHeight: 18 },
      headStyles: { fillColor: [55, 65, 81] },
      columnStyles: { 0: { cellWidth: 22 } },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const { x, y: cy, height } = data.cell;
          doc.setFillColor(...hexToRgb(surfaces[data.row.index].hex));
          doc.setDrawColor(120);
          doc.rect(x + 3, cy + 3, 16, height - 6, 'FD');
        }
      },
    });
    y = doc.lastAutoTable.finalY + 8;

    if (includeFloors && room.floors.length) {
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Revêtement de sol', 'Marque', 'Modèle', 'Couleur', 'Installé le']],
        body: room.floors.map((f) => [f.type, f.brand || '—', f.model || '—', f.color || '—', fmtMonth(f.installedOn)]),
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [120, 113, 108] },
      });
      y = doc.lastAutoTable.finalY + 8;
    }
    if (room.notes) {
      doc.setFontSize(9);
      doc.setTextColor(100);
      const lines = doc.splitTextToSize(`Notes : ${room.notes}`, 515);
      doc.text(lines, margin, y + 6);
      doc.setTextColor(0);
      y += lines.length * 11 + 6;
    }
    y += 22;
  }
  return doc;
}

export const downloadReport = (house, opts) =>
  buildReport(house, opts).save(`registre-peinture-${house.name.replace(/\W+/g, '-').toLowerCase()}.pdf`);

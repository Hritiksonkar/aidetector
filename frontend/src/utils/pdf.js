import { jsPDF } from 'jspdf';

export function generatePdfReport(record) {
    const r = record || {};
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    const marginX = 48;
    let y = 56;

    const title = 'TruthLens AI — Verification Report';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title, marginX, y);

    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`Generated: ${new Date().toLocaleString()}`, marginX, y);

    y += 20;
    doc.setTextColor(20);
    doc.setFontSize(12);

    const lines = [
        ['Type', r.kind || '—'],
        ['Result', r.result || '—'],
        ['Confidence', r.confidence != null ? `${Math.round(r.confidence)}%` : '—'],
        ['Trust Score', r.trustScore != null ? `${Math.round(r.trustScore)}%` : '—'],
        ['Input', r.label || '—'],
        ['Timestamp', r.ts ? new Date(r.ts).toLocaleString() : '—']
    ];

    doc.setFont('helvetica', 'bold');
    doc.text('Summary', marginX, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    for (const [k, v] of lines) {
        doc.setFont('helvetica', 'bold');
        doc.text(`${k}:`, marginX, y);
        doc.setFont('helvetica', 'normal');
        doc.text(String(v), marginX + 92, y);
        y += 14;
    }

    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('Explainable Signals', marginX, y);
    y += 14;
    doc.setFont('helvetica', 'normal');

    const why = Array.isArray(r.why) ? r.why : [];
    const bulletLines = why.length ? why : ['No explanation available.'];
    const wrapWidth = 520;

    for (const item of bulletLines) {
        const wrapped = doc.splitTextToSize(`• ${String(item)}`, wrapWidth);
        doc.text(wrapped, marginX, y);
        y += wrapped.length * 12 + 2;
        if (y > 760) {
            doc.addPage();
            y = 56;
        }
    }

    return doc;
}

export function downloadPdfReport(filename, record) {
    const doc = generatePdfReport(record);
    doc.save(filename);
}

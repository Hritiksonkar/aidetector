function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function exportJson(filename, data) {
    downloadText(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
}

function csvEscape(v) {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

export function exportCsv(filename, rows) {
    const list = Array.isArray(rows) ? rows : [];
    if (list.length === 0) {
        downloadText(filename, '');
        return;
    }

    const headers = Object.keys(list[0]);
    const lines = [headers.join(',')];
    for (const row of list) {
        lines.push(headers.map((h) => csvEscape(row[h])).join(','));
    }

    downloadText(filename, lines.join('\n'), 'text/csv;charset=utf-8');
}

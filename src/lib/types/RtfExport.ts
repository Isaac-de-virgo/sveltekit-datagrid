export async function exportToRtf(data: any[], columns: any[], selectedRows: (string | number)[] = []) {
    // Filter data for selected rows
    const dataToExport = selectedRows.length > 0
        ? data.filter(row => selectedRows.includes(row.id))
        : data;

    // Create RTF header
    let rtf = '{\\rtf1\\ansi\\deff0\n';
    rtf += '{\\fonttbl{\\f0\\fswiss Arial;}}\n';
    rtf += '\\f0\\fs24\n';

    // Add title
    rtf += '\\b Exported Data\\b0 \\par\\par\n';

    // Create table header
    rtf += '\\trowd\\trgaph70\\trleft-70\n';
    const headers = columns.filter(col => !col.selectable && col.header);
    headers.forEach((_, index) => {
        rtf += `\\cellx${(index + 1) * 2000}\n`;
    });

    // Add headers
    headers.forEach(col => {
        rtf += `\\b ${col.header}\\b0 \\cell `;
    });
    rtf += '\\row\n';

    // Add data rows
    dataToExport.forEach(row => {
        rtf += '\\trowd\\trgaph70\\trleft-70\n';
        headers.forEach((_, index) => {
            rtf += `\\cellx${(index + 1) * 2000}\n`;
        });

        headers.forEach(col => {
            const value = row[col.field];
            const formattedValue = col.format ? col.format(value, row) : value;
            rtf += `${formattedValue || ''} \\cell `;
        });
        rtf += '\\row\n';
    });

    // Close RTF document
    rtf += '}';

    // Create and download file
    const blob = new Blob([rtf], { type: 'application/rtf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.rtf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
import * as XLSX from 'xlsx';

export function exportToExcel(data: any[], columns: any[], format: 'xls' | 'xlsx' | 'csv', selectedRows: (string | number)[] = []) {
    // Filter data if there are selected rows
    const dataToExport = selectedRows.length > 0
        ? data.filter(row => selectedRows.includes(row.id))
        : data;

    // Prepare data for export
    const exportData = dataToExport.map(row => {
        const exportRow: Record<string, any> = {};
        columns.forEach(col => {
            if (col.field && col.header && !col.selectable) {
                const value = row[col.field];
                exportRow[col.header] = col.format ? col.format(value, row) : value;
            }
        });
        return exportRow;
    });

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    // Export based on format
    if (format === 'csv') {
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        saveFile(blob, `export.csv`);
    } else {
        XLSX.writeFile(wb, `export.${format}`);
    }
}

function saveFile(blob: Blob, filename: string) {
    if ('msSaveBlob' in navigator) {
        // IE10+
        (navigator as any).msSaveBlob(blob, filename);
    } else {
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
}
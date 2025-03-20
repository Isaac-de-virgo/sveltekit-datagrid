import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export async function exportToPdf(data: any[], columns: any[], selectedRows: (string | number)[] = []) {
    const doc = new jsPDF();

    // Filter data
    const dataToExport = selectedRows.length > 0
        ? data.filter(row => selectedRows.includes(row.id))
        : data;

    // Prepare table data
    const headers = columns
        .filter(col => !col.selectable && col.header)
        .map(col => col.header);

    const rows = dataToExport.map(row =>
        columns
            .filter(col => !col.selectable && col.field)
            .map(col => col.format ? col.format(row[col.field], row) : row[col.field])
    );

    // Add title
    doc.setFontSize(16);
    doc.text('Exported Data', 14, 15);

    // Use autoTable as direct function call
    autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 25,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [66, 139, 202], textColor: 255 }
    });

    doc.save('export.pdf');
}
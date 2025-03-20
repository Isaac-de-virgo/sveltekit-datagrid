import { Document, Paragraph, Table, TableRow, TableCell, Packer } from 'docx';

export async function exportToDocx(data: any[], columns: any[], selectedRows: (string | number)[] = []) {
    // Filter data if there are selected rows
    const dataToExport = selectedRows.length > 0
        ? data.filter(row => selectedRows.includes(row.id))
        : data;

    // Create table rows
    const tableRows = [
        // Header row
        new TableRow({
            children: columns
                .filter(col => !col.selectable && col.header)
                .map(col => new TableCell({ children: [new Paragraph({ text: col.header })] }))
        }),
        // Data rows
        ...dataToExport.map(row =>
            new TableRow({
                children: columns
                    .filter(col => !col.selectable && col.field)
                    .map(col => {
                        const value = col.format
                            ? col.format(row[col.field], row)
                            : row[col.field];
                        return new TableCell({
                            children: [new Paragraph({ text: String(value ?? '') })]
                        });
                    })
            })
        )
    ];

    // Create document
    const doc = new Document({
        sections: [{
            children: [
                new Table({ rows: tableRows })
            ]
        }]
    });

    // Generate and download
    const blob = await Packer.toBlob(doc);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'export.docx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}
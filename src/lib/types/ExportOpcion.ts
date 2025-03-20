export interface ExportOption {
    label: string;
    format: "pdf" | "xls" | "xlsx" | "docx" | "rtf" | "csv";
    enabled: boolean;
    icon?: string;
}
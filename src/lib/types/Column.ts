export interface Column<T = any> {
    field?: keyof T;
    header?: string;
    width?: string;
    sortable?: boolean;
    filterable?: boolean;
    selectable?: boolean;
    template?: any;
    format?: (value: any, row: T) => string;
}
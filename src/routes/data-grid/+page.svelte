<script lang="ts">
    import DataGrid from "$lib/DataGrid/DataGrid.svelte";

    // Define user interface
    interface User {
        id: number;
        name: string;
        email: string;
        role: string;
        status: "Active" | "Inactive";
        lastLogin: string;
    }

    // Define column interface
    interface Column<T = any> {
        field?: keyof T;
        header?: string;
        width?: string;
        sortable?: boolean;
        filterable?: boolean;
        selectable?: boolean;
        template?: any;
        format?: (value: any, row: T) => string;
    }

    // Define export options
    interface ExportOption {
        label: string;
        format: "pdf" | "xls" | "xlsx" | "docx" | "rtf" | "csv";
        enabled: boolean;
    }

    // Sample data with proper typing
    let users = $state<User[]>([
        {
            id: 1,
            name: "John Doe",
            email: "john@example.com",
            role: "Admin",
            status: "Active",
            lastLogin: "2023-11-15",
        },
        {
            id: 2,
            name: "Jane Smith",
            email: "jane@example.com",
            role: "User",
            status: "Active",
            lastLogin: "2023-11-14",
        },
        {
            id: 3,
            name: "Bob Johnson",
            email: "bob@example.com",
            role: "Editor",
            status: "Inactive",
            lastLogin: "2023-10-25",
        },
        {
            id: 4,
            name: "Alice Brown",
            email: "alice@example.com",
            role: "User",
            status: "Active",
            lastLogin: "2023-11-12",
        },
        {
            id: 5,
            name: "Charlie Wilson",
            email: "charlie@example.com",
            role: "Admin",
            status: "Active",
            lastLogin: "2023-11-10",
        },
        {
            id: 6,
            name: "Diana Miller",
            email: "diana@example.com",
            role: "User",
            status: "Inactive",
            lastLogin: "2023-09-30",
        },
        {
            id: 7,
            name: "Edward Davis",
            email: "edward@example.com",
            role: "Editor",
            status: "Active",
            lastLogin: "2023-11-08",
        },
        {
            id: 8,
            name: "Fiona Clark",
            email: "fiona@example.com",
            role: "User",
            status: "Active",
            lastLogin: "2023-11-05",
        },
        {
            id: 9,
            name: "George White",
            email: "george@example.com",
            role: "Admin",
            status: "Active",
            lastLogin: "2023-11-01",
        },
        {
            id: 10,
            name: "Hannah Green",
            email: "hannah@example.com",
            role: "User",
            status: "Inactive",
            lastLogin: "2023-10-15",
        },
        {
            id: 11,
            name: "Ian Black",
            email: "ian@example.com",
            role: "Editor",
            status: "Active",
            lastLogin: "2023-10-28",
        },
        {
            id: 12,
            name: "Julia Red",
            email: "julia@example.com",
            role: "User",
            status: "Active",
            lastLogin: "2023-10-20",
        },
    ]);

    // Column definitions with proper typing
    const columns: Column<User>[] = [
        { selectable: true }, // Checkbox column
        { field: "id", header: "ID", width: "200px" },
        { field: "name", header: "Name" },
        { field: "email", header: "Email" },
        {
            field: "role",
            header: "Role",
        },
        {
            field: "status",
            header: "Status",
            width: "100px",
            filterable: true,
            sortable: true,
            format: (value: string) => {
                const color = value === "Active" ? "green" : "red";
                return `<span style="color: ${color}; font-weight: bold;">${value}</span>`;
            },
        },
        {
            field: "lastLogin",
            header: "Last Login",
            format: (value: string) => {
                const date = new Date(value);
                return date.toLocaleDateString();
            },
        },
    ];

    // Export options
    const exportOptions: ExportOption[] = [
        { label: "Export to PDF", format: "pdf", enabled: true },
        { label: "Export to XLS", format: "xls", enabled: true },
        { label: "Export to XLSX", format: "xlsx", enabled: true },
        { label: "Export to DOCX", format: "docx", enabled: true },
        { label: "Export to RTF", format: "rtf", enabled: true },
        { label: "Export to CSV", format: "csv", enabled: true },
    ];

    function addNewUser(): void {
        const newId =
            users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1;
        users = [
            ...users,
            {
                id: newId,
                name: `New User ${newId}`,
                email: `user${newId}@example.com`,
                role: "User",
                status: "Active",
                lastLogin: new Date().toISOString().split("T")[0],
            },
        ];
    }
</script>

<h1>User Management</h1>

<div class="m-5">
    <DataGrid
        data={users}
        {columns}
        pageSize={10}
        showPagination={true}
        showFilter={true}
        showSort={true}
        {exportOptions}
        allowGrouping={true}
        onRowClick={(rowData, event) => {
            console.log("Row clicked:", rowData);
            // Access any field from the row
            console.log("ID:", rowData.id);
            // Perform actions based on the row data
        }}
    >
        {#snippet toolbar()}
            <button class="dx-button" onclick={addNewUser}> Add User </button>
        {/snippet}
    </DataGrid>
</div>

# 🚀 SvelteKit DataGrid Component 🚀

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

A powerful and customizable DataGrid component for SvelteKit applications. Built with TypeScript support, featuring sorting, filtering, pagination, export options, and more!

---

## 🌟 Features

✅ **TypeScript Ready**  
✅ **Pagination & Sorting**  
✅ **Column Filtering**  
✅ **Data Export** (PDF, Excel, CSV, etc.)  
✅ **Row Selection & Grouping**  
✅ **Custom Cell Formatting**  
✅ **Dynamic Data Updates**  
✅ **Responsive Design**  

---

## 📦 Installation

```bash
npm install sveltekit-datagrid docx jspdf jspdf-autotable xlsx 
```

---

## 🛠️ Quick Start

### 1. Import the Component

```svelte
<script lang="ts">
  import { DataGrid } from "sveltekit-mk-datagrid";
</script>
```

### 2. Define Your Data

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: "Active" | "Inactive";
  lastLogin: string;
}

let users = $state<User[]>([
  {
    id: 1,
    name: "John Doe",
    email: "john@example.com",
    role: "Admin",
    status: "Active",
    lastLogin: "2023-11-15",
  },
  // ... more data
]);
```

### 3. Configure Columns

```typescript
const columns: Column<User>[] = [
    { selectable: true }, // Checkbox column
    { field: "id", header: "ID" },
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
```

### 4. Add Export Options

```typescript
const exportOptions: ExportOption[] = [
    { label: "Export to PDF", format: "pdf", enabled: true },
    { label: "Export to XLS", format: "xls", enabled: true },
    { label: "Export to XLSX", format: "xlsx", enabled: true },
    { label: "Export to DOCX", format: "docx", enabled: true },
    { label: "Export to RTF", format: "rtf", enabled: true },
    { label: "Export to CSV", format: "csv", enabled: true },
];
```

### 5. Use the Component

```svelte
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
```

---

## 🎨 Customization

### Column Configuration Options

| Property      | Description                          | Type                          |
|---------------|--------------------------------------|-------------------------------|
| `field`       | Data field name                      | `keyof T`                     |
| `header`      | Column header text                   | `string`                      |
| `width`       | Column width                         | `string` (e.g., "150px")      |
| `sortable`    | Enable sorting                       | `boolean`                     |
| `filterable`  | Enable filtering                     | `boolean`                     |
| `format`      | Custom cell formatting function      | `(value: any, row: T) => string` |

### Export Options

Supports multiple formats:  
`pdf`, `xls`, `xlsx`, `docx`, `rtf`, `csv`

---

## 📚 Tutorial for Beginners

### Step 1: Create New SvelteKit Project
```bash
npm sv create my-app
cd my-app
npm install
```

### Step 2: Add Sample Data
Create a `data.js` file with mock data (like the user example above)

### Step 3: Basic Implementation
```svelte
<script>
  import { DataGrid } from "@joirg_dev98/makeit-datagrid";
  import { users } from "./data.js";
  
  const columns = [
    { field: "name", header: "Name" },
    { field: "email", header: "Email" },
    // Add more columns
  ];
</script>

<DataGrid data={users} {columns} />
```

### Step 4: Add Features
- **Pagination**: Add `pageSize={10}`
- **Filtering**: Add `showFilter={true}`
- **Export**: Add `exportOptions={[...]}`

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a pull request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

---

Made with ❤️ by Isaac R.  
Need help? Open an issue or contact me at [joirgdev@gmail.com]
``` 

This adds the necessary Tailwind CSS setup instructions that are required for the DataGrid component to work properly.
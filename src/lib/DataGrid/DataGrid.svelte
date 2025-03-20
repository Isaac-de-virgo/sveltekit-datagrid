<script lang="ts">
    import { exportToExcel } from "$lib/types/ExcelExport.js";
    import { exportToDocx } from "$lib/types/WordExport.js";
    import { exportToPdf } from "$lib/types/PdfExport.js";
    import { exportToRtf } from "$lib/types/RtfExport.js";
    import type { Column } from "$lib/types/Column.js";
    import type { ExportOption } from "$lib/types/ExportOpcion.js";
    import type { Snippet } from "svelte";
    import { onMount } from "svelte";

    // Props with types
    type Props = {
        data: Record<string, any>[];
        columns: Column[];
        pageSize: number;
        showPagination: boolean;
        showFilter: boolean;
        showSort: boolean;
        title?: Snippet;
        toolbar?: Snippet;
        exportOptions?: ExportOption[];
        allowGrouping?: boolean;
        theme?: "light" | "dark" | "auto";
        pageSizeOptions?: number[]; // Opciones para tamaño de página
        onRowClick?: (rowData: Record<string, any>, event: MouseEvent) => void;
    };

    let {
        data = [],
        columns = [],
        pageSize = 10,
        showPagination = true,
        showFilter = true,
        showSort = true,
        title,
        toolbar,
        exportOptions = [
            { label: "Export to PDF", format: "pdf", enabled: true },
            { label: "Export to XLS", format: "xls", enabled: true },
            { label: "Export to XLSX", format: "xlsx", enabled: true },
            { label: "Export to DOCX", format: "docx", enabled: true },
            { label: "Export to RTF", format: "rtf", enabled: true },
            { label: "Export to CSV", format: "csv", enabled: true },
        ],
        allowGrouping = true,
        theme = "light",
        pageSizeOptions = [5, 10, 20, 50, 100],
        onRowClick = undefined,
    }: Props = $props();

    let selectedRowId = $state<number | string | null>(null);

    // State with types
    let currentPage = $state<number>(1);
    let sortField = $state<string | null>(null);
    let sortDirection = $state<"asc" | "desc">("asc");
    let filters = $state<Record<string, string>>({});
    let selectedRows = $state<(string | number)[]>([]);
    let isSelectAll = $state<boolean>(false);
    let globalFilter = $state<string>("");
    let groupByFields = $state<string[]>([]);
    let columnFilterVisible = $state<Record<string, boolean>>({});
    let columnFilterSearch = $state<Record<string, string>>({});
    let columnFilterValues = $state<Record<string, Set<string>>>({});
    let groupPanelHovered = $state(false);
    let isDragging = $state(false);
    let currentDragField = $state<string | null>(null);
    let isMobile = $state(false);
    let showMobileFilters = $state(false);
    let darkMode = $state(false);
    let showPageSizeSelector = $state(false);
    let showJumpToPage = $state(false);
    let jumpToPageValue = $state("");
    let isLoading = $state(false);
    let activeFiltersCount = $state(0);
    let showFilterSummary = $state(false);
    let savedFilterProfiles = $state<
        { name: string; filters: Record<string, string> }[]
    >([{ name: "Perfil predeterminado", filters: {} }]);
    let currentFilterProfile = $state(0);
    let showSaveFilterDialog = $state(false);
    let newFilterProfileName = $state("");
    let showTooltip = $state<Record<string, boolean>>({});
    let tooltipContent = $state("");
    let tooltipPosition = $state({ x: 0, y: 0 });

    // Estados para modos de filtro y dropdown
    let filterModes = $state<Record<string, string>>({});
    let filterDropdownVisible = $state<Record<string, boolean>>({});
    const filterOptions = [
        {
            value: "Comienza con",
            icon: "↳",
            tooltip: "Filtrar por texto que comienza con el valor",
        },
        {
            value: "Contiene",
            icon: "∿",
            tooltip: "Filtrar por texto que contiene el valor",
        },
        {
            value: "No contiene",
            icon: "∿̷",
            tooltip: "Filtrar por texto que no contiene el valor",
        },
        {
            value: "Acaba con",
            icon: "↲",
            tooltip: "Filtrar por texto que termina con el valor",
        },
        {
            value: "Igual",
            icon: "=",
            tooltip: "Filtrar por texto exactamente igual al valor",
        },
        {
            value: "No igual",
            icon: "≠",
            tooltip: "Filtrar por texto diferente al valor",
        },
    ];

    // Check for dark mode preference
    onMount(() => {
        // Check for system preference
        if (theme === "auto") {
            const prefersDark = window.matchMedia(
                "(prefers-color-scheme: dark)",
            ).matches;
            darkMode = prefersDark;

            // Listen for changes
            window
                .matchMedia("(prefers-color-scheme: dark)")
                .addEventListener("change", (e) => {
                    darkMode = e.matches;
                });
        } else {
            darkMode = theme === "dark";
        }

        setTimeout(() => {
            const tableHeaders = document.querySelectorAll(
                ".data-grid-table th",
            );
            tableHeaders.forEach((th) => {
                const field = th.getAttribute("data-field");
                if (field) {
                    (th as HTMLElement).style.setProperty(
                        "--col-width",
                        `${(th as HTMLElement).offsetWidth}px`,
                    );
                }
            });
        }, 100);

        // Check for mobile
        const checkMobile = () => {
            isMobile = window.innerWidth < 768;
        };

        checkMobile();
        window.addEventListener("resize", checkMobile);

        // Keyboard shortcuts
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("resize", checkMobile);
            window.removeEventListener("keydown", handleKeyDown);
        };
    });

    function handleKeyDown(e: KeyboardEvent) {
        // No aplicar atajos si estamos en un input
        if (
            e.target instanceof HTMLInputElement ||
            e.target instanceof HTMLTextAreaElement
        ) {
            return;
        }

        // Atajos de teclado para navegación
        if (e.key === "ArrowRight" && e.altKey) {
            e.preventDefault();
            if (currentPage < totalPages) handlePageChange(currentPage + 1);
        } else if (e.key === "ArrowLeft" && e.altKey) {
            e.preventDefault();
            if (currentPage > 1) handlePageChange(currentPage - 1);
        } else if (e.key === "Home" && e.altKey) {
            e.preventDefault();
            handlePageChange(1);
        } else if (e.key === "End" && e.altKey) {
            e.preventDefault();
            handlePageChange(totalPages);
        } else if (e.key === "f" && e.ctrlKey) {
            e.preventDefault();
            // Enfocar el campo de búsqueda global
            const searchInput = document.getElementById("global-search");
            if (searchInput) searchInput.focus();
        }
    }

    function getCurrentFilterMode(field: string): string {
        return filterModes[field] || "Contiene";
    }

    // Derived state
    let globalFilteredData = $derived(applyGlobalFilter(data, globalFilter));
    let filteredData = $derived(applyFilters(globalFilteredData, filters));
    let sortedData = $derived(
        applySort(filteredData, sortField, sortDirection),
    );
    let groupedData = $derived(applyGrouping(sortedData, groupByFields));
    let paginatedData = $derived(
        applyPagination(groupedData, currentPage, pageSize),
    );
    let totalPages = $derived(Math.ceil(groupedData.length / pageSize));

    // Actualizar contador de filtros activos
    $effect(() => {
        activeFiltersCount = Object.values(filters).filter(
            (v) => v && v !== "(Todos)",
        ).length;
    });

    // Initialize column filter values
    $effect(() => {
        if (data.length > 0) {
            columns.forEach((column) => {
                if (column.field) {
                    const field = column.field as string;
                    const uniqueValues = new Set<string>();

                    data.forEach((row) => {
                        const value = row[field];
                        if (value !== undefined && value !== null) {
                            uniqueValues.add(String(value));
                        }
                    });

                    columnFilterValues[field] = uniqueValues;
                }
            });
        }
    });

    // Simular carga al cambiar de página
    function simulateLoading(callback: () => void) {
        isLoading = true;
        setTimeout(() => {
            callback();
            isLoading = false;
        }, 300); // Simular carga de 300ms
    }

    // Functions with type annotations
    function applyGlobalFilter(
        data: Record<string, any>[],
        filter: string,
    ): Record<string, any>[] {
        if (!filter) return data;

        const searchTerm = filter.toLowerCase();
        return data.filter((row) => {
            return Object.keys(row).some((key) => {
                const value = row[key];
                if (value === null || value === undefined) return false;
                return String(value).toLowerCase().includes(searchTerm);
            });
        });
    }

    function applyFilters(
        data: Record<string, any>[],
        filters: Record<string, string>,
    ): Record<string, any>[] {
        return data.filter((row) => {
            for (const [field, filterValue] of Object.entries(filters)) {
                if (!filterValue) continue;

                // Special filter values
                if (filterValue === "(Vacios)") {
                    const value = row[field];
                    if (value !== null && value !== undefined && value !== "")
                        return false;
                    continue;
                }

                if (filterValue === "(No vacios)") {
                    const value = row[field];
                    if (value === null || value === undefined || value === "")
                        return false;
                    continue;
                }

                if (filterValue === "(Todos)") {
                    continue;
                }

                const cellValue = String(row[field] || "").toLowerCase();
                const fValue = filterValue.toLowerCase();
                // Obtener modo de filtro para este campo, por defecto "Contiene"
                const mode = filterModes[field] || "Contiene";

                switch (mode) {
                    case "Comienza con":
                        if (!cellValue.startsWith(fValue)) return false;
                        break;
                    case "Contiene":
                        if (!cellValue.includes(fValue)) return false;
                        break;
                    case "No contiene":
                        if (cellValue.includes(fValue)) return false;
                        break;
                    case "Acaba con":
                        if (!cellValue.endsWith(fValue)) return false;
                        break;
                    case "Igual":
                        if (cellValue !== fValue) return false;
                        break;
                    case "No igual":
                        if (cellValue === fValue) return false;
                        break;
                }
            }
            return true;
        });
    }

    function applySort(
        data: Record<string, any>[],
        field: string | null,
        direction: "asc" | "desc",
    ): Record<string, any>[] {
        if (!field) return [...data];

        return [...data].sort((a, b) => {
            const aValue = a[field];
            const bValue = b[field];

            if (aValue === bValue) return 0;

            const comparison = aValue > bValue ? 1 : -1;
            return direction === "asc" ? comparison : -comparison;
        });
    }

    function applyGrouping(
        data: Record<string, any>[],
        groupFields: string[],
    ): Record<string, any>[] {
        if (groupFields.length === 0) return data;

        // Sort data by grouping fields
        const sorted = [...data].sort((a, b) => {
            for (const field of groupFields) {
                const aVal = a[field] || "";
                const bVal = b[field] || "";
                if (aVal < bVal) return -1;
                if (aVal > bVal) return 1;
            }
            // Apply existing sorting
            if (sortField) {
                const aVal = a[sortField];
                const bVal = b[sortField];
                return sortDirection === "asc"
                    ? aVal > bVal
                        ? 1
                        : -1
                    : bVal > aVal
                      ? 1
                      : -1;
            }
            return 0;
        });

        // Create grouped structure
        let currentGroup: string | null = null;
        const result: any[] = [];

        sorted.forEach((row) => {
            const groupKey = groupFields.map((f) => row[f]).join("|");
            if (groupKey !== currentGroup) {
                currentGroup = groupKey;
                result.push({
                    __isGroup: true,
                    __groupKey: groupKey,
                    __groupValues: groupFields.reduce(
                        (acc, field) => {
                            acc[field] = row[field];
                            return acc;
                        },
                        {} as Record<string, any>,
                    ),
                });
            }
            result.push(row);
        });

        return result;
    }

    function applyPagination(
        data: Record<string, any>[],
        page: number,
        size: number,
    ): Record<string, any>[] {
        const start = (page - 1) * size;
        const end = start + size;
        return data.slice(start, end);
    }

    function handleSort(field: string): void {
        if (sortField === field) {
            sortDirection = sortDirection === "asc" ? "desc" : "asc";
        } else {
            sortField = field;
            sortDirection = "asc";
        }

        // Feedback visual
        // showToast(
        //     `Ordenando por ${field} en orden ${sortDirection === "asc" ? "ascendente" : "descendente"}`,
        // );
    }

    function handleFilter(field: string, value: string): void {
        filters = { ...filters, [field]: value };

        // Feedback visual
        if (value && value !== "(Todos)") {
            showToast(
                `Filtro aplicado: ${field} ${getCurrentFilterMode(field).toLowerCase()} "${value}"`,
            );
        } else if (value === "(Todos)") {
            showToast(`Filtro eliminado para ${field}`);
        }
    }

    function handlePageChange(page: number): void {
        if (page < 1 || page > totalPages) return;

        simulateLoading(() => {
            currentPage = page;
        });
    }

    function handlePageSizeChange(size: number): void {
        simulateLoading(() => {
            pageSize = size;
            currentPage = 1; // Reset to first page
            showPageSizeSelector = false;
        });

        showToast(`Mostrando ${size} registros por página`);
    }

    // function handleJumpToPage(): void {
    //     const page = parseInt(jumpToPageValue);
    //     if (isNaN(page) || page < 1 || page > totalPages) {
    //         showToast("Número de página inválido", "error");
    //         return;
    //     }

    //     handlePageChange(page);
    //     showJumpToPage = false;
    //     jumpToPageValue = "";
    // }

    function toggleSelectAll(): void {
        isSelectAll = !isSelectAll;
        if (isSelectAll) {
            selectedRows = paginatedData.map(
                (row) => row.id || JSON.stringify(row),
            );
            showToast(`${selectedRows.length} filas seleccionadas`);
        } else {
            selectedRows = [];
            showToast("Selección eliminada");
        }
    }

    function toggleSelectRow(rowId: string | number): void {
        const index = selectedRows.indexOf(rowId);
        if (index === -1) {
            selectedRows = [...selectedRows, rowId];
        } else {
            selectedRows = selectedRows.filter((id) => id !== rowId);
        }
    }

    // Funciones para el toggle de filtro
    function toggleFilterDropdown(field: string): void {
        filterDropdownVisible = {
            ...filterDropdownVisible,
            [field]: !filterDropdownVisible[field],
        };
    }

    function selectFilterMode(field: string, option: string): void {
        filterModes = { ...filterModes, [field]: option };
        // Ocultar dropdown después de seleccionar
        filterDropdownVisible = {
            ...filterDropdownVisible,
            [field]: false,
        };

        showToast(`Modo de filtro cambiado a: ${option}`);
    }

    // Add or update the exportData function
    async function exportData(
        format: "pdf" | "xls" | "xlsx" | "docx" | "rtf" | "csv",
    ) {
        if (!selectedRows.length) {
            showToast(
                "Por favor seleccione al menos una fila para exportar",
                "info",
            );
            return;
        }

        try {
            switch (format) {
                case "pdf":
                    await exportToPdf(data, columns, selectedRows);
                    showToast(
                        `${selectedRows.length} filas exportadas a PDF correctamente`,
                        "success",
                    );
                    break;
                case "xls":
                case "xlsx":
                case "csv":
                    await exportToExcel(data, columns, format, selectedRows);
                    showToast(
                        `${selectedRows.length} filas exportadas a ${format.toUpperCase()} correctamente`,
                        "success",
                    );
                    break;
                case "docx":
                    await exportToDocx(data, columns, selectedRows);
                    showToast(
                        `${selectedRows.length} filas exportadas a DOCX correctamente`,
                        "success",
                    );
                    break;
                case "rtf":
                    await exportToRtf(data, columns, selectedRows);
                    showToast(
                        `${selectedRows.length} filas exportadas a RTF correctamente`,
                        "success",
                    );
                    break;
            }
        } catch (error) {
            console.error("Export error:", error);
            showToast("Error al exportar los datos", "error");
        }
    }

    // Column filter functions
    function toggleColumnFilter(field: string): void {
        columnFilterVisible = {
            ...columnFilterVisible,
            [field]: !columnFilterVisible[field],
        };

        // Reset search when opening
        if (!columnFilterVisible[field]) {
            columnFilterSearch = {
                ...columnFilterSearch,
                [field]: "",
            };
        }
    }

    function updateColumnFilterSearch(field: string, value: string): void {
        columnFilterSearch = {
            ...columnFilterSearch,
            [field]: value,
        };
    }

    function selectColumnFilterValue(field: string, value: string): void {
        handleFilter(field, value);
        columnFilterVisible = {
            ...columnFilterVisible,
            [field]: false,
        };
    }

    function getFilteredColumnValues(field: string): string[] {
        const allValues = Array.from(columnFilterValues[field] || []);
        const searchTerm = (columnFilterSearch[field] || "").toLowerCase();

        if (!searchTerm) return allValues;

        return allValues.filter((value) =>
            value.toLowerCase().includes(searchTerm),
        );
    }

    // Reset pagination when filters or global filter change
    $effect(() => {
        if (filters || globalFilter) {
            currentPage = 1;
        }
    });

    // Check if all rows on current page are selected
    $effect(() => {
        const currentPageIds = paginatedData.map(
            (row) => row.id || JSON.stringify(row),
        );
        isSelectAll =
            currentPageIds.length > 0 &&
            currentPageIds.every((id) => selectedRows.includes(id));
    });

    // Modificar la definición de visibleColumns para que filtre correctamente tanto columnas como datos
    let visibleColumns = $derived(
        columns.filter((col) => !groupByFields.includes(col.field as string)),
    );

    function handleDragStart(event: DragEvent, field: string) {
        event.dataTransfer?.setData("text/plain", field);
        isDragging = true;
        currentDragField = field;

        // Create a ghost image for dragging
        const ghostElement = document.createElement("div");
        ghostElement.classList.add("drag-ghost");
        ghostElement.textContent =
            columns.find((c) => c.field === field)?.header || field;
        document.body.appendChild(ghostElement);
        event.dataTransfer?.setDragImage(ghostElement, 0, 0);

        // Remove the ghost element after a short delay
        setTimeout(() => {
            document.body.removeChild(ghostElement);
        }, 0);

        // showToast("Arrastra la columna a la zona de agrupación", "info");
    }

    function handleDragEnd() {
        isDragging = false;
        currentDragField = null;
    }

    function handleDragOver(event: DragEvent) {
        event.preventDefault();
        groupPanelHovered = true;
    }

    function handleDragLeave() {
        groupPanelHovered = false;
    }

    // Modificar la función handleDrop para asegurar que la tabla mantenga su ancho
    function handleDrop(event: DragEvent) {
        event.preventDefault();
        const field = event.dataTransfer?.getData("text/plain");
        if (field && !groupByFields.includes(field)) {
            // Store column information before removing it
            const columnInfo = columns.find((c) => c.field === field);

            // Add to groupByFields
            groupByFields = [...groupByFields, field];

            // Ensure the table maintains its width by adding a class
            const tableElement = document.querySelector(".data-grid-table");
            if (tableElement) {
                tableElement.classList.add("table-fixed");
            }

            showToast(
                `Columna "${columnInfo?.header || field}" agrupada correctamente`,
                "success",
            );
        }
        groupPanelHovered = false;
        isDragging = false;
        currentDragField = null;
    }

    function toggleMobileFilters() {
        showMobileFilters = !showMobileFilters;
    }

    function clearAllFilters() {
        if (Object.keys(filters).length === 0) return;

        // Confirmar antes de limpiar
        if (
            confirm("¿Estás seguro de que deseas eliminar todos los filtros?")
        ) {
            filters = {};
            showToast("Todos los filtros han sido eliminados", "info");
        }
    }

    function saveCurrentFilters() {
        if (newFilterProfileName.trim() === "") {
            showToast("Debes ingresar un nombre para el perfil", "error");
            return;
        }

        savedFilterProfiles = [
            ...savedFilterProfiles,
            { name: newFilterProfileName, filters: { ...filters } },
        ];

        currentFilterProfile = savedFilterProfiles.length - 1;
        showSaveFilterDialog = false;
        newFilterProfileName = "";

        showToast(
            `Perfil de filtros "${savedFilterProfiles[currentFilterProfile].name}" guardado`,
            "success",
        );
    }

    function loadFilterProfile(index: number) {
        filters = { ...savedFilterProfiles[index].filters };
        currentFilterProfile = index;

        showToast(
            `Perfil de filtros "${savedFilterProfiles[currentFilterProfile].name}" cargado`,
            "info",
        );
    }

    function deleteFilterProfile(index: number) {
        if (savedFilterProfiles.length <= 1) {
            showToast("No puedes eliminar el único perfil", "error");
            return;
        }

        if (
            confirm(
                `¿Estás seguro de que deseas eliminar el perfil "${savedFilterProfiles[index].name}"?`,
            )
        ) {
            const deletedName = savedFilterProfiles[index].name;
            savedFilterProfiles = savedFilterProfiles.filter(
                (_, i) => i !== index,
            );

            if (currentFilterProfile === index) {
                currentFilterProfile = 0;
                filters = { ...savedFilterProfiles[0].filters };
            } else if (currentFilterProfile > index) {
                currentFilterProfile--;
            }

            showToast(`Perfil "${deletedName}" eliminado`, "info");
        }
    }

    // Sistema de tooltips
    function showTooltipFor(key: string, content: string, event: MouseEvent) {
        tooltipContent = content;
        tooltipPosition = { x: event.clientX, y: event.clientY };
        showTooltip = { ...showTooltip, [key]: true };

        // Auto-hide after 2 seconds
        setTimeout(() => {
            showTooltip = { ...showTooltip, [key]: false };
        }, 2000);
    }

    // Sistema de notificaciones toast
    let toasts = $state<{ id: number; message: string; type: string }[]>([]);
    let toastIdCounter = $state(0);

    function showToast(
        message: string,
        type: "info" | "success" | "error" = "info",
    ) {
        const id = toastIdCounter++;
        toasts = [...toasts, { id, message, type }];

        // Auto-remove after 3 seconds
        setTimeout(() => {
            toasts = toasts.filter((t) => t.id !== id);
        }, 3000);
    }

    // Aplicar filtro rápido
    function applyQuickFilter(field: string, value: string) {
        handleFilter(field, value);
    }

    // Add this function to handle row clicks
    function handleRowClick(row: Record<string, any>, event: MouseEvent) {
        // If the click was on a checkbox or button, don't trigger the row click
        if (
            event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLButtonElement ||
            (event.target as HTMLElement).closest("button") ||
            (event.target as HTMLElement).closest('input[type="checkbox"]')
        ) {
            return;
        }

        // Update the selected row
        selectedRowId = row.id;

        // Call the onRowClick callback if provided
        if (onRowClick) {
            onRowClick(row, event);
        }
    }
</script>

<div
    class="w-full bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200 transition-all duration-300 ease-in-out relative"
    class:dark={darkMode}
>
    {#if isLoading}
        <div
            class="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-30"
        >
            <div
                class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"
            ></div>
        </div>
    {/if}

    <!-- Toast notifications -->
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {#each toasts as toast}
            <div class="toast toast-{toast.type} animate-slideInRight">
                <div class="toast-icon">
                    {#if toast.type === "success"}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    {:else if toast.type === "error"}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                    {:else}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                    {/if}
                </div>
                <div class="toast-content">{toast.message}</div>
            </div>
        {/each}
    </div>

    <!-- Tooltip -->
    {#if Object.values(showTooltip).some((v) => v)}
        <div
            class="tooltip"
            style="left: {tooltipPosition.x + 10}px; top: {tooltipPosition.y +
                10}px"
        >
            {tooltipContent}
        </div>
    {/if}

    <!-- DevExpress style toolbar - Export buttons -->
    <div
        class="flex flex-col md:flex-row md:items-center md:justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 transition-all duration-300"
    >
        <div class="flex items-center space-x-2 mb-3 md:mb-0">
            {#if title}
                <div class="text-lg font-semibold text-gray-800">
                    {@render title()}
                </div>
            {/if}

            <!-- Contador de registros -->
            <div
                class="text-sm text-gray-500 ml-2 bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm"
            >
                <span class="font-medium">{filteredData.length}</span> registros
            </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
            <!-- Filtros guardados -->
            <div class="relative">
                <button
                    class="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm cursor-pointer"
                    onclick={() => (showFilterSummary = !showFilterSummary)}
                    onmouseenter={(e) =>
                        showTooltipFor(
                            "filterProfiles",
                            "Perfiles de filtros guardados",
                            e,
                        )}
                >
                    Perfiles
                    {#if activeFiltersCount > 0}
                        <span
                            class="ml-1.5 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                            >{activeFiltersCount}</span
                        >
                    {/if}
                </button>

                {#if showFilterSummary}
                    <div
                        class="absolute right-0 mt-1 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-10 animate-fadeIn"
                    >
                        <div
                            class="p-2 border-b border-gray-200 flex justify-between items-center"
                        >
                            <h3 class="text-sm font-medium text-gray-700">
                                Perfiles de filtros
                            </h3>
                            <button
                                class="text-gray-400 hover:text-gray-600"
                                onclick={() => (showSaveFilterDialog = true)}
                                onmouseenter={(e) =>
                                    showTooltipFor(
                                        "saveFilter",
                                        "Guardar filtros actuales",
                                        e,
                                    )}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="h-4 w-4"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <path
                                        d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
                                    ></path>
                                    <polyline points="17 21 17 13 7 13 7 21"
                                    ></polyline>
                                    <polyline points="7 3 7 8 15 8"></polyline>
                                </svg>
                            </button>
                        </div>

                        <div class="max-h-60 overflow-y-auto py-1">
                            {#each savedFilterProfiles as profile, index}
                                <div
                                    class="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center justify-between transition-colors duration-150"
                                >
                                    <div
                                        class="flex-1 text-sm text-gray-700"
                                        onclick={() => loadFilterProfile(index)}
                                    >
                                        <span
                                            class={currentFilterProfile ===
                                            index
                                                ? "font-medium text-blue-600"
                                                : ""}
                                        >
                                            {profile.name}
                                        </span>
                                    </div>
                                    <button
                                        class="text-gray-400 hover:text-red-500 transition-colors duration-150"
                                        onclick={() =>
                                            deleteFilterProfile(index)}
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            class="h-4 w-4"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        >
                                            <polyline points="3 6 5 6 21 6"
                                            ></polyline>
                                            <path
                                                d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                                            ></path>
                                        </svg>
                                    </button>
                                </div>
                            {/each}
                        </div>

                        <div class="p-2 border-t border-gray-200">
                            <button
                                class="w-full px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-gray-700 transition-colors duration-150 flex items-center justify-center"
                                onclick={clearAllFilters}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="h-4 w-4 mr-1.5"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line
                                        x1="4.93"
                                        y1="4.93"
                                        x2="19.07"
                                        y2="19.07"
                                    ></line>
                                </svg>
                                Limpiar todos los filtros
                            </button>
                        </div>
                    </div>
                {/if}

                {#if showSaveFilterDialog}
                    <div
                        class="fixed inset-0 z-50"
                        onclick={() => (showSaveFilterDialog = false)}
                    >
                        <div
                            class="bg-white rounded-lg shadow-xl p-4 w-80 animate-scaleIn absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                        >
                            <h3 class="text-lg font-medium text-gray-900 mb-3">
                                Guardar perfil de filtros
                            </h3>
                            <div class="mb-4">
                                <label
                                    class="block text-sm font-medium text-gray-700 mb-1"
                                    >Nombre del perfil</label
                                >
                                <input
                                    type="text"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Mi perfil de filtros"
                                    bind:value={newFilterProfileName}
                                />
                            </div>
                            <div class="flex justify-end space-x-2">
                                <button
                                    class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md text-sm font-medium transition-colors duration-150"
                                    onclick={() =>
                                        (showSaveFilterDialog = false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors duration-150"
                                    onclick={saveCurrentFilters}
                                >
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>

            {#if isMobile}
                <div class="dropdown-container relative">
                    <button
                        class="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm"
                        onmouseenter={(e) =>
                            showTooltipFor("export", "Exportar datos", e)}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4 mr-1"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                            ></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Exportar
                    </button>
                    <div
                        class="dropdown-menu absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-10 hidden group-hover:block"
                    >
                        {#each exportOptions as option}
                            {#if option.enabled}
                                <button
                                    class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center transition-colors duration-150"
                                    onclick={() => exportData(option.format)}
                                >
                                    <span class="mr-2">
                                        {#if option.format === "pdf"}
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                class="h-4 w-4 text-red-500"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                stroke-width="2"
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                            >
                                                <path
                                                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                                                ></path>
                                                <polyline
                                                    points="14 2 14 8 20 8"
                                                ></polyline>
                                                <line
                                                    x1="16"
                                                    y1="13"
                                                    x2="8"
                                                    y2="13"
                                                ></line>
                                                <line
                                                    x1="16"
                                                    y1="17"
                                                    x2="8"
                                                    y2="17"
                                                ></line>
                                                <polyline points="10 9 9 9 8 9"
                                                ></polyline>
                                            </svg>
                                        {:else if option.format === "xls" || option.format === "xlsx"}
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                class="h-4 w-4 text-green-500"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                stroke-width="2"
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                            >
                                                <path
                                                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                                                ></path>
                                                <polyline
                                                    points="14 2 14 8 20 8"
                                                ></polyline>
                                                <line
                                                    x1="16"
                                                    y1="13"
                                                    x2="8"
                                                    y2="13"
                                                ></line>
                                                <line
                                                    x1="16"
                                                    y1="17"
                                                    x2="8"
                                                    y2="17"
                                                ></line>
                                                <polyline points="10 9 9 9 8 9"
                                                ></polyline>
                                            </svg>
                                        {:else if option.format === "docx" || option.format === "rtf"}
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                class="h-4 w-4 text-blue-500"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                stroke-width="2"
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                            >
                                                <path
                                                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                                                ></path>
                                                <polyline
                                                    points="14 2 14 8 20 8"
                                                ></polyline>
                                                <line
                                                    x1="16"
                                                    y1="13"
                                                    x2="8"
                                                    y2="13"
                                                ></line>
                                                <line
                                                    x1="16"
                                                    y1="17"
                                                    x2="8"
                                                    y2="17"
                                                ></line>
                                                <polyline points="10 9 9 9 8 9"
                                                ></polyline>
                                            </svg>
                                        {:else if option.format === "csv"}
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                class="h-4 w-4 text-gray-500"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                stroke-width="2"
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                            >
                                                <polyline
                                                    points="8 17 12 21 16 17"
                                                ></polyline>
                                                <line
                                                    x1="12"
                                                    y1="12"
                                                    x2="12"
                                                    y2="21"
                                                ></line>
                                                <path
                                                    d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"
                                                ></path>
                                            </svg>
                                        {/if}
                                    </span>
                                    {option.format.toUpperCase()}
                                </button>
                            {/if}
                        {/each}
                    </div>
                </div>
            {:else}
                {#each exportOptions as option}
                    {#if option.enabled}
                        <button
                            class="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm hover:shadow-md transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm cursor-pointer"
                            onclick={() => exportData(option.format)}
                            onmouseenter={(e) =>
                                showTooltipFor(
                                    `export-${option.format}`,
                                    `Exportar a ${option.format.toUpperCase()}`,
                                    e,
                                )}
                        >
                            <span class="mr-1.5">
                                {#if option.format === "pdf"}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-4 w-4 text-red-500"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    >
                                        <path
                                            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                                        ></path>
                                        <polyline points="14 2 14 8 20 8"
                                        ></polyline>
                                        <line x1="16" y1="13" x2="8" y2="13"
                                        ></line>
                                        <line x1="16" y1="17" x2="8" y2="17"
                                        ></line>
                                        <polyline points="10 9 9 9 8 9"
                                        ></polyline>
                                    </svg>
                                {:else if option.format === "xls" || option.format === "xlsx"}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-4 w-4 text-green-500"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    >
                                        <path
                                            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                                        ></path>
                                        <polyline points="14 2 14 8 20 8"
                                        ></polyline>
                                        <line x1="16" y1="13" x2="8" y2="13"
                                        ></line>
                                        <line x1="16" y1="17" x2="8" y2="17"
                                        ></line>
                                        <polyline points="10 9 9 9 8 9"
                                        ></polyline>
                                    </svg>
                                {:else if option.format === "docx" || option.format === "rtf"}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-4 w-4 text-blue-500"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    >
                                        <path
                                            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                                        ></path>
                                        <polyline points="14 2 14 8 20 8"
                                        ></polyline>
                                        <line x1="16" y1="13" x2="8" y2="13"
                                        ></line>
                                        <line x1="16" y1="17" x2="8" y2="17"
                                        ></line>
                                        <polyline points="10 9 9 9 8 9"
                                        ></polyline>
                                    </svg>
                                {:else if option.format === "csv"}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-4 w-4 text-gray-500"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    >
                                        <polyline points="8 17 12 21 16 17"
                                        ></polyline>
                                        <line x1="12" y1="12" x2="12" y2="21"
                                        ></line>
                                        <path
                                            d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"
                                        ></path>
                                    </svg>
                                {/if}
                            </span>
                            {option.format.toUpperCase()}
                        </button>
                    {/if}
                {/each}
            {/if}

            {#if toolbar}
                <div class="ml-2">
                    {@render toolbar()}
                </div>
            {/if}

            {#if isMobile}
                <button
                    class="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm"
                    onclick={toggleMobileFilters}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4 mr-1"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <polygon
                            points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
                        ></polygon>
                    </svg>
                    Filtros
                    {#if activeFiltersCount > 0}
                        <span
                            class="ml-1.5 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                            >{activeFiltersCount}</span
                        >
                    {/if}
                </button>
            {/if}
        </div>
    </div>

    <!-- Search box -->
    <div class="p-4 bg-white border-b border-gray-200">
        <div class="relative">
            <div
                class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 text-gray-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
            </div>
            <input
                id="global-search"
                type="text"
                placeholder="Introduzca el texto a buscar... (Ctrl+F)"
                value={globalFilter}
                oninput={(e) =>
                    (globalFilter = (e.target as HTMLInputElement).value)}
                class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out shadow-sm"
            />
            {#if globalFilter}
                <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                        class="text-gray-400 hover:text-gray-600 focus:outline-none"
                        onclick={() => (globalFilter = "")}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                    </button>
                </div>
            {/if}
        </div>

        <!-- Keyboard shortcuts help -->
        <div class="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
            <span class="flex items-center">
                <kbd
                    class="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-800 font-mono"
                    >Alt + ←</kbd
                >
                <span class="ml-1">Página anterior</span>
            </span>
            <span class="flex items-center">
                <kbd
                    class="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-800 font-mono"
                    >Alt + →</kbd
                >
                <span class="ml-1">Página siguiente</span>
            </span>
            <span class="flex items-center">
                <kbd
                    class="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-800 font-mono"
                    >Alt + Home</kbd
                >
                <span class="ml-1">Primera página</span>
            </span>
            <span class="flex items-center">
                <kbd
                    class="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-800 font-mono"
                    >Alt + End</kbd
                >
                <span class="ml-1">Última página</span>
            </span>
            <span class="flex items-center">
                <kbd
                    class="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-800 font-mono"
                    >Ctrl + F</kbd
                >
                <span class="ml-1">Buscar</span>
            </span>
        </div>
    </div>

    <!-- Mobile filters panel -->
    {#if isMobile && showMobileFilters}
        <div class="p-4 bg-gray-50 border-b border-gray-200 animate-slideDown">
            <div class="flex justify-between items-center mb-3">
                <h3 class="text-sm font-medium text-gray-700">Filtros</h3>
                <button
                    class="text-gray-400 hover:text-gray-600 focus:outline-none"
                    onclick={clearAllFilters}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                    </svg>
                </button>
            </div>
            <div class="space-y-3">
                {#each columns as column}
                    {#if column.filterable !== false && column.field}
                        <div>
                            <label
                                class="block text-xs font-medium text-gray-700 mb-1"
                                >{column.header || column.field}</label
                            >
                            <div class="flex items-center space-x-2">
                                <div class="flex-grow relative">
                                    <input
                                        type="text"
                                        placeholder="{getCurrentFilterMode(
                                            column.field as string,
                                        )}..."
                                        value={filters[
                                            column.field as string
                                        ] || ""}
                                        oninput={(e) =>
                                            handleFilter(
                                                column.field as string,
                                                (e.target as HTMLInputElement)
                                                    .value,
                                            )}
                                        class="block w-full pl-2 pr-2 py-1.5 text-xs border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                                    />
                                </div>
                                <button
                                    class="p-1.5 rounded-md border border-gray-300 bg-gray-50 hover:bg-gray-100 focus:outline-none transition-colors duration-150 flex items-center justify-center"
                                    onclick={() =>
                                        toggleFilterDropdown(
                                            column.field as string,
                                        )}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-4 w-4 text-gray-500"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    >
                                        <polygon
                                            points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
                                        ></polygon>
                                    </svg>
                                </button>
                            </div>

                            <!-- Quick filters -->
                            {#if column.quickFilters && column.quickFilters.length > 0}
                                <div class="mt-1 flex flex-wrap gap-1">
                                    {#each column.quickFilters as quickFilter}
                                        <button
                                            class="px-2 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 text-gray-700 transition-colors duration-150"
                                            class:bg-blue-100={filters[
                                                column.field as string
                                            ] === quickFilter}
                                            class:border-blue-300={filters[
                                                column.field as string
                                            ] === quickFilter}
                                            class:text-blue-700={filters[
                                                column.field as string
                                            ] === quickFilter}
                                            onclick={() =>
                                                applyQuickFilter(
                                                    column.field as string,
                                                    quickFilter,
                                                )}
                                        >
                                            {quickFilter}
                                        </button>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/if}
                {/each}
            </div>
        </div>
    {/if}

    <!-- Group panel -->
    {#if allowGrouping}
        <div
            class="p-3 bg-gray-50 border-b border-gray-200 min-h-[50px] flex items-center flex-wrap gap-2 transition-all duration-300 ease-in-out"
            class:bg-blue-50={groupPanelHovered}
            class:shadow-inner={groupPanelHovered}
            ondragover={handleDragOver}
            ondragleave={handleDragLeave}
            ondrop={handleDrop}
        >
            {#each groupByFields as field}
                <div
                    class="flex items-center bg-white px-3 py-1.5 rounded-md border border-gray-300 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:shadow-md"
                >
                    {columns.find((c) => c.field === field)?.header || field}
                    <button
                        class="ml-2 text-gray-400 hover:text-gray-600 focus:outline-none"
                        onclick={() =>
                            (groupByFields = groupByFields.filter(
                                (f) => f !== field,
                            ))}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            {:else}
                <span class="text-sm text-gray-500 italic flex items-center">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4 mr-1 text-gray-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"
                        ></rect>
                        <line x1="3" y1="9" x2="21" y2="9"></line>
                        <line x1="9" y1="21" x2="9" y2="9"></line>
                    </svg>
                    Arrastre una columna aquí para agrupar por dicha columna
                </span>
            {/each}
        </div>
    {/if}

    <!-- Main grid -->
    <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 table-fixed">
            <thead
                class="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0 z-10"
            >
                <tr>
                    {#if columns.length > 0 && columns[0].selectable}
                        <th
                            class="w-12 px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                            <div class="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={isSelectAll}
                                    onchange={toggleSelectAll}
                                    class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                            </div>
                        </th>
                    {/if}

                    {#each visibleColumns as column, index}
                        {#if !(index === 0 && column.selectable)}
                            <th
                                draggable="true"
                                ondragstart={(e) =>
                                    handleDragStart(e, column.field as string)}
                                ondragend={handleDragEnd}
                                class="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative cursor-move"
                                class:bg-blue-50={currentDragField ===
                                    column.field}
                                style={column.width
                                    ? `width: ${column.width}`
                                    : ""}
                                data-field={column.field}
                            >
                                <div class="flex items-center justify-between">
                                    <span>{column.header || column.field}</span>

                                    <div class="flex items-center space-x-1">
                                        {#if showSort && column.sortable !== false}
                                            <button
                                                class="p-1 rounded hover:bg-gray-200 focus:outline-none transition-colors duration-150"
                                                onclick={() =>
                                                    handleSort(
                                                        column.field as string,
                                                    )}
                                                onmouseenter={(e) =>
                                                    showTooltipFor(
                                                        `sort-${String(column.field)}`,
                                                        `Ordenar por ${String(column.header || column.field)}`,
                                                        e,
                                                    )}
                                            >
                                                {#if sortField === column.field}
                                                    {#if sortDirection === "asc"}
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            class="h-4 w-4 text-blue-600"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            stroke-width="2"
                                                            stroke-linecap="round"
                                                            stroke-linejoin="round"
                                                        >
                                                            <polyline
                                                                points="18 15 12 9 6 15"
                                                            ></polyline>
                                                        </svg>
                                                    {:else}
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            class="h-4 w-4 text-blue-600"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            stroke-width="2"
                                                            stroke-linecap="round"
                                                            stroke-linejoin="round"
                                                        >
                                                            <polyline
                                                                points="6 9 12 15 18 9"
                                                            ></polyline>
                                                        </svg>
                                                    {/if}
                                                {:else}
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        class="h-4 w-4 text-gray-400"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        stroke-width="2"
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                    >
                                                        <line
                                                            x1="12"
                                                            y1="5"
                                                            x2="12"
                                                            y2="19"
                                                        ></line>
                                                        <polyline
                                                            points="19 12 12 19 5 12"
                                                        ></polyline>
                                                    </svg>
                                                {/if}
                                            </button>
                                        {/if}

                                        {#if column.field && !isMobile}
                                            <button
                                                class="p-1 rounded hover:bg-gray-200 focus:outline-none transition-colors duration-150"
                                                onclick={() =>
                                                    toggleColumnFilter(
                                                        column.field as string,
                                                    )}
                                                onmouseenter={(e) =>
                                                    showTooltipFor(
                                                        `filter-${String(column.field)}`,
                                                        `Filtrar ${String(column.header || column.field)}`,
                                                        e,
                                                    )}
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    class="h-4 w-4 text-gray-400"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    stroke-width="2"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                >
                                                    <polygon
                                                        points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
                                                    ></polygon>
                                                </svg>
                                            </button>
                                        {/if}
                                    </div>
                                </div>
                            </th>
                        {/if}
                    {/each}

                    <!-- Columna de relleno para mantener el ancho completo -->
                    {#if visibleColumns.length < columns.length}
                        <th class="w-full"></th>
                    {/if}
                </tr>
            </thead>

            <!-- Fila de filtros separada del encabezado -->
            {#if showFilter && !isMobile}
                <thead class="bg-white border-b border-gray-200">
                    <tr class="filter-row">
                        {#if columns.length > 0 && columns[0].selectable}
                            <th class="w-12 px-3 py-2"></th>
                        {/if}

                        {#each visibleColumns as column, index}
                            {#if !(index === 0 && column.selectable)}
                                <th class="px-3 py-2 relative">
                                    {#if column.filterable !== false && column.field}
                                        <div
                                            class="filter-container flex items-center space-x-2"
                                        >
                                            <!-- Input de filtro -->
                                            <div class="flex-grow relative">
                                                <input
                                                    type="text"
                                                    placeholder="{getCurrentFilterMode(
                                                        column.field as string,
                                                    )}..."
                                                    value={filters[
                                                        column.field as string
                                                    ] || ""}
                                                    oninput={(e) =>
                                                        handleFilter(
                                                            column.field as string,
                                                            (
                                                                e.target as HTMLInputElement
                                                            ).value,
                                                        )}
                                                    class="block w-full pl-2 pr-2 py-1.5 text-xs border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                                                />
                                                {#if filters[column.field as string]?.length > 0}
                                                    <div
                                                        class="absolute top-0 right-0 h-2 w-2 bg-blue-500 rounded-full transform translate-x-1 -translate-y-1"
                                                    ></div>
                                                {/if}
                                            </div>

                                            <!-- Botón de opciones de filtro independiente -->
                                            <div class="relative">
                                                <button
                                                    class="p-1.5 rounded-md border border-gray-300 bg-gray-50 hover:bg-gray-100 focus:outline-none transition-colors duration-150 flex items-center justify-center"
                                                    onclick={() =>
                                                        toggleFilterDropdown(
                                                            column.field as string,
                                                        )}
                                                    onmouseenter={(e) =>
                                                        showTooltipFor(
                                                            `filter-options-${String(column.field)}`,
                                                            `Opciones de filtro para ${String(column.header || column.field)}`,
                                                            e,
                                                        )}
                                                >
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        class="h-4 w-4 text-gray-500"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        stroke-width="2"
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                    >
                                                        <polygon
                                                            points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
                                                        ></polygon>
                                                    </svg>
                                                </button>

                                                {#if filterDropdownVisible[column.field as string]}
                                                    <div
                                                        class="fixed inset-0 z-10"
                                                        onclick={() =>
                                                            (filterDropdownVisible[
                                                                column.field as string
                                                            ] = false)}
                                                    ></div>
                                                    <div
                                                        class="absolute z-20 mt-1 w-48 left-0 bg-white rounded-md shadow-lg border border-gray-200 animate-fadeIn"
                                                        style="top: 100%; transform: translateY(0);"
                                                    >
                                                        <div
                                                            class="py-1 text-sm font-medium text-gray-700 border-b border-gray-200 px-3"
                                                        >
                                                            Modo de filtro
                                                        </div>
                                                        {#each filterOptions as option}
                                                            <div
                                                                class="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer flex items-center justify-between transition-colors duration-150"
                                                                onclick={() =>
                                                                    selectFilterMode(
                                                                        column.field as string,
                                                                        option.value,
                                                                    )}
                                                                onmouseenter={(
                                                                    e,
                                                                ) =>
                                                                    showTooltipFor(
                                                                        `filter-mode-${option.value}`,
                                                                        option.tooltip,
                                                                        e,
                                                                    )}
                                                            >
                                                                <span
                                                                    class="flex items-center"
                                                                >
                                                                    <span
                                                                        class="mr-2 text-gray-500"
                                                                        >{option.icon}</span
                                                                    >
                                                                    {option.value}
                                                                </span>
                                                                {#if (filterModes[column.field as string] || "Contiene") === option.value}
                                                                    <svg
                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                        class="h-4 w-4 text-blue-600"
                                                                        viewBox="0 0 24 24"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        stroke-width="2"
                                                                        stroke-linecap="round"
                                                                        stroke-linejoin="round"
                                                                    >
                                                                        <polyline
                                                                            points="20 6 9 17 4 12"

                                                                        ></polyline>
                                                                    </svg>
                                                                {/if}
                                                            </div>
                                                        {/each}
                                                    </div>
                                                {/if}
                                            </div>
                                        </div>

                                        <!-- Quick filters -->
                                        {#if column.quickFilters && column.quickFilters.length > 0}
                                            <div
                                                class="mt-1 flex flex-wrap gap-1"
                                            >
                                                {#each column.quickFilters as quickFilter}
                                                    <button
                                                        class="px-2 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 text-gray-700 transition-colors duration-150"
                                                        class:bg-blue-100={filters[
                                                            column.field as string
                                                        ] === quickFilter}
                                                        class:border-blue-300={filters[
                                                            column.field as string
                                                        ] === quickFilter}
                                                        class:text-blue-700={filters[
                                                            column.field as string
                                                        ] === quickFilter}
                                                        onclick={() =>
                                                            applyQuickFilter(
                                                                column.field as string,
                                                                quickFilter,
                                                            )}
                                                    >
                                                        {quickFilter}
                                                    </button>
                                                {/each}
                                            </div>
                                        {/if}

                                        {#if column.field && columnFilterVisible[column.field as string]}
                                            <div
                                                class="fixed inset-0 z-10"
                                                onclick={() =>
                                                    (columnFilterVisible[
                                                        column.field as string
                                                    ] = false)}
                                            ></div>
                                            <div
                                                class="absolute z-20 mt-1 w-56 right-0 bg-white rounded-md shadow-lg border border-gray-200 animate-fadeIn"
                                                style="top: -30%; transform: translateY(0); transform: translateX(190px); "
                                            >
                                                <div
                                                    class="p-2 border-b border-gray-200"
                                                >
                                                    <div class="relative">
                                                        <div
                                                            class="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none"
                                                        >
                                                            <svg
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                class="h-4 w-4 text-gray-400"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                stroke-width="2"
                                                                stroke-linecap="round"
                                                                stroke-linejoin="round"
                                                            >
                                                                <circle
                                                                    cx="11"
                                                                    cy="11"
                                                                    r="8"
                                                                ></circle>
                                                                <line
                                                                    x1="21"
                                                                    y1="21"
                                                                    x2="16.65"
                                                                    y2="16.65"
                                                                ></line>
                                                            </svg>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            placeholder="Buscar..."
                                                            value={columnFilterSearch[
                                                                column.field as string
                                                            ] || ""}
                                                            oninput={(e) =>
                                                                updateColumnFilterSearch(
                                                                    column.field as string,
                                                                    (
                                                                        e.target as HTMLInputElement
                                                                    ).value,
                                                                )}
                                                            class="block w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                                                        />
                                                    </div>
                                                </div>

                                                <div
                                                    class="max-h-60 overflow-y-auto py-1"
                                                >
                                                    <div
                                                        class="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors duration-150"
                                                        onclick={() =>
                                                            selectColumnFilterValue(
                                                                column.field as string,
                                                                "(Todos)",
                                                            )}
                                                    >
                                                        (Todos)
                                                    </div>
                                                    <div
                                                        class="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors duration-150"
                                                        onclick={() =>
                                                            selectColumnFilterValue(
                                                                column.field as string,
                                                                "(Vacios)",
                                                            )}
                                                    >
                                                        (Vacios)
                                                    </div>
                                                    <div
                                                        class="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors duration-150"
                                                        onclick={() =>
                                                            selectColumnFilterValue(
                                                                column.field as string,
                                                                "(No vacios)",
                                                            )}
                                                    >
                                                        (No vacios)
                                                    </div>

                                                    {#each getFilteredColumnValues(column.field as string) as value}
                                                        <div
                                                            class="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors duration-150"
                                                            onclick={() =>
                                                                selectColumnFilterValue(
                                                                    column.field as string,
                                                                    value,
                                                                )}
                                                        >
                                                            {value}
                                                        </div>
                                                    {/each}
                                                </div>
                                            </div>
                                        {/if}
                                    {/if}
                                </th>
                            {/if}
                        {/each}

                        <!-- Celda de relleno para mantener el ancho completo -->
                        {#if visibleColumns.length < columns.length}
                            <th class="w-full"></th>
                        {/if}
                    </tr>
                </thead>
            {/if}

            <tbody class="bg-white divide-y divide-gray-200">
                {#if paginatedData.length === 0}
                    <tr>
                        <td
                            colspan={columns.length +
                                (columns[0]?.selectable ? 1 : 0)}
                            class="px-6 py-10 text-center text-sm text-gray-500 bg-gray-50"
                        >
                            <div
                                class="flex flex-col items-center justify-center"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="h-10 w-10 text-gray-400 mb-2"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"
                                    ></line>
                                </svg>
                                <span class="font-medium"
                                    >Sin datos para mostrar</span
                                >
                            </div>
                        </td>
                    </tr>
                {:else}
                    {#each paginatedData as row}
                        {@const rowId = row.id || JSON.stringify(row)}
                        {#if row.__isGroup}
                            <tr
                                class="bg-gradient-to-r from-gray-100 to-gray-50"
                            >
                                <td
                                    colspan={columns.length +
                                        (columns[0]?.selectable ? 1 : 0)}
                                    class="px-4 py-2 text-sm font-medium text-gray-700"
                                >
                                    <div class="flex items-center">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            class="h-4 w-4 mr-2 text-gray-500"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        >
                                            <path d="M21 10H3"></path>
                                            <path d="M21 6H3"></path>
                                            <path d="M21 14H3"></path>
                                            <path d="M21 18H3"></path>
                                        </svg>
                                        {#each groupByFields as field}
                                            <strong class="mr-1"
                                                >{columns.find(
                                                    (c) => c.field === field,
                                                )?.header || field}:</strong
                                            >
                                            <span class="mr-3"
                                                >{row.__groupValues[
                                                    field
                                                ]}</span
                                            >
                                            {#if field !== groupByFields[groupByFields.length - 1]}
                                                <span class="mx-1 text-gray-400"
                                                    >|</span
                                                >
                                            {/if}
                                        {/each}
                                    </div>
                                </td>
                            </tr>
                        {:else}
                            <tr
                                class="hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                                class:bg-blue-50={selectedRows.includes(
                                    row.id || JSON.stringify(row),
                                )}
                                class:bg-yellow-100={row.id === selectedRowId}
                                onclick={(e) => handleRowClick(row, e)}
                            >
                                {#if columns.length > 0 && columns[0].selectable}
                                    <td class="px-3 py-2 whitespace-nowrap">
                                        <div class="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedRows.includes(
                                                    rowId,
                                                )}
                                                onchange={() =>
                                                    toggleSelectRow(rowId)}
                                                class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                        </div>
                                    </td>
                                {/if}

                                <!-- Solo renderizar celdas para columnas visibles -->
                                {#each visibleColumns as column, index}
                                    {#if !(index === 0 && column.selectable)}
                                        <td
                                            class="px-3 py-2 whitespace-nowrap text-sm text-gray-700"
                                        >
                                            {#if column.template}
                                                <svelte:component
                                                    this={column.template}
                                                    {row}
                                                    field={column.field}
                                                />
                                            {:else if column.format && column.field}
                                                {@html column.format(
                                                    row[
                                                        column.field as keyof typeof row
                                                    ],
                                                    row,
                                                )}
                                            {:else if column.field}
                                                {row[
                                                    column.field as keyof typeof row
                                                ]}
                                            {/if}
                                        </td>
                                    {/if}
                                {/each}

                                <!-- Celda de relleno para mantener el ancho completo -->
                                {#if visibleColumns.length < columns.length}
                                    <td class="w-full"></td>
                                {/if}
                            </tr>
                        {/if}
                    {/each}
                {/if}
            </tbody>
        </table>
    </div>

    <!-- Pagination -->
    {#if showPagination && sortedData.length > 0}
        <div
            class="bg-white px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between border-t border-gray-200 sm:px-6"
        >
            <div class="flex flex-col sm:flex-row sm:items-center gap-4">
                <p class="text-sm text-gray-700">
                    Mostrando <span class="font-medium"
                        >{Math.min(
                            (currentPage - 1) * pageSize + 1,
                            sortedData.length,
                        )}</span
                    >
                    a
                    <span class="font-medium"
                        >{Math.min(
                            currentPage * pageSize,
                            sortedData.length,
                        )}</span
                    >
                    de <span class="font-medium">{sortedData.length}</span> resultados
                </p>

                <!-- Page size selector -->
                <div class="relative inline-block z-10">
                    <select
                        class="appearance-none bg-white border border-gray-300 rounded-md pl-3 pr-8 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={pageSize}
                        onchange={(e) => {
                            const newPageSize = parseInt(
                                (e.target as HTMLSelectElement).value,
                            );
                            const newTotalPages = Math.ceil(
                                sortedData.length / newPageSize,
                            );
                            const newCurrentPage = Math.min(
                                currentPage,
                                newTotalPages,
                            );

                            pageSize = newPageSize;
                            currentPage = newCurrentPage || 1;
                        }}
                    >
                        {#each pageSizeOptions as size}
                            <option value={size}>{size} por página</option>
                        {/each}
                    </select>
                    <div
                        class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700"
                    >
                        <svg
                            class="h-4 w-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path d="M7 7l3-3 3 3m0 6l-3 3-3-3" />
                        </svg>
                    </div>
                </div>
            </div>

            <div class="mt-4 sm:mt-0">
                <nav
                    class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                    aria-label="Pagination"
                >
                    <button
                        class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
                        disabled={currentPage === 1}
                        onclick={() => handlePageChange(1)}
                        onmouseenter={(e) =>
                            showTooltipFor("first-page", "Primera página", e)}
                    >
                        <span class="sr-only">Primera</span>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <polyline points="11 17 6 12 11 7"></polyline>
                            <polyline points="18 17 13 12 18 7"></polyline>
                        </svg>
                    </button>
                    <button
                        class="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
                        disabled={currentPage === 1}
                        onclick={() => handlePageChange(currentPage - 1)}
                        onmouseenter={(e) =>
                            showTooltipFor("prev-page", "Página anterior", e)}
                    >
                        <span class="sr-only">Anterior</span>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>

                    {#each Array(Math.min(5, totalPages)) as _, i}
                        {@const pageNum = currentPage - 2 + i}
                        {#if pageNum > 0 && pageNum <= totalPages}
                            <button
                                class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium focus:z-10 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150 cursor-pointer"
                                class:bg-blue-50={pageNum === currentPage}
                                class:text-blue-600={pageNum === currentPage}
                                class:border-blue-500={pageNum === currentPage}
                                class:text-gray-700={pageNum !== currentPage}
                                class:font-semibold={pageNum === currentPage}
                                class:shadow-sm={pageNum === currentPage}
                                onclick={() => handlePageChange(pageNum)}
                            >
                                {pageNum}
                            </button>
                        {/if}
                    {/each}

                    <button
                        class="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
                        disabled={currentPage === totalPages}
                        onclick={() => handlePageChange(currentPage + 1)}
                        onmouseenter={(e) =>
                            showTooltipFor("next-page", "Página siguiente", e)}
                    >
                        <span class="sr-only">Siguiente</span>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                    <button
                        class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
                        disabled={currentPage === totalPages}
                        onclick={() => handlePageChange(totalPages)}
                        onmouseenter={(e) =>
                            showTooltipFor("last-page", "Última página", e)}
                    >
                        <span class="sr-only">Última</span>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <polyline points="13 17 18 12 13 7"></polyline>
                            <polyline points="6 17 11 12 6 7"></polyline>
                        </svg>
                    </button>
                </nav>
            </div>
        </div>
    {/if}
</div>

<style>
    /* Estilos encapsulados para el DataGrid */
    [data-datagrid-root] :global(*) {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }

    [data-datagrid-root] :global(table) {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
    }

    [data-datagrid-root] :global(th),
    [data-datagrid-root] :global(td) {
        border: none;
        background: none;
        font-size: inherit;
        font-weight: inherit;
        padding: inherit;
    }

    [data-datagrid-root] :global(button) {
        background: none;
        border: none;
        padding: 0;
        font: inherit;
        cursor: pointer;
        outline: inherit;
    }

    /* Asegurarse que los estilos de Tailwind se apliquen correctamente */
    [data-datagrid-root] :global(.table-auto) {
        table-layout: auto;
    }

    [data-datagrid-root] :global(.table-fixed) {
        table-layout: fixed;
    }
    /* Estilos adicionales para mejorar la apariencia */
    :global(.dark) {
        --tw-bg-opacity: 1;
        background-color: rgb(17 24 39 / var(--tw-bg-opacity));
        color: rgb(243 244 246 / 1);
    }

    :global(.dark) .bg-white {
        --tw-bg-opacity: 1;
        background-color: rgb(31 41 55 / var(--tw-bg-opacity));
    }

    :global(.dark) .bg-gray-50 {
        --tw-bg-opacity: 1;
        background-color: rgb(55 65 81 / var(--tw-bg-opacity));
    }

    :global(.dark) .text-gray-700 {
        --tw-text-opacity: 1;
        color: rgb(209 213 219 / var(--tw-text-opacity));
    }

    :global(.dark) .text-gray-500 {
        --tw-text-opacity: 1;
        color: rgb(156 163 175 / var(--tw-text-opacity));
    }

    :global(.dark) .border-gray-200 {
        --tw-border-opacity: 1;
        border-color: rgb(55 65 81 / var(--tw-border-opacity));
    }

    :global(.dark) .border-gray-300 {
        --tw-border-opacity: 1;
        border-color: rgb(75 85 99 / var(--tw-border-opacity));
    }

    :global(.dark) .hover\:bg-gray-50:hover {
        --tw-bg-opacity: 1;
        background-color: rgb(75 85 99 / var(--tw-bg-opacity));
    }

    :global(.dark) .hover\:bg-gray-100:hover {
        --tw-bg-opacity: 1;
        background-color: rgb(75 85 99 / var(--tw-bg-opacity));
    }

    :global(.dark) .bg-blue-50 {
        --tw-bg-opacity: 1;
        background-color: rgb(59 130 246 / 0.15);
    }

    :global(.dark) .bg-gradient-to-r.from-gray-50.to-gray-100 {
        background-image: linear-gradient(
            to right,
            rgb(55 65 81 / 1),
            rgb(75 85 99 / 1)
        );
    }

    :global(.dark) .bg-gradient-to-r.from-gray-100.to-gray-50 {
        background-image: linear-gradient(
            to right,
            rgb(75 85 99 / 1),
            rgb(55 65 81 / 1)
        );
    }

    /* Animaciones */
    .animate-fadeIn {
        animation: fadeIn 0.2s ease-in-out;
    }

    .animate-slideDown {
        animation: slideDown 0.3s ease-in-out;
    }

    .animate-slideInRight {
        animation: slideInRight 0.3s ease-in-out;
    }

    .animate-scaleIn {
        animation: scaleIn 0.2s ease-in-out;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(20px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }

    @keyframes scaleIn {
        from {
            opacity: 0;
            transform: scale(0.95);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }

    /* Estilos para drag and drop */
    .drag-ghost {
        position: absolute;
        padding: 8px 12px;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        box-shadow:
            0 4px 6px -1px rgba(0, 0, 0, 0.1),
            0 2px 4px -1px rgba(0, 0, 0, 0.06);
        font-size: 12px;
        font-weight: 500;
        color: #4b5563;
        pointer-events: none;
        z-index: 50;
        opacity: 0.9;
    }

    /* Responsive styles */
    @media (max-width: 768px) {
        .overflow-x-auto {
            -webkit-overflow-scrolling: touch;
        }

        table {
            display: block;
            width: 100%;
        }

        th,
        td {
            min-width: 120px;
        }

        .flex-col-mobile {
            flex-direction: column;
        }
    }

    /* Loader */
    .loader {
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top: 3px solid #3498db;
        width: 30px;
        height: 30px;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    /* Tooltip */
    .tooltip {
        position: fixed;
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 1000;
        pointer-events: none;
        max-width: 200px;
        white-space: normal;
    }

    /* Toast notifications */
    .toast {
        display: flex;
        align-items: center;
        padding: 10px 15px;
        border-radius: 6px;
        box-shadow:
            0 4px 6px -1px rgba(0, 0, 0, 0.1),
            0 2px 4px -1px rgba(0, 0, 0, 0.06);
        max-width: 350px;
    }

    .toast-icon {
        margin-right: 10px;
    }

    .toast-content {
        font-size: 14px;
    }

    .toast-success {
        background-color: #d1fae5;
        border-left: 4px solid #10b981;
        color: #065f46;
    }

    .toast-error {
        background-color: #fee2e2;
        border-left: 4px solid #ef4444;
        color: #991b1b;
    }

    .toast-info {
        background-color: #e0f2fe;
        border-left: 4px solid #3b82f6;
        color: #1e40af;
    }

    @keyframes fadeOut {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }

    .animate-fadeOut {
        animation: fadeOut 0.15s ease-out forwards;
    }

    /* Estilos específicos para la fila de filtros */
    .filter-row {
        background-color: #f9fafb;
    }

    :global(.dark) .filter-row {
        background-color: rgb(31 41 55 / var(--tw-bg-opacity));
    }

    .filter-container {
        position: relative;
        padding: 4px 0;
    }

    /* Asegurar que los dropdowns de filtro no se corten */
    .filter-container .absolute {
        max-height: 300px;
        overflow-y: auto;
    }

    /* Estilos para mejorar la visibilidad de los filtros activos */
    input[type="text"]:not(:placeholder-shown) {
        border-color: #3b82f6;
        background-color: #eff6ff;
    }

    :global(.dark) input[type="text"]:not(:placeholder-shown) {
        border-color: #3b82f6;
        background-color: rgba(59, 130, 246, 0.1);
    }

    /* Estilos para el botón de filtro */
    .filter-button {
        transition: all 0.2s ease;
        position: relative;
    }

    .filter-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .filter-button:active {
        transform: translateY(0);
    }

    .filter-button.active {
        background-color: #eff6ff;
        border-color: #3b82f6;
    }

    :global(.dark) .filter-button.active {
        background-color: rgba(59, 130, 246, 0.2);
        border-color: #3b82f6;
    }

    /* Estilos para el menú desplegable de filtros */
    .filter-dropdown {
        box-shadow:
            0 4px 6px -1px rgba(0, 0, 0, 0.1),
            0 2px 4px -1px rgba(0, 0, 0, 0.06);
        border-radius: 0.375rem;
        z-index: 30;
    }

    .filter-dropdown-header {
        font-weight: 500;
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid #e5e7eb;
        color: #4b5563;
    }

    :global(.dark) .filter-dropdown-header {
        border-color: #374151;
        color: #d1d5db;
    }

    .filter-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 0.75rem;
        cursor: pointer;
        transition: background-color 0.15s ease;
    }

    .filter-option:hover {
        background-color: #f3f4f6;
    }

    :global(.dark) .filter-option:hover {
        background-color: #374151;
    }

    .filter-option-selected {
        background-color: #eff6ff;
        font-weight: 500;
    }

    :global(.dark) .filter-option-selected {
        background-color: rgba(59, 130, 246, 0.2);
    }

    /* Indicador de filtro activo */
    .filter-indicator {
        position: absolute;
        top: 0;
        right: 0;
        height: 8px;
        width: 8px;
        background-color: #3b82f6;
        border-radius: 9999px;
        transform: translate(25%, -25%);
    }
</style>

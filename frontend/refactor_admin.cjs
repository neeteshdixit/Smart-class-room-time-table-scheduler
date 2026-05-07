const fs = require('fs');

const filePath = 'src/pages/AdminPages.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
content = content.replace(
  'import { Link } from "react-router-dom";',
  `import { Link } from "react-router-dom";\nimport { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";`
);

content = content.replace(
  'import { TimetableGrid, TimetableLegend, TimetableStatStrip } from "../components/timetable";',
  `import { TimetableGrid, TimetableLegend, TimetableStatStrip } from "../components/timetable";\nimport { DeleteConfirmationModal } from "../components/ui";`
);

// 2. Rewrite useMasterResource
const useMasterRegex = /function useMasterResource\(resource\) \{[\s\S]*?return \{[\s\S]*?onEdit,\n  \};\n\}/;
const newUseMaster = `function useMasterResource(resource) {
  const config = MASTER_RESOURCES[resource];
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(() => toInitialForm(resource));
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    setForm(toInitialForm(resource));
    setEditingId(null);
    setQuery("");
    setPagination({ page: 1, limit: 10, total: 0 });
  }, [resource]);

  const listQuery = useQuery({
    queryKey: ["masterData", resource, pagination.page, pagination.limit, query],
    queryFn: async () => {
      const res = await masterApi.list(resource, { page: pagination.page, limit: pagination.limit, q: query || undefined });
      return res;
    },
    keepPreviousData: true,
  });

  useEffect(() => {
    if (listQuery.data?.pagination) {
      setPagination((current) => ({
        ...current,
        total: listQuery.data.pagination.total || 0,
      }));
    }
  }, [listQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingId) {
        return masterApi.update(resource, editingId, payload);
      }
      return masterApi.create(resource, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["masterData", resource]);
      queryClient.invalidateQueries(["stats"]);
      setForm(toInitialForm(resource));
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => masterApi.remove(resource, id),
    onSuccess: () => {
      queryClient.invalidateQueries(["masterData", resource]);
      queryClient.invalidateQueries(["stats"]);
      setDeletingId(null);
    },
  });

  async function saveRecord(event) {
    event.preventDefault();
    const payload = normaliseFormPayload(resource, form);
    saveMutation.mutate(payload);
  }

  function onEdit(row) {
    const nextForm = toInitialForm(resource);
    config.fields.forEach((field) => {
      if (row[field.name] !== undefined && row[field.name] !== null) {
        nextForm[field.name] = field.type === "checkbox" ? Boolean(row[field.name]) : row[field.name];
      }
    });
    setForm(nextForm);
    setEditingId(row.id);
  }

  return {
    rows: listQuery.data?.data || [],
    pagination,
    query,
    setQuery,
    setPage: (nextPage) => setPagination((c) => ({ ...c, page: Math.max(1, nextPage) })),
    reload: () => listQuery.refetch(),
    loading: listQuery.isLoading || listQuery.isFetching,
    error: listQuery.error?.message || saveMutation.error?.message || deleteMutation.error?.message,
    form,
    setForm,
    editingId,
    setEditingId,
    deletingId,
    setDeletingId,
    saveRecord,
    isSaving: saveMutation.isLoading || saveMutation.isPending,
    executeDelete: () => deleteMutation.mutate(deletingId),
    isDeleting: deleteMutation.isLoading || deleteMutation.isPending,
    onEdit,
  };
}`;
content = content.replace(useMasterRegex, newUseMaster);

// 3. Rewrite AdminDashboardPage
const adminDashboardRegex = /export function AdminDashboardPage\(\) \{[\s\S]*?const recentActivity = summary\?\.recent_activity \|\| \[\];/;
const newAdminDashboard = `export function AdminDashboardPage() {
  const { data: summary, isLoading: loading, error: queryError } = useQuery({
    queryKey: ["stats", { includeActivity: true }],
    queryFn: () => statsApi.get(true),
  });
  
  const error = queryError?.message || "";
  const recentActivity = summary?.recent_activity || [];`;
content = content.replace(adminDashboardRegex, newAdminDashboard);

// 4. Update MasterDataPage usage of DeleteConfirmationModal
content = content.replace(
  'removeRecord,',
  'deletingId,\n    setDeletingId,\n    executeDelete,\n    isDeleting,'
);

// We need to change MasterDataPage's useEffect for totals to useQuery
const totalsEffectRegex = /const \[totals, setTotals\] = useState\(\{\}\);\s*useEffect\(\(\) => \{[\s\S]*?return \(\) => \{ cancelled = true; \};\s*\}, \[pagination\.total, resource\]\);/;
const newTotalsQuery = `const { data: statsData } = useQuery({
    queryKey: ["stats"],
    queryFn: () => statsApi.get(false),
  });
  const totals = statsData?.totals || {};`;
content = content.replace(totalsEffectRegex, newTotalsQuery);

// Render action button fix
content = content.replace(
  'onClick={() => removeRecord(row.id)}',
  'onClick={() => setDeletingId(row.id)}'
);

// Add modal in MasterDataPage just before the last closing div
const closingDivsRegex = /<\/div>\s*<\/div>\s*\);\s*\}/;
const newClosingDivs = `  <DeleteConfirmationModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={executeDelete}
        title={\`Delete \${config.title} Record\`}
        description="Are you sure you want to delete this record? This action cannot be undone and will instantly reflect across the system."
        isDeleting={isDeleting}
      />
    </div>
  </div>
);
}`;
content = content.replace(closingDivsRegex, newClosingDivs);

// Pass disabled state to save form
content = content.replace(
  'disabled={loading}',
  'disabled={isSaving}'
);

fs.writeFileSync(filePath, content);
console.log('AdminPages refactored successfully.');

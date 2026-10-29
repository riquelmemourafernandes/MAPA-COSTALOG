import { useEffect, useMemo, useRef, useState } from 'react';
import BaseCatalogSheet from './BaseCatalogSheet.js';
import { SCROLL_BATCH_SIZE, EMPTY_GRID_ROWS, normalizeCreateCount,
  normalizeRowHeight, mergeLoadedRows, shouldLoadNextBatch, virtualRowWindow } from './sheet-layout.js';
import SheetColorPicker from './SheetColorPicker.js';
import SheetDropdownEditor from './SheetDropdownEditor.js';
import { BASE_COLUMN_LIST } from './sheet-dropdown-utils.js';
import { STATUS_COLORS, statusRowColor, statusRowTextColor } from './sheet-status-rules.js';
import { checkboxChecked, checkboxSaveText, isCheckboxColumn } from './sheet-checkbox.js';
import {LOCKED_COLUMN_FORMAT,formatSheetValue,parseSheetValue,toDateInput,type SheetNumberFormat} from './sheet-formats.js';
import { matchesColumnFilters, uniqueFilterValues, type ColumnFilterMap } from './column-filter.js';
import {
  canPasteMatrix, moveGridPosition, parseClipboardGrid,
  parseEditableValue, selectionBounds, serializeSelection, gridKeyboardAction,
  type GridPosition
} from './sheet-grid.js';
import { Activity, Bell, Bold, GripVertical, ChevronDown, ClipboardList, Columns3, Filter, History, LayoutDashboard, LogOut, Menu, Plus, Save, Search, Settings2, Table2, Truck, Users, Waypoints, X, UserRound, ShieldCheck } from 'lucide-react';

type Column = { key: string; label: string; position: number; dataType: string; editable: boolean; visible: boolean; required?: boolean };
type ValidationItem = { key: string; label: string; dataType: string; total: number; missing: number };
type ValidationSummary = { checkedAt: string; totalRows: number; requiredFields: number; items: ValidationItem[] };
type DashboardSummary = { generatedAt: string; activeRecords: number; recentlyUpdated: number; statuses: { status: string; count: number }[] };
type AppointmentAlert = { id: string; sequence: number; kind: 'Coleta' | 'Entrega'; scheduledAt: string; minutesLate: number; attendant: string; clientName: string | null; container: string | null; cte: string | null; status: string | null };
type AppointmentAlertSummary = { generatedAt: string; total: number; filteredTotal?: number; byKind: { collection: number; delivery: number }; attendants?: string[]; items: AppointmentAlert[] };
type RecordRow = { id: string; sequence: number; data: Record<string, unknown>; status?: string | null; clientName?: string | null; container?: string | null; cte?: string | null; updatedAt: string };
type SavedView = { name: string; visibleKeys: string[]; query: string; status: string };
type CellStyle = { bold?: boolean; color?: string; background?: string; format?: SheetNumberFormat; align?: 'left'|'center'|'right' };
type AuditEntry = { id: string; action: string; fieldKey?: string | null; beforeValue?: unknown; afterValue?: unknown; createdAt: string; user?: { name?: string; email?: string } | null };
type UserProfile = { id: string; name: string; email: string; role: string; active: boolean };
type UserAdminItem = UserProfile & { createdAt?: string; updatedAt?: string; pendingApproval?: boolean };
// Keep the existing same-origin production proxy by default. A Vercel Preview
// can explicitly opt in to a SEPARATE staging backend using an environment
// variable scoped to Preview only; never silently switch production traffic.
const isVercelSite = typeof window !== 'undefined' && /(?:^|\.)vercel\.app$/.test(window.location.hostname);
const previewHomologApi = (import.meta.env.VITE_HOMOLOG_API_URL || '').trim().replace(/\/+$/, '');
const apiBase = isVercelSite && /^https:\/\/[^/]+$/.test(previewHomologApi)
  ? previewHomologApi
  : isVercelSite ? window.location.origin : (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
// Cabeçalho conferido na linha 1 de MAPA IMPORTAÇÃO > MAPA 1.0 (A:BT).
// As posições BL:BP não têm título; não deslocar os valores adjacentes.
const referenceHeader: Record<string, string> = {
  "A":"DATA",
  "B":"ATENDENTE",
  "C":"STATUS",
  "D":"CTE",
  "E":"MODALIDADE",
  "F":"DI / DTA",
  "G":"ARM",
  "H":"DEM",
  "I":"PROC.",
  "J":"PROG.",
  "K":"ID PROG.",
  "L":"CLIENTE",
  "M":"ISCA",
  "N":"REFERENCIA",
  "O":"BL",
  "P":"NAVIO",
  "Q":"VALORES",
  "R":"QTD",
  "S":"PESO",
  "T":"CONTAINER",
  "U":"TIPO",
  "V":"IMO",
  "W":"CAVALO",
  "X":"CARRETA",
  "Y":"MOTORISTA",
  "Z":"CONTATO",
  "AA":"OK?",
  "AB":"2º VIAGEM",
  "AC":"FRETE",
  "AD":"RV",
  "AE":"CIOT",
  "AF":"MDF",
  "AG":"CATEGORIA",
  "AH":"SM/AE",
  "AI":"TRAVA GR",
  "AJ":"TERMINAL COLETA",
  "AK":"CIDADE",
  "AL":"DATA / HORA - COLETA",
  "AM":"Nº AGEND.",
  "AN":"ENTREGA - 1",
  "AO":"KM",
  "AP":"DATA / HORA - ENTREGA - 1",
  "AQ":"ENDERECO - ENTREGA - 1",
  "AR":"ENTREGA - 2",
  "AS":"DATA / HORA - ENTREGA - 2",
  "AT":"ENDERECO - ENTREGA - 2",
  "AU":"CHEGADA NO TERMINAL / EADI",
  "AV":"SAÍDA DO TERMINAL / EADI",
  "AW":"CHEGADA NO CLIENTE",
  "AX":"SAÍDA DO CLIENTE",
  "AY":"STATUS",
  "AZ":"ARMADOR",
  "BA":"OBS",
  "BB":"STATUS UNIDADE VAZIA",
  "BC":"MINUTA/AG",
  "BD":"TERMINAL DE VAZIO",
  "BE":"CIDADE - DEPOT",
  "BF":"DATA / HORA - DEPOT",
  "BG":"P.S.",
  "BH":"DATA ENTREGA VAZIO",
  "BI":"P.S. DEVIDO?",
  "BJ":"EIR ENVIADO",
  "BK":"📷",
  "BQ":"CRÍTICO?",
  "BR":"ENVIADO P/ FATURAMENTO",
  "BS":"PROG.ENCERRADA",
  "BT":"PROC. ENCERRADO"
};
const referenceColumnKeys = new Set(Object.keys(referenceHeader).concat(['BL','BM','BN','BO','BP']));
const nav = [
  { name: 'Visão geral', icon: LayoutDashboard }, { name: 'MAPA 1.0', icon: Table2 },
  { name: 'Status operacional', icon: Activity }, { name: 'Cadastros', icon: Users }, { name: 'Minha conta', icon: UserRound }, { name: 'Usuários', icon: Users }, { name: 'Integrações', icon: Waypoints }
];
function valueText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
export default function App() {
  const [active, setActive] = useState('MAPA 1.0');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [filterColumn, setFilterColumn] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFilterMap>({});
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);
  const [filterMenuRect, setFilterMenuRect] = useState<{top:number;left:number} | null>(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterDraft, setFilterDraft] = useState<string[]>([]);
  const [filterAllChosen, setFilterAllChosen] = useState(true);
  const [filterOptions, setFilterOptions] = useState<string[]>([]);
  const [filterOptionsNote, setFilterOptionsNote] = useState('');
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkColumn, setBulkColumn] = useState('');
  const [bulkValue, setBulkValue] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const editingBusyRef = useRef(false);
  const editorRef = useRef<HTMLInputElement>(null);
  const [token, setToken] = useState(() => apiBase ? sessionStorage.getItem('mapa-costalog-token') || '' : '');
  const [userKey, setUserKey] = useState(() => sessionStorage.getItem('mapa-costalog-user') || 'usuario');
  const [userRole, setUserRole] = useState(() => sessionStorage.getItem('mapa-costalog-role') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authScreen, setAuthScreen] = useState<'login' | 'request'>('login');
  const [requestName, setRequestName] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestPassword, setRequestPassword] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [apiError, setApiError] = useState('');
  const [notice, setNotice] = useState('Conecte a API e o banco de dados para acessar os registros operacionais.');
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<Column[]>([]);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [pendingRowStatus, setPendingRowStatus] = useState<Record<string, string>>({});
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [appointmentAlerts, setAppointmentAlerts] = useState<AppointmentAlertSummary | null>(null);
  const [appointmentAlertsLoading, setAppointmentAlertsLoading] = useState(false);
  const [showAllAppointmentAlerts, setShowAllAppointmentAlerts] = useState(false);
  const [alertKindFilter, setAlertKindFilter] = useState<'Todos' | 'Coleta' | 'Entrega'>('Todos');
  const [alertAttendantFilter, setAlertAttendantFilter] = useState('Todos');
  const [page, setPage] = useState(1);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    localStorage.getItem('mapa-costalog-sidebar-collapsed') === 'yes');
  const [newRowsCount, setNewRowsCount] = useState(10);
  const [newRowsOpen, setNewRowsOpen] = useState(false);
  const [creatingRows, setCreatingRows] = useState(false);
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const [gridViewport, setGridViewport] = useState({scrollTop:0,height:560});
  const selectionDragRef = useRef(false);
  const dragInfoRef = useRef<{row:number;column:number;x:number;y:number;moved:boolean}|null>(null);
  const lastRequestedPageRef = useRef(0);
  const [retryRowsKey, setRetryRowsKey] = useState(0);
  const [total, setTotal] = useState(0);
  const [columnMenu, setColumnMenu] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<string[]>([]);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [viewName, setViewName] = useState('');
  const [showViewTools, setShowViewTools] = useState(false);
  const [showStatusColors, setShowStatusColors] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{row: RecordRow; column: Column} | null>(null);
  const [selectionMode, setSelectionMode] = useState<'cell'|'row'|'column'>('cell');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedColumnKey, setSelectedColumnKey] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{rowId: string; columnKey: string} | null>(null);
  const [editValue, setEditValue] = useState('');
  const [placeholderPosition, setPlaceholderPosition] = useState<GridPosition | null>(null);
  const [selectionAnchor, setSelectionAnchor] = useState<{rowId: string; columnKey: string} | null>(null);
  const [pastePreview, setPastePreview] = useState<{matrix: string[][]; start: GridPosition} | null>(null);
  const [pasteBusy, setPasteBusy] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{key:string; direction:'asc'|'desc'} | null>(null);
  const [cellStyles, setCellStyles] = useState<Record<string, CellStyle>>({});
  const [rowStyles, setRowStyles] = useState<Record<string, CellStyle>>({});
  const [columnStyles, setColumnStyles] = useState<Record<string, CellStyle>>({});
  const styleStorageKey = 'mapa-costalog-sheet-styles:' + userKey;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(styleStorageKey) || '{}');
      setRowStyles(saved?.rowStyles && typeof saved.rowStyles === 'object' ? saved.rowStyles : {});
      setColumnStyles(saved?.columnStyles && typeof saved.columnStyles === 'object' ? saved.columnStyles : {});
    } catch { setRowStyles({}); setColumnStyles({}); }
  }, [styleStorageKey]);
  const [historyTarget, setHistoryTarget] = useState<{row: RecordRow; column: Column} | null>(null);
  const [historyItems, setHistoryItems] = useState<AuditEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [users, setUsers] = useState<UserAdminItem[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('CONSULTA');
  const pageSize = SCROLL_BATCH_SIZE;
  const rowHeightStorageKey = 'mapa-costalog-row-heights:' + userKey;
  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem(rowHeightStorageKey) || '{}') as Record<string,unknown>;
      setRowHeights(Object.fromEntries(Object.entries(data)
        .filter((entry): entry is [string, number] => typeof entry[1] === 'number' &&
          Number.isFinite(entry[1]) && entry[1] >= 32 && entry[1] <= 800)));
    } catch { setRowHeights({}); }
  }, [rowHeightStorageKey]);
  useEffect(() => {
    if (active !== 'MAPA 1.0' || !token) return;
    const node = gridRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      setGridViewport({scrollTop:node.scrollTop,height:node.clientHeight});
    });
    observer.observe(node);
    setGridViewport({scrollTop:node.scrollTop,height:node.clientHeight});
    return () => observer.disconnect();
  }, [active, token]);
  useEffect(() => { setSelectedRowIds([]); }, [page, query, status, filterColumn, filterValue, columnFilters]);
  const selectedRows = rows.filter(row => selectedRowIds.includes(row.id));
  const editableColumns = columns.filter(column => column.editable);
  const preferenceKey = 'mapa-costalog-columns:' + userKey;
  const widthKey = 'mapa-costalog-widths:' + userKey;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(widthKey) || '{}') as Record<string, unknown>;
      setColumnWidths(Object.fromEntries(Object.entries(saved)
        .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] >= 90 && entry[1] <= 520)));
    } catch { setColumnWidths({}); }
  }, [widthKey]);

  useEffect(() => {
    if (!apiBase || !token) return;
    let cancelled = false;
    setLoading(true);
    setApiError('');
    Promise.all([
      fetch(apiBase + '/api/v1/config/columns', { headers: { Authorization: 'Bearer ' + token } }),
      fetch(apiBase + '/api/v1/mapa?page=' + page + '&pageSize=' + pageSize + '&search=' + encodeURIComponent(query) + '&status=' + encodeURIComponent(status) + '&filterColumn=' + encodeURIComponent(filterColumn) + '&filterValue=' + encodeURIComponent(filterValue), { headers: { Authorization: 'Bearer ' + token } })
    ]).then(async ([columnsResponse, rowsResponse]) => {
      const columnsBody = await columnsResponse.json().catch(() => ({}));
      const rowsBody = await rowsResponse.json().catch(() => ({}));
      if (!columnsResponse.ok) throw new Error(columnsBody?.error?.message || 'Falha ao carregar as colunas.');
      if (!rowsResponse.ok) throw new Error(rowsBody?.error?.message || 'Falha ao carregar os registros.');
      if (cancelled) return;
      const nextColumns = Array.isArray(columnsBody.items) ? columnsBody.items as Column[] : [];
      // Labels follow the source Sheet 1:1, without altering database config.
      const referenceColumns = nextColumns
        .filter(column => referenceColumnKeys.has(column.key))
        .map(column => ({ ...column, label: referenceHeader[column.key] || '' }));
      setColumns(referenceColumns);
      const saved = localStorage.getItem(preferenceKey);
      const savedKeys = saved ? JSON.parse(saved) as string[] : null;
      setVisibleKeys(savedKeys
        ? savedKeys.filter(key => referenceColumns.some(c => c.key === key))
        : referenceColumns.map(c => c.key));
      const incoming = Array.isArray(rowsBody.items) ? rowsBody.items as RecordRow[] : [];
      setRows(previous => page === 1 ? incoming : mergeLoadedRows(previous, incoming));
      setTotal(Number(rowsBody.total || 0));
      setNotice('Dados carregados do banco de dados. As colunas visíveis são personalizadas por usuário.');
    }).catch(error => {
      if (cancelled) return;
      const message = error instanceof Error ? error.message : 'Não foi possível conectar à API.';
      setApiError(message);
      if (/sessão|token|login/i.test(message)) { sessionStorage.removeItem('mapa-costalog-token'); setToken(''); }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, page, query, status, filterColumn, filterValue, preferenceKey, retryRowsKey]);

  useEffect(() => {
    if (!apiBase || !token) { setDashboardSummary(null); return; }
    let cancelled = false;
    setDashboardLoading(true);
    fetch(apiBase + '/api/v1/dashboard/summary', { headers: { Authorization: 'Bearer ' + token } })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error?.message || 'Não foi possível carregar os indicadores.');
        if (!cancelled) setDashboardSummary(body as DashboardSummary);
      })
      .catch(error => { if (!cancelled) setApiError(error instanceof Error ? error.message : 'Falha ao carregar o painel.'); })
      .finally(() => { if (!cancelled) setDashboardLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!apiBase || !token) { setAppointmentAlerts(null); return; }
    let cancelled = false;
    setAppointmentAlertsLoading(true);
    fetch(apiBase + '/api/v1/dashboard/appointment-alerts' + (() => { const params = new URLSearchParams(); if (alertAttendantFilter !== 'Todos') params.set('attendant', alertAttendantFilter); if (alertKindFilter !== 'Todos') params.set('kind', alertKindFilter); return params.size ? '?' + params.toString() : ''; })(), { headers: { Authorization: 'Bearer ' + token } })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error?.message || 'Não foi possível carregar os alertas de agendamento.');
        if (!cancelled) setAppointmentAlerts(body as AppointmentAlertSummary);
      })
      .catch(error => { if (!cancelled) setApiError(error instanceof Error ? error.message : 'Falha ao carregar alertas de agendamento.'); })
      .finally(() => { if (!cancelled) setAppointmentAlertsLoading(false); });
    return () => { cancelled = true; };
  }, [token, alertAttendantFilter, alertKindFilter]);

  useEffect(() => {
    if (!apiBase || !token) { setValidationSummary(null); return; }
    let cancelled = false;
    setValidationLoading(true);
    fetch(apiBase + '/api/v1/mapa/validations', { headers: { Authorization: 'Bearer ' + token } })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error?.message || 'Não foi possível validar os campos obrigatórios.');
        if (!cancelled) setValidationSummary(body as ValidationSummary);
      })
      .catch(error => { if (!cancelled) setApiError(error instanceof Error ? error.message : 'Falha na validação operacional.'); })
      .finally(() => { if (!cancelled) setValidationLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  async function persistPreferences(next: {visibleKeys?: string[]; savedViews?: SavedView[]}) {
    if (!apiBase || !token) return;
    try {
      const response = await fetch(apiBase + '/api/v1/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ visibleKeys: next.visibleKeys ?? visibleKeys, columnOrder: next.visibleKeys ?? visibleKeys, savedViews: next.savedViews ?? savedViews, cellStyles }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message || 'Não foi possível salvar as preferências.');
      setNotice('Preferências salvas na sua conta.');
    } catch (error) { setApiError(error instanceof Error ? error.message : 'Falha ao salvar preferências.'); }
  }
  useEffect(() => {
    if (!apiBase || !token) return;
    let cancelled = false;
    Promise.all([
      fetch(apiBase + '/api/v1/preferences', { headers: { Authorization: 'Bearer ' + token } }),
      fetch(apiBase + '/api/v1/auth/profile', { headers: { Authorization: 'Bearer ' + token } })
    ]).then(async ([preferencesResponse, profileResponse]) => {
      const preferencesBody = await preferencesResponse.json().catch(() => ({}));
      const profileBody = await profileResponse.json().catch(() => ({}));
      if (!preferencesResponse.ok || !profileResponse.ok) return;
      if (cancelled) return;
      const preferences = preferencesBody.preferences || {};
      if (Array.isArray(preferences.visibleKeys)) { setVisibleKeys(preferences.visibleKeys); localStorage.setItem(preferenceKey, JSON.stringify(preferences.visibleKeys)); }
      if (Array.isArray(preferences.savedViews)) setSavedViews(preferences.savedViews);
      if (preferences.cellStyles && typeof preferences.cellStyles === 'object') setCellStyles(preferences.cellStyles as Record<string, CellStyle>);
      if (preferences.rowStyles && typeof preferences.rowStyles === 'object') setRowStyles(preferences.rowStyles as Record<string, CellStyle>);
      if (preferences.columnStyles && typeof preferences.columnStyles === 'object') setColumnStyles(preferences.columnStyles as Record<string, CellStyle>);
      if (profileBody.user) { setProfile(profileBody.user); setProfileName(profileBody.user.name); setProfileEmail(profileBody.user.email); }
    }).catch(() => {});
    if (userRole === 'ADMIN') fetch(apiBase + '/api/v1/users', { headers: { Authorization: 'Bearer ' + token } }).then(async response => {
      const body = await response.json().catch(() => ({})); if (!cancelled && response.ok) setUsers(Array.isArray(body.items) ? body.items : []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [token, userKey, userRole, preferenceKey]);
  function reorderColumn(sourceKey: string, targetKey: string) {
    if (sourceKey === targetKey) return;
    setVisibleKeys(previous => {
      const ordered = [...previous]; const from = ordered.indexOf(sourceKey); const to = ordered.indexOf(targetKey);
      if (from < 0 || to < 0) return previous;
      ordered.splice(from, 1); ordered.splice(to, 0, sourceKey);
      localStorage.setItem(preferenceKey, JSON.stringify(ordered)); void persistPreferences({visibleKeys: ordered}); return ordered;
    });
  }
  function styleKey(row: RecordRow, column: Column) { return row.id + ':' + column.key; }
  function effectiveCellStyle(row: RecordRow, column: Column): CellStyle {
    // Cell > row > column, so specific formatting takes precedence.
    return { ...(columnStyles[column.key] || {}), ...(rowStyles[row.id] || {}),
      ...(cellStyles[styleKey(row, column)] || {}) };
  }
  const selectedStyle = selectionMode === 'row' && selectedRowId ? rowStyles[selectedRowId] || {} :
    selectionMode === 'column' && selectedColumnKey ? columnStyles[selectedColumnKey] || {} :
    selectedCell ? effectiveCellStyle(selectedCell.row, selectedCell.column) : {} ;
  const canFormatSelection = Boolean(token && userRole !== 'CONSULTA' &&
    (selectedCell || (selectionMode === 'column' && selectedColumnKey)));
  function updateSelectedStyle(change: CellStyle) {
    if (!canFormatSelection) return;
    let nextCellStyles = cellStyles, nextRowStyles = rowStyles, nextColumnStyles = columnStyles;
    let scope = 'célula';
    if (selectionMode === 'column' && selectedColumnKey) {
      nextColumnStyles = { ...columnStyles,
        [selectedColumnKey]: { ...(columnStyles[selectedColumnKey] || {}), ...change } };
      setColumnStyles(nextColumnStyles);
      scope = 'coluna';
    } else if (selectionMode === 'row' && selectedRowId) {
      nextRowStyles = { ...rowStyles,
        [selectedRowId]: { ...(rowStyles[selectedRowId] || {}), ...change } };
      setRowStyles(nextRowStyles);
      scope = 'linha';
    } else if (selectedCell) {
      const key = styleKey(selectedCell.row, selectedCell.column);
      nextCellStyles = { ...cellStyles, [key]: { ...(cellStyles[key] || {}), ...change } };
      setCellStyles(nextCellStyles);
    }
    localStorage.setItem(styleStorageKey, JSON.stringify({
      rowStyles: nextRowStyles, columnStyles: nextColumnStyles
    }));
    // Preferences are UI formatting, never modifications of operational rows.
    void (async () => {
      try {
        const response = await fetch(apiBase + '/api/v1/preferences', {
          method: 'PUT', headers: {'Content-Type':'application/json',Authorization:'Bearer '+token},
          body: JSON.stringify({ visibleKeys, columnOrder: visibleKeys, savedViews,
            cellStyles: nextCellStyles, rowStyles: nextRowStyles, columnStyles: nextColumnStyles })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error?.message || 'Ainda não é possível sincronizar a formatação.');
        setNotice('Formatação da ' + scope + ' salva na sua conta.');
      } catch {
        setNotice('Formatação aplicada à ' + scope + ' neste navegador. A sincronização depende da atualização da API.');
      }
    })();
  }
  async function saveCurrentView() {
    const name = viewName.trim();
    if (!name) { setApiError('Digite um nome para o filtro personalizado.'); return; }
    const next = [...savedViews.filter(view => view.name.toLocaleLowerCase('pt-BR') !== name.toLocaleLowerCase('pt-BR')), { name, visibleKeys, query, status }];
    setSavedViews(next); setViewName(''); setApiError(''); await persistPreferences({savedViews: next, visibleKeys});
  }
  function applyView(view: SavedView) {
    setVisibleKeys(view.visibleKeys.filter(key => columns.some(column => column.key === key)));
    setQuery(view.query); setStatus(view.status); setPage(1);
    localStorage.setItem(preferenceKey, JSON.stringify(view.visibleKeys)); void persistPreferences({visibleKeys:view.visibleKeys});
  }
  async function openHistory(row: RecordRow, column: Column) {
    setHistoryTarget({row, column}); setHistoryItems([]); setHistoryLoading(true);
    try {
      const response = await fetch(apiBase + '/api/v1/mapa/' + encodeURIComponent(row.id) + '/history?field=' + encodeURIComponent(column.key), {headers:{Authorization:'Bearer '+token}});
      const body = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(body?.error?.message || 'Não foi possível consultar o histórico.');
      setHistoryItems(Array.isArray(body.items) ? body.items as AuditEntry[] : []);
    } catch(error) { setApiError(error instanceof Error ? error.message : 'Falha ao consultar histórico.'); }
    finally { setHistoryLoading(false); }
  }
  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const response = await fetch(apiBase + '/api/v1/auth/profile', {method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({name:profileName,email:profileEmail,...(newPassword?{currentPassword,newPassword}:{})})});
      const body=await response.json().catch(()=>({})); if(!response.ok) throw new Error(body?.error?.message || 'Não foi possível atualizar o perfil.');
      setProfile(body.user); setProfileName(body.user.name); setProfileEmail(body.user.email); setCurrentPassword(''); setNewPassword(''); setNotice('Seu cadastro foi atualizado.');
    } catch(error) {setApiError(error instanceof Error ? error.message : 'Falha ao atualizar perfil.');}
  }
  async function createUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const response=await fetch(apiBase+'/api/v1/users',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({name:newUserName,email:newUserEmail,password:newUserPassword,role:newUserRole,active:true})});
      const body=await response.json().catch(()=>({})); if(!response.ok) throw new Error(body?.error?.message || 'Não foi possível criar usuário.');
      setUsers(previous=>[...previous,body.user].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')));setNewUserName('');setNewUserEmail('');setNewUserPassword('');setNewUserRole('CONSULTA');setNotice('Usuário criado com sucesso.');
    } catch(error) {setApiError(error instanceof Error ? error.message : 'Falha ao criar usuário.');}
  }
  async function updateUser(user: UserAdminItem, changes: Record<string, unknown>) {
    try {
      const response=await fetch(apiBase+'/api/v1/users/'+encodeURIComponent(user.id),{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(changes)});
      const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.error?.message || 'Não foi possível atualizar usuário.');
      setUsers(previous=>previous.map(item=>item.id===user.id?{...item,...body.user,pendingApproval:false}:item));setNotice('Cadastro de usuário atualizado.');
    } catch(error) {setApiError(error instanceof Error ? error.message : 'Falha ao atualizar usuário.');}
  }
  async function requestAccess(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setApiError('');
    if (!apiBase) { setApiError('A URL da API não está configurada nesta prévia.'); return; }
    setLoading(true);
    try {
      // Confirm the deployed backend supports registration before sending any
      // personal data or creating an account; the production API may be older.
      const capabilitiesResponse = await fetch(apiBase + '/api/v1/auth/capabilities', { cache: 'no-store' });
      const capabilities = await capabilitiesResponse.json().catch(() => ({}));
      if (!capabilitiesResponse.ok || capabilities.requestAccess !== true || capabilities.approvalRequired !== true) {
        throw new Error('A API do Render ainda não confirmou suporte à solicitação de acesso. A nova tela está disponível, mas a API correspondente precisa ser homologada e publicada pelo administrador. Nenhum cadastro foi enviado.');
      }
      const response = await fetch(apiBase + '/api/v1/auth/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: requestName.trim(), email: requestEmail.trim(), password: requestPassword })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status >= 500) throw new Error('A API apresentou um erro interno ao processar o cadastro (HTTP ' + response.status + '). O responsável pelo Render deve verificar os logs; a solicitação não foi confirmada.');
        throw new Error(body?.error?.message || 'Não foi possível registrar a solicitação (HTTP ' + response.status + ').');
      }
      setRequestPassword('');
      setRequestSent(true);
    } catch (error) {
      setApiError(error instanceof TypeError
        ? 'Não foi possível conectar à API. Confira a conexão no diagnóstico abaixo. A versão do Render pode não estar atualizada.'
        : error instanceof Error ? error.message : 'Falha ao solicitar acesso.');
    } finally { setLoading(false); }
  }
  async function checkApiConnection() {
    if (!apiBase) { setConnectionStatus('VITE_API_URL não foi configurada nesta versão.'); return; }
    setConnectionStatus('Verificando a conexão...');
    try {
      const response = await fetch(apiBase + '/api/v1/health', { cache: 'no-store', signal: AbortSignal.timeout(30000) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.status !== 'ok') throw new Error('Resposta inesperada do servidor (HTTP ' + response.status + ').');
      const capabilitiesResponse = await fetch(apiBase + '/api/v1/auth/capabilities', { cache: 'no-store' });
      const capabilities = await capabilitiesResponse.json().catch(() => ({}));
      setConnectionStatus(capabilitiesResponse.ok && capabilities.requestAccess === true
        ? 'API acessível; a versão do backend declara suporte a solicitações de acesso. Isso não confirma a gravação no banco.'
        : 'API de saúde acessível, mas o cadastro de novos usuários ainda não está disponível ou o backend precisa ser atualizado no Render.');
    } catch (error) {
      setConnectionStatus(error instanceof Error && error.name === 'TimeoutError'
        ? 'A API não respondeu em 30 segundos. Confira o serviço no Render.'
        : 'Não foi possível acessar a API pelo navegador. Verifique rede, bloqueio CORS, URL configurada e status do Render.');
    }
  }
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setApiError('');
    if (!apiBase) {
      setApiError('A API não está configurada nesta versão. Atualize VITE_API_URL no Vercel e gere uma nova prévia.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(apiBase + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message || ('Falha no login (HTTP ' + response.status + ').'));
      sessionStorage.setItem('mapa-costalog-token', body.token);
      sessionStorage.setItem('mapa-costalog-user', body.user?.id || body.user?.email || 'usuario');
      sessionStorage.setItem('mapa-costalog-role', body.user?.role || 'CONSULTA');
      setUserKey(body.user?.id || body.user?.email || 'usuario');
      setUserRole(body.user?.role || 'CONSULTA');
      setToken(body.token); setPassword('');
      setNotice('Conectado como ' + (body.user?.name || body.user?.email || 'usuário autorizado') + '.');
    } catch (error) {
      setApiError(error instanceof TypeError
        ? 'Não foi possível conectar à API. Pode ser uma falha de rede ou a origem desta prévia ainda não estar liberada pela API. Tente novamente em instantes.'
        : error instanceof Error ? error.message : 'Falha no login.');
    } finally { setLoading(false); }
  }
  function logout() {
    sessionStorage.removeItem('mapa-costalog-token'); sessionStorage.removeItem('mapa-costalog-user'); sessionStorage.removeItem('mapa-costalog-role');
    setUserRole(''); setToken(''); setRows([]); setNotice('Sessão encerrada.');
  }
  function toggleColumn(key: string) {
    setVisibleKeys(previous => {
      const next = previous.includes(key) ? previous.filter(item => item !== key) : [...previous, key];
      localStorage.setItem(preferenceKey, JSON.stringify(next)); void persistPreferences({visibleKeys:next}); return next;
    });
  }
  async function createRow() {
    if (!apiBase || !token) return;
    setLoading(true); setApiError('');
    try {
      const response = await fetch(apiBase + '/api/v1/mapa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ data: {} })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message || 'Não foi possível criar o registro.');
      setQuery(''); setStatus(''); setPage(1);
      setRows(previous => [body.item as RecordRow, ...previous]);
      setTotal(previous => previous + 1);
      setNotice('Novo registro criado. Preencha as colunas diretamente na grade.');
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Falha ao criar registro.');
    } finally { setLoading(false); }
  }
  async function applyBulkEdit() {
    const column = editableColumns.find(item => item.key === bulkColumn);
    if (!column || !selectedRows.length || !apiBase || !token) return;
    const trimmed = bulkValue.trim();
    const parsedValue: unknown = trimmed === '' ? null :
      (column.dataType === 'number' || column.dataType === 'currency' ? Number(trimmed.replace(',', '.')) :
      column.dataType === 'boolean' ? ['true','sim','1','yes'].includes(trimmed.toLocaleLowerCase('pt-BR')) : trimmed);
    if ((column.dataType === 'number' || column.dataType === 'currency') && trimmed !== '' && !Number.isFinite(parsedValue as number)) {
      setApiError('Valor inválido para a coluna ' + column.label + '.'); return;
    }
    if (column.dataType === 'boolean' && trimmed !== '' && !['true','false','sim','não','nao','1','0','yes','no'].includes(trimmed.toLocaleLowerCase('pt-BR'))) {
      setApiError('Para campo lógico, use Sim/Não ou Verdadeiro/Falso.'); return;
    }
    setBulkBusy(true); setApiError('');
    const succeeded: RecordRow[] = []; const failures: string[] = [];
    try {
      for (const row of selectedRows) {
        if (valueText(row.data?.[column.key]) === valueText(parsedValue)) continue;
        try {
          const response = await fetch(apiBase + '/api/v1/mapa/' + encodeURIComponent(row.id), {
            method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ changes: { [column.key]: parsedValue }, expectedUpdatedAt: row.updatedAt })
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body?.error?.message || 'Falha ao salvar');
          succeeded.push(body.item as RecordRow);
        } catch (error) { failures.push('Registro #' + row.sequence + ': ' + (error instanceof Error ? error.message : 'falha')); }
      }
      if (succeeded.length) setRows(previous => previous.map(row => succeeded.find(updated => updated.id === row.id) || row));
      setSelectedRowIds(failures.length ? selectedRows.filter(row => failures.some(message => message.startsWith('Registro #' + row.sequence + ':'))).map(row => row.id) : []);
      setNotice('Edição em massa: ' + succeeded.length + ' registro(s) atualizado(s)' + (failures.length ? '; ' + failures.length + ' falha(s).' : '. Cada alteração foi registrada no histórico.'));
      if (failures.length) setApiError(failures.slice(0, 5).join(' · ') + (failures.length > 5 ? ' · e outras falhas.' : ''));
      else setBulkOpen(false);
    } finally { setBulkBusy(false); }
  }
  async function saveCell(row: RecordRow, column: Column, value: string): Promise<boolean> {
    if (!apiBase || !token || !column.editable || userRole === 'CONSULTA') return false;
    const previousValue = valueText(row.data?.[column.key]);
    if (value === previousValue) return true;
    const parsed = LOCKED_COLUMN_FORMAT[column.key]
      ? parseSheetValue(value,LOCKED_COLUMN_FORMAT[column.key])
      : parseEditableValue(column.dataType, value);
    if (!parsed.ok) {
      setApiError(parsed.message + ' na coluna ' + column.label + '.');
      return false;
    }
    // Apply the conditional row color immediately while the audited PATCH
    // is in flight. On failure, remove this preview and show the old color.
    if (column.key === 'C') {
      setPendingRowStatus(previous => ({
        ...previous, [row.id]: typeof parsed.value === 'string' ? parsed.value : ''
      }));
    }
    try {
      const response = await fetch(apiBase + '/api/v1/mapa/' + encodeURIComponent(row.id), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ changes: { [column.key]: parsed.value }, expectedUpdatedAt: row.updatedAt })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message || 'Não foi possível salvar.');
      setRows(previous => previous.map(item => item.id === row.id ? body.item as RecordRow : item));
      setNotice('Alteração salva no banco e registrada no histórico.');
      setApiError('');
      return true;
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Falha ao salvar.');
      setNotice('A alteração não foi confirmada. Atualize a tela antes de continuar.');
      return false;
    } finally {
      if (column.key === 'C') {
        setPendingRowStatus(previous => {
          const next = { ...previous }; delete next[row.id]; return next;
        });
      }
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target && (target.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(target.tagName)));
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault(); searchInputRef.current?.focus(); searchInputRef.current?.select();
      } else if (event.key === 'Escape' && !typing) {
        setQuery(''); setFilterColumn(''); setFilterValue(''); setStatus(''); setPage(1);
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'n' && active === 'MAPA 1.0' && userRole !== 'CONSULTA') {
        event.preventDefault(); void createRow();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, userRole, apiBase, token]);
  const visibleColumns = useMemo(() => columns.filter(c => visibleKeys.includes(c.key)).sort((a,b) => visibleKeys.indexOf(a.key)-visibleKeys.indexOf(b.key)), [columns, visibleKeys]);
  // When backend filtering is available, values are filtered before pagination.
  // On an older API, the same selection works over the loaded page only.
  const displayedRows = useMemo(() => {
    const filtered = rows.filter(row => {
      const values = Object.values(row.data || {}).map(valueText).join(' ') + ' ' + [row.status,row.clientName,row.container,row.cte].map(valueText).join(' ');
      const matchesGlobal = values.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'));
      const matchesSelectedColumn = !filterColumn || valueText(row.data?.[filterColumn]).toLocaleLowerCase('pt-BR').includes(filterValue.toLocaleLowerCase('pt-BR'));
      const matchesEachColumn = matchesColumnFilters(row.data || {}, columnFilters);
      return matchesGlobal && matchesSelectedColumn && matchesEachColumn;
    });
    if (!sortConfig) return filtered;
    return [...filtered].sort((a,b) => {
      const av = valueText(a.data?.[sortConfig.key]).trim(); const bv = valueText(b.data?.[sortConfig.key]).trim();
      const an = Number(av.replace(/\\./g,'').replace(',','.')); const bn = Number(bv.replace(/\\./g,'').replace(',','.'));
      const bothNumeric = av !== '' && bv !== '' && Number.isFinite(an) && Number.isFinite(bn);
      const compared = bothNumeric ? an-bn : av.localeCompare(bv,'pt-BR',{numeric:true,sensitivity:'base'});
      return sortConfig.direction === 'asc' ? compared : -compared;
    });
  }, [rows, query, filterColumn, filterValue, columnFilters, visibleColumns, sortConfig]);


  const windowed = useMemo(() => virtualRowWindow(
    displayedRows.map(row => rowHeights[row.id] || 35),
    gridViewport.scrollTop,
    gridViewport.height
  ), [displayedRows, rowHeights, gridViewport.scrollTop, gridViewport.height]);
  const visibleRenderedRows = displayedRows.slice(windowed.start,windowed.end);
  function handleGridScroll(event: React.UIEvent<HTMLDivElement>) {
    const node=event.currentTarget;
    setGridViewport({scrollTop:node.scrollTop,height:node.clientHeight});
    if (lastRequestedPageRef.current === page + 1) return;
    if (page >= Math.ceil(total / pageSize)) return;
    if (shouldLoadNextBatch({
      scrollTop:node.scrollTop,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight,
      loadedCount:rows.length,total,busy:loading||creatingRows
    })) {
      lastRequestedPageRef.current=page+1;
      setPage(value=>value+1);
    }
  }
  function toggleSidebar() {
    setSidebarCollapsed(previous=>{
      localStorage.setItem('mapa-costalog-sidebar-collapsed',previous?'no':'yes');
      return !previous;
    });
  }
  function beginRowResize(event: React.PointerEvent<HTMLSpanElement>, row: RecordRow) {
    if(event.button!==0)return;
    event.preventDefault();event.stopPropagation();
    const currentHeight=event.currentTarget.closest('tr')?.getBoundingClientRect().height ||
      rowHeights[row.id] || 35;
    const startY=event.clientY;
    const move=(ev:PointerEvent)=>{
      const height=normalizeRowHeight(currentHeight+ev.clientY-startY);
      setRowHeights(previous=>({...previous,[row.id]:height}));
    };
    const end=()=>{
      window.removeEventListener('pointermove',move);
      window.removeEventListener('pointerup',end);
      // The persisted state is only a per-user visual preference.
      setRowHeights(previous=>{localStorage.setItem(rowHeightStorageKey,JSON.stringify(previous));return previous;});
    };
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',end,{once:true});
  }
  function beginRangeDrag(event:React.PointerEvent<HTMLTableCellElement>,ri:number,ci:number) {
    if(event.button!==0 || (event.target as HTMLElement).closest('input,select,button,textarea,[data-cell-editor]'))return;
    event.preventDefault();
    selectionDragRef.current=true;
    dragInfoRef.current={row:ri,column:ci,x:event.clientX,y:event.clientY,moved:false};
    if(editingCell)setEditingCell(null);
    selectGridCell(ri,ci,event.shiftKey,false);
    const stop=()=>{selectionDragRef.current=false;dragInfoRef.current=null;
      window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);};
    window.addEventListener('pointerup',stop,{once:true});
    window.addEventListener('pointercancel',stop,{once:true});
  }
  function extendRangeDrag(ri:number,ci:number) {
    if(!selectionDragRef.current)return;
    if(dragInfoRef.current)dragInfoRef.current.moved=true;
    selectGridCell(ri,ci,true,false);
  }
  function finishRangeDrag(ri:number,ci:number) {
    const info=dragInfoRef.current;
    if(!info || !selectionDragRef.current || info.moved || info.row!==ri || info.column!==ci)return;
    const row=displayedRows[ri],column=visibleColumns[ci];
    if(row&&column&&column.editable&&userRole!=='CONSULTA'&&
      !isCheckboxColumn(column.key,column.dataType))beginCellEdit(ri,ci);
  }

  const localFilterOptions = useMemo(() => {
    if (!openFilterKey) return [];
    return uniqueFilterValues(
      rows.filter(row => matchesColumnFilters(row.data || {}, columnFilters, openFilterKey))
        .map(row => row.data || {}), openFilterKey, filterSearch
    );
  }, [rows, columnFilters, openFilterKey, filterSearch]);
  const shownFilterOptions = filterOptionsNote.startsWith('Todos os registros')
    ? filterOptions : localFilterOptions;
  const filteredFilterOptions = shownFilterOptions.filter(value =>
    value.toLocaleLowerCase('pt-BR').includes(filterSearch.toLocaleLowerCase('pt-BR')));
  function showColumnFilter(event: React.MouseEvent<HTMLElement>, column: Column) {
    const rect = event.currentTarget.getBoundingClientRect();
    setOpenFilterKey(current => current === column.key ? null : column.key);
    setFilterMenuRect({
      top: Math.min(window.innerHeight - 420, rect.bottom + 6),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 305))
    });
    setFilterSearch('');
    setFilterDraft(columnFilters[column.key]?.values || []);
    setFilterAllChosen(!columnFilters[column.key]);
    setFilterOptions([]);
    setFilterOptionsNote('');
  }
  function applyColumnFilter() {
    if (!openFilterKey) return;
    setColumnFilters(current => {
      const next = { ...current };
      if (filterAllChosen) delete next[openFilterKey];
      else next[openFilterKey] = { values: [...new Set(filterDraft)] };
      return next;
    });
    setPage(1);
    setOpenFilterKey(null);
  }
  function clearColumnFilter(key: string) {
    setColumnFilters(current => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setOpenFilterKey(null);
    setPage(1);
  }
  function chooseFilterAllVisible(select: boolean) {
    if (select) {
      setFilterDraft(current => [...new Set([...current, ...filteredFilterOptions])]);
      if (!filterSearch) setFilterAllChosen(true);
    } else {
      setFilterDraft(current => current.filter(value => !filteredFilterOptions.includes(value)));
      setFilterAllChosen(false);
    }
  }
  useEffect(() => {
    if (!openFilterKey || !apiBase || !token) return;
    const controller = new AbortController();
    setFilterOptionsLoading(true);
    const params = new URLSearchParams({ column: openFilterKey, search: filterSearch });
    fetch(apiBase + '/api/v1/mapa/filter-values?' + params, {
      headers: { Authorization: 'Bearer ' + token }, signal: controller.signal
    }).then(async res => {
      if (!res.ok) throw new Error('Filtro completo ainda não está publicado na API.');
      const body = await res.json();
      if (!Array.isArray(body.items)) throw new Error('Resposta inválida');
      setFilterOptions(body.items.map((item: unknown) => String(item)));
      setFilterOptionsNote('Todos os registros · até 250 opções por pesquisa' + (body.truncated ? ' · refine a pesquisa' : ''));
    }).catch(() => {
      if (!controller.signal.aborted) {
        setFilterOptionsNote('Prévia: valores da página carregada; atualização da API pendente.');
      }
    }).finally(() => {
      if (!controller.signal.aborted) setFilterOptionsLoading(false);
    });
    return () => controller.abort();
  }, [openFilterKey, filterSearch, token]);
  useEffect(() => {
    if (!openFilterKey) return;
    function handleClickOutside(e: MouseEvent) {
      if (!(e.target as HTMLElement)?.closest('.sheet-filter-popover, .sheet-filter-trigger')) {
        setOpenFilterKey(null);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openFilterKey]);
  // Keyboard/grid operations only inspect the currently loaded page and never
  // request hidden rows, bypass permissions or change operational data in tests.
  const selectedPosition = useMemo(() => {
    if (!selectedCell) return null;
    const row = displayedRows.findIndex(item => item.id === selectedCell.row.id);
    const column = visibleColumns.findIndex(item => item.key === selectedCell.column.key);
    return row >= 0 && column >= 0 ? { row, column } : null;
  }, [displayedRows, visibleColumns, selectedCell]);
  useEffect(() => { if (displayedRows.length > 0) setPlaceholderPosition(null); }, [displayedRows.length]);
  const selectedBounds = useMemo(() => {
    if (!displayedRows.length || !visibleColumns.length) return null;
    if (selectionMode === 'column' && selectedColumnKey) {
      const column = visibleColumns.findIndex(item => item.key === selectedColumnKey);
      return column < 0 ? null : {top:0,bottom:displayedRows.length-1,left:column,right:column};
    }
    if (selectionMode === 'row' && selectedRowId) {
      const row = displayedRows.findIndex(item => item.id === selectedRowId);
      return row < 0 ? null : {top:row,bottom:row,left:0,right:visibleColumns.length-1};
    }
    if (!selectedPosition) return null;
    const anchorRow = selectionAnchor ? displayedRows.findIndex(item => item.id === selectionAnchor.rowId) : -1;
    const anchorColumn = selectionAnchor ? visibleColumns.findIndex(item => item.key === selectionAnchor.columnKey) : -1;
    return selectionBounds(
      anchorRow >= 0 && anchorColumn >= 0 ? { row: anchorRow, column: anchorColumn } : selectedPosition,
      selectedPosition
    );
  }, [selectedPosition, selectionAnchor, displayedRows, visibleColumns,
      selectionMode, selectedRowId, selectedColumnKey]);

  function beginCellEdit(rowIndex: number, columnIndex: number, replacement?: string) {
    const row = displayedRows[rowIndex], column = visibleColumns[columnIndex];
    if (!row || !column || !token || userRole === 'CONSULTA' || !column.editable || editingBusyRef.current) return;
    // Boolean columns are edited directly through checkboxes, never a text editor.
    if (isCheckboxColumn(column.key, column.dataType)) return;
    setSelectionAnchor({ rowId: row.id, columnKey: column.key });
    setSelectionMode('cell');
    setSelectedRowId(null);
    setSelectedColumnKey(null);
    setSelectedCell({ row, column });
    setEditValue(replacement === undefined
      ? (column.key === 'A' ? toDateInput(row.data?.[column.key]) : valueText(row.data?.[column.key]))
      : replacement);
    setEditingCell({ rowId: row.id, columnKey: column.key });
  }

  async function finishCellEdit(row: RecordRow, column: Column, value: string,
    move?: { row: number; column: number }) {
    if (editingBusyRef.current) return;
    editingBusyRef.current = true;
    const success = await saveCell(row, column, value);
    editingBusyRef.current = false;
    if (success) {
      setEditingCell(null);
      setEditValue('');
      // Enter confirms and moves down; Tab confirms and moves right.
      // Focus only after the editor is removed from the DOM, so the next
      // keyboard action stays inside the grid (instead of leaving the table).
      if (move) selectGridCell(move.row, move.column, false, true);
      else {
        // Mouse dropdown confirmation leaves the cell selected and keyboard-ready.
        window.requestAnimationFrame(() => {
          const cell = Array.from(gridRef.current?.querySelectorAll<HTMLElement>('[data-cell-id]') || [])
            .find(item => item.dataset.cellId === row.id + ':' + column.key);
          cell?.focus({ preventScroll: true });
        });
      }
    } else {
      // Validation or API error: preserve the typed value and editor position.
      (editorRef.current || gridRef.current?.querySelector<HTMLInputElement>('[role="combobox"]'))?.focus();
    }
  }

  function selectGridCell(rowIndex: number, columnIndex: number, extend = false, moveFocus = false) {
    const row = displayedRows[rowIndex], column = visibleColumns[columnIndex];
    if (!row || !column) return;
    setSelectionMode('cell'); setSelectedRowId(null); setSelectedColumnKey(null);
    setPlaceholderPosition(null);
    if (!extend || !selectionAnchor) setSelectionAnchor({ rowId: row.id, columnKey: column.key });
    setSelectedCell({ row, column });
    if (moveFocus) {
      // The new focused element may not exist until React commits the selection.
      // Target its stable row/column identity, not a stale page index.
      window.requestAnimationFrame(() => {
        const target = Array.from(gridRef.current?.querySelectorAll<HTMLElement>('[data-cell-id]') || [])
          .find(item => item.dataset.cellId === row.id + ':' + column.key);
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    }
  }
  function selectEntireRow(rowIndex: number) {
    const row = displayedRows[rowIndex], firstColumn = visibleColumns[0];
    if (!row || !firstColumn) return;
    setOpenFilterKey(null);
    setSelectionMode('row'); setSelectedRowId(row.id); setSelectedColumnKey(null);
    setSelectionAnchor({rowId:row.id,columnKey:firstColumn.key});
    setSelectedCell({row,column:firstColumn});
    setEditingCell(null);
    gridRef.current?.focus({preventScroll:true});
  }
  function selectEntireColumn(column: Column) {
    setOpenFilterKey(null);
    setSelectionMode('column'); setSelectedColumnKey(column.key); setSelectedRowId(null);
    const firstRow = displayedRows[0];
    if (firstRow) {
      setSelectionAnchor({rowId:firstRow.id,columnKey:column.key});
      setSelectedCell({row:firstRow,column});
    } else { setSelectedCell(null); }
    setEditingCell(null);
    gridRef.current?.focus({preventScroll:true});
  }
  function onGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const element = event.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName) ||
      pasteBusy || editingCell) return;
    if (!selectedPosition && placeholderPosition && displayedRows.length === 0) {
      const action = gridKeyboardAction(event.key, false);
      if (action === 'move') {
        event.preventDefault();
        const next = moveGridPosition(placeholderPosition, event.key, 12, visibleColumns.length, event.shiftKey);
        setPlaceholderPosition(next);
        const target = gridRef.current?.querySelector<HTMLElement>(
          '[data-grid-empty-row="' + next.row + '"][data-grid-empty-column="' + next.column + '"]');
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } else if (action === 'edit' || (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1)) {
        event.preventDefault();
        setNotice('Esta linha é apenas visual. Clique em “Novo registro” para criar uma linha operacional antes de editar.');
      }
      return;
    }
    if (!selectedPosition) return;
    const keyboardColumn = visibleColumns[selectedPosition.column];
    const keyboardRow = displayedRows[selectedPosition.row];
    if (event.key === ' ' && keyboardColumn && keyboardRow &&
        isCheckboxColumn(keyboardColumn.key, keyboardColumn.dataType)) {
      event.preventDefault();
      if (keyboardColumn.editable && userRole !== 'CONSULTA') {
        void saveCell(keyboardRow, keyboardColumn,
          checkboxSaveText(!checkboxChecked(keyboardRow.data?.[keyboardColumn.key])));
      }
      return;
    }
    if (gridKeyboardAction(event.key, false) === 'edit') {
      event.preventDefault();
      beginCellEdit(selectedPosition.row, selectedPosition.column);
      return;
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) {
      event.preventDefault();
      beginCellEdit(selectedPosition.row, selectedPosition.column, event.key);
      return;
    }
    if (gridKeyboardAction(event.key, false) !== 'move') return;
    event.preventDefault();
    const next = moveGridPosition(selectedPosition, event.key, displayedRows.length, visibleColumns.length, event.shiftKey);
    selectGridCell(next.row, next.column, event.shiftKey && event.key.startsWith('Arrow'), true);
  }
  function selectedGridText(): string {
    if (!selectedBounds) return '';
    return serializeSelection(selectedBounds, (row, column) =>
      valueText(displayedRows[row]?.data?.[visibleColumns[column]?.key]));
  }
  function onGridCopy(event: React.ClipboardEvent<HTMLDivElement>) {
    if (!selectedBounds || window.getSelection()?.toString()) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', selectedGridText());
  }
  async function copyGridSelection() {
    if (!selectedBounds) return;
    try {
      await navigator.clipboard.writeText(selectedGridText());
      setNotice('Seleção copiada para a área de transferência.');
    } catch { setApiError('Não foi possível copiar. Selecione a célula e utilize Ctrl+C.'); }
  }
  function onGridPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const element = event.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) return;
    event.preventDefault();
    if (userRole === 'CONSULTA') { setApiError('Seu perfil permite apenas consultar a planilha.'); return; }
    if (!selectedPosition || pasteBusy) {
      if (placeholderPosition) setApiError('A linha selecionada é apenas visual. Crie um registro antes de colar.');
      return;
    }
    const matrix = parseClipboardGrid(event.clipboardData.getData('text/plain'));
    if (!canPasteMatrix(matrix, selectedPosition, displayedRows.length, visibleColumns.length, 200) ||
        matrix[0].length > 40) {
      setApiError('A colagem deve caber na página atual, ser retangular e conter no máximo 200 células (até 40 colunas por linha).');
      return;
    }
    for (let offset = 0; offset < matrix[0].length; offset++) {
      if (!visibleColumns[selectedPosition.column + offset]?.editable) {
        setApiError('A seleção inclui coluna protegida. Nenhuma alteração foi aplicada.');
        return;
      }
    }
    for (let row = 0; row < matrix.length; row++) for (let column = 0; column < matrix[row].length; column++) {
      const definition = visibleColumns[selectedPosition.column + column];
      const parsed = LOCKED_COLUMN_FORMAT[definition.key]
        ? parseSheetValue(matrix[row][column],LOCKED_COLUMN_FORMAT[definition.key])
        : parseEditableValue(definition.dataType, matrix[row][column]);
      if (!parsed.ok) {
        setApiError('Colagem inválida na coluna ' + definition.label + ': ' + parsed.message + '. Nenhuma alteração foi aplicada.');
        return;
      }
    }
    setApiError('');
    setPastePreview({ matrix, start: selectedPosition });
  }
  async function applyGridPaste() {
    if (!pastePreview || pasteBusy || !token || userRole === 'CONSULTA') return;
    const { matrix, start } = pastePreview;
    if (!canPasteMatrix(matrix, start, displayedRows.length, visibleColumns.length, 200)) return;
    setPasteBusy(true);
    let updated = 0;
    try {
      // One audited PATCH per row, sequentially, with optimistic concurrency.
      for (let i = 0; i < matrix.length; i++) {
        const row = displayedRows[start.row + i];
        const changes: Record<string, string | number | boolean | null> = {};
        for (let j = 0; j < matrix[i].length; j++) {
          const column = visibleColumns[start.column + j];
          if (!column?.editable) throw new Error('A colagem inclui coluna protegida.');
          const parsed = LOCKED_COLUMN_FORMAT[column.key]
            ? parseSheetValue(matrix[i][j],LOCKED_COLUMN_FORMAT[column.key])
            : parseEditableValue(column.dataType, matrix[i][j]);
          if (!parsed.ok) throw new Error('Valor inválido em ' + column.label + '.');
          if (valueText(row.data?.[column.key]) !== matrix[i][j]) changes[column.key] = parsed.value;
        }
        if (!Object.keys(changes).length) continue;
        const response = await fetch(apiBase + '/api/v1/mapa/' + encodeURIComponent(row.id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ changes, expectedUpdatedAt: row.updatedAt })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error?.message || 'Falha ao salvar a linha #' + row.sequence);
        setRows(previous => previous.map(item => item.id === row.id ? body.item as RecordRow : item));
        updated++;
      }
      setNotice('Colagem concluída: ' + updated + ' linha(s) atualizada(s), com histórico de auditoria.');
      setApiError('');
    } catch (error) {
      setApiError('Colagem interrompida após ' + updated + ' linha(s) salva(s): ' +
        (error instanceof Error ? error.message : 'Erro de gravação') + '. Atualize a grade antes de tentar novamente.');
    } finally {
      setPasteBusy(false);
      setPastePreview(null);
    }
  }
  function beginColumnResize(event: React.PointerEvent<HTMLSpanElement>, column: Column) {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const th = event.currentTarget.closest('th');
    const startWidth = th?.getBoundingClientRect().width || 180;
    const startX = event.clientX;
    const onMove = (move: PointerEvent) => {
      const width = Math.max(90, Math.min(520, Math.round(startWidth + move.clientX - startX)));
      setColumnWidths(previous => ({ ...previous, [column.key]: width }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setColumnWidths(previous => {
        localStorage.setItem(widthKey, JSON.stringify(previous));
        return previous;
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }

  async function createManyRows() {
    const count=normalizeCreateCount(newRowsCount);
    if(!count||!apiBase||!token||creatingRows||userRole==='CONSULTA') {
      setApiError('Informe de 1 a 100 linhas e confira suas permissões.');return;
    }
    if(!window.confirm('Criar '+count+' linhas vazias no MAPA? Elas serão registros reais na API conectada.'))return;
    setCreatingRows(true);setApiError('');
    try{
      const response=await fetch(apiBase+'/api/v1/mapa/batch-blank',{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
        body:JSON.stringify({count})
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(response.status===404
        ? 'A API conectada ainda não suporta a criação de várias linhas. Habilite a API de homologação.'
        : body?.error?.message||'Não foi possível criar as linhas.');
      setNewRowsOpen(false);setPage(1);lastRequestedPageRef.current=0;
      setRows([]);setRetryRowsKey(previous=>previous+1);
      if(gridRef.current)gridRef.current.scrollTop=0;
      setNotice(count+' linhas criadas com histórico de auditoria.');
    }catch(error){setApiError(error instanceof Error?error.message:'Falha na criação.');}
    finally{setCreatingRows(false);}
  }

  if (!token) {
    return <main className="auth-layout">
      <div className="auth-intro">
        <div className="auth-brand"><span className="auth-logo"><Truck size={28}/></span><div><strong>MAPA COSTALOG</strong><small>GESTÃO OPERACIONAL</small></div></div>
        <div className="auth-intro-copy"><span className="auth-eyebrow">AMBIENTE CORPORATIVO</span><h1>Controle logístico com acesso seguro.</h1><p>Operações, agendamentos e registros em um só lugar, com permissões individuais e histórico de alterações.</p></div>
        <small className="auth-intro-foot">Acesso exclusivo a usuários autorizados pela Costalog.</small>
      </div>
      <section className="auth-content">
        <div className="auth-card">
          <div className="auth-card-heading">
            <span className="auth-eyebrow">BEM-VINDO</span>
            <h2>{authScreen === 'login' ? 'Entrar no sistema' : 'Solicitar acesso'}</h2>
            <p>{authScreen === 'login' ? 'Utilize seu e-mail e senha cadastrados.' : 'Seu cadastro será avaliado por um administrador antes de qualquer acesso.'}</p>
          </div>
          <div className="auth-tabs" role="tablist" aria-label="Tipo de acesso">
            <button type="button" role="tab" aria-selected={authScreen === 'login'} className={authScreen === 'login' ? 'selected' : ''} onClick={() => { setAuthScreen('login'); setApiError(''); setConnectionStatus(''); }}>Entrar</button>
            <button type="button" role="tab" aria-selected={authScreen === 'request'} className={authScreen === 'request' ? 'selected' : ''} onClick={() => { setAuthScreen('request'); setApiError(''); setConnectionStatus(''); }}>Solicitar acesso</button>
          </div>
          {authScreen === 'login' ? <form className="auth-form" onSubmit={login}>
            <label>E-mail<input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@empresa.com.br" /></label>
            <label>Senha<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha" /></label>
            <button className="primary auth-submit" disabled={loading || !apiBase} type="submit">{loading ? 'Conectando...' : 'Entrar no MAPA COSTALOG'}</button>
          </form> : requestSent ? <div className="auth-success" role="status">
            <strong>Solicitação enviada</strong>
            <p>Se seu cadastro for elegível, ele ficará aguardando análise do administrador. Confirme seu acesso com a equipe responsável; nenhuma conta é liberada automaticamente.</p>
            <button className="secondary" onClick={() => { setAuthScreen('login'); setRequestSent(false); setApiError(''); }} type="button">Voltar ao login</button>
          </div> : <form className="auth-form" onSubmit={requestAccess}>
            <label>Nome completo<input required minLength={2} maxLength={120} autoComplete="name" value={requestName} onChange={e => setRequestName(e.target.value)} placeholder="Nome e sobrenome" /></label>
            <label>E-mail corporativo<input type="email" required maxLength={254} autoComplete="email" value={requestEmail} onChange={e => setRequestEmail(e.target.value)} placeholder="nome@empresa.com.br" /></label>
            <label>Senha para seu futuro acesso<input type="password" minLength={12} maxLength={200} required autoComplete="new-password" value={requestPassword} onChange={e => setRequestPassword(e.target.value)} placeholder="Pelo menos 12 caracteres" /></label>
            <p className="auth-note"><ShieldCheck size={16}/> Sua conta ficará inativa até que o administrador confirme sua identidade e aprove o cadastro.</p>
            <button className="primary auth-submit" type="submit" disabled={loading || !apiBase}>{loading ? 'Enviando...' : 'Enviar solicitação'}</button>
          </form>}
          {apiError && <div className="auth-error" role="alert">{apiError}</div>}
          {!apiBase && <div className="auth-error" role="alert">Esta prévia não tem VITE_API_URL configurada. A equipe técnica precisa corrigir o ambiente.</div>}
          <div className="auth-diagnostics">
            <button type="button" className="auth-diagnostic-button" onClick={() => void checkApiConnection()}>Testar conexão com a API</button>
            {connectionStatus && <p role="status">{connectionStatus}</p>}
            {apiBase && <a href={apiBase + '/api/v1/health'} target="_blank" rel="noreferrer">Abrir verificação da API</a>}
          </div>
        </div>
        <small className="auth-copyright">MAPA COSTALOG · Plataforma de uso interno</small>
      </section>
    </main>;
  }
  return <div className={'app-shell ' + (sidebarCollapsed ? 'sidebar-collapsed' : '') +
      (active === 'MAPA 1.0' ? ' map-fullscreen' : '')}>
    <aside className="sidebar">
      <button type="button" className="sidebar-hide-button" title="Recolher menu"
        aria-label="Recolher menu lateral" onClick={toggleSidebar}>☰</button>
      <div className="brand"><div className="brand-mark"><Truck size={22}/></div><div><strong>COSTALOG</strong><span>OPERAÇÕES</span></div></div>
      <div className="workspace"><span className="workspace-dot"/> MAPA operacional <ChevronDown size={15}/></div>
      <div className="nav-label">MENU PRINCIPAL</div>
      <nav>{nav.map(item => <button key={item.name} className={`nav-item ${active === item.name ? 'active' : ''}`} onClick={() => setActive(item.name)}><item.icon size={18}/><span>{item.name}</span>{item.name === 'MAPA 1.0' && <span className="nav-count">{columns.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="connection"><span className="connection-dot"/> {apiBase && token ? 'Conectado à API' : 'API não conectada'}</div><div className="user"><div className="avatar">C</div><div><b>Costalog</b><small>{token ? 'Usuário autenticado' : 'Acesso operacional'}</small></div><Settings2 size={17}/></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><button type="button" className="sidebar-toggle" title={sidebarCollapsed?'Mostrar menu':'Ocultar menu'}
          aria-label={sidebarCollapsed?'Mostrar menu lateral':'Ocultar menu lateral'}
          aria-expanded={!sidebarCollapsed} onClick={toggleSidebar}><Menu size={18}/></button>
        <div className="breadcrumbs">Operações <span>/</span> <b>{active}</b></div><div className="top-actions">{token && <button className="secondary" onClick={logout}><LogOut size={15}/> Sair</button>}<button className="icon-button" title="Notificações"><Bell size={18}/></button><div className="avatar small">C</div></div></header>
      <section className={'content ' + (active === 'MAPA 1.0' ? 'map-content' : '')}>
        {active !== 'MAPA 1.0' && <div className="page-heading"><div><div className="eyebrow">CENTRAL DE OPERAÇÕES</div><h1>{active}</h1><p>Grade operacional completa, com colunas configuráveis para cada usuário.</p></div></div>}
        {active !== 'MAPA 1.0' && <div className="notice"><ClipboardList size={17}/><span>{apiBase ? (token ? notice : 'Entre com sua conta para acessar os dados reais.') : 'Configure VITE_API_URL para conectar a aplicação à API. Nenhum dado fictício será exibido.'}</span></div>}
        {apiBase && !token && <form className="panel login-panel" onSubmit={login}><div><h2>Acessar MAPA COSTALOG</h2><p>Entre com seu usuário autorizado.</p></div><div className="login-fields"><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-mail corporativo" autoComplete="username"/><input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha" autoComplete="current-password"/><button className="primary" disabled={loading}>{loading ? 'Conectando...' : 'Entrar'}</button></div>{apiError && <p className="api-error">{apiError}</p>}</form>}
        {apiBase && apiError && token && <div className="notice api-error"><span>{apiError}</span><button onClick={logout}>Fazer login novamente</button></div>}
        {active === 'Visão geral' && <section className="workspace-page">
          <div className="section-intro"><span className="eyebrow">INDICADORES DA OPERAÇÃO</span><h2>Visão geral da operação</h2><p>Indicadores consolidados diretamente do banco de dados, sem estimativas.</p></div>
          {!token ? <div className="empty-state">Entre com sua conta autorizada para consultar os indicadores reais.</div> : <>
            <div className="overview-grid"><div className="overview-card"><span>Registros ativos</span><strong>{dashboardLoading ? '…' : (dashboardSummary?.activeRecords ?? '—')}</strong><small>Exclui registros arquivados</small></div><div className="overview-card"><span>Atualizados nos últimos 7 dias</span><strong>{dashboardLoading ? '…' : (dashboardSummary?.recentlyUpdated ?? '—')}</strong><small>Atividade recente</small></div><div className="overview-card"><span>Colunas configuradas</span><strong>{columns.length}</strong><small>Estrutura MAPA 1.0</small></div></div>
            <div className="overview-grid"><div className={'overview-card ' + ((appointmentAlerts?.total || 0) > 0 ? 'validation-warning' : 'validation-ok')}><span>Agendamentos vencidos</span><strong>{appointmentAlertsLoading ? '…' : (appointmentAlerts?.total ?? '—')}</strong><small>Coletas e primeiras entregas pendentes</small></div><div className="overview-card"><span>Coletas vencidas</span><strong>{appointmentAlertsLoading ? '…' : (appointmentAlerts?.byKind?.collection ?? '—')}</strong><small>Conferência conforme AU ou AV</small></div><div className="overview-card"><span>Entregas vencidas</span><strong>{appointmentAlertsLoading ? '…' : (appointmentAlerts?.byKind?.delivery ?? '—')}</strong><small>Primeira entrega, conforme AW</small></div><div className={'overview-card ' + ((validationSummary?.items.length || 0) > 0 ? 'validation-warning' : 'validation-ok')}><span>Campos obrigatórios pendentes</span><strong>{validationLoading ? '…' : (validationSummary ? validationSummary.items.reduce((sum,item)=>sum+item.missing,0) : '—')}</strong><small>Soma de pendências por campo; um registro pode ter mais de uma</small></div></div>
            <div className="panel validation-panel"><div className="panel-heading"><div><h2>Distribuição por status</h2><p>Até 12 status com mais registros ativos.</p></div><button className="secondary" disabled={dashboardLoading} onClick={()=>{setDashboardLoading(true);fetch(apiBase + '/api/v1/dashboard/summary',{headers:{Authorization:'Bearer '+token}}).then(async response=>{const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.error?.message||'Falha ao atualizar indicadores.');setDashboardSummary(body as DashboardSummary);setApiError('');}).catch(error=>setApiError(error instanceof Error?error.message:'Falha ao atualizar painel.')).finally(()=>setDashboardLoading(false));}}>Atualizar indicadores</button></div>
              {dashboardSummary?.statuses?.length ? <div className="status-grid">{dashboardSummary.statuses.map(item=><button className="status-card" key={item.status} disabled={item.status === 'Sem status'} title={item.status === 'Sem status' ? 'O filtro de registros sem status ainda não está disponível.' : 'Abrir registros deste status'} onClick={()=>{setStatus(item.status);setPage(1);setActive('MAPA 1.0')}}><span className="status-indicator"/><b>{item.status}</b><strong>{item.count}</strong><small>Ver registros</small></button>)}</div> : <div className="empty-state">{dashboardLoading ? 'Carregando indicadores…' : 'Não há registros ativos com status para exibir.'}</div>}
              {dashboardSummary && <p className="validation-footnote">Atualizado em {new Date(dashboardSummary.generatedAt).toLocaleString('pt-BR')}. Os indicadores refletem os dados disponíveis no banco no momento da consulta.</p>}
            </div>
          </>}
          <div className="panel validation-panel"><div className="panel-heading"><div><h2>Pendências que precisam de atenção</h2><p>Alertas baseados nos campos obrigatórios configurados, sem criar prazos presumidos.</p></div><button className="secondary" onClick={()=>setActive('Status operacional')}>Ver todas</button></div>
            {!token ? <div className="empty-state">Entre para consultar as pendências reais.</div> : validationLoading && !validationSummary ? <div className="empty-state">Verificando pendências…</div> : validationSummary?.items.length ? <div className="validation-list">{validationSummary.items.slice(0,4).map(item=><div className="validation-row" key={item.key}><div className="validation-icon"><Bell size={17}/></div><div className="validation-field"><b>{item.label}</b><small>Campo obrigatório incompleto</small></div><strong>{item.missing}</strong><span>registro(s)</span></div>)}</div> : <div className="empty-state">{validationSummary ? 'Nenhuma pendência de campo obrigatório encontrada.' : 'Aguardando a validação dos dados.'}</div>}
          </div>
          <div className="panel validation-panel"><div className="panel-heading"><div><h2>Agendamentos vencidos</h2><p>Coletas e entregas com data/hora do agendamento já passada e sem registro do marco operacional correspondente. Responsável conforme o campo ATENDENTE.</p></div><button className="secondary" disabled={appointmentAlertsLoading} onClick={()=>{setAppointmentAlertsLoading(true);fetch(apiBase + '/api/v1/dashboard/appointment-alerts'+(()=>{const params=new URLSearchParams();if(alertAttendantFilter!=='Todos')params.set('attendant',alertAttendantFilter);if(alertKindFilter!=='Todos')params.set('kind',alertKindFilter);return params.size?'?'+params.toString():''})(),{headers:{Authorization:'Bearer '+token}}).then(async response=>{const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.error?.message||'Falha ao atualizar alertas.');setAppointmentAlerts(body as AppointmentAlertSummary);setApiError('');}).catch(error=>setApiError(error instanceof Error?error.message:'Falha ao atualizar alertas.')).finally(()=>setAppointmentAlertsLoading(false));}}>Atualizar alertas</button></div>
            {appointmentAlerts && appointmentAlerts.total > 0 && <div className="toolbar" role="group" aria-label="Filtrar alertas"><button className={alertKindFilter==='Todos'?'primary':'secondary'} onClick={()=>{setAlertKindFilter('Todos');setShowAllAppointmentAlerts(false);}}>Todos ({appointmentAlerts.total})</button><button className={alertKindFilter==='Coleta'?'primary':'secondary'} onClick={()=>{setAlertKindFilter('Coleta');setShowAllAppointmentAlerts(false);}}>Coletas ({appointmentAlerts.byKind?.collection ?? appointmentAlerts.items.filter(item=>item.kind==='Coleta').length})</button><button className={alertKindFilter==='Entrega'?'primary':'secondary'} onClick={()=>{setAlertKindFilter('Entrega');setShowAllAppointmentAlerts(false);}}>Entregas ({appointmentAlerts.byKind?.delivery ?? appointmentAlerts.items.filter(item=>item.kind==='Entrega').length})</button><label className="filter-control">Atendente <select value={alertAttendantFilter} onChange={event=>{setAlertAttendantFilter(event.target.value);setShowAllAppointmentAlerts(false);}}><option value="Todos">Todos</option>{(appointmentAlerts.attendants || Array.from(new Set(appointmentAlerts.items.map(item=>item.attendant).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'pt-BR'))).map(attendant=><option key={attendant} value={attendant}>{attendant}</option>)}</select></label></div>}
            {!token ? <div className="empty-state">Entre para consultar os agendamentos reais.</div> : appointmentAlertsLoading && !appointmentAlerts ? <div className="empty-state">Verificando agendamentos…</div> : appointmentAlerts?.items.length ? <div className="validation-list">{appointmentAlerts.items.filter(item=>(alertKindFilter==='Todos'||item.kind===alertKindFilter)&&(alertAttendantFilter==='Todos'||item.attendant===alertAttendantFilter)).slice(0,showAllAppointmentAlerts ? 100 : 8).map(item=><div className="validation-row" key={item.id + item.kind}><div className="validation-icon"><Bell size={17}/></div><div className="validation-field"><b>#{item.sequence} · {item.kind}</b><small>{item.clientName || 'Cliente não informado'}{item.container ? ' · '+item.container : ''}{item.cte ? ' · CT-e '+item.cte : ''}</small><small>Agendado: {new Date(item.scheduledAt).toLocaleString('pt-BR')} · Atendente: {item.attendant}</small></div><strong>{item.minutesLate >= 60 ? Math.floor(item.minutesLate/60)+' h' : item.minutesLate+' min'}</strong><button className="secondary" onClick={()=>{setQuery(item.container || item.cte || item.clientName || '');setStatus('');setFilterColumn('');setFilterValue('');setPage(1);setActive('MAPA 1.0')}}>Abrir</button></div>)}</div> : <div className="empty-state">{appointmentAlerts ? 'Nenhum agendamento vencido encontrado com os campos disponíveis.' : 'Aguardando consulta dos agendamentos.'}</div>}
            {appointmentAlerts && <p className="validation-footnote">Análise em {new Date(appointmentAlerts.generatedAt).toLocaleString('pt-BR')}. Total de alertas: {appointmentAlerts.total}. {showAllAppointmentAlerts ? 'Exibindo até 100 alertas para o filtro atual.' : 'Exibindo os 8 primeiros alertas do filtro atual.'} Nenhuma data foi alterada.</p>}
            {appointmentAlerts && (appointmentAlerts.filteredTotal ?? appointmentAlerts.items.length) > 8 && <button className="secondary" onClick={()=>setShowAllAppointmentAlerts(value=>!value)}>{showAllAppointmentAlerts ? 'Mostrar menos' : `Ver todos os ${Math.min(appointmentAlerts.filteredTotal ?? appointmentAlerts.items.length,100)} alertas`}</button>}
          </div>
          <div className="panel quick-panel"><div><h3>Acesso rápido</h3><p>Consulte e edite os registros operacionais na grade.</p></div><button className="primary" onClick={()=>setActive('MAPA 1.0')}><Table2 size={16}/> Abrir MAPA 1.0</button></div>
        </section>}
        {active === 'Status operacional' && <section className="workspace-page">
          <div className="section-intro"><span className="eyebrow">ACOMPANHAMENTO</span><h2>Status e validações operacionais</h2><p>Consulte os status existentes e identifique campos obrigatórios ainda não preenchidos nos registros ativos.</p></div>
          <div className="validation-summary-grid">
            <div className="overview-card"><span>Registros ativos analisados</span><strong>{validationLoading ? '…' : (validationSummary?.totalRows ?? '—')}</strong><small>Sem registros arquivados</small></div>
            <div className="overview-card"><span>Campos obrigatórios</span><strong>{validationSummary?.requiredFields ?? '—'}</strong><small>Conforme configuração das colunas</small></div>
            <div className={'overview-card ' + ((validationSummary?.items.length || 0) > 0 ? 'validation-warning' : 'validation-ok')}><span>Campos com pendências</span><strong>{validationLoading ? '…' : (validationSummary?.items.length ?? '—')}</strong><small>{validationSummary ? (validationSummary.items.length ? 'Precisam de conferência' : 'Nenhuma pendência encontrada') : 'Aguardando validação'}</small></div>
          </div>
          <div className="panel validation-panel"><div className="panel-heading"><div><h2>Campos obrigatórios incompletos</h2><p>A contagem é calculada no servidor sobre todos os registros ativos.</p></div><button className="secondary" disabled={validationLoading || !token} onClick={()=>{setValidationLoading(true);fetch(apiBase + '/api/v1/mapa/validations',{headers:{Authorization:'Bearer '+token}}).then(async response=>{const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.error?.message||'Falha ao atualizar validação.');setValidationSummary(body as ValidationSummary);setApiError('');}).catch(error=>setApiError(error instanceof Error?error.message:'Falha na validação.')).finally(()=>setValidationLoading(false));}}>Atualizar validação</button></div>
            {!token ? <div className="empty-state">Entre com sua conta para validar os dados reais.</div> : validationLoading && !validationSummary ? <div className="empty-state">Analisando os campos obrigatórios…</div> : validationSummary?.items.length ? <div className="validation-list">{validationSummary.items.map(item=><div className="validation-row" key={item.key}><div className="validation-icon"><Activity size={17}/></div><div className="validation-field"><b>{item.label}</b><small>Coluna {item.key} · {item.dataType}</small></div><strong>{item.missing}</strong><span>registro(s) sem preenchimento</span></div>)}</div> : <div className="empty-state">{validationSummary ? 'Nenhum campo obrigatório incompleto foi encontrado.' : 'A validação ainda não foi executada.'}</div>}
            {validationSummary && <p className="validation-footnote">Última análise: {new Date(validationSummary.checkedAt).toLocaleString('pt-BR')}. Esta verificação usa apenas colunas marcadas como obrigatórias; regras de prazo ainda precisam ser configuradas conforme o processo da operação.</p>}
          </div>
          <div className="section-intro status-section-intro"><h2>Status dos registros</h2><p>Selecione um status para abrir os registros correspondentes.</p></div>
          <div className="status-grid">{Array.from(new Set(rows.map(row=>row.status).filter((value): value is string=>Boolean(value)))).sort().map(value=><button className="status-card" key={value} onClick={()=>{setStatus(value);setPage(1);setActive('MAPA 1.0')}}><span className="status-indicator"/><b>{value}</b><small>Ver registros com este status</small></button>)}</div>
          {rows.every(row=>!row.status) && <div className="empty-state">Não há status preenchidos nos registros carregados.</div>}
          <button className="secondary" onClick={()=>{setStatus('');setActive('MAPA 1.0')}}>Limpar filtro e abrir grade</button>
        </section>}
        {active === 'Cadastros' && <BaseCatalogSheet userRole={userRole} apiBase={apiBase} token={token} onOpenMapa={() => setActive('MAPA 1.0')} />}

        {active === 'Minha conta' && <section className="workspace-page"><div className="section-intro"><span className="eyebrow">CONTA PESSOAL</span><h2>Meu cadastro</h2><p>Atualize seu nome, e-mail e senha.</p></div><form className="panel profile-form" onSubmit={saveProfile}><label>Nome completo<input required minLength={2} value={profileName} onChange={event=>setProfileName(event.target.value)}/></label><label>E-mail<input required type="email" value={profileEmail} onChange={event=>setProfileEmail(event.target.value)}/></label><div className="profile-role">Perfil de acesso <strong>{profile?.role||userRole||'—'}</strong><small>Permissões são alteradas por um administrador.</small></div><div className="password-section"><h3>Alterar senha (opcional)</h3><label>Senha atual<input type="password" autoComplete="current-password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)} required={Boolean(newPassword)}/></label><label>Nova senha<input type="password" minLength={10} autoComplete="new-password" value={newPassword} onChange={event=>setNewPassword(event.target.value)} placeholder="Mínimo de 10 caracteres"/></label></div><button className="primary" type="submit"><Save size={15}/> Salvar meu cadastro</button></form></section>}
        {active === 'Usuários' && <section className="workspace-page"><div className="section-intro"><span className="eyebrow">ADMINISTRAÇÃO</span><h2>Usuários e permissões</h2><p>Crie contas, altere perfis e bloqueie acessos.</p></div>{userRole!=='ADMIN'?<div className="empty-state">Esta área é exclusiva para administradores.</div>:<><form className="panel create-user-form" onSubmit={createUser}><h3>Novo usuário</h3><div className="user-form-grid"><label>Nome<input required minLength={2} value={newUserName} onChange={event=>setNewUserName(event.target.value)}/></label><label>E-mail<input required type="email" value={newUserEmail} onChange={event=>setNewUserEmail(event.target.value)}/></label><label>Senha inicial<input required type="password" minLength={10} value={newUserPassword} onChange={event=>setNewUserPassword(event.target.value)}/></label><label>Perfil<select value={newUserRole} onChange={event=>setNewUserRole(event.target.value)}><option value="CONSULTA">Consulta</option><option value="OPERACAO">Operação</option><option value="SUPERVISOR">Supervisor</option><option value="ADMIN">Administrador</option></select></label></div><button className="primary" type="submit"><Plus size={15}/> Criar usuário</button></form><div className="panel users-table-panel"><div className="panel-heading"><div><h2>Usuários cadastrados</h2><p>{users.length} conta(s) · {users.filter(item=>item.pendingApproval).length} solicitação(ões) pendente(s)</p></div></div><div className="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{users.map(item=><tr key={item.id}><td>{item.name}</td><td>{item.email}</td><td><select value={item.role} disabled={item.id===profile?.id} onChange={event=>void updateUser(item,{role:event.target.value})}><option value="CONSULTA">Consulta</option><option value="OPERACAO">Operação</option><option value="SUPERVISOR">Supervisor</option><option value="ADMIN">Administrador</option></select></td><td><span className={item.active?'feature-state connected':'feature-state'}>{item.active?'Ativo':item.pendingApproval?'Pendente':'Bloqueado'}</span></td><td><button className="secondary" disabled={item.id===profile?.id} onClick={()=>{if(item.pendingApproval && !window.confirm('Você confirmou a identidade e o e-mail desta pessoa antes de liberar o acesso?')) return; void updateUser(item,{active:!item.active});}}>{item.active?'Bloquear':item.pendingApproval?'Aprovar acesso':'Reativar'}</button></td></tr>)}</tbody></table></div></div></>}</section>}
        {active === 'Integrações' && <section className="workspace-page">
          <div className="section-intro"><span className="eyebrow">CONEXÕES DO SISTEMA</span><h2>Integrações</h2><p>Estado de acesso aos recursos centrais do MAPA COSTALOG.</p></div>
          <div className="feature-list"><div className="feature-row"><div className="feature-icon"><Waypoints size={19}/></div><div><b>API MAPA COSTALOG</b><p>{apiBase || 'Endereço da API não configurado no frontend.'}</p></div><span className={apiBase && token ? 'feature-state connected' : 'feature-state'}>{apiBase && token ? 'Sessão ativa' : 'Sem sessão'}</span></div><div className="feature-row"><div className="feature-icon"><Activity size={19}/></div><div><b>Banco de dados</b><p>Registros consultados pela API e armazenados no PostgreSQL/Supabase.</p></div><span className="feature-state">{token ? 'Acesso autenticado' : 'Aguardando login'}</span></div><div className="notice"><ClipboardList size={17}/><span>Sincronizações externas adicionais ainda precisam ser implementadas e testadas.</span></div></div>
        </section>}
        {active === 'MAPA 1.0' && <>
        <section className="panel mapa-grid-panel">
          <div className="panel-heading compact-map-heading"><div><h2><Table2 size={19}/> MAPA 1.0</h2><p>Planilha operacional · edite as células autorizadas diretamente na grade.</p></div><div className="panel-actions">{token && userRole !== 'CONSULTA' && <>
        <button className="primary" disabled={loading||creatingRows} onClick={()=>void createRow()} title="Inserir uma linha">
          <Plus size={16}/> Nova linha</button>
        <button className="secondary" onClick={()=>setNewRowsOpen(value=>!value)} disabled={creatingRows}
          title="Adicionar várias linhas de uma vez"><Plus size={14}/> Várias linhas</button>
      </>}<button className="secondary" onClick={()=>setColumnMenu(value=>!value)}><Columns3 size={16}/> Escolher colunas ({visibleColumns.length})</button></div></div>
          {newRowsOpen && <div className="sheet-add-many">
            <label>Adicionar linhas <input type="number" min={1} max={100} step={1}
              aria-label="Número de linhas para criar" value={newRowsCount}
              onChange={event=>setNewRowsCount(Number(event.target.value))}/></label>
            <button className="primary" disabled={creatingRows||!normalizeCreateCount(newRowsCount)}
              onClick={()=>void createManyRows()}>{creatingRows?'Adicionando…':'Adicionar '+newRowsCount+' linhas'}</button>
            <button className="secondary" onClick={()=>setNewRowsOpen(false)}>Cancelar</button>
            <small>Até 100 por operação · registros reais somente após confirmar</small>
          </div>}
          {columnMenu && <div className="column-picker"><div className="column-picker-actions"><b>Colunas exibidas e sequência</b><button className="secondary" onClick={()=>{const all=columns.map(c=>c.key);setVisibleKeys(all);localStorage.setItem(preferenceKey,JSON.stringify(all));void persistPreferences({visibleKeys:all});}}>Mostrar todas</button><button className="secondary" onClick={()=>{const defaults=columns.filter(c=>c.visible).map(c=>c.key);setVisibleKeys(defaults);localStorage.setItem(preferenceKey,JSON.stringify(defaults));void persistPreferences({visibleKeys:defaults});}}>Restaurar padrão</button></div><div className="column-options">{[...columns].sort((a,b)=>{const ai=visibleKeys.indexOf(a.key),bi=visibleKeys.indexOf(b.key);return ai<0?(bi<0?a.position-b.position:1):bi<0?-1:ai-bi}).map(column=><div className={"column-option "+(draggedColumn===column.key?"dragging":"")} key={column.key} draggable onDragStart={()=>setDraggedColumn(column.key)} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(draggedColumn)reorderColumn(draggedColumn,column.key);setDraggedColumn(null)}} onDragEnd={()=>setDraggedColumn(null)}><GripVertical size={15} className="drag-handle"/><input type="checkbox" checked={visibleKeys.includes(column.key)} onChange={()=>toggleColumn(column.key)}/><span>{column.label || '(coluna sem título)'}</span></div>)}</div><div className="saved-view-tools"><button className="secondary" onClick={()=>setShowViewTools(value=>!value)}><Filter size={14}/> Filtros personalizados</button>{showViewTools&&<div className="saved-view-editor"><div className="saved-view-save"><input value={viewName} onChange={event=>setViewName(event.target.value)} placeholder="Nome da configuração"/><button className="primary" onClick={()=>void saveCurrentView()}><Save size={14}/> Salvar filtro</button></div>{savedViews.map(view=><div className="saved-view-item" key={view.name}><button onClick={()=>applyView(view)}>{view.name}</button><small>{view.visibleKeys.length} colunas · {view.status||'Todos os status'}{view.query?' · busca: '+view.query:''}</small><button title="Excluir filtro" onClick={()=>{const next=savedViews.filter(item=>item.name!==view.name);setSavedViews(next);void persistPreferences({savedViews:next});}}><X size={14}/></button></div>)}</div>}</div></div>}<div className="toolbar"><div className="searchbox"><Search size={16}/><input ref={searchInputRef} value={query} onChange={e=>{setPage(1);setQuery(e.target.value)}} placeholder="Buscar em todos os campos..."/></div><div className="select-wrap"><Filter size={16}/><select value={status} onChange={e=>{setPage(1);setStatus(e.target.value)}}><option value="">Todos os status</option>{Array.from(new Set(rows.map(row=>row.status).filter((value): value is string=>Boolean(value)))).sort().map(value=><option key={value} value={value}>{value}</option>)}</select></div><div className="select-wrap"><Columns3 size={16}/><select aria-label="Filtrar por coluna" value={filterColumn} onChange={e=>{setPage(1);setFilterColumn(e.target.value)}}><option value="">Todas as colunas</option>{columns.map(column=><option key={column.key} value={column.key}>{column.label || column.key}</option>)}</select></div><input aria-label="Valor do filtro de coluna" className="column-filter-input" value={filterValue} onChange={e=>{setPage(1);setFilterValue(e.target.value)}} placeholder="Valor da coluna..."/><button className="secondary" onClick={()=>{setFilterColumn('');setFilterValue('');setColumnFilters({});setPage(1)}} disabled={!filterColumn&&!filterValue&&!Object.keys(columnFilters).length}>Limpar filtro</button><button className="secondary" disabled={!selectedCell} onClick={()=>selectedCell&&void openHistory(selectedCell.row,selectedCell.column)}><History size={14}/> Histórico da célula selecionada</button><button className="secondary" disabled={!canFormatSelection} title="Negrito na célula, linha ou coluna selecionada" onClick={()=>updateSelectedStyle({bold:!selectedStyle.bold})}><Bold size={14}/> Negrito</button><SheetColorPicker kind="text" value={selectedStyle.color||'#47584E'} disabled={!canFormatSelection}
  onSelect={color=>updateSelectedStyle({color})}/>
<SheetColorPicker kind="background" value={selectedStyle.background||'#FFFFFF'} disabled={!canFormatSelection}
  onSelect={background=>updateSelectedStyle({background})}/>
<select className="sheet-format-select" aria-label="Formato da seleção" title="Formatar célula, linha ou coluna"
  value={selectedCell?.column.key === 'A' ? 'date' :
    selectedCell?.column.key === 'Q' ? 'currency' : (selectedStyle.format||'text')}
  disabled={!canFormatSelection || (selectionMode === 'cell' && (selectedCell?.column.key==='A'||selectedCell?.column.key==='Q'))}
  onChange={event=>updateSelectedStyle({format:event.target.value as SheetNumberFormat})}>
  <option value="text">Texto</option><option value="number">Número</option>
  <option value="currency">Moeda (R$)</option><option value="date">Data</option>
</select>
<select className="sheet-format-select" aria-label="Alinhamento da seleção" title="Alinhar texto"
  value={selectedStyle.align||'left'} disabled={!canFormatSelection}
  onChange={event=>updateSelectedStyle({align:event.target.value as 'left'|'center'|'right'})}>
  <option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option>
</select>
<button className="secondary" type="button" title="Limpar formatação da seleção"
  disabled={!canFormatSelection} onClick={()=>updateSelectedStyle({
    bold:false,color:'#47584E',background:'#FFFFFF',align:'left',format:'text'
  })}>Limpar formato</button>{token && userRole!=='CONSULTA' && <><button className="secondary" onClick={()=>setSelectedRowIds(previous=>Array.from(new Set([...previous,...displayedRows.map(row=>row.id)])))} disabled={!displayedRows.length}>Selecionar página</button><button className="secondary" onClick={()=>setSelectedRowIds([])} disabled={!selectedRowIds.length}>Limpar seleção ({selectedRowIds.length})</button><button className="primary" onClick={()=>setBulkOpen(true)} disabled={!selectedRowIds.length}><Save size={14}/> Editar selecionados</button></>}<span className="rows-count">{total} registros</span></div>
          <div className="sheet-action-strip">
            <span className="sheet-address">{selectionMode === 'column' && selectedColumnKey ? 'Coluna ' + selectedColumnKey :
              selectionMode === 'row' && selectedCell ? 'Linha ' + selectedCell.row.sequence :
              selectedPosition ? visibleColumns[selectedPosition.column].key + displayedRows[selectedPosition.row].sequence :
              placeholderPosition && visibleColumns[placeholderPosition.column]
                ? visibleColumns[placeholderPosition.column].key + (placeholderPosition.row + 1) + ' (visual)'
                : 'Selecione uma célula'}</span>
            <span className="sheet-guide" aria-hidden="true"></span>
            <button className="secondary" type="button" disabled={!selectedBounds} onClick={() => void copyGridSelection()}>Copiar seleção</button>
            <div className="sheet-status-guide">
              <button className="secondary" type="button" aria-expanded={showStatusColors}
                onClick={() => setShowStatusColors(current => !current)}>Cores por status (C) ▾</button>
              {showStatusColors && <div className="sheet-status-legend" role="group" aria-label="Padrões de cores por status">
                {STATUS_COLORS.map(rule => <div key={rule.status} className="sheet-status-legend-item">
                  <span className="sheet-status-swatch" style={{backgroundColor:rule.background}}/>
                  <span>{rule.status}</span><code>{rule.background}</code>
                </div>)}
              </div>}
            </div>
          </div>
          <div className="table-wrap sheet-grid-wrap" ref={gridRef} tabIndex={0} onKeyDown={onGridKeyDown} onCopy={onGridCopy} onPaste={onGridPaste}
            onScroll={handleGridScroll}>
            <table className="sheet-table" role="grid" aria-label="MAPA 1.0 - planilha operacional">
              <colgroup>
                <col style={{width: 65}} />
                {visibleColumns.map(column => <col key={column.key} style={{width: columnWidths[column.key] || 180}} />)}
              </colgroup>
              <thead>
                <tr>
                  <th className="sheet-row-header">
                    {userRole !== 'CONSULTA' && <input type="checkbox" aria-label="Selecionar todos os registros desta página"
                      checked={displayedRows.length > 0 && displayedRows.every(row => selectedRowIds.includes(row.id))}
                      onChange={event => setSelectedRowIds(previous => event.target.checked
                        ? Array.from(new Set([...previous, ...displayedRows.map(row => row.id)]))
                        : previous.filter(id => !displayedRows.some(row => row.id === id)))} />}
                    <span>#</span>
                  </th>
                  {visibleColumns.map(column => <th key={column.key} className={'sheet-column-header ' + (selectionMode==='column' && selectedColumnKey===column.key ? 'sheet-column-selected' : '')} scope="col">
                    <div className="sheet-column-title">
                      <button className="sheet-column-key sheet-column-select" type="button"
                        aria-label={'Selecionar coluna inteira ' + column.key}
                        title={'Selecionar toda a coluna ' + column.key} onClick={()=>selectEntireColumn(column)}>{column.key}</button>
                      <button className={'sheet-filter-trigger ' + (columnFilters[column.key] ? 'filter-active' : '')}
                        type="button" title={'Filtrar e ordenar ' + column.label}
                        aria-label={'Abrir filtro da coluna ' + (column.label || column.key)}
                        aria-expanded={openFilterKey === column.key}
                        onClick={event => showColumnFilter(event, column)}>
                        <span className="sheet-header-name">{column.label || '(sem título)'}</span>
                        <span aria-hidden="true">{columnFilters[column.key] ? '▼' : '▾'}</span>
                      </button>
                    </div>
                    <span className="sheet-resize-handle" role="separator" aria-label={'Ajustar largura de ' + column.label}
                      title="Arraste para ajustar a largura" onPointerDown={event => beginColumnResize(event, column)} />
                  </th>)}
                </tr>
              </thead>
              <tbody>
                {windowed.top > 0 && <tr className="sheet-virtual-spacer" aria-hidden="true">
                  <td colSpan={visibleColumns.length+1} style={{height:windowed.top,padding:0,border:0}}/>
                </tr>}
                {visibleRenderedRows.map((row, index) => {
                  const ri=windowed.start+index;
                  const conditionalBackground = statusRowColor(
                    Object.prototype.hasOwnProperty.call(pendingRowStatus, row.id)
                      ? pendingRowStatus[row.id] : (row.data?.C ?? row.status)
                  );
                  const conditionalTextColor = conditionalBackground ? statusRowTextColor(conditionalBackground) : undefined;
                  return <tr key={row.id} className={selectedRowIds.includes(row.id) ? 'bulk-selected-row' : ''}
                    style={{height:normalizeRowHeight(rowHeights[row.id]||35)}}
                    data-status={String(row.data?.C ?? row.status ?? '')}>
                  <th scope="row" className={'sheet-row-number '+ (selectionMode === 'row' && selectedRowId===row.id ? 'sheet-row-selected' : '')}>
                    {userRole !== 'CONSULTA' && <input type="checkbox" aria-label={'Marcar registro ' + row.sequence + ' para edição em massa'}
                      checked={selectedRowIds.includes(row.id)}
                      title="Marcar registro para edição em massa"
                      onChange={event => setSelectedRowIds(previous => event.target.checked
                        ? [...previous.filter(id => id !== row.id), row.id]
                        : previous.filter(id => id !== row.id))} />}
                    <button className="sheet-row-select" type="button"
                      title={'Selecionar toda a linha ' + row.sequence}
                      aria-label={'Selecionar linha inteira ' + row.sequence}
                      onClick={()=>selectEntireRow(ri)}>{row.sequence}</button>
                    <span className="sheet-row-resize-handle" role="separator"
                      aria-label={'Arrastar para ajustar altura da linha '+row.sequence}
                      title="Arraste para mudar a altura da linha"
                      onPointerDown={event=>beginRowResize(event,row)}/>
                  </th>
                  {visibleColumns.map((column, ci) => {
                    const selected = selectionMode === 'cell' && selectedPosition?.row === ri && selectedPosition.column === ci;
                    const inRange = Boolean(selectedBounds && ri >= selectedBounds.top && ri <= selectedBounds.bottom &&
                      ci >= selectedBounds.left && ci <= selectedBounds.right);
                    const editable = Boolean(token && userRole !== 'CONSULTA' && column.editable);
                    const lookup = Boolean(BASE_COLUMN_LIST[column.key]);
                    const checkbox = isCheckboxColumn(column.key, column.dataType);
                    const style = effectiveCellStyle(row,column);
                    const displayFormat = LOCKED_COLUMN_FORMAT[column.key] ||
                      style.format || (column.dataType === 'currency' ? 'currency' :
                      column.dataType === 'date' ? 'date' : column.dataType === 'number' ? 'number' : 'text');
                    return <td key={column.key} aria-selected={inRange}
                      className={(editable ? 'editable-cell ' : '') + (lookup ? 'sheet-lookup-cell ' : '') +
                        (checkbox ? 'sheet-boolean-cell ' : '') + (inRange ? 'sheet-range-cell ' : '') +
                        (selected ? 'selected-cell ' : '')}
                      style={{fontWeight: style.bold ? 'bold' : 'normal',
                        color: style.color || conditionalTextColor,
                        textAlign: checkbox ? 'center' : (style.align || 'left'),
                        backgroundColor: conditionalBackground ?? style.background}}
                      onPointerDown={event=>beginRangeDrag(event,ri,ci)}
                      onPointerMove={event=>{
                        const info=dragInfoRef.current;
                        if(info && Math.hypot(event.clientX-info.x,event.clientY-info.y)>6)
                          info.moved=true;
                      }}
                      onPointerEnter={()=>extendRangeDrag(ri,ci)}
                      onPointerUp={()=>finishRangeDrag(ri,ci)}>
                      <div className="cell-content">
                        {checkbox ? (
                          <span className="sheet-boolean-wrapper"
                            data-grid-row={ri} data-grid-column={ci}
                            data-cell-id={row.id + ':' + column.key}
                            tabIndex={selected ? 0 : -1}
                            role="gridcell" aria-readonly={!editable}
                            aria-label={column.key + row.sequence + ': ' + column.label}>
                            <input type="checkbox"
                              className="sheet-value-checkbox"
                              aria-label={column.label + ' da linha ' + row.sequence}
                              title={editable ? 'Marcar ou desmarcar' : 'Somente leitura'}
                              checked={checkboxChecked(row.data?.[column.key])}
                              disabled={!editable}
                              onClick={event => event.stopPropagation()}
                              onChange={event => {
                                selectGridCell(ri, ci, false);
                                void saveCell(row, column, checkboxSaveText(event.target.checked));
                              }}/>
                          </span>
                        ) : editingCell?.rowId === row.id && editingCell.columnKey === column.key ? (
                          lookup ? <SheetDropdownEditor
                            columnKey={column.key} rowLabel={(column.label||column.key)+" linha "+row.sequence}
                            currentValue={valueText(row.data?.[column.key])} initialQuery={editValue}
                            fallbackOptions={rows.map(item=>valueText(item.data?.[column.key])).filter(Boolean)}
                            apiBase={apiBase} token={token}
                            onConfirm={(value,key,shift)=>{
                              const next=key?moveGridPosition({row:ri,column:ci},key,
                                displayedRows.length,visibleColumns.length,shift):undefined;
                              void finishCellEdit(row,column,value,next);
                            }}
                            onCancel={()=>{setEditingCell(null);setEditValue('');}}
                          /> : <input ref={editorRef} autoFocus className="sheet-cell-editor"
                            type={column.key === 'A' ? 'date' : 'text'}
                            inputMode={column.key === 'Q' ? 'decimal' : undefined}
                            data-cell-editor="true" aria-label={'Editar ' + column.key + row.sequence}
                            value={editValue} onChange={event => setEditValue(event.target.value)}
                            onClick={event => event.stopPropagation()}
                            onKeyDown={event => {
                              if (event.key === 'Escape') {
                                event.preventDefault(); event.stopPropagation();
                                setEditingCell(null); setEditValue('');
                                window.requestAnimationFrame(() => {
                                  gridRef.current?.querySelector<HTMLElement>(
                                    '[data-cell-id="' + row.id + ':' + column.key + '"]')?.focus({preventScroll:true});
                                });
                              } else if (event.key === 'Enter' || event.key === 'Tab') {
                                event.preventDefault(); event.stopPropagation();
                                const next = moveGridPosition({row:ri,column:ci}, event.key,
                                  displayedRows.length, visibleColumns.length, event.shiftKey);
                                void finishCellEdit(row, column, event.currentTarget.value, next);
                              }
                            }}
                            onBlur={event => {
                              if (!editingBusyRef.current) void finishCellEdit(row, column, event.currentTarget.value);
                            }}
                          />
                        ) : (
                          <span data-grid-row={ri} data-grid-column={ci}
                            data-cell-id={row.id + ':' + column.key} tabIndex={selected ? 0 : -1}
                            role="gridcell" aria-readonly={!editable}
                            aria-label={column.key + row.sequence + ': ' + (column.label || column.key)}
                            title={editable ? lookup
                              ? 'Clique para abrir as opções da BASE; digite para pesquisar. Enter confirma e desce; Tab confirma e vai à direita.'
                              : 'Clique para selecionar. Enter confirma e desce; Tab confirma e vai à direita; F2 ou duplo clique edita.'
                              : 'Somente leitura'}
>
                            {formatSheetValue(row.data?.[column.key],displayFormat)}
                          </span>
                        )}
                      </div>
                    </td>;
                  })}
                </tr>;
                })}
                {windowed.bottom > 0 && <tr className="sheet-virtual-spacer" aria-hidden="true">
                  <td colSpan={visibleColumns.length+1} style={{height:windowed.bottom,padding:0,border:0}}/>
                </tr>}
                {!loading && rows.length >= total && displayedRows.length < 35 &&
                  Array.from({length: EMPTY_GRID_ROWS - Math.min(EMPTY_GRID_ROWS,displayedRows.length)}, (_, index) =>
                  <tr className="sheet-placeholder-row" key={'placeholder-' + index} aria-label="Linha visual vazia, sem registro salvo">
                    <th scope="row" className="sheet-row-number">{displayedRows.length ? '＋' : index + 1}</th>
                    {visibleColumns.map((column, ci) => {
                      const chosen = placeholderPosition?.row === index && placeholderPosition.column === ci;
                      return <td key={column.key} className={'sheet-placeholder-cell ' + (chosen ? 'selected-cell' : '')}
                        aria-selected={chosen}
                        onClick={() => {
                          setSelectedCell(null);
                          setPlaceholderPosition({row:index,column:ci});
                          const element = gridRef.current?.querySelector<HTMLElement>(
                            '[data-grid-empty-row="' + index + '"][data-grid-empty-column="' + ci + '"]');
                          element?.focus({preventScroll:true});
                        }}>
                        <span data-grid-empty-row={index} data-grid-empty-column={ci} tabIndex={chosen ? 0 : -1}
                          role="gridcell" aria-disabled="true"
                          title="Linha visual ainda não salva; use Novo registro para cadastrar.">&nbsp;</span>
                      </td>;
                    })}
                  </tr>)}
              </tbody>
            </table>
            {!loading && displayedRows.length === 0 &&
              <div className="sheet-empty-message" role="status">
                {total === 0 ? 'Sem registros operacionais carregados. A grade vazia é apenas visual; use “Novo registro” com permissão de edição para criar uma linha.'
                  : 'Nenhuma linha corresponde aos filtros desta visualização. Limpe os filtros.'}
              </div>}
          </div>
          {openFilterKey && filterMenuRect && <div className="sheet-filter-popover"
            role="dialog" aria-label={'Filtro da coluna ' + (referenceHeader[openFilterKey] || openFilterKey)}
            style={{position:'fixed', top:Math.max(8,filterMenuRect.top), left:filterMenuRect.left}}>
            <div className="sheet-filter-heading">
              <strong>{referenceHeader[openFilterKey] || openFilterKey}</strong>
              <button className="sheet-filter-x" aria-label="Fechar filtro" onClick={()=>setOpenFilterKey(null)}>×</button>
            </div>
            <div className="sheet-filter-order">
              <button type="button" onClick={() => {setSortConfig({key:openFilterKey,direction:'asc'});setOpenFilterKey(null);}}>↑ Ordenar A → Z</button>
              <button type="button" onClick={() => {setSortConfig({key:openFilterKey,direction:'desc'});setOpenFilterKey(null);}}>↓ Ordenar Z → A</button>
            </div>
            <label className="sheet-filter-find">
              <span>Filtrar por valores</span>
              <input aria-label="Pesquisar valores da coluna" autoFocus
                value={filterSearch} onChange={event => setFilterSearch(event.target.value)}
                placeholder="Pesquisar..." />
            </label>
            <div className="sheet-filter-all">
              <button type="button" onClick={()=>chooseFilterAllVisible(true)}>Selecionar tudo</button>
              <button type="button" onClick={()=>chooseFilterAllVisible(false)}>Limpar</button>
              <small>{filterOptionsLoading ? 'Carregando...' : filteredFilterOptions.length + ' valor(es)'}</small>
            </div>
            <div className="sheet-filter-list" role="group" aria-label="Valores disponíveis">
              {filteredFilterOptions.map(value =>
                <label key={value} className="sheet-filter-value">
                  <input type="checkbox" checked={filterAllChosen || filterDraft.includes(value)}
                    onChange={event => {
                      if (filterAllChosen) {
                        setFilterDraft(filteredFilterOptions.filter(item => item !== value));
                        setFilterAllChosen(false);
                      } else {
                        setFilterDraft(previous => event.target.checked
                          ? [...previous, value] : previous.filter(item => item !== value));
                      }
                    }} />
                  <span title={value || '(Em branco)'}>{value || '(Em branco)'}</span>
                </label>)}
              {!filterOptionsLoading && !filteredFilterOptions.length && <p className="sheet-filter-no-values">Nenhum valor encontrado.</p>}
            </div>
            <p className="sheet-filter-note">{filterOptionsNote || 'Buscando os valores disponíveis...'}</p>
            <div className="sheet-filter-actions">
              <button type="button" className="secondary" onClick={()=>clearColumnFilter(openFilterKey)}>Remover filtro</button>
              <button type="button" className="primary" onClick={applyColumnFilter}>Aplicar</button>
            </div>
          </div>}
          <footer className="table-footer"><span>{apiBase && token ? 'Dados do banco • edição individual com auditoria' : 'Sem dados de demonstração'}</span><span><span className="green-dot"/> {visibleColumns.length} coluna(s) selecionada(s)</span></footer>
          <div className="sheet-scroll-status" role="status">
            <span>{displayedRows.length} de {total} registros carregados · Role para continuar</span>
            {rows.length < total && <button className="secondary" disabled={loading}
              onClick={()=>{lastRequestedPageRef.current=page+1;setPage(value=>value+1)}}>
              {loading?'Carregando…':'Carregar mais linhas'}</button>}
          </div>
        </section>
        </>}
        {pastePreview && <div className="modal-backdrop">
        <section className="history-modal sheet-paste-modal" role="dialog" aria-modal="true" aria-labelledby="sheet-paste-title">
          <header>
            <div><h2 id="sheet-paste-title">Confirmar colagem na planilha</h2>
              <p>{pastePreview.matrix.length} linha(s) × {pastePreview.matrix[0].length} coluna(s) · até {pastePreview.matrix.length * pastePreview.matrix[0].length} células</p>
            </div>
            <button className="secondary" type="button" disabled={pasteBusy} onClick={() => setPastePreview(null)}>Cancelar</button>
          </header>
          <p className="sheet-paste-warning">A colagem substituirá os valores das células selecionadas. As alterações serão gravadas nos registros reais e auditadas. Confira antes de confirmar.</p>
          <div className="sheet-paste-preview">
            <table><thead><tr>{pastePreview.matrix[0].slice(0, 6).map((_, i) =>
              <th key={i}>{visibleColumns[pastePreview.start.column + i]?.key}</th>)}</tr></thead>
              <tbody>{pastePreview.matrix.slice(0, 6).map((line, i) =>
                <tr key={i}>{line.slice(0, 6).map((value, j) => <td key={j}>{value || '∅'}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <small>Prévia limitada às primeiras 6 linhas e 6 colunas. A colagem é sequencial; uma falha pode interromper após algumas linhas já terem sido salvas.</small>
          <div className="sheet-paste-actions">
            <button type="button" className="secondary" disabled={pasteBusy} onClick={() => setPastePreview(null)}>Cancelar</button>
            <button type="button" className="primary" disabled={pasteBusy} onClick={() => void applyGridPaste()}>
              {pasteBusy ? 'Salvando...' : 'Confirmar colagem'}
            </button>
          </div>
        </section>
      </div>}
      {bulkOpen&&<div className="modal-backdrop" onClick={()=>!bulkBusy&&setBulkOpen(false)}><section className="history-modal bulk-edit-modal" onClick={event=>event.stopPropagation()}><header><div><h2><Save size={18}/> Edição em massa</h2><p>Revise o campo e o valor antes de aplicar aos registros selecionados.</p></div><button className="secondary" disabled={bulkBusy} onClick={()=>setBulkOpen(false)}><X size={16}/></button></header><div className="bulk-edit-content"><div className="bulk-summary"><strong>{selectedRows.length} registro(s) selecionado(s)</strong><span>As alterações serão gravadas individualmente e registradas no histórico.</span></div><label>Coluna a alterar<select value={bulkColumn} onChange={event=>setBulkColumn(event.target.value)}><option value="">Selecione uma coluna</option>{editableColumns.map(column=><option key={column.key} value={column.key}>{column.label} ({column.dataType})</option>)}</select></label><label>Novo valor<input value={bulkValue} onChange={event=>setBulkValue(event.target.value)} placeholder="Deixe vazio para limpar o campo"/></label>{bulkColumn&&<div className="bulk-preview"><b>Prévia das alterações</b><div className="bulk-preview-table"><div><span>Registro</span><span>Valor atual</span><span>Novo valor</span></div>{selectedRows.slice(0,8).map(row=><div key={row.id}><span>#{row.sequence}</span><span>{valueText(row.data?.[bulkColumn])||'—'}</span><span>{bulkValue||'—'}</span></div>)}</div>{selectedRows.length>8&&<small>Exibindo 8 de {selectedRows.length} registros.</small>}</div>}<div className="bulk-actions"><button className="secondary" disabled={bulkBusy} onClick={()=>setBulkOpen(false)}>Cancelar</button><button className="primary" disabled={bulkBusy||!bulkColumn||!selectedRows.length} onClick={()=>void applyBulkEdit()}>{bulkBusy?'Salvando...':'Aplicar alterações'}</button></div><small>Atalhos: Ctrl+F buscar · Ctrl+Shift+N novo registro · Esc limpar filtros.</small></div></section></div>}{historyTarget&&<div className="modal-backdrop" onClick={()=>setHistoryTarget(null)}><section className="history-modal" onClick={event=>event.stopPropagation()}><header><div><h2><History size={18}/> Histórico da célula</h2><p>Registro #{historyTarget.row.sequence} · {historyTarget.column.label||"Coluna sem título"}</p></div><button className="icon-button" onClick={()=>setHistoryTarget(null)}><X size={18}/></button></header>{historyLoading?<div className="empty-state">Carregando histórico…</div>:historyItems.length===0?<div className="empty-state">Nenhuma edição encontrada para esta célula.</div>:<div className="history-list">{historyItems.map(item=><article key={item.id}><div className="history-meta"><b>{item.user?.name||item.user?.email||"Usuário não identificado"}</b><time>{new Date(item.createdAt).toLocaleString("pt-BR")}</time></div><p><span>Ação:</span> {item.action}</p><p><span>Antes:</span> {valueText(item.beforeValue&&typeof item.beforeValue==="object"&&historyTarget.column.key in (item.beforeValue as Record<string,unknown>)?(item.beforeValue as Record<string,unknown>)[historyTarget.column.key]:item.beforeValue)}</p><p><span>Depois:</span> {valueText(item.afterValue&&typeof item.afterValue==="object"&&historyTarget.column.key in (item.afterValue as Record<string,unknown>)?(item.afterValue as Record<string,unknown>)[historyTarget.column.key]:item.afterValue)}</p></article>)}</div>}</section></div>}
        <footer className="app-footer">MAPA COSTALOG <span>•</span> Aplicação web operacional em desenvolvimento</footer>
      </section>
    </main>
  </div>;
}

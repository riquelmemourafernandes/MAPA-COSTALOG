import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { referenceHeader } from './reference-header.js';
import BaseCatalogSheet from './BaseCatalogSheet.js';
import {inheritRowPresentation,nearestPreviousRowId,type PresentationSnapshot} from './sheet-row-format.js';
import SheetContextMenu from './SheetContextMenu.js';
import {type SheetContextKind,type SheetContextAction} from './sheet-context-menu.js';
import { sourceColumnWidth, sourceRowHeight } from './mapa-source-dimensions.js';
import { SCROLL_BATCH_SIZE, normalizeCreateCount,
  normalizeRowHeight, mergeLoadedRows, shouldLoadNextBatch, virtualRowWindow,
  sparseSheetWindow, SHEET_MAX_ROW,
  normalizeColumnWidth, totalSheetWidth, MIN_ROW_HEIGHT, MAX_ROW_HEIGHT,
  MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH, ROW_NUMBER_COLUMN_WIDTH } from './sheet-layout.js';
import SheetColorPicker from './SheetColorPicker.js';
import SheetDropdownEditor from './SheetDropdownEditor.js';
import { BASE_COLUMN_LIST } from './sheet-dropdown-utils.js';
import { STATUS_COLORS, statusRowColor, statusRowTextColor } from './sheet-status-rules.js';
import { checkboxChecked, checkboxSaveText, isCheckboxColumn } from './sheet-checkbox.js';
import {LOCKED_COLUMN_FORMAT,formatSheetValue,parseSheetValue,toDateInput,type SheetNumberFormat} from './sheet-formats.js';
import { matchesColumnFilters, uniqueFilterValues, type ColumnFilterMap } from './column-filter.js';
import {
  canPasteMatrix, moveGridPosition, parseClipboardGrid,
  parseEditableValue, selectionBounds, serializeSelection, gridKeyboardAction, planClearSelection,
  type GridPosition
} from './sheet-grid.js';
import { Activity, Bell, Bold, GripVertical, ChevronDown, ClipboardList, Columns3, Filter, History, LayoutDashboard, LogOut, Menu, Moon, Sun, Plus, Save, Search, Settings2, Table2, Truck, Users, Waypoints, X, UserRound, ShieldCheck, Undo2, Redo2 } from 'lucide-react';
import { buildUndoRecord, matchesUndoState, undoShortcut, type UndoRecord } from './sheet-undo.js';
import { evaluateFormula, type FormulaValue } from './formula-engine.js';

type Column = { key: string; label: string; position: number; dataType: string; editable: boolean; visible: boolean; required?: boolean };
function parseGridCellValue(column: Column, value: string) {
  if (value.trim().startsWith('=')) return { ok: true as const, value: value.trim() };
  return LOCKED_COLUMN_FORMAT[column.key]
    ? parseSheetValue(value, LOCKED_COLUMN_FORMAT[column.key])
    : parseEditableValue(column.dataType, value);
}
type ValidationItem = { key: string; label: string; dataType: string; total: number; missing: number };
type ValidationSummary = { checkedAt: string; totalRows: number; requiredFields: number; items: ValidationItem[] };
type DashboardSummary = { generatedAt: string; activeRecords: number; recentlyUpdated: number; statuses: { status: string; count: number }[] };
type AppointmentAlert = { id: string; sequence: number; kind: 'Coleta' | 'Entrega'; scheduledAt: string; minutesLate: number; attendant: string; clientName: string | null; container: string | null; cte: string | null; status: string | null };
type AppointmentAlertSummary = { generatedAt: string; total: number; filteredTotal?: number; byKind: { collection: number; delivery: number }; attendants?: string[]; items: AppointmentAlert[] };
type RecordRow = { id: string; sequence: number; sheetRowNumber?: number; data: Record<string, unknown>; status?: string | null; clientName?: string | null; container?: string | null; cte?: string | null; updatedAt: string };
type SavedView = { name: string; visibleKeys: string[]; query: string; status: string };
type CellStyle = { bold?: boolean; color?: string; background?: string; format?: SheetNumberFormat; align?: 'left'|'center'|'right' };
type UndoStep =
  | {kind:'cells'; label:string; edits:UndoRecord[]}
  | {kind:'style'; label:string; target:'cell'|'row'|'column'; key:string;
      before:CellStyle|null; after:CellStyle|null}
  | {kind:'size'; label:string; target:'row'|'column'; key:string;
      before:number|null; after:number|null};
type AuditEntry = { id: string; action: string; fieldKey?: string | null; beforeValue?: unknown; afterValue?: unknown; createdAt: string; user?: { name?: string; email?: string } | null };
type UserProfile = { id: string; name: string; email: string; role: string; active: boolean };
type UserAdminItem = UserProfile & { createdAt?: string; updatedAt?: string; pendingApproval?: boolean };
// Keep the existing same-origin production proxy by default. A Vercel Preview
// can explicitly opt in to a SEPARATE staging backend using an environment
// variable scoped to Preview only; never silently switch production traffic.
const isVercelSite = typeof window !== 'undefined' && /(?:^|\.)vercel\.app$/.test(window.location.hostname);
// Pages is strictly a staging frontend. Never fall back to the production
// same-origin proxy or to VITE_API_URL when the staging API is not configured.
const isGitHubPagesPreview = typeof window !== 'undefined' &&
  window.location.hostname === 'riquelmemourafernandes.github.io' &&
  window.location.pathname.startsWith('/MAPA-COSTALOG/');
const previewHomologApi = (import.meta.env.VITE_HOMOLOG_API_URL || '').trim().replace(/\/+$/, '');
const apiBase = isGitHubPagesPreview
  ? ''
  : isVercelSite && /^https:\/\/[^/]+$/.test(previewHomologApi)
    ? previewHomologApi
    : isVercelSite ? window.location.origin : (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
// Cabeçalho conferido na linha 1 de MAPA IMPORTAÇÃO > MAPA 1.0 (A:BT).
// As posições BL:BP não têm título; não deslocar os valores adjacentes.

const referenceColumnKeys = new Set(Object.keys(referenceHeader).concat(['BL','BM','BN','BO','BP']));
const nav = [
  { name: 'Visão geral', icon: LayoutDashboard }, { name: 'MAPA 2.0', icon: Table2 },
  { name: 'Status operacional', icon: Activity }, { name: 'Cadastros', icon: Users }, { name: 'Minha conta', icon: UserRound }, { name: 'Usuários', icon: Users }, { name: 'Integrações', icon: Waypoints }
];
function valueText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const LOCAL_DEMO_STORAGE_KEY = 'mapa-costalog-local-sheet-v2';
function excelColumnKey(index: number): string {
  let n = index + 1, label = '';
  while (n > 0) { n--; label = String.fromCharCode(65 + n % 26) + label; n = Math.floor(n / 26); }
  return label;
}
function buildLocalDemoColumns(): Column[] {
  return Array.from({ length: 72 }, (_, index) => {
    const key = excelColumnKey(index);
    return { key, label: referenceHeader[key] || '', position: index + 1,
      dataType: key === 'A' ? 'date' : key === 'Q' ? 'currency' : key === 'AO' ? 'number' : 'text',
      editable: true, visible: true };
  });
}
function buildLocalDemoRows(columns: Column[]): RecordRow[] {
  return Array.from({ length: 24 }, (_, index) => {
    const data: Record<string, unknown> = Object.fromEntries(columns.map(column => [column.key, '']));
    data.A = new Date(Date.UTC(2026, 9, index + 1)).toISOString().slice(0, 10);
    data.B = 'Atendente de demonstração ' + (index % 3 + 1);
    data.C = ['NOVO', 'AG. DOCS', 'EM ABERTO', 'FINALIZADO'][index % 4];
    data.D = 'CTE-DEMO-' + String(1200 + index);
    data.E = ['DI', 'DUIMP', 'CABOTAGEM'][index % 3];
    data.L = ['Cliente exemplo A', 'Cliente exemplo B', 'Cliente exemplo C'][index % 3];
    data.Q = 1200 + index * 25;
    data.T = 'CONT-DEMO-' + String(index + 1).padStart(4, '0');
    data.AJ = index % 2 ? 'Terminal exemplo Guarujá' : 'Terminal exemplo Santos';
    data.AK = index % 2 ? 'GUARUJÁ - SP' : 'SANTOS - SP';
    data.AN = index % 2 ? 'PIRACICABA - SP' : 'SANTOS - SP';
    data.AO = index % 2 ? 190 : 0;
    data.AZ = 'Armador de exemplo ' + (index % 2 ? 'B' : 'A');
    data.BD = 'Depot de demonstração';
    return { id: 'local-demo-row-' + (index + 1), sequence: index + 1, sheetRowNumber: index + 2, data,
      status: String(data.C), clientName: String(data.L), container: String(data.T), cte: String(data.D),
      updatedAt: '2026-10-29T12:00:00.000Z' };
  });
}
function loadLocalDemoSheet(): { columns: Column[]; rows: RecordRow[]; total: number; maxSheetRowNumber: number } {
  const fallbackColumns = buildLocalDemoColumns(), fallbackRows = buildLocalDemoRows(fallbackColumns);
  try {
    const raw = localStorage.getItem(LOCAL_DEMO_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { columns?: Column[]; rows?: RecordRow[]; maxSheetRowNumber?: number };
      if (Array.isArray(saved.columns) && saved.columns.length > 0 && Array.isArray(saved.rows) &&
          saved.columns.every(column => column && typeof column.key === 'string') &&
          saved.rows.every(row => row && typeof row.id === 'string' && row.data && typeof row.data === 'object')) {
        return { columns: saved.columns, rows: saved.rows, total: saved.rows.length,
          maxSheetRowNumber: Math.max(1, Number(saved.maxSheetRowNumber || 1),
            ...saved.rows.map(row => Number(row.sheetRowNumber ?? row.sequence + 1))) };
      }
    }
    const legacyRaw = localStorage.getItem('mapa-costalog-public-demo-v1');
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as { columns?: { id: string; key: string; label: string }[]; rows?: { id: string; data: Record<string, string> }[] };
      if (Array.isArray(legacy.columns) && Array.isArray(legacy.rows)) {
        const migratedColumns: Column[] = legacy.columns.map((column, index) => ({
          key: column.key, label: column.label || '', position: index + 1,
          dataType: column.key === 'A' ? 'date' : column.key === 'Q' ? 'currency' : column.key === 'AO' ? 'number' : 'text',
          editable: true, visible: true
        }));
        const migratedRows: RecordRow[] = legacy.rows.map((row, index) => {
          const data: Record<string, unknown> = Object.fromEntries(migratedColumns.map(column => [column.key, row.data['col-' + column.key] ?? '']));
          return { id: row.id, sequence: index + 1, sheetRowNumber: index + 2, data,
            status: String(data.C || ''), clientName: String(data.L || ''), container: String(data.T || ''), cte: String(data.D || ''),
            updatedAt: '2026-10-29T12:00:00.000Z' };
        });
        return { columns: migratedColumns, rows: migratedRows, total: migratedRows.length,
          maxSheetRowNumber: Math.max(1, ...migratedRows.map(row => Number(row.sheetRowNumber ?? 1))) };
      }
    }
  } catch { /* Start from labelled sample data if browser storage is invalid. */ }
  return { columns: fallbackColumns, rows: fallbackRows, total: fallbackRows.length, maxSheetRowNumber: 25 };
}
const initialLocalDemoSheet = isGitHubPagesPreview ? loadLocalDemoSheet() : null;
function parseCsvMatrix(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const result: string[][] = []; let row: string[] = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if (char === '\n' && !quoted) { row.push(field); result.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field.length || row.length) { row.push(field); result.push(row); }
  return result;
}

export default function App() {
  const [active, setActive] = useState('MAPA 2.0');
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
  const cellSaveBusyRef = useRef(false);
  const gridMutationBusyRef = useRef(false);
  const editorRef = useRef<HTMLInputElement>(null);
  const localCsvInputRef = useRef<HTMLInputElement>(null);
  const [token, setToken] = useState(() => isGitHubPagesPreview ? 'local-demo' : apiBase ? sessionStorage.getItem('mapa-costalog-token') || '' : '');
  const [userKey, setUserKey] = useState(() => isGitHubPagesPreview ? 'local-demo' : sessionStorage.getItem('mapa-costalog-user') || 'usuario');
  const [userRole, setUserRole] = useState(() => isGitHubPagesPreview ? 'ADMIN' : sessionStorage.getItem('mapa-costalog-role') || '');
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
  const [columns, setColumns] = useState<Column[]>(() => initialLocalDemoSheet?.columns ?? []);
  const [rows, setRows] = useState<RecordRow[]>(() => initialLocalDemoSheet?.rows ?? []);
  const rowsRef=useRef<RecordRow[]>([]);
  useEffect(()=>{rowsRef.current=rows;},[rows]);
  const undoStacksRef=useRef<{undo:UndoStep[];redo:UndoStep[]}>({undo:[],redo:[]});
  const undoBusyRef=useRef(false);
  const [undoCounts,setUndoCounts]=useState({undo:0,redo:0});
  const [undoFeedback,setUndoFeedback]=useState('');
  function syncUndoCounts(){
    setUndoCounts({undo:undoStacksRef.current.undo.length,redo:undoStacksRef.current.redo.length});
  }
  function rememberUndo(step:UndoStep){
    const stacks=undoStacksRef.current;
    stacks.undo.push(step);
    if(stacks.undo.length>60)stacks.undo.shift();
    stacks.redo=[];
    syncUndoCounts();
  }
  useEffect(()=>{
    undoStacksRef.current={undo:[],redo:[]};
    setUndoFeedback('');
    syncUndoCounts();
  },[userKey,token]);
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
  // Shared theme for every page, keeping operational spreadsheet cell colors unchanged.
  const [structuralDarkMode,setStructuralDarkMode] = useState(() =>
    localStorage.getItem('mapa-costalog-structural-dark') === 'yes');
  function toggleStructuralDarkMode(){
    setStructuralDarkMode(previous=>{
      localStorage.setItem('mapa-costalog-structural-dark',previous?'no':'yes');
      return !previous;
    });
  }
  useEffect(()=>{
    // The login and portaled menus also belong to the same site-wide theme.
    document.documentElement.classList.toggle('costalog-dark',structuralDarkMode);
    return ()=>document.documentElement.classList.remove('costalog-dark');
  },[structuralDarkMode]);
  const [newRowsCount, setNewRowsCount] = useState(10);
  const [newRowsOpen, setNewRowsOpen] = useState(false);
  const [creatingRows, setCreatingRows] = useState(false);
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const [gridViewport, setGridViewport] = useState({scrollTop:0,height:560});
  const selectionDragRef = useRef(false);
  const dragInfoRef = useRef<{row:number;column:number;x:number;y:number;moved:boolean}|null>(null);
  const lastRequestedPageRef = useRef(0);
  const [retryRowsKey, setRetryRowsKey] = useState(0);
  const [total, setTotal] = useState(() => initialLocalDemoSheet?.total ?? 0);
  const [maxSheetRowNumber,setMaxSheetRowNumber] = useState(() => initialLocalDemoSheet?.maxSheetRowNumber ?? 1);
  useEffect(() => {
    if (!isGitHubPagesPreview || !columns.length) return;
    try { localStorage.setItem(LOCAL_DEMO_STORAGE_KEY, JSON.stringify({ columns, rows, total, maxSheetRowNumber })); }
    catch { setNotice('O navegador não conseguiu salvar todas as alterações. Copie os dados antes de fechar a página.'); }
  }, [columns, rows, total, maxSheetRowNumber]);
  const [gridRangeSupported,setGridRangeSupported] = useState<boolean|null>(() => isGitHubPagesPreview ? true : null);
  const loadedGridChunksRef=useRef(new Set<number>());
  const inFlightGridChunksRef=useRef(new Set<number>());
  const [blankEditing,setBlankEditing] = useState<{index:number;columnKey:string}|null>(null);
  const [blankDraft,setBlankDraft] = useState('');
  const [blankSaving,setBlankSaving] = useState(false);
  const [selectedBlankRow,setSelectedBlankRow] = useState<number|null>(null);
  const [columnMenu, setColumnMenu] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => {
    if (!isGitHubPagesPreview || !initialLocalDemoSheet) return [];
    try {
      const saved = localStorage.getItem('mapa-costalog-columns:local-demo');
      const keys = saved ? JSON.parse(saved) as string[] : null;
      return Array.isArray(keys) ? keys.filter(key => initialLocalDemoSheet.columns.some(column => column.key === key))
        : initialLocalDemoSheet.columns.map(column => column.key);
    } catch { return initialLocalDemoSheet.columns.map(column => column.key); }
  });
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    if (!isGitHubPagesPreview) return [];
    try { const saved = localStorage.getItem('mapa-costalog-views:local-demo'); const parsed = saved ? JSON.parse(saved) as SavedView[] : []; return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  });
  const [viewName, setViewName] = useState('');
  const [showViewTools, setShowViewTools] = useState(false);
  const [showStatusColors, setShowStatusColors] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{row: RecordRow; column: Column} | null>(null);
  const [selectionMode, setSelectionMode] = useState<'cell'|'row'|'column'>('cell');
  const [sheetContextMenu, setSheetContextMenu] = useState<{
    kind:SheetContextKind;x:number;y:number;rowIndex?:number;columnIndex?:number
  }|null>(null);
  const [adminSheetBusy,setAdminSheetBusy] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedColumnKey, setSelectedColumnKey] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{rowId: string; columnKey: string} | null>(null);
  const [editValue, setEditValue] = useState('');
  const [formulaDraft, setFormulaDraft] = useState('');
  const [placeholderPosition, setPlaceholderPosition] = useState<GridPosition | null>(null);
  const [selectionAnchor, setSelectionAnchor] = useState<{rowId: string; columnKey: string} | null>(null);
  const [pasteBusy, setPasteBusy] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{key:string; direction:'asc'|'desc'} | null>(null);
  const [cellStyles, setCellStyles] = useState<Record<string, CellStyle>>({});
  const [rowStyles, setRowStyles] = useState<Record<string, CellStyle>>({});
  const [columnStyles, setColumnStyles] = useState<Record<string, CellStyle>>({});
  const presentationRef=useRef<PresentationSnapshot>({rowStyles:{},cellStyles:{},rowHeights:{}});
  useEffect(()=>{
    presentationRef.current={rowStyles,cellStyles,rowHeights};
  },[rowStyles,cellStyles,rowHeights]);
  const styleStorageKey = 'mapa-costalog-sheet-styles:' + userKey;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(styleStorageKey) || '{}');
      setRowStyles(saved?.rowStyles && typeof saved.rowStyles === 'object' ? saved.rowStyles : {});
      setCellStyles(saved?.cellStyles && typeof saved.cellStyles === 'object' ? saved.cellStyles : {});
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
          Number.isFinite(entry[1]) && entry[1] >= MIN_ROW_HEIGHT && entry[1] <= MAX_ROW_HEIGHT)));
    } catch { setRowHeights({}); }
  }, [rowHeightStorageKey]);
  useEffect(() => {
    if (active !== 'MAPA 2.0' || !token) return;
    const node = gridRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      setGridViewport({scrollTop:node.scrollTop,height:node.clientHeight});
    });
    observer.observe(node);
    setGridViewport({scrollTop:node.scrollTop,height:node.clientHeight});
    return () => observer.disconnect();
  }, [active, token]);
  // Infinite-scroll page loads must preserve row selection.
  useEffect(() => {
    setSelectedRowIds([]);
    lastRequestedPageRef.current=0;
    if(gridRef.current) gridRef.current.scrollTop=0;
    setGridViewport(current=>({...current,scrollTop:0}));
  }, [query,status,filterColumn,filterValue,columnFilters]);
  const selectedRows = rows.filter(row => selectedRowIds.includes(row.id));
  const editableColumns = columns.filter(column => column.editable);
  const preferenceKey = 'mapa-costalog-columns:' + userKey;
  const widthKey = 'mapa-costalog-widths:' + userKey;
  useEffect(() => {
    if (!isGitHubPagesPreview) return;
    try { localStorage.setItem(preferenceKey, JSON.stringify(visibleKeys)); localStorage.setItem('mapa-costalog-views:local-demo', JSON.stringify(savedViews)); }
    catch { /* Keep the grid usable if storage is unavailable. */ }
  }, [preferenceKey, visibleKeys, savedViews]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(widthKey) || '{}') as Record<string, unknown>;
      setColumnWidths(Object.fromEntries(Object.entries(saved)
        .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]) &&
          entry[1] >= MIN_COLUMN_WIDTH && entry[1] <= MAX_COLUMN_WIDTH)));
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
        .filter(column => referenceColumnKeys.has(column.key) && column.visible !== false)
        .map(column => ({ ...column, label: referenceHeader[column.key] || '' }));
      setColumns(referenceColumns);
      const saved = localStorage.getItem(preferenceKey);
      const savedKeys = saved ? JSON.parse(saved) as string[] : null;
      setVisibleKeys(savedKeys
        ? savedKeys.filter(key => referenceColumns.some(c => c.key === key))
        : referenceColumns.map(c => c.key));
      const incoming = Array.isArray(rowsBody.items) ? rowsBody.items as RecordRow[] : [];
      setRows(previous => page === 1 && previous.length===0 ? incoming : mergeLoadedRows(previous, incoming));
      setTotal(Number(rowsBody.total || 0));
      setMaxSheetRowNumber(Number(rowsBody.maxSheetRowNumber || 1));
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
  // A newly created row inherits the preceding row's VISUAL formatting only.
  // Never duplicate status, client, dates or any other operational field value.
  function inheritNewRowFormat(item:RecordRow,position:number,knownRows:RecordRow[]):PresentationSnapshot|null {
    const sourceId=nearestPreviousRowId(knownRows,position);
    if(!sourceId)return null;
    const previous=presentationRef.current;
    const next=inheritRowPresentation(sourceId,item.id,columns.map(col=>col.key),previous);
    if(!next.rowStyles[item.id] && !next.rowHeights[item.id] &&
      !columns.some(col=>next.cellStyles[item.id+':'+col.key]))return null;
    presentationRef.current=next;
    setRowStyles(next.rowStyles);setCellStyles(next.cellStyles);setRowHeights(next.rowHeights);
    localStorage.setItem(styleStorageKey,JSON.stringify({
      rowStyles:next.rowStyles,cellStyles:next.cellStyles,columnStyles
    }));
    localStorage.setItem(rowHeightStorageKey,JSON.stringify(next.rowHeights));
    return next;
  }
  async function syncNewRowFormat(snapshot:PresentationSnapshot|null){
    if(!snapshot||!token)return;
    try{
      const response=await fetch(apiBase+'/api/v1/preferences',{
        method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
        body:JSON.stringify({visibleKeys,columnOrder:visibleKeys,savedViews,
          cellStyles:snapshot.cellStyles,rowStyles:snapshot.rowStyles,columnStyles})
      });
      if(!response.ok)throw new Error('API sem suporte à preferência de formatação.');
    }catch{
      setNotice('Formato herdado neste navegador; sincronização de estilos pendente na API.');
    }
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
    if(undoBusyRef.current)return;
    let nextCellStyles = cellStyles, nextRowStyles = rowStyles, nextColumnStyles = columnStyles;
    let scope = 'célula';
    const undoTarget: 'cell'|'row'|'column' =
      selectionMode==='column'&&selectedColumnKey?'column':
      selectionMode==='row'&&selectedRowId?'row':'cell';
    const undoKey=undoTarget==='column'?selectedColumnKey!:
      undoTarget==='row'?selectedRowId!:
      selectedCell?styleKey(selectedCell.row,selectedCell.column):'';
    const beforeStyle=undoTarget==='column'?columnStyles[undoKey]??null:
      undoTarget==='row'?rowStyles[undoKey]??null:cellStyles[undoKey]??null;
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
    const afterStyle=undoTarget==='column'?nextColumnStyles[undoKey]??null:
      undoTarget==='row'?nextRowStyles[undoKey]??null:nextCellStyles[undoKey]??null;
    if(JSON.stringify(beforeStyle)!==JSON.stringify(afterStyle)){
      rememberUndo({kind:'style',label:'Formatação da '+scope,target:undoTarget,
        key:undoKey,before:beforeStyle?{...beforeStyle}:null,
        after:afterStyle?{...afterStyle}:null});
    }
    localStorage.setItem(styleStorageKey, JSON.stringify({
      rowStyles: nextRowStyles, cellStyles: nextCellStyles, columnStyles: nextColumnStyles
    }));
    // Preferences are UI formatting, never modifications of operational rows.
    if (isGitHubPagesPreview) { setNotice('Formatação da ' + scope + ' salva neste navegador.'); return; }
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
      const created=body.item as RecordRow;
      const priorPosition=Number(created.sheetRowNumber??created.sequence+1);
      const inherited=inheritNewRowFormat(created,priorPosition,displayedRows);
      setRows(previous => [created, ...previous]);
      void syncNewRowFormat(inherited);
      setTotal(previous => previous + 1);
      setNotice('Novo registro criado. Preencha as colunas diretamente na grade.');
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Falha ao criar registro.');
    } finally { setLoading(false); }
  }
  async function applyBulkEdit() {
    const column = editableColumns.find(item => item.key === bulkColumn);
    if (!column || !selectedRows.length || (!apiBase && !isGitHubPagesPreview) || !token) return;
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
    const undoEdits:UndoRecord[]=[];
    try {
      for (const row of selectedRows) {
        if (valueText(row.data?.[column.key]) === valueText(parsedValue)) continue;
        if (isGitHubPagesPreview) {
          const updated: RecordRow = { ...row, data: { ...row.data, [column.key]: parsedValue }, updatedAt: new Date().toISOString() };
          succeeded.push(updated);
          const edit = buildUndoRecord(row, updated, [column.key]); if (edit) undoEdits.push(edit);
          continue;
        }
        try {
          const response = await fetch(apiBase + '/api/v1/mapa/' + encodeURIComponent(row.id), {
            method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ changes: { [column.key]: parsedValue }, expectedUpdatedAt: row.updatedAt })
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body?.error?.message || 'Falha ao salvar');
          const updated=body.item as RecordRow;
          succeeded.push(updated);
          const edit=buildUndoRecord(row,updated,[column.key]);
          if(edit)undoEdits.push(edit);
        } catch (error) { failures.push('Registro #' + row.sequence + ': ' + (error instanceof Error ? error.message : 'falha')); }
      }
      if(undoEdits.length)rememberUndo({kind:'cells',label:'Edição em massa',edits:undoEdits});
      if (succeeded.length) setRows(previous => previous.map(row => succeeded.find(updated => updated.id === row.id) || row));
      setSelectedRowIds(failures.length ? selectedRows.filter(row => failures.some(message => message.startsWith('Registro #' + row.sequence + ':'))).map(row => row.id) : []);
      setNotice(isGitHubPagesPreview
        ? 'Edição em massa salva neste navegador: ' + succeeded.length + ' registro(s) atualizado(s).'
        : 'Edição em massa: ' + succeeded.length + ' registro(s) atualizado(s)' + (failures.length ? '; ' + failures.length + ' falha(s).' : '. Cada alteração foi registrada no histórico.'));
      if (failures.length) setApiError(failures.slice(0, 5).join(' · ') + (failures.length > 5 ? ' · e outras falhas.' : ''));
      else setBulkOpen(false);
    } finally { setBulkBusy(false); }
  }
  async function saveCell(row: RecordRow, column: Column, value: string): Promise<boolean> {
    if ((!apiBase && !isGitHubPagesPreview) || !token || !column.editable || userRole === 'CONSULTA' || gridMutationBusyRef.current || cellSaveBusyRef.current) return false;
    const previousValue = valueText(row.data?.[column.key]);
    if (value === previousValue) return true;
    const parsed = LOCKED_COLUMN_FORMAT[column.key]
      ? parseSheetValue(value,LOCKED_COLUMN_FORMAT[column.key])
      : parseEditableValue(column.dataType, value);
    if (!parsed.ok) {
      setApiError(parsed.message + ' na coluna ' + column.label + '.');
      return false;
    }
    if (isGitHubPagesPreview) {
      const updated: RecordRow = { ...row, data: { ...row.data, [column.key]: parsed.value },
        updatedAt: new Date().toISOString(), ...(column.key === 'C' ? { status: valueText(parsed.value) } : {}) };
      setRows(previous => previous.map(item => item.id === row.id ? updated : item));
      const edit = buildUndoRecord(row, updated, [column.key]);
      if (edit) rememberUndo({ kind: 'cells', label: 'Edição da célula ' + column.key + row.sequence, edits: [edit] });
      setNotice('Alteração salva automaticamente neste navegador.'); setApiError('');
      return true;
    }
    cellSaveBusyRef.current=true;
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
      const updated=body.item as RecordRow;
      setRows(previous => previous.map(item => item.id === row.id ? updated : item));
      const edit=buildUndoRecord(row,updated,[column.key]);
      if(edit)rememberUndo({kind:'cells',label:'Edição da célula '+column.key+row.sequence,edits:[edit]});
      setNotice('Alteração salva no banco e registrada no histórico.');
      setApiError('');
      return true;
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Falha ao salvar.');
      setNotice('A alteração não foi confirmada. Atualize a tela antes de continuar.');
      return false;
    } finally {
      cellSaveBusyRef.current=false;
      if (column.key === 'C') {
        setPendingRowStatus(previous => {
          const next = { ...previous }; delete next[row.id]; return next;
        });
      }
    }
  }

  // Spreadsheet undo/redo replays confirmed edits through the audited API.
  // It does not overwrite a value changed since the recorded edit; HTTP 409
  // also prevents stale writes if a collaborator edits during the request.
  async function replayEdit(direction:'undo'|'redo'){
    if(active!=='MAPA 2.0'||undoBusyRef.current||gridMutationBusyRef.current||
       editingBusyRef.current||cellSaveBusyRef.current||blankSaving||pasteBusy||adminSheetBusy||
       bulkBusy||creatingRows)return;
    const stacks=undoStacksRef.current;
    const source=stacks[direction],target=stacks[direction==='undo'?'redo':'undo'];
    const entry=source[source.length-1];
    if(!entry){setUndoFeedback(direction==='undo'?'Nada para desfazer.':'Nada para refazer.');return;}
    if(entry.kind!=='size'&&(!token||(!apiBase&&!isGitHubPagesPreview)||userRole==='CONSULTA'))return;
    undoBusyRef.current=true;
    setUndoFeedback('');
    setApiError('');
    try{
      if(entry.kind==='cells'){
        // Verify all currently loaded values before applying any request.
        for(const edit of entry.edits){
          const current=rowsRef.current.find(row=>row.id===edit.rowId);
          if(!matchesUndoState(current,edit,direction)){
            throw new Error('A linha desta alteração não está carregada ou foi modificada desde então. '+
              'Não sobrescrevi dados de outro usuário. Atualize a grade para conferir.');
          }
        }
        gridMutationBusyRef.current=true;setPasteBusy(true);
        const completed:UndoRecord[]=[];
        let failed:Error|null=null;
        for(const edit of (direction==='undo'?[...entry.edits].reverse():entry.edits)){
          const current=rowsRef.current.find(row=>row.id===edit.rowId);
          if(!current||!matchesUndoState(current,edit,direction)){
            failed=new Error('Os valores da linha mudaram durante a operação.');break;
          }
          try{
            if (isGitHubPagesPreview) {
              const updated: RecordRow = { ...current, data: { ...current.data, ...(direction === 'undo' ? edit.before : edit.after) }, updatedAt: new Date().toISOString() };
              rowsRef.current = rowsRef.current.map(row => row.id === updated.id ? updated : row);
              setRows(previous => previous.map(row => row.id === updated.id ? updated : row));
              completed.push(edit); continue;
            }
            const response=await fetch(apiBase+'/api/v1/mapa/'+encodeURIComponent(edit.rowId),{
              method:'PATCH',
              headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
              body:JSON.stringify({
                changes:direction==='undo'?edit.before:edit.after,
                expectedUpdatedAt:current.updatedAt
              })
            });
            const body=await response.json().catch(()=>({}));
            if(!response.ok)throw new Error(body?.error?.message||
              (response.status===409?'Conflito de edição: recarregue a grade.':
                'Não foi possível gravar a reversão.'));
            const updated=body.item as RecordRow;
            rowsRef.current=rowsRef.current.map(row=>row.id===updated.id?updated:row);
            setRows(previous=>previous.map(row=>row.id===updated.id?updated:row));
            completed.push(edit);
          }catch(error){
            failed=error instanceof Error?error:new Error('Falha ao salvar.');break;
          }
        }
        if(completed.length){
          if(completed.length===entry.edits.length)source.pop();
          else source[source.length-1]={...entry,edits:entry.edits.filter(edit=>!completed.includes(edit))};
          target.push({...entry,edits:completed});
          if(target.length>60)target.shift();
          syncUndoCounts();
          setNotice((direction==='undo'?'Desfeito: ':'Refeito: ')+entry.label+
            ' ('+completed.length+' linha(s)). Alteração registrada na auditoria.');
          setUndoFeedback((direction==='undo'?'Desfeito: ':'Refeito: ')+entry.label);
        }
        if(failed)throw new Error(failed.message+
          (completed.length?' '+completed.length+' linha(s) já confirmada(s) foram mantidas.':''));
      }else if(entry.kind==='style'){
        const existing=entry.target==='cell'?cellStyles:
          entry.target==='row'?rowStyles:columnStyles;
        const expected=direction==='undo'?entry.after:entry.before;
        const desired=direction==='undo'?entry.before:entry.after;
        if(JSON.stringify(existing[entry.key]??null)!==JSON.stringify(expected))
          throw new Error('Essa formatação mudou desde a operação. Nada foi substituído.');
        const next={...existing};
        if(desired)next[entry.key]={...desired};
        else delete next[entry.key];
        const nextCells=entry.target==='cell'?next:cellStyles;
        const nextRows=entry.target==='row'?next:rowStyles;
        const nextColumns=entry.target==='column'?next:columnStyles;
        if(entry.target==='cell')setCellStyles(nextCells);
        else if(entry.target==='row')setRowStyles(nextRows);
        else setColumnStyles(nextColumns);
        localStorage.setItem(styleStorageKey,JSON.stringify({
          cellStyles:nextCells,rowStyles:nextRows,columnStyles:nextColumns
        }));
        source.pop();target.push(entry);
        if(target.length>60)target.shift();
        syncUndoCounts();
        try{
          const response=await fetch(apiBase+'/api/v1/preferences',{
            method:'PUT',
            headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
            body:JSON.stringify({visibleKeys,columnOrder:visibleKeys,savedViews,
              cellStyles:nextCells,rowStyles:nextRows,columnStyles:nextColumns})
          });
          if(!response.ok)throw new Error('A sincronização com a API falhou.');
          setNotice((direction==='undo'?'Desfeita: ':'Refeita: ')+entry.label+'.');
          setUndoFeedback((direction==='undo'?'Desfeita: ':'Refeita: ')+entry.label);
        }catch{
          setNotice('Formatação '+(direction==='undo'?'desfeita':'refeita')+
            ' neste navegador; sincronização com o servidor pendente.');
        }
      }else{
        const current=entry.target==='row'?rowHeights:columnWidths;
        const expected=direction==='undo'?entry.after:entry.before;
        const desired=direction==='undo'?entry.before:entry.after;
        if((current[entry.key]??null)!==expected)
          throw new Error('O tamanho da linha ou coluna mudou desde então.');
        const next={...current};
        if(desired===null)delete next[entry.key];
        else next[entry.key]=desired;
        if(entry.target==='row'){
          setRowHeights(next);
          localStorage.setItem(rowHeightStorageKey,JSON.stringify(next));
        }else{
          setColumnWidths(next);
          localStorage.setItem(widthKey,JSON.stringify(next));
        }
        source.pop();target.push(entry);
        if(target.length>60)target.shift();
        syncUndoCounts();
        setNotice((direction==='undo'?'Desfeito: ':'Refeito: ')+entry.label+'.');
        setUndoFeedback((direction==='undo'?'Desfeito: ':'Refeito: ')+entry.label);
      }
    }catch(error){
      const message='Ctrl+'+(direction==='undo'?'Z':'Y')+': '+
        (error instanceof Error?error.message:'Não foi possível concluir a operação.');
      setApiError(message);
      setUndoFeedback(message);
    }finally{
      gridMutationBusyRef.current=false;
      setPasteBusy(false);
      undoBusyRef.current=false;
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target && (target.isContentEditable ||
        ['INPUT','TEXTAREA','SELECT'].includes(target.tagName) &&
        !(target instanceof HTMLInputElement && target.type==='checkbox')));
      const shortcut=undoShortcut(event);
      if(shortcut && active==='MAPA 2.0' && !typing){
        event.preventDefault();
        event.stopPropagation();
        void replayEdit(shortcut);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault(); searchInputRef.current?.focus(); searchInputRef.current?.select();
      } else if (event.key === 'Escape' && !typing) {
        setQuery(''); setFilterColumn(''); setFilterValue(''); setStatus(''); setPage(1);
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'n' && active === 'MAPA 2.0' && userRole !== 'CONSULTA') {
        event.preventDefault(); void createRow();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, userRole, apiBase, token, rows, cellStyles, rowStyles, columnStyles, rowHeights, columnWidths, visibleKeys, savedViews, blankSaving, pasteBusy, adminSheetBusy, bulkBusy, creatingRows]);
  const visibleColumns = useMemo(() => columns.filter(c => c.visible !== false && visibleKeys.includes(c.key)).sort((a,b) => visibleKeys.indexOf(a.key)-visibleKeys.indexOf(b.key)), [columns, visibleKeys]);
  // When backend filtering is available, values are filtered before pagination.
  // On an older API, the same selection works over the loaded page only.
  const formulaValues = useMemo(() => {
    const byPosition = new Map<number, RecordRow>();
    rows.forEach((row, index) => byPosition.set(Number(row.sheetRowNumber ?? row.sequence + 1), row));
    const resolveCell = (rowNumber: number, columnKey: string, stack: Set<string> = new Set()): FormulaValue => {
      if (rowNumber === 1) return referenceHeader[columnKey] ?? '';
      const record = byPosition.get(rowNumber);
      if (!record) return null;
      const raw = record.data?.[columnKey];
      if (typeof raw === 'string' && raw.trim().startsWith('=')) {
        return evaluateFormula(raw, resolveCell, stack);
      }
      return raw === undefined ? null : raw as FormulaValue;
    };
    const result = new Map<string, FormulaValue>();
    for (const row of rows) {
      const rowNumber = Number(row.sheetRowNumber ?? row.sequence + 1);
      for (const column of columns) {
        const raw = row.data?.[column.key];
        if (typeof raw === 'string' && raw.trim().startsWith('=')) {
          const address = column.key + rowNumber;
          result.set(address, evaluateFormula(raw, resolveCell, new Set([address])));
        }
      }
    }
    return result;
  }, [rows, columns]);
  function displayedCellValue(row: RecordRow, column: Column): unknown {
    const raw = row.data?.[column.key];
    if (typeof raw !== 'string' || !raw.trim().startsWith('=')) return raw;
    return formulaValues.get(column.key + Number(row.sheetRowNumber ?? row.sequence + 1)) ?? '#ERROR!';
  }
  useEffect(() => {
    if (!selectedCell) { setFormulaDraft(''); return; }
    const current = rows.find(row => row.id === selectedCell.row.id);
    setFormulaDraft(valueText(current?.data?.[selectedCell.column.key]));
  }, [selectedCell?.row.id, selectedCell?.column.key, rows]);
  async function commitFormulaBar() {
    if (!selectedCell) return;
    const row = rows.find(item => item.id === selectedCell.row.id);
    if (!row) return;
    const saved = await saveCell(row, selectedCell.column, formulaDraft);
    if (saved) {
      setSelectedCell({ row: { ...row, data: { ...row.data, [selectedCell.column.key]: formulaDraft } }, column: selectedCell.column });
      gridRef.current?.focus({ preventScroll: true });
    }
  }

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


  const sheetCanvas = !query.trim() && !status && !filterColumn && !filterValue &&
    !sortConfig && Object.keys(columnFilters).length===0;
  const sheetRecordsByRow = useMemo(()=>{
    const result=new Map<number,RecordRow>();
    displayedRows.forEach((row,i)=>{
      const pos=Number(row.sheetRowNumber ?? i+2);
      if(Number.isInteger(pos)&&pos>=2&&pos<=SHEET_MAX_ROW)result.set(pos,row);
    });
    return result;
  },[displayedRows]);
  const rowIndexById = useMemo(() =>
    new Map(displayedRows.map((row,index)=>[row.id,index])),[displayedRows]);
  const sheetHeightOverrides = useMemo(()=>{
    const result:Record<number,number>={2:sourceRowHeight(2)};
    for(const [key,height] of Object.entries(rowHeights)){
      if(!key.startsWith('slot:'))continue;
      const position=Number(key.slice(5));
      if(Number.isInteger(position)&&position>=2&&position<=SHEET_MAX_ROW)
        result[position]=height;
    }
    for(const [position,row] of sheetRecordsByRow){
      if(result[position]===undefined && rowHeights[row.id]!==undefined)
        result[position]=rowHeights[row.id];
    }
    return result;
  },[sheetRecordsByRow,rowHeights]);
  const rowHeightAt=(position:number,row?:RecordRow):number =>
    normalizeRowHeight(rowHeights['slot:'+position]??(row?rowHeights[row.id]:undefined)??sourceRowHeight(position));
  const windowed = useMemo(() => sheetCanvas
    ? sparseSheetWindow(gridViewport.scrollTop,gridViewport.height,sheetHeightOverrides)
    : virtualRowWindow(displayedRows.map((row,index)=>
        rowHeightAt(Number(row.sheetRowNumber??index+2),row)),
        gridViewport.scrollTop,gridViewport.height),
  [sheetCanvas,displayedRows,sheetHeightOverrides,rowHeights,gridViewport.scrollTop,gridViewport.height]);
  const renderedSlots = useMemo(()=>{
    if(!sheetCanvas)return displayedRows.slice(windowed.start,windowed.end)
      .map((row,i)=>({row,ri:windowed.start+i,index:windowed.start+i}));
    return Array.from({length:windowed.end-windowed.start},(_,i)=>{
      const index=windowed.start+i, row=sheetRecordsByRow.get(index+2);
      return {row,ri:row?(rowIndexById.get(row.id)??-1):-1,index};
    });
  },[sheetCanvas,displayedRows,sheetRecordsByRow,rowIndexById,windowed.start,windowed.end]);
  useEffect(()=>{
    loadedGridChunksRef.current.clear();
    inFlightGridChunksRef.current.clear();
    setGridRangeSupported(isGitHubPagesPreview ? true : null);
  },[token]);
  useEffect(()=>{
    if(isGitHubPagesPreview||!sheetCanvas||!token||active!=='MAPA 2.0'||gridRangeSupported===false)return;
    const first=Math.floor(windowed.start/100),last=Math.floor(Math.max(windowed.start,windowed.end-1)/100);
    const controller=new AbortController();
    for(let chunk=first;chunk<=Math.min(last,first+3);chunk++){
      if(loadedGridChunksRef.current.has(chunk)||inFlightGridChunksRef.current.has(chunk))continue;
      inFlightGridChunksRef.current.add(chunk);
      fetch(apiBase+'/api/v1/mapa/grid?'+new URLSearchParams({
        start:String(chunk*100+2),count:'100'
      }),{headers:{Authorization:'Bearer '+token},signal:controller.signal}).then(async response=>{
        if(response.status===404){setGridRangeSupported(false);return null;}
        if(!response.ok)throw new Error('Não foi possível consultar a grade de linhas.');
        return response.json();
      }).then(body=>{
        if(!body)return;
        if(!Array.isArray(body.items))throw new Error('Resposta inválida da grade.');
        loadedGridChunksRef.current.add(chunk);setGridRangeSupported(true);
        setRows(previous=>mergeLoadedRows(previous,body.items as RecordRow[]));
      }).catch(error=>{
        if(!controller.signal.aborted)setApiError(error instanceof Error?error.message:'Falha na grade.');
      }).finally(()=>{
        inFlightGridChunksRef.current.delete(chunk);
        if(controller.signal.aborted && !loadedGridChunksRef.current.has(chunk)){
          setGridViewport(previous=>({...previous}));
        }
      });
    }
    return ()=>controller.abort();
  },[sheetCanvas,token,active,apiBase,windowed.start,windowed.end]);
  function handleGridScroll(event: React.UIEvent<HTMLDivElement>) {
    const node=event.currentTarget;
    setGridViewport({scrollTop:node.scrollTop,height:node.clientHeight});
    if(sheetCanvas && gridRangeSupported!==false)return;
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
  function beginRowResize(event: React.PointerEvent<HTMLSpanElement>, position:number, row?:RecordRow) {
    if(event.button!==0)return;
    event.preventDefault();event.stopPropagation();
    const storageKey='slot:'+position;
    const currentHeight=rowHeightAt(position,row);
    const originalValue=rowHeights[storageKey]??null;
    const startY=event.clientY;
    let finalHeight=currentHeight;
    const move=(ev:PointerEvent)=>{
      const height=normalizeRowHeight(currentHeight+ev.clientY-startY);
      finalHeight=height;
      setRowHeights(previous=>({...previous,[storageKey]:height}));
    };
    const end=()=>{
      window.removeEventListener('pointermove',move);
      window.removeEventListener('pointerup',end);
      setRowHeights(previous=>{
        localStorage.setItem(rowHeightStorageKey,JSON.stringify(previous));
        return previous;
      });
      if(finalHeight!==currentHeight)
        rememberUndo({kind:'size',label:'Altura da linha '+position,
          target:'row',key:storageKey,before:originalValue,after:finalHeight});
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
    if(!row||!column)return;
    if(BASE_COLUMN_LIST[column.key]&&column.editable&&userRole!=='CONSULTA')beginCellEdit(ri,ci);
    else {
      const target=Array.from(gridRef.current?.querySelectorAll<HTMLElement>('[data-cell-id]')||[])
        .find(item=>item.dataset.cellId===row.id+':'+column.key);
      target?.focus({preventScroll:true});
    }
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

  function selectBlankCell(index:number,columnIndex:number,openEditor=false,replacement?:string){
    const column=visibleColumns[columnIndex];
    if(!sheetCanvas||!column)return;
    setSelectedCell(null);setSelectionMode('cell');setSelectedRowId(null);
    setSelectedColumnKey(null);setSelectedBlankRow(null);setSelectionAnchor(null);
    setPlaceholderPosition({row:index,column:columnIndex});
    if(openEditor){
      if(userRole==='CONSULTA'||!column.editable || gridRangeSupported!==true ||
         (!isGitHubPagesPreview && !loadedGridChunksRef.current.has(Math.floor(index/100))))return;
      setBlankEditing({index,columnKey:column.key});
      setBlankDraft(replacement??'');
    }else{
      setBlankEditing(null);
      window.requestAnimationFrame(()=>{
        const target=gridRef.current?.querySelector<HTMLElement>(
          '[data-grid-empty-row="'+index+'"][data-grid-empty-column="'+columnIndex+'"]');
        target?.focus({preventScroll:true});
      });
    }
  }
  async function saveBlankCell(index:number,column:Column,value:string,
    key:'Enter'|'Tab'|null=null,shift=false){
    if(blankSaving||userRole==='CONSULTA'||!token||gridRangeSupported!==true)return;
    const parsed=LOCKED_COLUMN_FORMAT[column.key]
      ?parseSheetValue(value,LOCKED_COLUMN_FORMAT[column.key])
      :parseEditableValue(column.dataType,value);
    if(!parsed.ok){setApiError(parsed.message+' na coluna '+column.label);return;}
    if(parsed.value===null||parsed.value===''){
      setBlankEditing(null);setBlankDraft('');
    }else{
      if (isGitHubPagesPreview) {
        const position = index + 2;
        const existing = rowsRef.current.find(row => Number(row.sheetRowNumber ?? row.sequence + 1) === position);
        const created: RecordRow = existing
          ? { ...existing, data: { ...existing.data, [column.key]: parsed.value }, updatedAt: new Date().toISOString() }
          : { id: 'local-sheet-row-' + position, sequence: position - 1, sheetRowNumber: position, data: { [column.key]: parsed.value },
              status: column.key === 'C' ? valueText(parsed.value) : '', clientName: column.key === 'L' ? valueText(parsed.value) : '',
              container: column.key === 'T' ? valueText(parsed.value) : '', cte: column.key === 'D' ? valueText(parsed.value) : '',
              updatedAt: new Date().toISOString() };
        const nextRows = existing ? rowsRef.current.map(row => row.id === existing.id ? created : row)
          : [...rowsRef.current, created].sort((a,b) => Number(a.sheetRowNumber ?? a.sequence + 1) - Number(b.sheetRowNumber ?? b.sequence + 1));
        rowsRef.current = nextRows; setRows(nextRows); setTotal(nextRows.length);
        setMaxSheetRowNumber(previous => Math.max(previous, position));
        const edit = buildUndoRecord(existing ?? { id: created.id, data: {} }, created, [column.key]);
        if (edit) rememberUndo({ kind: 'cells', label: 'Preenchimento de nova linha', edits: [edit] });
        setNotice('Linha ' + position + ' criada automaticamente ao preencher a célula.');
        setApiError(''); setBlankEditing(null); setBlankDraft(''); return;
      }
      setBlankSaving(true);
      try{
        const response=await fetch(apiBase+'/api/v1/mapa',{
          method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
          body:JSON.stringify({sheetRowNumber:index+2,data:{[column.key]:parsed.value}})
        });
        const body=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(body?.error?.message||
          'Não foi possível gravar esta linha. Verifique a API de homologação.');
        const created=body.item as RecordRow;
        const createdEdit=buildUndoRecord({id:created.id,data:{}},created,[column.key]);
        if(createdEdit)rememberUndo({kind:'cells',label:'Preenchimento de nova linha',edits:[createdEdit]});
        const inherited=inheritNewRowFormat(created,index+2,displayedRows);
        setRows(previous=>mergeLoadedRows(previous,[created]));
        void syncNewRowFormat(inherited);
        setTotal(previous=>previous+1);
        setMaxSheetRowNumber(previous=>Math.max(previous,index+2));
        setNotice('Linha '+(index+2)+' criada automaticamente ao preencher a célula.');
        setApiError('');
        setBlankEditing(null);setBlankDraft('');
      }catch(error){
        setApiError(error instanceof Error?error.message:'Falha ao criar a linha.');
        setBlankSaving(false);return;
      }finally{setBlankSaving(false);}
    }
    if(key){
      const next=moveGridPosition({row:index,column:visibleColumns.indexOf(column)},key,
        SHEET_MAX_ROW-1,visibleColumns.length,shift);
      const nextRow=sheetRecordsByRow.get(next.row+2);
      if(nextRow){
        selectGridCell(displayedRows.findIndex(row=>row.id===nextRow.id),next.column,false,true);
      }else selectBlankCell(next.row,next.column,false);
    }else selectBlankCell(index,visibleColumns.indexOf(column),false);
  }

  function beginCellEdit(rowIndex: number, columnIndex: number, replacement?: string) {
    const row = displayedRows[rowIndex], column = visibleColumns[columnIndex];
    if (!row || !column || !token || userRole === 'CONSULTA' || !column.editable || editingBusyRef.current || gridMutationBusyRef.current) return;
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
    setSelectedBlankRow(null);
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
  function selectEntireRow(rowIndex: number,shift=false,additive=false) {
    const row = displayedRows[rowIndex], firstColumn = visibleColumns[0];
    if (!row || !firstColumn) return;
    setOpenFilterKey(null);
    // The row number replaces selection checkboxes. Shift extends the row
    // interval; Ctrl/Cmd toggles additional rows for bulk actions.
    setSelectedRowIds(previous=>{
      if(shift && selectedRowId){
        const anchor=displayedRows.findIndex(item=>item.id===selectedRowId);
        if(anchor>=0){
          const start=Math.min(anchor,rowIndex),end=Math.max(anchor,rowIndex);
          return Array.from(new Set([...previous,...displayedRows.slice(start,end+1).map(item=>item.id)]));
        }
      }
      if(additive)return previous.includes(row.id)
        ?previous.filter(id=>id!==row.id):[...previous,row.id];
      return [row.id];
    });
    setSelectionMode('row'); setSelectedRowId(row.id); setSelectedColumnKey(null);
    setSelectedBlankRow(null);
    setSelectionAnchor({rowId:row.id,columnKey:firstColumn.key});
    setSelectedCell({row,column:firstColumn});
    setEditingCell(null);
    gridRef.current?.focus({preventScroll:true});
  }
  function selectEntireColumn(column: Column) {
    setOpenFilterKey(null);
    setSelectionMode('column'); setSelectedColumnKey(column.key); setSelectedRowId(null);
    setSelectedBlankRow(null);
    const firstRow = displayedRows[0];
    if (firstRow) {
      setSelectionAnchor({rowId:firstRow.id,columnKey:column.key});
      setSelectedCell({row:firstRow,column});
    } else { setSelectedCell(null); }
    setEditingCell(null);
    gridRef.current?.focus({preventScroll:true});
  }
  function selectAllLoadedCells() {
    if(!displayedRows.length || !visibleColumns.length)return;
    setSelectionMode('cell');
    setSelectedRowId(null);setSelectedColumnKey(null);
    setSelectionAnchor({rowId:displayedRows[0].id,columnKey:visibleColumns[0].key});
    setSelectedCell({row:displayedRows[displayedRows.length-1],
      column:visibleColumns[visibleColumns.length-1]});
    gridRef.current?.focus({preventScroll:true});
  }
  function openSheetContext(event: React.MouseEvent<HTMLElement>, kind:SheetContextKind,
    rowIndex?:number,columnIndex?:number) {
    if(userRole!=='ADMIN')return;
    event.preventDefault();event.stopPropagation();
    if(editingCell)setEditingCell(null);
    if(kind==='row' && rowIndex!==undefined){
      const row=displayedRows[rowIndex];
      if(row && !(selectedRowIds.includes(row.id) || (selectionMode==='row' && selectedRowId===row.id) ||
        (selectedBounds && rowIndex>=selectedBounds.top && rowIndex<=selectedBounds.bottom)))
        selectEntireRow(rowIndex);
    }else if(kind==='column' && columnIndex!==undefined){
      const column=visibleColumns[columnIndex];
      if(column && !(selectionMode==='column' && selectedColumnKey===column.key))
        selectEntireColumn(column);
    }else if(kind==='cell' && rowIndex!==undefined && columnIndex!==undefined){
      if(!selectedBounds || rowIndex<selectedBounds.top || rowIndex>selectedBounds.bottom ||
        columnIndex<selectedBounds.left || columnIndex>selectedBounds.right)
        selectGridCell(rowIndex,columnIndex,false,false);
    }else if(kind==='all')selectAllLoadedCells();
    setOpenFilterKey(null);
    setSheetContextMenu({kind,x:event.clientX,y:event.clientY,rowIndex,columnIndex});
  }
  async function performSheetContextAction(action:SheetContextAction) {
    const context=sheetContextMenu;
    setSheetContextMenu(null);
    if(userRole!=='ADMIN'||!context||adminSheetBusy)return;
    const currentColumn=context.columnIndex===undefined?selectedCell?.column:
      visibleColumns[context.columnIndex];
    const currentRow=context.rowIndex===undefined?selectedCell?.row:displayedRows[context.rowIndex];
    if(action==='select-all'){selectAllLoadedCells();return;}
    if(action==='copy'||action==='cut'){
      try{
        if(!selectedBounds)throw new Error('Selecione uma célula antes de copiar.');
        await navigator.clipboard.writeText(selectedGridText());
        if(action==='cut')await clearGridSelection();
        else setNotice('Conteúdo copiado. Use Ctrl+V para colar.');
      }catch(error){setApiError(error instanceof Error?error.message:'Não foi possível copiar.');}
      return;
    }
    if(action==='paste'||action==='paste-values'){
      try {pasteGridText(await navigator.clipboard.readText());}
      catch {setApiError('O navegador bloqueou a área de transferência. Use Ctrl+V.');}
      return;
    }
    if(action==='clear'){await clearGridSelection();return;}
    if(action==='insert-rows'){setNewRowsOpen(true);return;}
    if(action==='conditional'){setShowStatusColors(true);return;}
    if(action==='sort-asc'||action==='sort-desc'){
      if(currentColumn)setSortConfig({key:currentColumn.key,
        direction:action==='sort-asc'?'asc':'desc'});
      return;
    }
    if(action==='filter'){
      if(currentColumn){
        const button=Array.from(gridRef.current?.querySelectorAll<HTMLButtonElement>('.sheet-filter-trigger')||[])
          .find(el=>el.getAttribute('aria-label')===
            'Abrir filtro da coluna '+(currentColumn.label||currentColumn.key));
        button?.click();
      }
      return;
    }
    if(action==='dropdown'){
      if(currentColumn && BASE_COLUMN_LIST[currentColumn.key] && currentRow){
        const r=displayedRows.findIndex(item=>item.id===currentRow.id);
        const c=visibleColumns.findIndex(item=>item.key===currentColumn.key);
        if(r>=0&&c>=0)beginCellEdit(r,c);
      }else setActive('Cadastros');
      return;
    }
    if(action==='resize-row' && currentRow){
      const position=Number(currentRow.sheetRowNumber??currentRow.sequence+1);
      const answer=window.prompt('Altura da linha em pixels (12 a 2000):',
        String(rowHeightAt(position,currentRow)));
      if(answer===null)return;
      const n=Number(answer);
      if(!Number.isInteger(n)||n<MIN_ROW_HEIGHT||n>MAX_ROW_HEIGHT){
        setApiError('Informe uma altura de '+MIN_ROW_HEIGHT+' a '+MAX_ROW_HEIGHT+' pixels.');return;
      }
      setRowHeights(previous=>{
        const next={...previous,['slot:'+position]:n};
        localStorage.setItem(rowHeightStorageKey,JSON.stringify(next));
        return next;
      });
      return;
    }
    if(action==='resize-column' && currentColumn){
      const answer=window.prompt('Largura da coluna em pixels ('+MIN_COLUMN_WIDTH+' a '+MAX_COLUMN_WIDTH+'):',
        String(columnWidths[currentColumn.key]??sourceColumnWidth(currentColumn.key)));
      if(answer===null)return;
      const n=Number(answer);
      if(!Number.isInteger(n)||n<MIN_COLUMN_WIDTH||n>MAX_COLUMN_WIDTH){
        setApiError('Informe uma largura de '+MIN_COLUMN_WIDTH+' a '+MAX_COLUMN_WIDTH+' pixels.');return;
      }
      setColumnWidths(previous=>{
        const next={...previous,[currentColumn.key]:n};
        localStorage.setItem(widthKey,JSON.stringify(next));
        return next;
      });
      return;
    }
    if(action==='hide-column' && currentColumn){
      if(visibleColumns.length<=1){setApiError('Não é possível ocultar a última coluna.');return;}
      const next=visibleKeys.filter(key=>key!==currentColumn.key);
      setVisibleKeys(next);localStorage.setItem(preferenceKey,JSON.stringify(next));
      void persistPreferences({visibleKeys:next});
      setSelectedCell(null);
      setNotice('Coluna '+currentColumn.key+' oculta apenas na sua visualização.');
      return;
    }
    if(action==='delete-rows'){
      const rowsInRange=selectedBounds
        ?displayedRows.slice(selectedBounds.top,selectedBounds.bottom+1):[];
      const checkboxRows=displayedRows.filter(row=>selectedRowIds.includes(row.id));
      const candidates=context.kind==='row'&&currentRow
        ?checkboxRows.some(item=>item.id===currentRow.id)?checkboxRows
          :rowsInRange.some(item=>item.id===currentRow.id)?rowsInRange:[currentRow]
        :rowsInRange;
      const unique=[...new Map(candidates.map(item=>[item.id,item])).values()];
      if(!unique.length){setApiError('Selecione uma ou mais linhas.');return;}
      if(unique.length>100){setApiError('É possível excluir até 100 linhas por operação.');return;}
      if(!window.confirm(isGitHubPagesPreview ? 'Excluir ' + unique.length + ' linha(s) desta cópia local?' : 'Arquivar '+unique.length+' linha(s) selecionada(s)? Elas deixarão a grade, mas o histórico será preservado.'))return;
      if (isGitHubPagesPreview) {
        const ids = new Set(unique.map(row => row.id)); const nextRows = rowsRef.current.filter(row => !ids.has(row.id));
        rowsRef.current = nextRows; setRows(nextRows); setTotal(nextRows.length);
        setSelectedRowIds([]); setSelectedCell(null); setSelectionAnchor(null);
        setNotice(unique.length + ' linha(s) excluída(s) desta cópia local.'); return;
      }
      setAdminSheetBusy(true);
      try{
        const response=await fetch(apiBase+'/api/v1/mapa/archive-selected',{
          method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
          body:JSON.stringify({ids:unique.map(row=>row.id)})
        });
        const body=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(response.status===404
          ?'Exclusão indisponível na API atual. Conecte o backend de homologação.'
          :body?.error?.message||'Falha ao arquivar as linhas.');
        setSelectedRowIds([]);setSelectedCell(null);setSelectionAnchor(null);
        setRows(previous=>previous.filter(row=>!unique.some(item=>item.id===row.id)));
        setTotal(previous=>Math.max(0,previous-unique.length));
        setNotice(unique.length+' linha(s) arquivada(s) com auditoria.');
        setPage(1);lastRequestedPageRef.current=0;
        setRetryRowsKey(value=>value+1);
      }catch(error){setApiError(error instanceof Error?error.message:'Falha na exclusão.');}
      finally{setAdminSheetBusy(false);}
      return;
    }
    if(action==='delete-column' && currentColumn){
      if(visibleColumns.length<=1){setApiError('Não é possível excluir a última coluna.');return;}
      if(!window.confirm(isGitHubPagesPreview ? 'Excluir a coluna ' + currentColumn.key + ' desta cópia local?' : 'Excluir a coluna '+currentColumn.key+' ('+currentColumn.label+') da grade compartilhada? Valores antigos e histórico serão preservados.'))return;
      if (isGitHubPagesPreview) {
        setColumns(previous => previous.filter(item => item.key !== currentColumn.key));
        setVisibleKeys(previous => previous.filter(key => key !== currentColumn.key));
        const nextRows = rowsRef.current.map(row => { const data = { ...row.data }; delete data[currentColumn.key]; return { ...row, data }; });
        rowsRef.current = nextRows; setRows(nextRows); setSelectedCell(null); setSelectionAnchor(null); setSelectedColumnKey(null);
        setNotice('Coluna ' + currentColumn.key + ' excluída desta cópia local.'); return;
      }
      setAdminSheetBusy(true);
      try{
        const response=await fetch(apiBase+'/api/v1/config/columns/'+encodeURIComponent(currentColumn.key)+'/archive',{
          method:'PATCH',headers:{Authorization:'Bearer '+token}
        });
        const body=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(response.status===404
          ?'A API conectada ainda não oferece a exclusão de colunas. Use homologação.'
          :body?.error?.message||'Não foi possível excluir a coluna.');
        setColumns(previous=>previous.filter(item=>item.key!==currentColumn.key));
        setVisibleKeys(previous=>{
          const next=previous.filter(key=>key!==currentColumn.key);
          localStorage.setItem(preferenceKey,JSON.stringify(next));
          return next;
        });
        setSelectedCell(null);setSelectionAnchor(null);setSelectedColumnKey(null);
        setNotice('Coluna '+currentColumn.key+' arquivada para todos. Os dados históricos foram mantidos.');
      }catch(error){setApiError(error instanceof Error?error.message:'Falha ao excluir a coluna.');}
      finally{setAdminSheetBusy(false);}
    }
  }

  function onGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const element = event.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName) ||
      pasteBusy || adminSheetBusy || editingCell) return;
    if(userRole==='ADMIN' && (event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='a'){
      event.preventDefault();selectAllLoadedCells();return;
    }
    if(userRole==='ADMIN' && (event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='x'){
      event.preventDefault();
      if(selectedBounds)void navigator.clipboard.writeText(selectedGridText())
        .then(()=>clearGridSelection())
        .catch(()=>setApiError('Recorte bloqueado pelo navegador. Use o menu de contexto.'));
      return;
    }
    if(userRole==='ADMIN' && event.shiftKey && event.key==='F10' && selectedPosition){
      event.preventDefault();
      const cell=gridRef.current?.querySelector<HTMLElement>(
        '[data-grid-row="'+selectedPosition.row+'"][data-grid-column="'+selectedPosition.column+'"]');
      const rect=cell?.getBoundingClientRect();
      setSheetContextMenu({kind:'cell',rowIndex:selectedPosition.row,
        columnIndex:selectedPosition.column,x:rect?.left||30,y:rect?.bottom||100});
      return;
    }
    if (!selectedPosition && placeholderPosition && sheetCanvas) {
      const action=gridKeyboardAction(event.key,false);
      if(action==='move'){
        event.preventDefault();
        const next=moveGridPosition(placeholderPosition,event.key,
          SHEET_MAX_ROW-1,visibleColumns.length,event.shiftKey);
        const record=sheetRecordsByRow.get(next.row+2);
        if(record){
          const index=displayedRows.findIndex(item=>item.id===record.id);
          if(index>=0)selectGridCell(index,next.column,false,true);
        }else selectBlankCell(next.row,next.column,false);
      }else if(event.key==='Delete'||event.key==='Backspace'){
        event.preventDefault();
      }else if(action==='edit' || (!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.key.length===1)){
        event.preventDefault();
        selectBlankCell(placeholderPosition.row,placeholderPosition.column,true,
          action==='edit'?'':event.key);
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
    if(event.key==='Delete'||event.key==='Backspace'){
      event.preventDefault();void clearGridSelection();return;
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
  async function updateGridRows(
    edits: {row:RecordRow;changes:Record<string,string|number|boolean|null>}[],
    action: 'Colagem' | 'Limpeza'
  ) {
    if(gridMutationBusyRef.current || !token || (!apiBase && !isGitHubPagesPreview) || userRole==='CONSULTA')return;
    gridMutationBusyRef.current=true;setPasteBusy(true);setApiError('');
    let saved=0;
    const undoEdits:UndoRecord[]=[];
    try{
      if (isGitHubPagesPreview) {
        const updates = new Map<string, RecordRow>();
        for (const { row, changes } of edits) {
          if (!Object.keys(changes).length) continue;
          const current = rowsRef.current.find(item => item.id === row.id) || row;
          const updated: RecordRow = { ...current, data: { ...current.data, ...changes }, updatedAt: new Date().toISOString(),
            ...(Object.prototype.hasOwnProperty.call(changes, 'C') ? { status: valueText(changes.C) } : {}) };
          updates.set(updated.id, updated);
          const undo = buildUndoRecord(current, updated, Object.keys(changes)); if (undo) undoEdits.push(undo);
          saved++;
        }
        const nextRows = rowsRef.current.map(row => updates.get(row.id) || row);
        rowsRef.current = nextRows; setRows(nextRows);
        setNotice(action + ' aplicada diretamente neste navegador: ' + saved + ' linha(s) atualizada(s).');
      } else {
      for(const {row,changes} of edits){
        if(!Object.keys(changes).length)continue;
        const response=await fetch(apiBase+'/api/v1/mapa/'+encodeURIComponent(row.id),{
          method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
          body:JSON.stringify({changes,expectedUpdatedAt:row.updatedAt})
        });
        const body=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(body?.error?.message||'Não foi possível atualizar a linha '+row.sequence);
        const updated=body.item as RecordRow;
        const edit=buildUndoRecord(row,updated,Object.keys(changes));
        if(edit)undoEdits.push(edit);
        setRows(previous=>previous.map(item=>item.id===row.id?updated:item));
        saved++;
      }
      setNotice(action+' aplicada diretamente: '+saved+' linha(s) atualizada(s).');
      }
    }catch(error){
      setApiError(action+' interrompida após '+saved+' linha(s) salva(s): '+
        (error instanceof Error?error.message:'Falha de gravação')+
        '. As células restantes não foram alteradas. Recarregue antes de tentar novamente.');
    }finally{
      if(undoEdits.length)rememberUndo({kind:'cells',label:action,edits:undoEdits});
      gridMutationBusyRef.current=false;setPasteBusy(false);
    }
  }
  async function clearGridSelection() {
    if(!selectedBounds || pasteBusy || gridMutationBusyRef.current)return;
    if(userRole==='CONSULTA'){setApiError('Sem permissão para limpar células.');return;}
    const planned=planClearSelection(selectedBounds,displayedRows,visibleColumns,2000);
    if(!planned){setApiError('Seleção protegida, fora da grade ou maior que 2.000 células. Nada foi apagado.');return;}
    const changesById=new Map(planned.map(item=>[item.rowId,item.changes]));
    const edits=displayedRows.filter(row=>changesById.has(row.id))
      .map(row=>({row,changes:changesById.get(row.id)!}));
    if(edits.length)await updateGridRows(edits,'Limpeza');
  }
  async function pasteVirtualRange(plainText:string,start:GridPosition){
    if((!isGitHubPagesPreview&&gridRangeSupported!==true)||!token||userRole==='CONSULTA'){
      setApiError('A colagem em linhas virtuais requer a API de homologação atualizada.');
      return;
    }
    const matrix=parseClipboardGrid(plainText);
    if(!matrix.length||matrix.length>100 || matrix.length*matrix[0].length>2000 ||
      matrix.some(row=>row.length!==matrix[0].length)||
      start.row+matrix.length>SHEET_MAX_ROW-1 ||
      start.column+matrix[0].length>visibleColumns.length){
      setApiError('Cole até 100 linhas e 2.000 células em um intervalo válido.');
      return;
    }
    const requested:{position:number;changes:Record<string,string|number|boolean|null>}[]=[];
    for(let i=0;i<matrix.length;i++){
      const changes:Record<string,string|number|boolean|null>={};
      for(let j=0;j<matrix[i].length;j++){
        const column=visibleColumns[start.column+j];
        if(!column?.editable){setApiError('Coluna protegida. Nada foi colado.');return;}
        const parsed=LOCKED_COLUMN_FORMAT[column.key]
          ?parseSheetValue(matrix[i][j],LOCKED_COLUMN_FORMAT[column.key])
          :parseEditableValue(column.dataType,matrix[i][j]);
        if(!parsed.ok){setApiError('Valor inválido em '+column.label+'. Nada foi colado.');return;}
        changes[column.key]=parsed.value;
      }
      requested.push({position:start.row+i+2,changes});
    }
    if (isGitHubPagesPreview) {
      const byPosition = new Map<number, RecordRow>(rowsRef.current.map(row => [Number(row.sheetRowNumber ?? row.sequence + 1), row]));
      const updates = new Map<string, RecordRow>(); const createdRows: RecordRow[] = []; const undoEdits: UndoRecord[] = [];
      for (const item of requested) {
        const old = byPosition.get(item.position);
        if (!old && !Object.values(item.changes).some(value => value !== null && value !== '')) continue;
        const updated: RecordRow = old
          ? { ...old, data: { ...old.data, ...item.changes }, updatedAt: new Date().toISOString() }
          : { id: 'local-sheet-row-' + item.position, sequence: item.position - 1, sheetRowNumber: item.position,
              data: { ...item.changes }, status: valueText(item.changes.C || ''), clientName: valueText(item.changes.L || ''),
              container: valueText(item.changes.T || ''), cte: valueText(item.changes.D || ''), updatedAt: new Date().toISOString() };
        updates.set(updated.id, updated); if (!old) createdRows.push(updated);
        const undo = buildUndoRecord(old ?? { id: updated.id, data: {} }, updated, Object.keys(item.changes));
        if (undo) undoEdits.push(undo);
      }
      const nextRows = [...rowsRef.current.filter(row => !updates.has(row.id)), ...updates.values()]
        .sort((a,b) => Number(a.sheetRowNumber ?? a.sequence + 1) - Number(b.sheetRowNumber ?? b.sequence + 1));
      rowsRef.current = nextRows; setRows(nextRows); setTotal(nextRows.length);
      setMaxSheetRowNumber(previous => Math.max(previous, ...requested.map(item => item.position)));
      if (undoEdits.length) rememberUndo({ kind: 'cells', label: 'Colagem em linhas da grade', edits: undoEdits });
      setBlankEditing(null); setBlankDraft(''); setPlaceholderPosition(null);
      setNotice('Colagem direta: ' + updates.size + ' linha(s) atualizada(s); ' + createdRows.length + ' criada(s).');
      setApiError(''); return;
    }
    gridMutationBusyRef.current=true;setPasteBusy(true);setApiError('');
    let saved=0,created=0;
    const undoEdits:UndoRecord[]=[];
    try{
      const response=await fetch(apiBase+'/api/v1/mapa/grid?'+new URLSearchParams({
        start:String(start.row+2),count:String(matrix.length)
      }),{headers:{Authorization:'Bearer '+token}});
      if(!response.ok)throw new Error('Não foi possível conferir as linhas antes da colagem.');
      const body=await response.json();
      const current=new Map<number,RecordRow>(
        (body.items as RecordRow[]).map(item=>[Number(item.sheetRowNumber),item]));
      const knownRows=[...displayedRows,...(body.items as RecordRow[])];
      let lastInherited:PresentationSnapshot|null=null;
      for(const item of requested){
        const old=current.get(item.position);
        const changes=Object.fromEntries(Object.entries(item.changes).filter(
          ([key,value])=>old?old.data?.[key]!==value:value!==null && value!==''));
        if(!Object.keys(changes).length)continue;
        const res=await fetch(old
          ?apiBase+'/api/v1/mapa/'+encodeURIComponent(old.id)
          :apiBase+'/api/v1/mapa',{
          method:old?'PATCH':'POST',
          headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
          body:JSON.stringify(old
            ?{changes,expectedUpdatedAt:old.updatedAt}
            :{sheetRowNumber:item.position,data:changes})
        });
        const savedBody=await res.json().catch(()=>({}));
        if(!res.ok)throw new Error(savedBody?.error?.message||
          'Erro ao salvar a linha '+item.position);
        const updated=savedBody.item as RecordRow;
        const edit=buildUndoRecord(old??{id:updated.id,data:{}},updated,Object.keys(changes));
        if(edit)undoEdits.push(edit);
        setRows(previous=>mergeLoadedRows(previous,[updated])
          .map(row=>row.id===updated.id?updated:row));
        if(!old){
          const createdRow=savedBody.item as RecordRow;
          lastInherited=inheritNewRowFormat(createdRow,item.position,knownRows)??lastInherited;
          knownRows.push(createdRow);
          created++;
        }
        saved++;
      }
      if(created)setTotal(previous=>previous+created);
      void syncNewRowFormat(lastInherited);
      setMaxSheetRowNumber(previous=>Math.max(previous,...requested.map(item=>item.position)));
      setNotice('Colagem direta: '+saved+' linha(s) atualizada(s); '+
        created+' criada(s) automaticamente.');
    }catch(error){
      setApiError('Colagem interrompida após '+saved+' linhas. '+
        (error instanceof Error?error.message:'Falha de rede')+
        '. Linhas já confirmadas foram preservadas.');
      if(created)setTotal(previous=>previous+created);
    }finally{
      if(undoEdits.length)rememberUndo({kind:'cells',label:'Colagem em linhas da grade',edits:undoEdits});
      gridMutationBusyRef.current=false;setPasteBusy(false);
    }
  }

  function onGridPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const element=event.target as HTMLElement;
    if(['INPUT','TEXTAREA','SELECT'].includes(element.tagName))return;
    event.preventDefault();
    pasteGridText(event.clipboardData.getData('text/plain'));
  }
  function pasteGridText(plainText: string) {
    if(userRole==='CONSULTA'){setApiError('Seu perfil permite apenas consultar a planilha.');return;}
    if(pasteBusy||gridMutationBusyRef.current)return;
    if(!selectedPosition){
      if(placeholderPosition && sheetCanvas){
        void pasteVirtualRange(plainText,placeholderPosition);
        return;
      }
      setApiError('Selecione uma célula para colar.');
      return;
    }
    const matrix=parseClipboardGrid(plainText);
    if(!canPasteMatrix(matrix,selectedPosition,displayedRows.length,visibleColumns.length,2000)){
      if (isGitHubPagesPreview && matrix.length && matrix.every(row => row.length === matrix[0].length) &&
          selectedPosition.column + matrix[0].length <= visibleColumns.length) {
        const selectedRow = displayedRows[selectedPosition.row];
        const startRow = Number(selectedRow?.sheetRowNumber ?? selectedPosition.row + 2) - 2;
        if (startRow >= 0) { void pasteVirtualRange(plainText, { row: startRow, column: selectedPosition.column }); return; }
      }
      setApiError('A colagem deve ser retangular, caber nas linhas carregadas e conter até 2.000 células.');
      return;
    }
    const edits:{row:RecordRow;changes:Record<string,string|number|boolean|null>}[]=[];
    // Validate all target cells before the first audited PATCH.
    for(let i=0;i<matrix.length;i++){
      const row=displayedRows[selectedPosition.row+i];
      const changes:Record<string,string|number|boolean|null>={};
      for(let j=0;j<matrix[i].length;j++){
        const column=visibleColumns[selectedPosition.column+j];
        if(!column?.editable){setApiError('Coluna protegida. Nenhuma célula foi alterada.');return;}
        const parsed=LOCKED_COLUMN_FORMAT[column.key]
          ?parseSheetValue(matrix[i][j],LOCKED_COLUMN_FORMAT[column.key])
          :parseEditableValue(column.dataType,matrix[i][j]);
        if(!parsed.ok){setApiError('Valor inválido em '+column.label+'. Nenhuma célula foi alterada.');return;}
        if(row.data?.[column.key]!==parsed.value)changes[column.key]=parsed.value;
      }
      if(Object.keys(changes).length)edits.push({row,changes});
    }
    void updateGridRows(edits,'Colagem');
  }
  function beginColumnResize(event: React.PointerEvent<HTMLSpanElement>, column: Column) {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const th = event.currentTarget.closest('th');
    const startWidth = th?.getBoundingClientRect().width || 180;
    const originalValue=columnWidths[column.key]??null;
    const startX = event.clientX;
    let finalWidth=startWidth;
    const onMove = (move: PointerEvent) => {
      const width = normalizeColumnWidth(startWidth + move.clientX - startX);
      finalWidth=width;
      setColumnWidths(previous => ({ ...previous, [column.key]: width }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setColumnWidths(previous => {
        localStorage.setItem(widthKey, JSON.stringify(previous));
        return previous;
      });
      if(Math.round(finalWidth)!==Math.round(startWidth))
        rememberUndo({kind:'size',label:'Largura da coluna '+column.key,
          target:'column',key:column.key,before:originalValue,after:finalWidth});
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }

  async function createManyRows() {
    const count=normalizeCreateCount(newRowsCount);
    if(!count||(!apiBase&&!isGitHubPagesPreview)||!token||creatingRows||userRole==='CONSULTA') {
      setApiError('Informe de 1 a 100 linhas e confira suas permissões.');return;
    }
    if(!window.confirm(isGitHubPagesPreview ? 'Criar ' + count + ' linhas vazias nesta cópia local do MAPA?' : 'Criar '+count+' linhas vazias no MAPA? Elas serão registros reais na API conectada.'))return;
    setCreatingRows(true);setApiError('');
    try{
      if (isGitHubPagesPreview) {
        const start = Math.max(maxSheetRowNumber, ...rows.map(row => Number(row.sheetRowNumber ?? row.sequence + 1))) + 1;
        const createdRows: RecordRow[] = Array.from({ length: count }, (_, offset) => {
          const position = start + offset;
          return { id: 'local-sheet-row-' + position, sequence: position - 1, sheetRowNumber: position, data: {},
            status: '', clientName: '', container: '', cte: '', updatedAt: new Date().toISOString() };
        });
        const nextRows = [...rowsRef.current, ...createdRows].sort((a,b) => Number(a.sheetRowNumber ?? a.sequence + 1) - Number(b.sheetRowNumber ?? b.sequence + 1));
        rowsRef.current = nextRows; setRows(nextRows); setTotal(nextRows.length); setMaxSheetRowNumber(start + count - 1);
        setNewRowsOpen(false); setNotice(count + ' linha(s) vazia(s) criada(s) nesta cópia local.'); setApiError('');
        if (gridRef.current) gridRef.current.scrollTop = 0; return;
      }
      const response=await fetch(apiBase+'/api/v1/mapa/batch-blank',{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
        body:JSON.stringify({count})
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(response.status===404
        ? 'A API conectada ainda não suporta a criação de várias linhas. Habilite a API de homologação.'
        : body?.error?.message||'Não foi possível criar as linhas.');
      // Multiple new rows follow the same formatting inheritance rule.
      const createdRows=Array.isArray(body.items)?body.items as RecordRow[]:[];
      const prior=[...displayedRows];let inherited:PresentationSnapshot|null=null;
      for(const item of createdRows){
        const position=Number(item.sheetRowNumber??item.sequence+1);
        inherited=inheritNewRowFormat(item,position,prior)??inherited;
        prior.push(item);
      }
      void syncNewRowFormat(inherited);
      setNewRowsOpen(false);setPage(1);lastRequestedPageRef.current=0;
      setRows([]);setRetryRowsKey(previous=>previous+1);
      if(gridRef.current)gridRef.current.scrollTop=0;
      setNotice(count+' linhas criadas com histórico de auditoria.');
    }catch(error){setApiError(error instanceof Error?error.message:'Falha na criação.');}
    finally{setCreatingRows(false);}
  }

  function exportLocalCsv() {
    if (!isGitHubPagesPreview) return;
    const csvEscape = (value: unknown) => '"' + valueText(value).replace(/"/g, '""') + '"';
    const orderedRows = [...rows].sort((a,b) => Number(a.sheetRowNumber ?? a.sequence + 1) - Number(b.sheetRowNumber ?? b.sequence + 1));
    const lines = [
      visibleColumns.map(column => csvEscape(column.label || column.key)).join(','),
      ...orderedRows.map(row => visibleColumns.map(column => csvEscape(row.data?.[column.key])).join(','))
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'mapa-costalog-local.csv'; anchor.click();
    URL.revokeObjectURL(url);
    setNotice('CSV exportado. O arquivo contém a cópia local atual da planilha.');
  }
  async function importLocalCsv(file: File) {
    if (!isGitHubPagesPreview) return;
    try {
      const matrix = parseCsvMatrix(await file.text());
      if (matrix.length < 2) throw new Error('O CSV precisa ter cabeçalho e pelo menos uma linha de dados.');
      const used = new Set<string>();
      const mapping = matrix[0].map((header, index) => {
        const normalized = header.trim().toLocaleLowerCase('pt-BR');
        const exact = columns.find(column => !used.has(column.key) &&
          [column.key, column.label, column.key + ' - ' + column.label]
            .some(candidate => candidate.trim().toLocaleLowerCase('pt-BR') === normalized));
        if (exact) { used.add(exact.key); return exact; }
        return visibleColumns[index] || null;
      });
      const sourceRows = matrix.slice(1).filter(values => values.some(value => value.trim() !== ''));
      const imported: RecordRow[] = sourceRows.map((values, index) => {
        const data: Record<string, unknown> = Object.fromEntries(columns.map(column => [column.key, '']));
        mapping.forEach((column, colIndex) => { if (column) data[column.key] = values[colIndex] ?? ''; });
        const position = index + 2;
        return { id: 'local-import-' + Date.now().toString(36) + '-' + index, sequence: index + 1,
          sheetRowNumber: position, data, status: valueText(data.C || ''), clientName: valueText(data.L || ''),
          container: valueText(data.T || ''), cte: valueText(data.D || ''), updatedAt: new Date().toISOString() };
      });
      rowsRef.current = imported; setRows(imported); setTotal(imported.length);
      setMaxSheetRowNumber(imported.length + 1); setSelectedCell(null); setSelectedRowIds([]);
      setSelectionAnchor(null); setPlaceholderPosition(null); setPage(1); setSortConfig(null);
      setQuery(''); setStatus(''); setFilterColumn(''); setFilterValue(''); setColumnFilters({});
      setNotice('CSV importado: ' + imported.length + ' linha(s). A planilha local foi substituída pelo arquivo.');
      setApiError('');
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Não foi possível importar o CSV.');
    }
  }

  if (!token) {
    return <main className={'auth-layout '+(structuralDarkMode?'structural-dark':'')}>
      <button type="button" className="structural-theme-toggle auth-theme-toggle"
        aria-label={structuralDarkMode?'Ativar modo claro':'Ativar modo escuro'}
        title={structuralDarkMode?'Modo claro':'Modo escuro'}
        aria-pressed={structuralDarkMode} onClick={toggleStructuralDarkMode}>
        {structuralDarkMode?<Sun size={15}/>:<Moon size={15}/>}
        <span>{structuralDarkMode?'Modo claro':'Modo escuro'}</span>
      </button>
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
      (active === 'MAPA 2.0' ? ' map-fullscreen' : '') +
      (structuralDarkMode ? ' structural-dark' : '')}>
    <aside className="sidebar">
      <button type="button" className="sidebar-hide-button" title="Recolher menu"
        aria-label="Recolher menu lateral" onClick={toggleSidebar}>☰</button>
      <div className="brand"><div className="brand-mark"><Truck size={22}/></div><div><strong>COSTALOG</strong><span>OPERAÇÕES</span></div></div>
      <div className="workspace"><span className="workspace-dot"/> MAPA operacional <ChevronDown size={15}/></div>
      <div className="nav-label">MENU PRINCIPAL</div>
      <nav>{nav.map(item => <button key={item.name} className={`nav-item ${active === item.name ? 'active' : ''}`} onClick={() => setActive(item.name)}><item.icon size={18}/><span>{item.name}</span>{item.name === 'MAPA 2.0' && <span className="nav-count">{columns.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="connection"><span className="connection-dot"/> {isGitHubPagesPreview ? 'Demonstração local' : apiBase && token ? 'Conectado à API' : 'API não conectada'}</div><div className="user"><div className="avatar">C</div><div><b>Costalog</b><small>{isGitHubPagesPreview ? 'Modo local · sem login real' : token ? 'Usuário autenticado' : 'Acesso operacional'}</small></div><Settings2 size={17}/></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><button type="button" className="sidebar-toggle" title={sidebarCollapsed?'Mostrar menu':'Ocultar menu'}
          aria-label={sidebarCollapsed?'Mostrar menu lateral':'Ocultar menu lateral'}
          aria-expanded={!sidebarCollapsed} onClick={toggleSidebar}><Menu size={18}/></button>
        <div className="breadcrumbs">Operações <span>/</span> <b>{active}</b></div><div className="top-actions">
          <button type="button" className="structural-theme-toggle"
            aria-label={structuralDarkMode?'Ativar modo claro do site':'Ativar modo escuro do site'}
            title={structuralDarkMode?'Modo claro do site':'Modo escuro do site'}
            aria-pressed={structuralDarkMode} onClick={toggleStructuralDarkMode}>
            {structuralDarkMode?<Sun size={15}/>:<Moon size={15}/>}
            <span>{structuralDarkMode?'Modo claro':'Modo escuro'}</span>
          </button>{token && !isGitHubPagesPreview && <button className="secondary" onClick={logout}><LogOut size={15}/> Sair</button>}<button className="icon-button" title="Notificações"><Bell size={18}/></button><div className="avatar small">C</div></div></header>
      {isGitHubPagesPreview && <div className="notice local-demo-warning" role="status">
        <ShieldCheck size={17}/><span><strong>Demonstração local — sem login real.</strong> Os registros são exemplos e as alterações ficam apenas neste navegador; não há banco compartilhado nem dados confidenciais. Exporte ou copie o que precisar antes de limpar os dados do navegador.</span>
      </div>}
      <section className={'content ' + (active === 'MAPA 2.0' ? 'map-content' : '')}>
        {active !== 'MAPA 2.0' && <div className="page-heading"><div><div className="eyebrow">CENTRAL DE OPERAÇÕES</div><h1>{active}</h1><p>Grade operacional completa, com colunas configuráveis para cada usuário.</p></div></div>}
        {active !== 'MAPA 2.0' && <div className="notice"><ClipboardList size={17}/><span>{isGitHubPagesPreview ? 'Demonstração local: dados de exemplo e alterações salvos neste navegador.' : apiBase ? (token ? notice : 'Entre com sua conta para acessar os dados reais.') : 'Configure VITE_API_URL para conectar a aplicação à API. Nenhum dado fictício será exibido.'}</span></div>}
        {apiBase && !token && <form className="panel login-panel" onSubmit={login}><div><h2>Acessar MAPA COSTALOG</h2><p>Entre com seu usuário autorizado.</p></div><div className="login-fields"><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-mail corporativo" autoComplete="username"/><input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha" autoComplete="current-password"/><button className="primary" disabled={loading}>{loading ? 'Conectando...' : 'Entrar'}</button></div>{apiError && <p className="api-error">{apiError}</p>}</form>}
        {apiBase && apiError && token && <div className="notice api-error" role="alert"><span>{apiError}</span>{apiError.startsWith('Ctrl+')?
  <button onClick={()=>setApiError('')}>Fechar</button>:
  <button onClick={logout}>Fazer login novamente</button>}</div>}
        {active === 'Visão geral' && <section className="workspace-page">
          <div className="costalog-welcome-hero" aria-label="Boas-vindas à central Costalog">
            <div className="costalog-welcome-copy">
              <small>CENTRAL OPERACIONAL · MAPA COSTALOG</small>
              <h2>Olá, {profileName.trim().split(/\s+/)[0] || 'equipe'}.</h2>
              <p>Acompanhe os registros, documentos e cadastros da operação em um só lugar.</p>
            </div>
            <div className="costalog-welcome-figures" aria-label="Estrutura do MAPA 2.0">
              <div className="costalog-welcome-figure"><strong>{columns.length}</strong><span>colunas</span></div>
              <div className="costalog-welcome-figure"><strong>100</strong><span>linhas de teste</span></div>
            </div>
          </div>
          <div className="section-intro"><span className="eyebrow">INDICADORES DA OPERAÇÃO</span><h2>Visão geral da operação</h2><p>Indicadores consolidados diretamente do banco de dados, sem estimativas.</p></div>
          {!token ? <div className="empty-state">Entre com sua conta autorizada para consultar os indicadores reais.</div> : <>
            <div className="overview-grid"><div className="overview-card"><span>Registros ativos</span><strong>{dashboardLoading ? '…' : (dashboardSummary?.activeRecords ?? '—')}</strong><small>Exclui registros arquivados</small></div><div className="overview-card"><span>Atualizados nos últimos 7 dias</span><strong>{dashboardLoading ? '…' : (dashboardSummary?.recentlyUpdated ?? '—')}</strong><small>Atividade recente</small></div><div className="overview-card"><span>Colunas configuradas</span><strong>{columns.length}</strong><small>Estrutura MAPA 2.0</small></div></div>
            <div className="overview-grid"><div className={'overview-card ' + ((appointmentAlerts?.total || 0) > 0 ? 'validation-warning' : 'validation-ok')}><span>Agendamentos vencidos</span><strong>{appointmentAlertsLoading ? '…' : (appointmentAlerts?.total ?? '—')}</strong><small>Coletas e primeiras entregas pendentes</small></div><div className="overview-card"><span>Coletas vencidas</span><strong>{appointmentAlertsLoading ? '…' : (appointmentAlerts?.byKind?.collection ?? '—')}</strong><small>Conferência conforme AU ou AV</small></div><div className="overview-card"><span>Entregas vencidas</span><strong>{appointmentAlertsLoading ? '…' : (appointmentAlerts?.byKind?.delivery ?? '—')}</strong><small>Primeira entrega, conforme AW</small></div><div className={'overview-card ' + ((validationSummary?.items.length || 0) > 0 ? 'validation-warning' : 'validation-ok')}><span>Campos obrigatórios pendentes</span><strong>{validationLoading ? '…' : (validationSummary ? validationSummary.items.reduce((sum,item)=>sum+item.missing,0) : '—')}</strong><small>Soma de pendências por campo; um registro pode ter mais de uma</small></div></div>
            <div className="panel validation-panel"><div className="panel-heading"><div><h2>Distribuição por status</h2><p>Até 12 status com mais registros ativos.</p></div><button className="secondary" disabled={dashboardLoading} onClick={()=>{setDashboardLoading(true);fetch(apiBase + '/api/v1/dashboard/summary',{headers:{Authorization:'Bearer '+token}}).then(async response=>{const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.error?.message||'Falha ao atualizar indicadores.');setDashboardSummary(body as DashboardSummary);setApiError('');}).catch(error=>setApiError(error instanceof Error?error.message:'Falha ao atualizar painel.')).finally(()=>setDashboardLoading(false));}}>Atualizar indicadores</button></div>
              {dashboardSummary?.statuses?.length ? <div className="status-grid">{dashboardSummary.statuses.map(item=><button className="status-card" key={item.status} disabled={item.status === 'Sem status'} title={item.status === 'Sem status' ? 'O filtro de registros sem status ainda não está disponível.' : 'Abrir registros deste status'} onClick={()=>{setStatus(item.status);setPage(1);setActive('MAPA 2.0')}}><span className="status-indicator"/><b>{item.status}</b><strong>{item.count}</strong><small>Ver registros</small></button>)}</div> : <div className="empty-state">{dashboardLoading ? 'Carregando indicadores…' : 'Não há registros ativos com status para exibir.'}</div>}
              {dashboardSummary && <p className="validation-footnote">Atualizado em {new Date(dashboardSummary.generatedAt).toLocaleString('pt-BR')}. Os indicadores refletem os dados disponíveis no banco no momento da consulta.</p>}
            </div>
          </>}
          <div className="panel validation-panel"><div className="panel-heading"><div><h2>Pendências que precisam de atenção</h2><p>Alertas baseados nos campos obrigatórios configurados, sem criar prazos presumidos.</p></div><button className="secondary" onClick={()=>setActive('Status operacional')}>Ver todas</button></div>
            {!token ? <div className="empty-state">Entre para consultar as pendências reais.</div> : validationLoading && !validationSummary ? <div className="empty-state">Verificando pendências…</div> : validationSummary?.items.length ? <div className="validation-list">{validationSummary.items.slice(0,4).map(item=><div className="validation-row" key={item.key}><div className="validation-icon"><Bell size={17}/></div><div className="validation-field"><b>{item.label}</b><small>Campo obrigatório incompleto</small></div><strong>{item.missing}</strong><span>registro(s)</span></div>)}</div> : <div className="empty-state">{validationSummary ? 'Nenhuma pendência de campo obrigatório encontrada.' : 'Aguardando a validação dos dados.'}</div>}
          </div>
          <div className="panel validation-panel"><div className="panel-heading"><div><h2>Agendamentos vencidos</h2><p>Coletas e entregas com data/hora do agendamento já passada e sem registro do marco operacional correspondente. Responsável conforme o campo ATENDENTE.</p></div><button className="secondary" disabled={appointmentAlertsLoading} onClick={()=>{setAppointmentAlertsLoading(true);fetch(apiBase + '/api/v1/dashboard/appointment-alerts'+(()=>{const params=new URLSearchParams();if(alertAttendantFilter!=='Todos')params.set('attendant',alertAttendantFilter);if(alertKindFilter!=='Todos')params.set('kind',alertKindFilter);return params.size?'?'+params.toString():''})(),{headers:{Authorization:'Bearer '+token}}).then(async response=>{const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.error?.message||'Falha ao atualizar alertas.');setAppointmentAlerts(body as AppointmentAlertSummary);setApiError('');}).catch(error=>setApiError(error instanceof Error?error.message:'Falha ao atualizar alertas.')).finally(()=>setAppointmentAlertsLoading(false));}}>Atualizar alertas</button></div>
            {appointmentAlerts && appointmentAlerts.total > 0 && <div className="toolbar" role="group" aria-label="Filtrar alertas"><button className={alertKindFilter==='Todos'?'primary':'secondary'} onClick={()=>{setAlertKindFilter('Todos');setShowAllAppointmentAlerts(false);}}>Todos ({appointmentAlerts.total})</button><button className={alertKindFilter==='Coleta'?'primary':'secondary'} onClick={()=>{setAlertKindFilter('Coleta');setShowAllAppointmentAlerts(false);}}>Coletas ({appointmentAlerts.byKind?.collection ?? appointmentAlerts.items.filter(item=>item.kind==='Coleta').length})</button><button className={alertKindFilter==='Entrega'?'primary':'secondary'} onClick={()=>{setAlertKindFilter('Entrega');setShowAllAppointmentAlerts(false);}}>Entregas ({appointmentAlerts.byKind?.delivery ?? appointmentAlerts.items.filter(item=>item.kind==='Entrega').length})</button><label className="filter-control">Atendente <select value={alertAttendantFilter} onChange={event=>{setAlertAttendantFilter(event.target.value);setShowAllAppointmentAlerts(false);}}><option value="Todos">Todos</option>{(appointmentAlerts.attendants || Array.from(new Set(appointmentAlerts.items.map(item=>item.attendant).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'pt-BR'))).map(attendant=><option key={attendant} value={attendant}>{attendant}</option>)}</select></label></div>}
            {!token ? <div className="empty-state">Entre para consultar os agendamentos reais.</div> : appointmentAlertsLoading && !appointmentAlerts ? <div className="empty-state">Verificando agendamentos…</div> : appointmentAlerts?.items.length ? <div className="validation-list">{appointmentAlerts.items.filter(item=>(alertKindFilter==='Todos'||item.kind===alertKindFilter)&&(alertAttendantFilter==='Todos'||item.attendant===alertAttendantFilter)).slice(0,showAllAppointmentAlerts ? 100 : 8).map(item=><div className="validation-row" key={item.id + item.kind}><div className="validation-icon"><Bell size={17}/></div><div className="validation-field"><b>#{item.sequence} · {item.kind}</b><small>{item.clientName || 'Cliente não informado'}{item.container ? ' · '+item.container : ''}{item.cte ? ' · CT-e '+item.cte : ''}</small><small>Agendado: {new Date(item.scheduledAt).toLocaleString('pt-BR')} · Atendente: {item.attendant}</small></div><strong>{item.minutesLate >= 60 ? Math.floor(item.minutesLate/60)+' h' : item.minutesLate+' min'}</strong><button className="secondary" onClick={()=>{setQuery(item.container || item.cte || item.clientName || '');setStatus('');setFilterColumn('');setFilterValue('');setPage(1);setActive('MAPA 2.0')}}>Abrir</button></div>)}</div> : <div className="empty-state">{appointmentAlerts ? 'Nenhum agendamento vencido encontrado com os campos disponíveis.' : 'Aguardando consulta dos agendamentos.'}</div>}
            {appointmentAlerts && <p className="validation-footnote">Análise em {new Date(appointmentAlerts.generatedAt).toLocaleString('pt-BR')}. Total de alertas: {appointmentAlerts.total}. {showAllAppointmentAlerts ? 'Exibindo até 100 alertas para o filtro atual.' : 'Exibindo os 8 primeiros alertas do filtro atual.'} Nenhuma data foi alterada.</p>}
            {appointmentAlerts && (appointmentAlerts.filteredTotal ?? appointmentAlerts.items.length) > 8 && <button className="secondary" onClick={()=>setShowAllAppointmentAlerts(value=>!value)}>{showAllAppointmentAlerts ? 'Mostrar menos' : `Ver todos os ${Math.min(appointmentAlerts.filteredTotal ?? appointmentAlerts.items.length,100)} alertas`}</button>}
          </div>
          <div className="panel quick-panel"><div><h3>Acesso rápido</h3><p>Consulte e edite os registros operacionais na grade.</p></div><button className="primary" onClick={()=>setActive('MAPA 2.0')}><Table2 size={16}/> Abrir MAPA 2.0</button></div>
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
          <div className="status-grid">{Array.from(new Set(rows.map(row=>row.status).filter((value): value is string=>Boolean(value)))).sort().map(value=><button className="status-card" key={value} onClick={()=>{setStatus(value);setPage(1);setActive('MAPA 2.0')}}><span className="status-indicator"/><b>{value}</b><small>Ver registros com este status</small></button>)}</div>
          {rows.every(row=>!row.status) && <div className="empty-state">Não há status preenchidos nos registros carregados.</div>}
          <button className="secondary" onClick={()=>{setStatus('');setActive('MAPA 2.0')}}>Limpar filtro e abrir grade</button>
        </section>}
        {active === 'Cadastros' && <BaseCatalogSheet userRole={userRole} apiBase={apiBase} token={token} onOpenMapa={() => setActive('MAPA 2.0')} />}

        {active === 'Minha conta' && <section className="workspace-page"><div className="section-intro"><span className="eyebrow">CONTA PESSOAL</span><h2>Meu cadastro</h2><p>Atualize seu nome, e-mail e senha.</p></div><form className="panel profile-form" onSubmit={saveProfile}><label>Nome completo<input required minLength={2} value={profileName} onChange={event=>setProfileName(event.target.value)}/></label><label>E-mail<input required type="email" value={profileEmail} onChange={event=>setProfileEmail(event.target.value)}/></label><div className="profile-role">Perfil de acesso <strong>{profile?.role||userRole||'—'}</strong><small>Permissões são alteradas por um administrador.</small></div><div className="password-section"><h3>Alterar senha (opcional)</h3><label>Senha atual<input type="password" autoComplete="current-password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)} required={Boolean(newPassword)}/></label><label>Nova senha<input type="password" minLength={10} autoComplete="new-password" value={newPassword} onChange={event=>setNewPassword(event.target.value)} placeholder="Mínimo de 10 caracteres"/></label></div><button className="primary" type="submit"><Save size={15}/> Salvar meu cadastro</button></form></section>}
        {active === 'Usuários' && <section className="workspace-page"><div className="section-intro"><span className="eyebrow">ADMINISTRAÇÃO</span><h2>Usuários e permissões</h2><p>Crie contas, altere perfis e bloqueie acessos.</p></div>{userRole!=='ADMIN'?<div className="empty-state">Esta área é exclusiva para administradores.</div>:<><form className="panel create-user-form" onSubmit={createUser}><h3>Novo usuário</h3><div className="user-form-grid"><label>Nome<input required minLength={2} value={newUserName} onChange={event=>setNewUserName(event.target.value)}/></label><label>E-mail<input required type="email" value={newUserEmail} onChange={event=>setNewUserEmail(event.target.value)}/></label><label>Senha inicial<input required type="password" minLength={10} value={newUserPassword} onChange={event=>setNewUserPassword(event.target.value)}/></label><label>Perfil<select value={newUserRole} onChange={event=>setNewUserRole(event.target.value)}><option value="CONSULTA">Consulta</option><option value="OPERACAO">Operação</option><option value="SUPERVISOR">Supervisor</option><option value="ADMIN">Administrador</option></select></label></div><button className="primary" type="submit"><Plus size={15}/> Criar usuário</button></form><div className="panel users-table-panel"><div className="panel-heading"><div><h2>Usuários cadastrados</h2><p>{users.length} conta(s) · {users.filter(item=>item.pendingApproval).length} solicitação(ões) pendente(s)</p></div></div><div className="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{users.map(item=><tr key={item.id}><td>{item.name}</td><td>{item.email}</td><td><select value={item.role} disabled={item.id===profile?.id} onChange={event=>void updateUser(item,{role:event.target.value})}><option value="CONSULTA">Consulta</option><option value="OPERACAO">Operação</option><option value="SUPERVISOR">Supervisor</option><option value="ADMIN">Administrador</option></select></td><td><span className={item.active?'feature-state connected':'feature-state'}>{item.active?'Ativo':item.pendingApproval?'Pendente':'Bloqueado'}</span></td><td><button className="secondary" disabled={item.id===profile?.id} onClick={()=>{if(item.pendingApproval && !window.confirm('Você confirmou a identidade e o e-mail desta pessoa antes de liberar o acesso?')) return; void updateUser(item,{active:!item.active});}}>{item.active?'Bloquear':item.pendingApproval?'Aprovar acesso':'Reativar'}</button></td></tr>)}</tbody></table></div></div></>}</section>}
        {active === 'Integrações' && <section className="workspace-page">
          <div className="section-intro"><span className="eyebrow">CONEXÕES DO SISTEMA</span><h2>Integrações</h2><p>Estado de acesso aos recursos centrais do MAPA COSTALOG.</p></div>
          <div className="feature-list"><div className="feature-row"><div className="feature-icon"><Waypoints size={19}/></div><div><b>API MAPA COSTALOG</b><p>{apiBase || 'Endereço da API não configurado no frontend.'}</p></div><span className={apiBase && token ? 'feature-state connected' : 'feature-state'}>{apiBase && token ? 'Sessão ativa' : 'Sem sessão'}</span></div><div className="feature-row"><div className="feature-icon"><Activity size={19}/></div><div><b>Banco de dados</b><p>Registros consultados pela API e armazenados no PostgreSQL/Supabase.</p></div><span className="feature-state">{token ? 'Acesso autenticado' : 'Aguardando login'}</span></div><div className="notice"><ClipboardList size={17}/><span>Sincronizações externas adicionais ainda precisam ser implementadas e testadas.</span></div></div>
        </section>}
        {active === 'MAPA 2.0' && <>
        <section className="panel mapa-grid-panel">
          <div className="panel-heading compact-map-heading"><div><h2><Table2 size={19}/> MAPA 2.0</h2><p>Planilha operacional · edite as células autorizadas diretamente na grade.</p></div><div className="panel-actions">{token && userRole !== 'CONSULTA' && !sheetCanvas && <>
        <button className="primary" disabled={loading||creatingRows} onClick={()=>void createRow()} title="Inserir uma linha">
          <Plus size={16}/> Nova linha</button>
        <button className="secondary" onClick={()=>setNewRowsOpen(value=>!value)} disabled={creatingRows}
          title="Adicionar várias linhas de uma vez"><Plus size={14}/> Várias linhas</button>
      </>}<button className="secondary" onClick={()=>setColumnMenu(value=>!value)}><Columns3 size={16}/> Escolher colunas ({visibleColumns.length})</button></div></div>
          {newRowsOpen && !sheetCanvas && <div className="sheet-add-many">
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
          <div className="sheet-formula-bar" role="group" aria-label="Barra de fórmulas">
            <span className="sheet-formula-address" aria-label="Endereço da célula">
              {selectedCell ? selectedCell.column.key + Number(selectedCell.row.sheetRowNumber ?? selectedCell.row.sequence + 1) : '—'}
            </span>
            <span className="sheet-formula-fx" aria-hidden="true">fx</span>
            <input className="sheet-formula-input" aria-label="Conteúdo ou fórmula da célula"
              value={formulaDraft} disabled={!selectedCell || userRole==='CONSULTA'}
              placeholder="Digite um valor ou fórmula, por exemplo =SUM(Q2:Q10)"
              onChange={event=>setFormulaDraft(event.target.value)}
              onKeyDown={event=>{
                if(event.key==='Enter'){event.preventDefault();void commitFormulaBar();}
                if(event.key==='Escape'){event.preventDefault();const row=selectedCell&&rows.find(item=>item.id===selectedCell.row.id);setFormulaDraft(valueText(row?.data?.[selectedCell?.column.key||'']));gridRef.current?.focus({preventScroll:true});}
              }}/>
            <button className="secondary sheet-formula-apply" type="button" disabled={!selectedCell || userRole==='CONSULTA'}
              title="Aplicar fórmula ou valor (Enter)" onClick={()=>void commitFormulaBar()}>✓</button>
          </div>
          <div className="sheet-action-strip">
            <span className="sheet-address">{selectionMode === 'column' && selectedColumnKey ? 'Coluna ' + selectedColumnKey :
              selectionMode === 'row' && selectedCell ? 'Linha ' + selectedCell.row.sequence :
              selectedPosition ? visibleColumns[selectedPosition.column].key + displayedRows[selectedPosition.row].sequence :
              placeholderPosition && visibleColumns[placeholderPosition.column]
                ? visibleColumns[placeholderPosition.column].key + (placeholderPosition.row + 1) + ' (visual)'
                : 'Selecione uma célula'}</span>
            <span className="sheet-guide" aria-hidden="true"></span>
            <button className="secondary" type="button" disabled={!undoCounts.undo||undoBusyRef.current||pasteBusy||editingCell!==null}
              title="Desfazer a última alteração (Ctrl+Z)" aria-label="Desfazer"
              onClick={()=>void replayEdit('undo')}><Undo2 size={14}/> Desfazer</button>
            <button className="secondary" type="button" disabled={!undoCounts.redo||undoBusyRef.current||pasteBusy||editingCell!==null}
              title="Refazer alteração (Ctrl+Y / Ctrl+Shift+Z)" aria-label="Refazer"
              onClick={()=>void replayEdit('redo')}><Redo2 size={14}/> Refazer</button>
            <span className="sheet-undo-feedback" role="status" aria-live="polite">{undoFeedback}</span>
            <button className="secondary" type="button" disabled={!selectedBounds} onClick={() => void copyGridSelection()}>Copiar seleção</button>
            {isGitHubPagesPreview && <>
              <button className="secondary" type="button" onClick={exportLocalCsv}>Exportar CSV</button>
              <button className="secondary" type="button" onClick={() => localCsvInputRef.current?.click()}>Importar CSV</button>
              <input ref={localCsvInputRef} type="file" accept=".csv,text/csv" hidden
                onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void importLocalCsv(file); event.currentTarget.value = ''; }} />
            </>}
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
            <table className="sheet-table" role="grid" aria-label="MAPA 2.0 - planilha operacional"
              style={{width:totalSheetWidth(visibleColumns.map(col=>col.key),columnWidths)}}>
              <colgroup>
                <col style={{width:ROW_NUMBER_COLUMN_WIDTH}} />
                {visibleColumns.map(column => <col key={column.key}
                  style={{width:normalizeColumnWidth(columnWidths[column.key]??sourceColumnWidth(column.key))}} />)}
              </colgroup>
              <thead>
                <tr className="sheet-letters-row">
                  <th className="sheet-row-header sheet-corner" title="Selecionar células carregadas"
                    onClick={()=>{if(userRole==='ADMIN')selectAllLoadedCells();}}
                    onContextMenu={event=>openSheetContext(event,'all')}>▦</th>
                  {visibleColumns.map((column,ci)=><th key={column.key}
                    className={'sheet-letter-header '+
                      (selectionMode==='column'&&selectedColumnKey===column.key?'sheet-column-selected ':'')+
                      (selectionMode==='cell' && (selectedCell?.column.key===column.key ||
                        (placeholderPosition && visibleColumns[placeholderPosition.column]?.key===column.key))
                        ?'sheet-column-active-header':'')}
                    scope="col" title={'Selecionar coluna '+column.key}
                    onClick={()=>selectEntireColumn(column)}
                    onContextMenu={event=>openSheetContext(event,'column',undefined,ci)}>
                    <button type="button" className="sheet-letter-button"
                      aria-label={'Selecionar coluna inteira '+column.key}
                      onClick={event=>{event.stopPropagation();selectEntireColumn(column);}}>
                      {column.key}</button>
                    <span className="sheet-resize-handle" role="separator"
                      aria-label={'Ajustar largura da coluna '+column.key}
                      onPointerDown={event=>beginColumnResize(event,column)}/>
                  </th>)}
                </tr>
                <tr className="sheet-label-row">
                  <th className="sheet-row-header sheet-header-number"
                    title="Linha 1: cabeçalho fixo">1</th>
                  {visibleColumns.map((column,ci)=><th key={column.key}
                    className={'sheet-column-header '+(selectionMode==='column'&&selectedColumnKey===column.key?'sheet-column-selected':'')}
                    scope="col" title={'Clique para abrir o menu de '+(column.label||column.key)}
                    onClick={event=>showColumnFilter(event,column)}
                    onContextMenu={event=>openSheetContext(event,'column',undefined,ci)}>
                    <button type="button"
                      className={'sheet-filter-trigger '+(columnFilters[column.key]?'filter-active':'')}
                      title={'Abrir menu de '+(column.label||column.key)}
                      aria-label={'Abrir menu da coluna '+(column.label||column.key)}
                      aria-haspopup="dialog"
                      aria-expanded={openFilterKey===column.key}>
                      <span className="sheet-header-name">{column.label||'(sem título)'}</span>
                    </button>
                  </th>)}
                </tr>
              </thead>
              <tbody>
                {windowed.top > 0 && <tr className="sheet-virtual-spacer" aria-hidden="true">
                  <td colSpan={visibleColumns.length+1} style={{height:windowed.top,padding:0,border:0}}/>
                </tr>}
                {renderedSlots.map(({row,ri,index}) => {
                  if(!row) return <tr key={'virtual-'+index}
                    className={'sheet-virtual-empty-row '+
                      (selectedBlankRow===index?'sheet-virtual-row-selected ':'')+
                      (selectionMode==='cell' && placeholderPosition?.row===index?'sheet-row-active ':'')}
                    style={{height:rowHeightAt(index+2),
                      '--mapa-row-height':rowHeightAt(index+2)+'px'} as CSSProperties}>
                    <th scope="row" className={'sheet-row-number '+
                      (selectedBlankRow===index?'sheet-row-selected ':'')+
                      (selectionMode==='cell'&&placeholderPosition?.row===index?'sheet-row-active-header':'')}
                      onClick={()=>{setSelectedBlankRow(index);setSelectionMode('row');
                        setSelectedRowId(null);setSelectedColumnKey(null);setSelectionAnchor(null);
                        setSelectedCell(null);setPlaceholderPosition({row:index,column:0});
                        setBlankEditing(null);gridRef.current?.focus({preventScroll:true});}}
                      title={'Selecionar toda a linha '+(index+2)}>{index+2}
                      <span className="sheet-row-resize-handle" role="separator"
                        aria-label={'Arrastar para ajustar a altura da linha '+(index+2)}
                        title="Arraste a borda inferior para mudar a altura"
                        onPointerDown={event=>beginRowResize(event,index+2)}/>
                    </th>
                    {visibleColumns.map((column,ci)=>{
                      const chosen=placeholderPosition?.row===index&&placeholderPosition.column===ci;
                      const selectedColumn=selectionMode==='column'&&selectedColumnKey===column.key;
                      const editing=blankEditing?.index===index&&blankEditing.columnKey===column.key;
                      const loaded=loadedGridChunksRef.current.has(Math.floor(index/100));
                      const ready=gridRangeSupported===true&&loaded&&column.editable&&userRole!=='CONSULTA';
                      return <td key={column.key}
                        className={'sheet-placeholder-cell '+(chosen?'selected-cell ':'')+
                          (selectedColumn||selectedBlankRow===index?'sheet-range-cell ':'')+
                          (ready?'editable-cell ':'')}
                        aria-selected={chosen||selectedColumn||selectedBlankRow===index}
                        onClick={()=>selectBlankCell(index,ci,Boolean(BASE_COLUMN_LIST[column.key]))}
                        onDoubleClick={()=>selectBlankCell(index,ci,true)}
                        title={ready?'Clique, digite ou pressione Enter para preencher.':'Aguardando carregamento da grade'}>
                        {editing ? BASE_COLUMN_LIST[column.key] ?
                          <SheetDropdownEditor columnKey={column.key}
                            rowLabel={column.label+' linha '+(index+2)}
                            currentValue="" initialQuery={blankDraft}
                            fallbackOptions={rows.map(item=>valueText(item.data?.[column.key])).filter(Boolean)}
                            apiBase={apiBase} token={token}
                            onConfirm={(value,key,shift)=>void saveBlankCell(index,column,value,key,shift)}
                            onCancel={()=>setBlankEditing(null)}
                            onPasteCell={text=>{setBlankDraft(text);}}/>
                          : <input className="sheet-cell-editor sheet-blank-editor" autoFocus
                              type={column.key==='A'?'date':'text'}
                              inputMode={column.key==='Q'?'decimal':undefined}
                              aria-label={column.label+' linha '+(index+2)}
                              value={blankDraft} onChange={event=>setBlankDraft(event.target.value)}
                              onClick={event=>event.stopPropagation()}
                              onKeyDown={event=>{
                                if(event.key==='Escape'){event.preventDefault();setBlankEditing(null);return;}
                                if(event.key==='Enter'||event.key==='Tab'){
                                  event.preventDefault();event.stopPropagation();
                                  void saveBlankCell(index,column,event.currentTarget.value,
                                    event.key,event.shiftKey);
                                }
                              }}/>
                          : <span data-grid-empty-row={index} data-grid-empty-column={ci}
                              tabIndex={chosen?0:-1} role="gridcell"
                              aria-label={column.key+(index+2)+' vazio'}
                              aria-readonly={!ready}>&nbsp;</span>}
                      </td>;
                    })}
                  </tr>;
                  
                  const conditionalBackground = statusRowColor(
                    Object.prototype.hasOwnProperty.call(pendingRowStatus, row.id)
                      ? pendingRowStatus[row.id] : (row.data?.C ?? row.status)
                  );
                  const conditionalTextColor = conditionalBackground ? statusRowTextColor(conditionalBackground) : undefined;
                  return <tr key={row.id}
                    className={(selectedRowIds.includes(row.id)?'bulk-selected-row ':'')+
                      (selectionMode==='row'&&selectedRowIds.includes(row.id)?'sheet-whole-row-selected ':'')+
                      (selectionMode==='cell'&&selectedCell?.row.id===row.id?'sheet-row-active':'')}
                    style={{height:rowHeightAt(Number(row.sheetRowNumber??ri+2),row),
                      '--mapa-row-height':rowHeightAt(Number(row.sheetRowNumber??ri+2),row)+'px'} as CSSProperties}
                    data-status={String(row.data?.C ?? row.status ?? '')}>
                  <th scope="row" className={'sheet-row-number '+
                    (selectionMode==='row'&&selectedRowIds.includes(row.id)?'sheet-row-selected ':'')+
                    (selectionMode==='cell'&&selectedCell?.row.id===row.id?'sheet-row-active-header':'')}
                    onContextMenu={event=>openSheetContext(event,'row',ri)}
                    onClick={event=>{
                      if(!(event.target as HTMLElement).closest('button,.sheet-row-resize-handle'))
                        selectEntireRow(ri,event.shiftKey,event.ctrlKey||event.metaKey);
                    }}>
                    <button className="sheet-row-select" type="button"
                      title={'Selecionar toda a linha ' + (sheetCanvas ? Number(row.sheetRowNumber??ri+2) : ri+2)}
                      aria-label={'Selecionar linha inteira ' + (sheetCanvas ? Number(row.sheetRowNumber??ri+2) : ri+2)}
                      onClick={event=>{event.stopPropagation();selectEntireRow(ri,event.shiftKey,event.ctrlKey||event.metaKey);}}>
                      {sheetCanvas ? Number(row.sheetRowNumber??ri+2) : ri+2}</button>
                    <span className="sheet-row-resize-handle" role="separator"
                      aria-label={'Arrastar para ajustar altura da linha '+row.sequence}
                      title="Arraste para mudar a altura da linha"
                      onPointerDown={event=>beginRowResize(event,
                        Number(row.sheetRowNumber??ri+2),row)}/>
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
                      onContextMenu={event=>openSheetContext(event,'cell',ri,ci)}
                      onPointerDown={event=>beginRangeDrag(event,ri,ci)}
                      onPointerMove={event=>{
                        const info=dragInfoRef.current;
                        if(info && Math.hypot(event.clientX-info.x,event.clientY-info.y)>6)
                          info.moved=true;
                      }}
                      onPointerEnter={()=>extendRangeDrag(ri,ci)}
                      onPointerUp={()=>finishRangeDrag(ri,ci)}
                      onDoubleClick={()=>{if(editable&&!checkbox)beginCellEdit(ri,ci);}}>
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
                            onPasteCell={text=>{setEditingCell(null);setEditValue('');pasteGridText(text);}}
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
                              : 'Clique para selecionar; Enter ou duplo clique edita. Delete limpa.'
                              : 'Somente leitura'}
>
                            {formatSheetValue(displayedCellValue(row,column),displayFormat)}
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
              </tbody>
            </table>
            {!loading && displayedRows.length === 0 && !sheetCanvas &&
              <div className="sheet-empty-message" role="status">
                Nenhum registro corresponde aos filtros. Limpe os filtros para voltar à grade completa.
              </div>}
          </div>
          {sheetContextMenu && userRole==='ADMIN' &&
            <SheetContextMenu kind={sheetContextMenu.kind} x={sheetContextMenu.x}
              y={sheetContextMenu.y} onClose={()=>setSheetContextMenu(null)}
              onAction={action=>void performSheetContextAction(action)}/>}
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
          <footer className="table-footer"><span>{isGitHubPagesPreview ? 'Dados locais • salvamento automático no navegador' : apiBase && token ? 'Dados do banco • edição individual com auditoria' : 'Sem dados de demonstração'}</span><span><span className="green-dot"/> {visibleColumns.length} coluna(s) selecionada(s)</span></footer>
          {sheetCanvas && gridRangeSupported===false && <div className="sheet-grid-compat-alert" role="status">
            A API conectada ainda não suporta as linhas virtuais editáveis.
            Conecte a API de homologação atualizada para cadastrar diretamente na grade.
          </div>}
          <div className="sheet-scroll-status" role="status">
            <span>{sheetCanvas
              ? 'Cabeçalho: linha 1 · '+(SHEET_MAX_ROW-1).toLocaleString('pt-BR')+
                ' linhas virtuais · '+total+' registros salvos · Última linha preenchida: '+maxSheetRowNumber
              : displayedRows.length+' de '+total+' registros carregados'}</span>
            {!sheetCanvas && rows.length < total && <button className="secondary" disabled={loading}
              onClick={()=>{lastRequestedPageRef.current=page+1;setPage(value=>value+1)}}>
              {loading?'Carregando…':'Carregar mais linhas'}</button>}
          </div>
        </section>
        </>}
      {bulkOpen&&<div className="modal-backdrop" onClick={()=>!bulkBusy&&setBulkOpen(false)}><section className="history-modal bulk-edit-modal" onClick={event=>event.stopPropagation()}><header><div><h2><Save size={18}/> Edição em massa</h2><p>Revise o campo e o valor antes de aplicar aos registros selecionados.</p></div><button className="secondary" disabled={bulkBusy} onClick={()=>setBulkOpen(false)}><X size={16}/></button></header><div className="bulk-edit-content"><div className="bulk-summary"><strong>{selectedRows.length} registro(s) selecionado(s)</strong><span>As alterações serão gravadas individualmente e registradas no histórico.</span></div><label>Coluna a alterar<select value={bulkColumn} onChange={event=>setBulkColumn(event.target.value)}><option value="">Selecione uma coluna</option>{editableColumns.map(column=><option key={column.key} value={column.key}>{column.label} ({column.dataType})</option>)}</select></label><label>Novo valor<input value={bulkValue} onChange={event=>setBulkValue(event.target.value)} placeholder="Deixe vazio para limpar o campo"/></label>{bulkColumn&&<div className="bulk-preview"><b>Prévia das alterações</b><div className="bulk-preview-table"><div><span>Registro</span><span>Valor atual</span><span>Novo valor</span></div>{selectedRows.slice(0,8).map(row=><div key={row.id}><span>#{row.sequence}</span><span>{valueText(row.data?.[bulkColumn])||'—'}</span><span>{bulkValue||'—'}</span></div>)}</div>{selectedRows.length>8&&<small>Exibindo 8 de {selectedRows.length} registros.</small>}</div>}<div className="bulk-actions"><button className="secondary" disabled={bulkBusy} onClick={()=>setBulkOpen(false)}>Cancelar</button><button className="primary" disabled={bulkBusy||!bulkColumn||!selectedRows.length} onClick={()=>void applyBulkEdit()}>{bulkBusy?'Salvando...':'Aplicar alterações'}</button></div><small>Atalhos: Ctrl+F buscar · Ctrl+Shift+N novo registro · Esc limpar filtros.</small></div></section></div>}{historyTarget&&<div className="modal-backdrop" onClick={()=>setHistoryTarget(null)}><section className="history-modal" onClick={event=>event.stopPropagation()}><header><div><h2><History size={18}/> Histórico da célula</h2><p>Registro #{historyTarget.row.sequence} · {historyTarget.column.label||"Coluna sem título"}</p></div><button className="icon-button" onClick={()=>setHistoryTarget(null)}><X size={18}/></button></header>{historyLoading?<div className="empty-state">Carregando histórico…</div>:historyItems.length===0?<div className="empty-state">Nenhuma edição encontrada para esta célula.</div>:<div className="history-list">{historyItems.map(item=><article key={item.id}><div className="history-meta"><b>{item.user?.name||item.user?.email||"Usuário não identificado"}</b><time>{new Date(item.createdAt).toLocaleString("pt-BR")}</time></div><p><span>Ação:</span> {item.action}</p><p><span>Antes:</span> {valueText(item.beforeValue&&typeof item.beforeValue==="object"&&historyTarget.column.key in (item.beforeValue as Record<string,unknown>)?(item.beforeValue as Record<string,unknown>)[historyTarget.column.key]:item.beforeValue)}</p><p><span>Depois:</span> {valueText(item.afterValue&&typeof item.afterValue==="object"&&historyTarget.column.key in (item.afterValue as Record<string,unknown>)?(item.afterValue as Record<string,unknown>)[historyTarget.column.key]:item.afterValue)}</p></article>)}</div>}</section></div>}
        <footer className="app-footer">MAPA COSTALOG <span>•</span> Aplicação web operacional em desenvolvimento</footer>
      </section>
    </main>
  </div>;
}

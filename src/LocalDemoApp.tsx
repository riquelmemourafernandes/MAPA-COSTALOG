import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDownAZ, ArrowUpAZ, CheckCircle2, ChevronDown,
  Copy, Download, FileSpreadsheet, Filter, Plus, Redo2, RotateCcw,
  Search, ShieldAlert, Trash2, Undo2, Upload, X
} from 'lucide-react';
import './local-demo.css';

type Column = { id: string; key: string; label: string };
type DemoRow = { id: string; data: Record<string, string> };
type Model = { columns: Column[]; rows: DemoRow[] };
type CellRef = { rowId: string; colId: string };
type Selection = { anchor: CellRef; active: CellRef };
type ContextMenu = { x: number; y: number; kind: 'cell' | 'row' | 'column'; rowId?: string; colId?: string };

const STORAGE_KEY = 'mapa-costalog-public-demo-v1';

function excelColumn(index: number): string {
  let n = index + 1;
  let label = '';
  while (n > 0) {
    n--;
    label = String.fromCharCode(65 + n % 26) + label;
    n = Math.floor(n / 26);
  }
  return label;
}

function makeInitialModel(headers: Record<string, string>): Model {
  const columns: Column[] = Array.from({ length: 72 }, (_, index) => {
    const key = excelColumn(index);
    return { id: 'col-' + key, key, label: headers[key] || '' };
  });
  const rows: DemoRow[] = Array.from({ length: 24 }, (_, index) => {
    const data: Record<string, string> = {};
    columns.forEach(column => { data[column.id] = ''; });
    data['col-A'] = String(index + 1).padStart(2, '0') + '/10/2026';
    data['col-B'] = 'Atendente de demonstração ' + (index % 3 + 1);
    data['col-C'] = ['NOVO', 'AG. DOCS', 'EM ABERTO', 'FINALIZADO'][index % 4];
    data['col-D'] = 'CTE-DEMO-' + String(1200 + index);
    data['col-E'] = ['DI', 'DUIMP', 'CABOTAGEM'][index % 3];
    data['col-L'] = ['Cliente exemplo A', 'Cliente exemplo B', 'Cliente exemplo C'][index % 3];
    data['col-T'] = 'CONT-DEMO-' + String(index + 1).padStart(4, '0');
    data['col-AJ'] = index % 2 ? 'Terminal exemplo Guarujá' : 'Terminal exemplo Santos';
    data['col-AK'] = index % 2 ? 'GUARUJÁ - SP' : 'SANTOS - SP';
    data['col-AN'] = index % 2 ? 'PIRACICABA - SP' : 'SANTOS - SP';
    data['col-AO'] = index % 2 ? '190' : '0';
    data['col-AZ'] = 'Armador de exemplo ' + (index % 2 ? 'B' : 'A');
    data['col-BD'] = 'Depot de demonstração';
    return { id: 'demo-row-' + index, data };
  });
  return { columns, rows };
}

function loadModel(headers: Record<string, string>): Model {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Model;
      if (Array.isArray(parsed.columns) && parsed.columns.length > 0 &&
          Array.isArray(parsed.rows) && parsed.columns.every(c => c && typeof c.id === 'string') &&
          parsed.rows.every(r => r && typeof r.id === 'string' && r.data && typeof r.data === 'object')) {
        return parsed;
      }
    }
  } catch {
    // Ignore an invalid local cache and start with clearly labelled sample data.
  }
  return makeInitialModel(headers);
}

function parseClipboard(text: string): string[][] {
  const input = text.replace(/\r\n?/g, '\n');
  const result: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') { field += '"'; index++; }
      else if (quoted) quoted = false;
      else if (!field.length) quoted = true;
      else field += '"';
    } else if (char === '\t' && !quoted) {
      row.push(field); field = '';
    } else if (char === '\n' && !quoted) {
      row.push(field); result.push(row); row = []; field = '';
    } else field += char;
  }
  if (field.length || row.length) { row.push(field); result.push(row); }
  return result;
}

function parseCsv(text: string): string[][] {
  const input = text.replace(/\r\n?/g, '\n');
  const result: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') { field += '"'; index++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(field); field = '';
    } else if (char === '\n' && !quoted) {
      row.push(field); result.push(row); row = []; field = '';
    } else field += char;
  }
  if (field.length || row.length) { row.push(field); result.push(row); }
  return result;
}

function newBlankRow(columns: Column[]): DemoRow {
  const data: Record<string, string> = {};
  columns.forEach(column => { data[column.id] = ''; });
  return { id: 'local-row-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7), data };
}

function rekeyColumns(columns: Column[]): Column[] {
  return columns.map((column, index) => ({ ...column, key: excelColumn(index) }));
}

export default function LocalDemoApp({ headers }: { headers: Record<string, string> }) {
  const [model, setModel] = useState<Model>(() => loadModel(headers));
  const modelRef = useRef(model);
  modelRef.current = model;
  const historyRef = useRef<{ undo: Model[]; redo: Model[] }>({ undo: [], redo: [] });
  const gridRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [sort, setSort] = useState<{ id: string; direction: 'asc' | 'desc' } | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const selectionRef = useRef<Selection | null>(null);
  const [editing, setEditing] = useState<CellRef | null>(null);
  const [editValue, setEditValue] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [message, setMessage] = useState('As alterações são salvas automaticamente neste navegador.');
  const [showInfo, setShowInfo] = useState(true);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(model)); }
    catch { setMessage('O navegador não conseguiu salvar localmente. Exporte um CSV para guardar uma cópia.'); }
  }, [model]);

  const visibleRows = useMemo(() => {
    let result = model.rows.filter(row => {
      const matchesSearch = !search.trim() || model.columns.some(column =>
        (row.data[column.id] || '').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
      const statusColumn = model.columns.find(column => column.key === 'C');
      const rowStatus = statusColumn ? row.data[statusColumn.id] || '' : '';
      return matchesSearch && (statusFilter === 'Todos' || rowStatus === statusFilter);
    });
    if (sort) {
      const column = model.columns.find(item => item.id === sort.id);
      if (column) result = [...result].sort((a, b) => {
        const left = a.data[column.id] || '';
        const right = b.data[column.id] || '';
        return left.localeCompare(right, 'pt-BR', { numeric: true, sensitivity: 'base' }) * (sort.direction === 'asc' ? 1 : -1);
      });
    }
    return result;
  }, [model, search, statusFilter, sort]);

  const selectedBounds = useMemo(() => {
    if (!selection) return null;
    const startRow = visibleRows.findIndex(row => row.id === selection.anchor.rowId);
    const endRow = visibleRows.findIndex(row => row.id === selection.active.rowId);
    const startCol = model.columns.findIndex(column => column.id === selection.anchor.colId);
    const endCol = model.columns.findIndex(column => column.id === selection.active.colId);
    if ([startRow, endRow, startCol, endCol].some(value => value < 0)) return null;
    return {
      top: Math.min(startRow, endRow), bottom: Math.max(startRow, endRow),
      left: Math.min(startCol, endCol), right: Math.max(startCol, endCol)
    };
  }, [selection, visibleRows, model.columns]);

  function commit(next: Model, notice?: string) {
    const current = modelRef.current;
    historyRef.current.undo.push(JSON.parse(JSON.stringify(current)) as Model);
    if (historyRef.current.undo.length > 80) historyRef.current.undo.shift();
    historyRef.current.redo = [];
    modelRef.current = next;
    setModel(next);
    if (notice) setMessage(notice);
  }

  function selectCell(rowId: string, colId: string, extend = false) {
    const next: Selection = extend && selectionRef.current
      ? { anchor: selectionRef.current.anchor, active: { rowId, colId } }
      : { anchor: { rowId, colId }, active: { rowId, colId } };
    selectionRef.current = next;
    setSelection(next);
    gridRef.current?.focus({ preventScroll: true });
  }

  function selectRow(rowId: string) {
    if (!model.columns.length) return;
    const first = model.columns[0].id;
    const last = model.columns[model.columns.length - 1].id;
    const next = { anchor: { rowId, colId: first }, active: { rowId, colId: last } };
    selectionRef.current = next;
    setSelection(next);
    gridRef.current?.focus({ preventScroll: true });
  }

  function selectColumn(colId: string) {
    if (!visibleRows.length) return;
    const next = { anchor: { rowId: visibleRows[0].id, colId }, active: { rowId: visibleRows[visibleRows.length - 1].id, colId } };
    selectionRef.current = next;
    setSelection(next);
    gridRef.current?.focus({ preventScroll: true });
  }

  function beginEdit(rowId: string, colId: string) {
    const row = modelRef.current.rows.find(item => item.id === rowId);
    if (!row) return;
    setEditing({ rowId, colId });
    setEditValue(row.data[colId] || '');
  }

  function finishEdit(value = editValue) {
    if (!editing) return;
    const current = modelRef.current;
    const nextRows = current.rows.map(row => row.id === editing.rowId
      ? { ...row, data: { ...row.data, [editing.colId]: value } }
      : row);
    commit({ ...current, rows: nextRows }, 'Célula atualizada e salva neste navegador.');
    setEditing(null);
    setEditValue('');
  }

  function clearSelection() {
    const bounds = selectedBounds;
    if (!bounds) return;
    const rowIds = new Set(visibleRows.slice(bounds.top, bounds.bottom + 1).map(row => row.id));
    const colIds = model.columns.slice(bounds.left, bounds.right + 1).map(column => column.id);
    const nextRows = model.rows.map(row => rowIds.has(row.id)
      ? { ...row, data: { ...row.data, ...Object.fromEntries(colIds.map(id => [id, ''])) } }
      : row);
    commit({ ...model, rows: nextRows }, 'Célula(s) limpa(s).');
  }

  function copySelection() {
    if (!selectedBounds) return;
    const bounds = selectedBounds;
    const text = visibleRows.slice(bounds.top, bounds.bottom + 1).map(row =>
      model.columns.slice(bounds.left, bounds.right + 1).map(column => row.data[column.id] || '').join('\t')
    ).join('\n');
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).then(
        () => setMessage('Seleção copiada. Você pode colar diretamente na planilha.'),
        () => setMessage('A cópia foi bloqueada pelo navegador. Use Ctrl+C novamente ou o menu do navegador.')
      );
    } else setMessage('A cópia direta não está disponível neste navegador.');
  }

  function pasteText(text: string) {
    if (!selectedBounds || !text) return;
    const matrix = parseClipboard(text);
    if (!matrix.length) return;
    const start = selection ? visibleRows.findIndex(row => row.id === selection.active.rowId) : 0;
    const startCol = selection ? model.columns.findIndex(column => column.id === selection.active.colId) : 0;
    if (start < 0 || startCol < 0) return;
    let nextRows = [...model.rows];
    const targetIds: string[] = [];
    for (let offset = 0; offset < matrix.length; offset++) {
      const existing = visibleRows[start + offset];
      if (existing) targetIds.push(existing.id);
      else {
        const blank = newBlankRow(model.columns);
        nextRows.push(blank);
        targetIds.push(blank.id);
      }
    }
    nextRows = nextRows.map(row => {
      const rowOffset = targetIds.indexOf(row.id);
      if (rowOffset < 0) return row;
      const data = { ...row.data };
      matrix[rowOffset].slice(0, model.columns.length - startCol).forEach((value, colOffset) => {
        const column = model.columns[startCol + colOffset];
        if (column) data[column.id] = value;
      });
      return { ...row, data };
    });
    commit({ ...model, rows: nextRows }, 'Colagem aplicada diretamente na planilha local.');
  }

  function addRow(where: 'above' | 'below' | 'end' = 'end') {
    const blank = newBlankRow(model.columns);
    const current = modelRef.current;
    const activeId = selectionRef.current?.active.rowId;
    const actualIndex = activeId ? current.rows.findIndex(row => row.id === activeId) : -1;
    const insertAt = where === 'end' || actualIndex < 0 ? current.rows.length : actualIndex + (where === 'below' ? 1 : 0);
    const nextRows = [...current.rows];
    nextRows.splice(insertAt, 0, blank);
    commit({ ...current, rows: nextRows }, 'Nova linha adicionada.');
    if (current.columns[0]) selectCell(blank.id, current.columns[0].id);
  }

  function deleteSelectedRows() {
    if (!selectedBounds) return;
    const ids = new Set(visibleRows.slice(selectedBounds.top, selectedBounds.bottom + 1).map(row => row.id));
    if (!ids.size) return;
    if (!window.confirm('Excluir ' + ids.size + ' linha(s) somente desta cópia local?')) return;
    commit({ ...model, rows: model.rows.filter(row => !ids.has(row.id)) }, 'Linhas excluídas desta cópia local.');
    setSelection(null); selectionRef.current = null;
  }

  function addColumn(where: 'left' | 'right' = 'right') {
    const current = modelRef.current;
    const activeId = selectionRef.current?.active.colId;
    const activeIndex = activeId ? current.columns.findIndex(column => column.id === activeId) : -1;
    const insertAt = activeIndex < 0 ? current.columns.length : activeIndex + (where === 'right' ? 1 : 0);
    const newId = 'local-col-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    const nextColumns = [...current.columns];
    nextColumns.splice(insertAt, 0, { id: newId, key: '', label: 'NOVA COLUNA' });
    const columns = rekeyColumns(nextColumns);
    const rows = current.rows.map(row => ({ ...row, data: { ...row.data, [newId]: '' } }));
    commit({ columns, rows }, 'Nova coluna adicionada.');
    if (visibleRows[0]) selectCell(visibleRows[0].id, newId);
  }

  function deleteSelectedColumns() {
    if (!selectedBounds) return;
    const removed = model.columns.slice(selectedBounds.left, selectedBounds.right + 1);
    if (!removed.length) return;
    if (model.columns.length - removed.length < 1) {
      setMessage('A planilha precisa manter pelo menos uma coluna.');
      return;
    }
    if (!window.confirm('Excluir ' + removed.length + ' coluna(s) somente desta cópia local?')) return;
    const removedIds = new Set(removed.map(column => column.id));
    const columns = rekeyColumns(model.columns.filter(column => !removedIds.has(column.id)));
    const rows = model.rows.map(row => {
      const data = { ...row.data };
      removedIds.forEach(id => { delete data[id]; });
      return { ...row, data };
    });
    commit({ columns, rows }, 'Colunas excluídas desta cópia local.');
    setSelection(null); selectionRef.current = null;
  }

  function undo() {
    const previous = historyRef.current.undo.pop();
    if (!previous) return;
    historyRef.current.redo.push(JSON.parse(JSON.stringify(modelRef.current)) as Model);
    modelRef.current = previous;
    setModel(previous);
    setMessage('Última alteração desfeita.');
  }

  function redo() {
    const next = historyRef.current.redo.pop();
    if (!next) return;
    historyRef.current.undo.push(JSON.parse(JSON.stringify(modelRef.current)) as Model);
    modelRef.current = next;
    setModel(next);
    setMessage('Alteração refeita.');
  }

  function exportCsv() {
    const escape = (value: string) => '"' + value.replace(/"/g, '""') + '"';
    const lines = [
      model.columns.map(column => escape(column.label || column.key)).join(','),
      ...model.rows.map(row => model.columns.map(column => escape(row.data[column.id] || '')).join(','))
    ];
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mapa-costalog-demonstracao.csv';
    link.click();
    URL.revokeObjectURL(url);
    setMessage('CSV exportado. Guarde o arquivo para ter uma cópia fora deste navegador.');
  }

  async function importCsv(file: File) {
    try {
      const text = await file.text();
      const matrix = file.name.toLocaleLowerCase('pt-BR').endsWith('.tsv') || text.includes('\t')
        ? parseClipboard(text) : parseCsv(text);
      if (!matrix.length) throw new Error('O arquivo não contém linhas.');
      const current = modelRef.current;
      const sourceHeaders = matrix[0];
      const existingByLabel = new Map(current.columns.map(column => [(column.label || column.key).trim().toLocaleLowerCase('pt-BR'), column]));
      const targetColumns = current.columns.map(column => ({ ...column }));
      const newRows = matrix.slice(1).filter(line => line.some(value => value.trim())).map((line, rowIndex) => {
        const data: Record<string, string> = {};
        targetColumns.forEach(column => { data[column.id] = ''; });
        line.forEach((value, index) => {
          const header = (sourceHeaders[index] || '').trim().toLocaleLowerCase('pt-BR');
          const target = header ? (existingByLabel.get(header) || targetColumns[index]) : targetColumns[index];
          if (target) data[target.id] = value;
        });
        return { id: 'import-row-' + Date.now().toString(36) + '-' + rowIndex + '-' + Math.random().toString(36).slice(2, 5), data };
      });
      if (!newRows.length) throw new Error('Não encontrei linhas de dados depois do cabeçalho.');
      if (!window.confirm('Importar ' + newRows.length + ' linha(s) do arquivo para esta cópia local? Isso substituirá as linhas de demonstração atuais.')) return;
      commit({ ...current, rows: newRows }, 'Arquivo importado para este navegador. Nenhum servidor foi atualizado.');
      setSearch(''); setStatusFilter('Todos'); setSelection(null); selectionRef.current = null;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível importar o arquivo.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function resetDemo() {
    if (!window.confirm('Descartar as alterações locais e recriar os dados fictícios de demonstração?')) return;
    const next = makeInitialModel(headers);
    historyRef.current = { undo: [], redo: [] };
    modelRef.current = next;
    setModel(next);
    setSearch(''); setStatusFilter('Todos'); setSort(null); setSelection(null); selectionRef.current = null;
    setMessage('Dados fictícios recriados. Nenhum dado real foi alterado.');
  }

  function onGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || editing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      if (visibleRows[0] && model.columns[0]) {
        const next = {
          anchor: { rowId: visibleRows[0].id, colId: model.columns[0].id },
          active: { rowId: visibleRows[visibleRows.length - 1].id, colId: model.columns[model.columns.length - 1].id }
        };
        selectionRef.current = next; setSelection(next);
      }
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') { event.preventDefault(); copySelection(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'x') { event.preventDefault(); copySelection(); clearSelection(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); clearSelection(); return; }
    if (!selection || !selectedBounds) return;
    if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault(); beginEdit(selection.active.rowId, selection.active.colId); return;
    }
    const rowIndex = visibleRows.findIndex(row => row.id === selection.active.rowId);
    const colIndex = model.columns.findIndex(column => column.id === selection.active.colId);
    let nextRow = rowIndex;
    let nextCol = colIndex;
    if (event.key === 'ArrowDown') nextRow = Math.min(visibleRows.length - 1, rowIndex + 1);
    else if (event.key === 'ArrowUp') nextRow = Math.max(0, rowIndex - 1);
    else if (event.key === 'ArrowRight' || event.key === 'Tab') nextCol = Math.min(model.columns.length - 1, colIndex + 1);
    else if (event.key === 'ArrowLeft') nextCol = Math.max(0, colIndex - 1);
    else return;
    event.preventDefault();
    if (visibleRows[nextRow] && model.columns[nextCol]) selectCell(visibleRows[nextRow].id, model.columns[nextCol].id, event.shiftKey);
  }

  function openContextMenu(event: React.MouseEvent, kind: ContextMenu['kind'], rowId?: string, colId?: string) {
    event.preventDefault();
    event.stopPropagation();
    if (rowId && colId) selectCell(rowId, colId);
    else if (rowId) selectRow(rowId);
    else if (colId) selectColumn(colId);
    setContextMenu({ x: Math.min(event.clientX, window.innerWidth - 245), y: Math.min(event.clientY, window.innerHeight - 330), kind, rowId, colId });
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    if (editing) return;
    const text = event.clipboardData.getData('text/plain');
    if (text && selection) { event.preventDefault(); pasteText(text); }
  }

  function handleCopy(event: React.ClipboardEvent<HTMLDivElement>) {
    if (!selectedBounds) return;
    const bounds = selectedBounds;
    const text = visibleRows.slice(bounds.top, bounds.bottom + 1).map(row =>
      model.columns.slice(bounds.left, bounds.right + 1).map(column => row.data[column.id] || '').join('\t')
    ).join('\n');
    event.clipboardData.setData('text/plain', text);
    event.preventDefault();
  }

  const statuses = ['Todos', ...new Set(model.rows.map(row => {
    const column = model.columns.find(item => item.key === 'C');
    return column ? row.data[column.id] || '' : '';
  }).filter(Boolean))];

  return (
    <main className="local-demo-shell">
      <header className="local-demo-header">
        <div className="local-demo-brand">
          <span className="local-demo-mark"><FileSpreadsheet size={22} /></span>
          <div><strong>MAPA COSTALOG</strong><small>PLANILHA OPERACIONAL · DEMONSTRAÇÃO LOCAL</small></div>
        </div>
        <div className="local-demo-header-actions">
          <span className="local-demo-saved"><CheckCircle2 size={15} /> Salvamento local automático</span>
          <button type="button" className="local-demo-button" onClick={exportCsv}><Download size={16} /> Exportar CSV</button>
        </div>
      </header>

      {showInfo && <section className="local-demo-warning">
        <ShieldAlert size={20} />
        <div><strong>Modo público de demonstração — sem login seguro</strong>
          <p>Este site não usa API nem banco de dados. Os registros são fictícios e ficam apenas neste navegador. Qualquer pessoa com o link pode abrir o modo de demonstração; não insira dados confidenciais.</p>
        </div>
        <button type="button" aria-label="Fechar aviso" onClick={() => setShowInfo(false)}><X size={17} /></button>
      </section>}

      <section className="local-demo-heading">
        <div><span>ESPAÇO DE TESTES</span><h1>MAPA 1.0 — Planilha</h1><p>Edite células, cole intervalos do Excel e teste os atalhos sem alterar nenhum sistema externo.</p></div>
        <div className="local-demo-count"><strong>{model.rows.length.toLocaleString('pt-BR')}</strong><span>linhas locais</span></div>
      </section>

      <section className="local-demo-toolbar">
        <label className="local-demo-search"><Search size={16} /><input aria-label="Pesquisar na planilha" value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar em todas as colunas..." /></label>
        <label className="local-demo-filter"><Filter size={15} /><select aria-label="Filtrar por status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>{statuses.map(value => <option key={value} value={value}>{value === 'Todos' ? 'Todos os status' : value || '(Em branco)'}</option>)}</select><ChevronDown size={13} /></label>
        <button type="button" className="local-demo-button" onClick={() => addRow('end')}><Plus size={15} /> Nova linha</button>
        <button type="button" className="local-demo-button" onClick={() => addColumn('right')}><Plus size={15} /> Nova coluna</button>
        <button type="button" className="local-demo-button" onClick={undo} disabled={!historyRef.current.undo.length} title="Ctrl+Z"><Undo2 size={15} /> Desfazer</button>
        <button type="button" className="local-demo-button" onClick={redo} disabled={!historyRef.current.redo.length} title="Ctrl+Y"><Redo2 size={15} /> Refazer</button>
        <button type="button" className="local-demo-button" onClick={() => fileInputRef.current?.click()}><Upload size={15} /> Importar CSV</button>
        <input ref={fileInputRef} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void importCsv(file); }} />
        <button type="button" className="local-demo-button local-demo-reset" onClick={resetDemo}><RotateCcw size={15} /> Reiniciar exemplo</button>
      </section>

      <div className="local-demo-message" role="status"><AlertTriangle size={15} /><span>{message}</span><span className="local-demo-shortcuts">Enter/F2 editar · Delete limpar · Ctrl+C/Ctrl+V copiar/colar · Ctrl+Z desfazer</span></div>

      <section className="local-demo-grid-panel">
        <div className="local-demo-grid-scroll" ref={gridRef} tabIndex={0} onKeyDown={onGridKeyDown} onPaste={handlePaste} onCopy={handleCopy} onContextMenu={event => openContextMenu(event, 'cell', selection?.active.rowId, selection?.active.colId)} aria-label="Grade de planilha de demonstração">
          <table className="local-demo-table">
            <thead><tr>
              <th className="local-demo-row-number local-demo-corner" title="Número da linha">#</th>
              {model.columns.map((column, index) => {
                const selected = selectedBounds && index >= selectedBounds.left && index <= selectedBounds.right;
                return <th key={column.id} className={selected ? 'local-demo-col-selected' : ''} onClick={() => selectColumn(column.id)} onContextMenu={event => openContextMenu(event, 'column', undefined, column.id)} title={'Coluna ' + column.key + (column.label ? ' — ' + column.label : '')}>
                  <small>{column.key}</small><span>{column.label || ' '}</span>
                  <button type="button" aria-label={'Ordenar por ' + (column.label || column.key)} onClick={event => { event.stopPropagation(); setSort(current => current?.id === column.id && current.direction === 'asc' ? { id: column.id, direction: 'desc' } : { id: column.id, direction: 'asc' }); }} className="local-demo-sort">{sort?.id === column.id && sort.direction === 'desc' ? <ArrowDownAZ size={12} /> : <ArrowUpAZ size={12} />}</button>
                </th>;
              })}
            </tr></thead>
            <tbody>
              {visibleRows.map((row, rowIndex) => <tr key={row.id}>
                <th className={'local-demo-row-number ' + (selectedBounds && rowIndex >= selectedBounds.top && rowIndex <= selectedBounds.bottom ? 'local-demo-row-selected' : '')} onClick={() => selectRow(row.id)} onContextMenu={event => openContextMenu(event, 'row', row.id)}>{model.rows.findIndex(item => item.id === row.id) + 2}</th>
                {model.columns.map((column, colIndex) => {
                  const selected = selectedBounds && rowIndex >= selectedBounds.top && rowIndex <= selectedBounds.bottom && colIndex >= selectedBounds.left && colIndex <= selectedBounds.right;
                  const isActive = selection?.active.rowId === row.id && selection?.active.colId === column.id;
                  const isEditing = editing?.rowId === row.id && editing?.colId === column.id;
                  return <td key={column.id} className={(selected ? 'local-demo-selected ' : '') + (isActive ? 'local-demo-active ' : '')} onClick={event => selectCell(row.id, column.id, event.shiftKey)} onDoubleClick={() => beginEdit(row.id, column.id)} onContextMenu={event => openContextMenu(event, 'cell', row.id, column.id)} title={column.key + ' · duplo clique para editar'}>
                    {isEditing ? <input autoFocus className="local-demo-editor" value={editValue} onChange={event => setEditValue(event.target.value)} onBlur={() => finishEdit()} onKeyDown={event => {
                      if (event.key === 'Escape') { event.preventDefault(); setEditing(null); setEditValue(''); gridRef.current?.focus(); }
                      else if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); finishEdit(); if (event.key === 'Tab') { const nextColumn = model.columns[colIndex + (event.shiftKey ? -1 : 1)]; if (nextColumn) selectCell(row.id, nextColumn.id); } else gridRef.current?.focus(); }
                    }} /> : <span>{row.data[column.id] || ''}</span>}
                  </td>;
                })}
              </tr>)}
              {!visibleRows.length && <tr><td className="local-demo-empty" colSpan={model.columns.length + 1}>Nenhuma linha corresponde à pesquisa ou ao filtro.</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="local-demo-grid-footer"><span>{visibleRows.length} de {model.rows.length} linhas exibidas</span><span>{model.columns.length} colunas · {selection ? 'Seleção ativa' : 'Clique em uma célula para começar'}</span><span>Dados salvos somente neste navegador</span></footer>
      </section>

      <footer className="local-demo-footer">MAPA COSTALOG <span>•</span> GitHub Pages <span>•</span> Demonstração sem autenticação nem sincronização</footer>

      {contextMenu && <div className="local-demo-menu-backdrop" onClick={() => setContextMenu(null)}>
        <div className="local-demo-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} role="menu" onClick={event => event.stopPropagation()}>
          <div className="local-demo-menu-title">{contextMenu.kind === 'row' ? 'Opções da linha' : contextMenu.kind === 'column' ? 'Opções da coluna' : 'Opções da célula'}</div>
          <button type="button" role="menuitem" onClick={() => { if (selection) beginEdit(selection.active.rowId, selection.active.colId); setContextMenu(null); }}>Editar célula <span>Enter / F2</span></button>
          <button type="button" role="menuitem" onClick={() => { copySelection(); setContextMenu(null); }}><Copy size={14} /> Copiar seleção <span>Ctrl+C</span></button>
          <button type="button" role="menuitem" onClick={() => { clearSelection(); setContextMenu(null); }}><Trash2 size={14} /> Limpar seleção <span>Delete</span></button>
          <div className="local-demo-menu-divider" />
          <button type="button" role="menuitem" onClick={() => { addRow('above'); setContextMenu(null); }}><Plus size={14} /> Inserir linha acima</button>
          <button type="button" role="menuitem" onClick={() => { addRow('below'); setContextMenu(null); }}><Plus size={14} /> Inserir linha abaixo</button>
          <button type="button" role="menuitem" onClick={() => { deleteSelectedRows(); setContextMenu(null); }}><Trash2 size={14} /> Excluir linha(s)</button>
          <div className="local-demo-menu-divider" />
          <button type="button" role="menuitem" onClick={() => { addColumn('left'); setContextMenu(null); }}><Plus size={14} /> Inserir coluna à esquerda</button>
          <button type="button" role="menuitem" onClick={() => { addColumn('right'); setContextMenu(null); }}><Plus size={14} /> Inserir coluna à direita</button>
          <button type="button" role="menuitem" onClick={() => { deleteSelectedColumns(); setContextMenu(null); }}><Trash2 size={14} /> Excluir coluna(s)</button>
          <button type="button" role="menuitem" onClick={() => setContextMenu(null)}><X size={14} /> Fechar</button>
        </div>
      </div>}
    </main>
  );
}

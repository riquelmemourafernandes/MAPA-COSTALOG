import { useEffect, useMemo, useState } from 'react';
import { Activity, Bell, Bold, GripVertical, Palette, PaintBucket, ChevronDown, ClipboardList, Columns3, Filter, History, LayoutDashboard, LogOut, Plus, Save, Search, Settings2, Table2, Truck, Users, Waypoints, X, UserRound } from 'lucide-react';

type Column = { key: string; label: string; position: number; dataType: string; editable: boolean; visible: boolean };
type RecordRow = { id: string; sequence: number; data: Record<string, unknown>; status?: string | null; clientName?: string | null; container?: string | null; cte?: string | null; updatedAt: string };
type SavedView = { name: string; visibleKeys: string[]; query: string; status: string };
type CellStyle = { bold?: boolean; color?: string; background?: string };
type AuditEntry = { id: string; action: string; fieldKey?: string | null; beforeValue?: unknown; afterValue?: unknown; createdAt: string; user?: { name?: string; email?: string } | null };
type UserProfile = { id: string; name: string; email: string; role: string; active: boolean };
type UserAdminItem = UserProfile & { createdAt?: string; updatedAt?: string };
const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
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
  const [token, setToken] = useState(() => apiBase ? sessionStorage.getItem('mapa-costalog-token') || '' : '');
  const [userKey, setUserKey] = useState(() => sessionStorage.getItem('mapa-costalog-user') || 'usuario');
  const [userRole, setUserRole] = useState(() => sessionStorage.getItem('mapa-costalog-role') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiError, setApiError] = useState('');
  const [notice, setNotice] = useState('Conecte a API e o banco de dados para acessar os registros operacionais.');
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<Column[]>([]);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [columnMenu, setColumnMenu] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<string[]>([]);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [viewName, setViewName] = useState('');
  const [showViewTools, setShowViewTools] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{row: RecordRow; column: Column} | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{key:string; direction:'asc'|'desc'} | null>(null);
  const [cellStyles, setCellStyles] = useState<Record<string, CellStyle>>({});
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
  const pageSize = 100;
  const preferenceKey = 'mapa-costalog-columns:' + userKey;

  useEffect(() => {
    if (!apiBase || !token) return;
    let cancelled = false;
    setLoading(true);
    setApiError('');
    Promise.all([
      fetch(apiBase + '/api/v1/config/columns', { headers: { Authorization: 'Bearer ' + token } }),
      fetch(apiBase + '/api/v1/mapa?page=' + page + '&pageSize=' + pageSize + '&search=' + encodeURIComponent(query) + '&status=' + encodeURIComponent(status), { headers: { Authorization: 'Bearer ' + token } })
    ]).then(async ([columnsResponse, rowsResponse]) => {
      const columnsBody = await columnsResponse.json().catch(() => ({}));
      const rowsBody = await rowsResponse.json().catch(() => ({}));
      if (!columnsResponse.ok) throw new Error(columnsBody?.error?.message || 'Falha ao carregar as colunas.');
      if (!rowsResponse.ok) throw new Error(rowsBody?.error?.message || 'Falha ao carregar os registros.');
      if (cancelled) return;
      const nextColumns = Array.isArray(columnsBody.items) ? columnsBody.items as Column[] : [];
      setColumns(nextColumns);
      const saved = localStorage.getItem(preferenceKey);
      const savedKeys = saved ? JSON.parse(saved) as string[] : null;
      setVisibleKeys(savedKeys ? savedKeys.filter(key => nextColumns.some(c => c.key === key)) : nextColumns.filter(c => c.visible).map(c => c.key));
      setRows(Array.isArray(rowsBody.items) ? rowsBody.items as RecordRow[] : []);
      setTotal(Number(rowsBody.total || 0));
      setNotice('Dados carregados do banco de dados. As colunas visíveis são personalizadas por usuário.');
    }).catch(error => {
      if (cancelled) return;
      const message = error instanceof Error ? error.message : 'Não foi possível conectar à API.';
      setApiError(message);
      if (/sessão|token|login/i.test(message)) { sessionStorage.removeItem('mapa-costalog-token'); setToken(''); }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, page, query, status, preferenceKey]);

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
  function updateSelectedStyle(change: CellStyle) {
    if (!selectedCell) return;
    const key = styleKey(selectedCell.row, selectedCell.column);
    const next = { ...cellStyles, [key]: { ...(cellStyles[key] || {}), ...change } };
    setCellStyles(next);
    void (async () => {
      try {
        const response = await fetch(apiBase + '/api/v1/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ visibleKeys, columnOrder: visibleKeys, savedViews, cellStyles: next }) });
        const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body?.error?.message || 'Não foi possível salvar a formatação.');
        setNotice('Formatação da célula salva na sua conta.');
      } catch (error) { setApiError(error instanceof Error ? error.message : 'Falha ao salvar formatação.'); }
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
      setUsers(previous=>previous.map(item=>item.id===user.id?{...item,...body.user}:item));setNotice('Cadastro de usuário atualizado.');
    } catch(error) {setApiError(error instanceof Error ? error.message : 'Falha ao atualizar usuário.');}
  }
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!apiBase) return;
    setLoading(true); setApiError('');
    try {
      const response = await fetch(apiBase + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message || 'Não foi possível entrar.');
      sessionStorage.setItem('mapa-costalog-token', body.token);
      sessionStorage.setItem('mapa-costalog-user', body.user?.id || body.user?.email || 'usuario');
      sessionStorage.setItem('mapa-costalog-role', body.user?.role || 'CONSULTA');
      setUserKey(body.user?.id || body.user?.email || 'usuario');
      setUserRole(body.user?.role || 'CONSULTA');
      setToken(body.token); setPassword('');
      setNotice('Conectado como ' + (body.user?.name || body.user?.email || 'usuário autorizado') + '.');
    } catch (error) { setApiError(error instanceof Error ? error.message : 'Falha no login.'); }
    finally { setLoading(false); }
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
  async function saveCell(row: RecordRow, column: Column, value: string) {
    if (!apiBase || !token || !column.editable) return;
    const previousValue = valueText(row.data?.[column.key]);
    if (value === previousValue) return;
    const parsedValue: unknown = value === '' ? null :
      (column.dataType === 'number' || column.dataType === 'currency' ? Number(value.replace(',', '.')) :
      column.dataType === 'boolean' ? value.toLocaleLowerCase('pt-BR') === 'true' || value.toLocaleLowerCase('pt-BR') === 'sim' : value);
    if ((column.dataType === 'number' || column.dataType === 'currency') && value !== '' && !Number.isFinite(parsedValue as number)) {
      setApiError('Informe um número válido na coluna ' + column.label + '.'); return;
    }
    try {
      const response = await fetch(apiBase + '/api/v1/mapa/' + encodeURIComponent(row.id), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ changes: { [column.key]: parsedValue }, expectedUpdatedAt: row.updatedAt })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message || 'Não foi possível salvar.');
      setRows(previous => previous.map(item => item.id === row.id ? body.item as RecordRow : item));
      setNotice('Alteração salva no banco e registrada no histórico.');
      setApiError('');
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Falha ao salvar.');
      setNotice('A alteração não foi confirmada. Atualize a tela antes de continuar.');
    }
  }
  const visibleColumns = useMemo(() => columns.filter(c => visibleKeys.includes(c.key)).sort((a,b) => visibleKeys.indexOf(a.key)-visibleKeys.indexOf(b.key)), [columns, visibleKeys]);
  const displayedRows = useMemo(() => {
    const filtered = rows.filter(row => {
      const values = Object.values(row.data || {}).map(valueText).join(' ') + ' ' + [row.status,row.clientName,row.container,row.cte].map(valueText).join(' ');
      return values.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'));
    });
    if (!sortConfig) return filtered;
    return [...filtered].sort((a,b) => {
      const av = valueText(a.data?.[sortConfig.key]).trim(); const bv = valueText(b.data?.[sortConfig.key]).trim();
      const an = Number(av.replace(/\\./g,'').replace(',','.')); const bn = Number(bv.replace(/\\./g,'').replace(',','.'));
      const bothNumeric = av !== '' && bv !== '' && Number.isFinite(an) && Number.isFinite(bn);
      const compared = bothNumeric ? an-bn : av.localeCompare(bv,'pt-BR',{numeric:true,sensitivity:'base'});
      return sortConfig.direction === 'asc' ? compared : -compared;
    });
  }, [rows, query, sortConfig]);
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Truck size={22}/></div><div><strong>COSTALOG</strong><span>OPERAÇÕES</span></div></div>
      <div className="workspace"><span className="workspace-dot"/> MAPA operacional <ChevronDown size={15}/></div>
      <div className="nav-label">MENU PRINCIPAL</div>
      <nav>{nav.map(item => <button key={item.name} className={`nav-item ${active === item.name ? 'active' : ''}`} onClick={() => setActive(item.name)}><item.icon size={18}/><span>{item.name}</span>{item.name === 'MAPA 1.0' && <span className="nav-count">{columns.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="connection"><span className="connection-dot"/> {apiBase && token ? 'Conectado à API' : 'API não conectada'}</div><div className="user"><div className="avatar">C</div><div><b>Costalog</b><small>{token ? 'Usuário autenticado' : 'Acesso operacional'}</small></div><Settings2 size={17}/></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumbs">Operações <span>/</span> <b>{active}</b></div><div className="top-actions">{token && <button className="secondary" onClick={logout}><LogOut size={15}/> Sair</button>}<button className="icon-button" title="Notificações"><Bell size={18}/></button><div className="avatar small">C</div></div></header>
      <section className="content">
        {active !== 'MAPA 1.0' && <div className="page-heading"><div><div className="eyebrow">CENTRAL DE OPERAÇÕES</div><h1>{active}</h1><p>Grade operacional completa, com colunas configuráveis para cada usuário.</p></div></div>}
        {active !== 'MAPA 1.0' && <div className="notice"><ClipboardList size={17}/><span>{apiBase ? (token ? notice : 'Entre com sua conta para acessar os dados reais.') : 'Configure VITE_API_URL para conectar a aplicação à API. Nenhum dado fictício será exibido.'}</span></div>}
        {apiBase && !token && <form className="panel login-panel" onSubmit={login}><div><h2>Acessar MAPA COSTALOG</h2><p>Entre com seu usuário autorizado.</p></div><div className="login-fields"><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-mail corporativo" autoComplete="username"/><input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha" autoComplete="current-password"/><button className="primary" disabled={loading}>{loading ? 'Conectando...' : 'Entrar'}</button></div>{apiError && <p className="api-error">{apiError}</p>}</form>}
        {apiBase && apiError && token && <div className="notice api-error"><span>{apiError}</span><button onClick={logout}>Fazer login novamente</button></div>}
        {active === 'Visão geral' && <section className="workspace-page">
          <div className="section-intro"><span className="eyebrow">RESUMO DO DIA</span><h2>Visão geral da operação</h2><p>Indicadores dos registros atualmente carregados.</p></div>
          <div className="overview-grid"><div className="overview-card"><span>Registros encontrados</span><strong>{total}</strong><small>Na consulta atual</small></div><div className="overview-card"><span>Registros nesta página</span><strong>{displayedRows.length}</strong><small>Até {pageSize} por página</small></div><div className="overview-card"><span>Colunas configuradas</span><strong>{columns.length}</strong><small>Estrutura MAPA 1.0</small></div></div>
          <div className="panel quick-panel"><div><h3>Acesso rápido</h3><p>Consulte e edite os registros operacionais na grade.</p></div><button className="primary" onClick={()=>setActive('MAPA 1.0')}><Table2 size={16}/> Abrir MAPA 1.0</button></div>
          {total === 0 && <div className="empty-state">Ainda não há registros operacionais no banco. Nenhum dado fictício é exibido.</div>}
        </section>}
        {active === 'Status operacional' && <section className="workspace-page">
          <div className="section-intro"><span className="eyebrow">ACOMPANHAMENTO</span><h2>Status dos registros</h2><p>Selecione um status para abrir os registros correspondentes.</p></div>
          <div className="status-grid">{Array.from(new Set(rows.map(row=>row.status).filter((value): value is string=>Boolean(value)))).sort().map(value=><button className="status-card" key={value} onClick={()=>{setStatus(value);setPage(1);setActive('MAPA 1.0')}}><span className="status-indicator"/><b>{value}</b><small>Ver registros com este status</small></button>)}</div>
          {rows.every(row=>!row.status) && <div className="empty-state">Não há status preenchidos nos registros carregados.</div>}
          <button className="secondary" onClick={()=>{setStatus('');setActive('MAPA 1.0')}}>Limpar filtro e abrir grade</button>
        </section>}
        {active === 'Cadastros' && <section className="workspace-page">
          <div className="section-intro"><span className="eyebrow">DADOS DE APOIO</span><h2>Cadastros</h2><p>Listas de referência utilizadas pela operação.</p></div>
          <div className="feature-list"><div className="feature-row"><div className="feature-icon"><Users size={19}/></div><div><b>Listas de apoio</b><p>A estrutura de armazenamento existe; a manutenção dos cadastros pela interface ainda precisa ser conectada à API.</p></div><span className="feature-state">Em implementação</span></div><div className="feature-row"><div className="feature-icon"><Settings2 size={19}/></div><div><b>Colunas do MAPA</b><p>Configure as colunas exibidas diretamente na grade MAPA 1.0.</p></div><button className="secondary" onClick={()=>setActive('MAPA 1.0')}>Abrir grade</button></div></div>
        </section>}

        {active === 'Minha conta' && <section className="workspace-page"><div className="section-intro"><span className="eyebrow">CONTA PESSOAL</span><h2>Meu cadastro</h2><p>Atualize seu nome, e-mail e senha.</p></div><form className="panel profile-form" onSubmit={saveProfile}><label>Nome completo<input required minLength={2} value={profileName} onChange={event=>setProfileName(event.target.value)}/></label><label>E-mail<input required type="email" value={profileEmail} onChange={event=>setProfileEmail(event.target.value)}/></label><div className="profile-role">Perfil de acesso <strong>{profile?.role||userRole||'—'}</strong><small>Permissões são alteradas por um administrador.</small></div><div className="password-section"><h3>Alterar senha (opcional)</h3><label>Senha atual<input type="password" autoComplete="current-password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)} required={Boolean(newPassword)}/></label><label>Nova senha<input type="password" minLength={10} autoComplete="new-password" value={newPassword} onChange={event=>setNewPassword(event.target.value)} placeholder="Mínimo de 10 caracteres"/></label></div><button className="primary" type="submit"><Save size={15}/> Salvar meu cadastro</button></form></section>}
        {active === 'Usuários' && <section className="workspace-page"><div className="section-intro"><span className="eyebrow">ADMINISTRAÇÃO</span><h2>Usuários e permissões</h2><p>Crie contas, altere perfis e bloqueie acessos.</p></div>{userRole!=='ADMIN'?<div className="empty-state">Esta área é exclusiva para administradores.</div>:<><form className="panel create-user-form" onSubmit={createUser}><h3>Novo usuário</h3><div className="user-form-grid"><label>Nome<input required minLength={2} value={newUserName} onChange={event=>setNewUserName(event.target.value)}/></label><label>E-mail<input required type="email" value={newUserEmail} onChange={event=>setNewUserEmail(event.target.value)}/></label><label>Senha inicial<input required type="password" minLength={10} value={newUserPassword} onChange={event=>setNewUserPassword(event.target.value)}/></label><label>Perfil<select value={newUserRole} onChange={event=>setNewUserRole(event.target.value)}><option value="CONSULTA">Consulta</option><option value="OPERACAO">Operação</option><option value="SUPERVISOR">Supervisor</option><option value="ADMIN">Administrador</option></select></label></div><button className="primary" type="submit"><Plus size={15}/> Criar usuário</button></form><div className="panel users-table-panel"><div className="panel-heading"><div><h2>Usuários cadastrados</h2><p>{users.length} conta(s)</p></div></div><div className="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{users.map(item=><tr key={item.id}><td>{item.name}</td><td>{item.email}</td><td><select value={item.role} disabled={item.id===profile?.id} onChange={event=>void updateUser(item,{role:event.target.value})}><option value="CONSULTA">Consulta</option><option value="OPERACAO">Operação</option><option value="SUPERVISOR">Supervisor</option><option value="ADMIN">Administrador</option></select></td><td><span className={item.active?'feature-state connected':'feature-state'}>{item.active?'Ativo':'Bloqueado'}</span></td><td><button className="secondary" disabled={item.id===profile?.id} onClick={()=>void updateUser(item,{active:!item.active})}>{item.active?'Bloquear':'Reativar'}</button></td></tr>)}</tbody></table></div></div></>}</section>}
        {active === 'Integrações' && <section className="workspace-page">
          <div className="section-intro"><span className="eyebrow">CONEXÕES DO SISTEMA</span><h2>Integrações</h2><p>Estado de acesso aos recursos centrais do MAPA COSTALOG.</p></div>
          <div className="feature-list"><div className="feature-row"><div className="feature-icon"><Waypoints size={19}/></div><div><b>API MAPA COSTALOG</b><p>{apiBase || 'Endereço da API não configurado no frontend.'}</p></div><span className={apiBase && token ? 'feature-state connected' : 'feature-state'}>{apiBase && token ? 'Sessão ativa' : 'Sem sessão'}</span></div><div className="feature-row"><div className="feature-icon"><Activity size={19}/></div><div><b>Banco de dados</b><p>Registros consultados pela API e armazenados no PostgreSQL/Supabase.</p></div><span className="feature-state">{token ? 'Acesso autenticado' : 'Aguardando login'}</span></div><div className="notice"><ClipboardList size={17}/><span>Sincronizações externas adicionais ainda precisam ser implementadas e testadas.</span></div></div>
        </section>}
        {active === 'MAPA 1.0' && <>
        <section className="panel mapa-grid-panel">
          <div className="panel-heading compact-map-heading"><div><h2><Table2 size={19}/> MAPA 1.0</h2><p>Planilha operacional · edite as células autorizadas diretamente na grade.</p></div><div className="panel-actions">{token && userRole !== 'CONSULTA' && <button className="primary" disabled={loading} onClick={()=>void createRow()}><Plus size={16}/> Novo registro</button>}<button className="secondary" onClick={()=>setColumnMenu(value=>!value)}><Columns3 size={16}/> Escolher colunas ({visibleColumns.length})</button></div></div>
          {columnMenu && <div className="column-picker"><div className="column-picker-actions"><b>Colunas exibidas e sequência</b><button className="secondary" onClick={()=>{const all=columns.map(c=>c.key);setVisibleKeys(all);localStorage.setItem(preferenceKey,JSON.stringify(all));void persistPreferences({visibleKeys:all});}}>Mostrar todas</button><button className="secondary" onClick={()=>{const defaults=columns.filter(c=>c.visible).map(c=>c.key);setVisibleKeys(defaults);localStorage.setItem(preferenceKey,JSON.stringify(defaults));void persistPreferences({visibleKeys:defaults});}}>Restaurar padrão</button></div><div className="column-options">{[...columns].sort((a,b)=>{const ai=visibleKeys.indexOf(a.key),bi=visibleKeys.indexOf(b.key);return ai<0?(bi<0?a.position-b.position:1):bi<0?-1:ai-bi}).map(column=><div className={"column-option "+(draggedColumn===column.key?"dragging":"")} key={column.key} draggable onDragStart={()=>setDraggedColumn(column.key)} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(draggedColumn)reorderColumn(draggedColumn,column.key);setDraggedColumn(null)}} onDragEnd={()=>setDraggedColumn(null)}><GripVertical size={15} className="drag-handle"/><input type="checkbox" checked={visibleKeys.includes(column.key)} onChange={()=>toggleColumn(column.key)}/><span>{column.label || '(coluna sem título)'}</span></div>)}</div><div className="saved-view-tools"><button className="secondary" onClick={()=>setShowViewTools(value=>!value)}><Filter size={14}/> Filtros personalizados</button>{showViewTools&&<div className="saved-view-editor"><div className="saved-view-save"><input value={viewName} onChange={event=>setViewName(event.target.value)} placeholder="Nome da configuração"/><button className="primary" onClick={()=>void saveCurrentView()}><Save size={14}/> Salvar filtro</button></div>{savedViews.map(view=><div className="saved-view-item" key={view.name}><button onClick={()=>applyView(view)}>{view.name}</button><small>{view.visibleKeys.length} colunas · {view.status||'Todos os status'}{view.query?' · busca: '+view.query:''}</small><button title="Excluir filtro" onClick={()=>{const next=savedViews.filter(item=>item.name!==view.name);setSavedViews(next);void persistPreferences({savedViews:next});}}><X size={14}/></button></div>)}</div>}</div></div>}<div className="toolbar"><div className="searchbox"><Search size={16}/><input value={query} onChange={e=>{setPage(1);setQuery(e.target.value)}} placeholder="Buscar em todos os campos..."/></div><div className="select-wrap"><Filter size={16}/><select value={status} onChange={e=>{setPage(1);setStatus(e.target.value)}}><option value="">Todos os status</option>{Array.from(new Set(rows.map(row=>row.status).filter((value): value is string=>Boolean(value)))).sort().map(value=><option key={value} value={value}>{value}</option>)}</select></div><button className="secondary" disabled={!selectedCell} onClick={()=>selectedCell&&void openHistory(selectedCell.row,selectedCell.column)}><History size={14}/> Histórico da célula selecionada</button><button className="secondary" disabled={!selectedCell||userRole==='CONSULTA'} onClick={()=>updateSelectedStyle({bold:!cellStyles[selectedCell?styleKey(selectedCell.row,selectedCell.column):'']?.bold})}><Bold size={14}/> Negrito</button><label className="format-color" title="Cor do texto"><Palette size={14}/><input type="color" aria-label="Cor do texto" disabled={!selectedCell||userRole==='CONSULTA'} value={selectedCell?(cellStyles[styleKey(selectedCell.row,selectedCell.column)]?.color||'#47584e'):'#47584e'} onChange={event=>updateSelectedStyle({color:event.target.value})}/></label><label className="format-color" title="Cor de fundo"><PaintBucket size={14}/><input type="color" aria-label="Cor de fundo" disabled={!selectedCell||userRole==='CONSULTA'} value={selectedCell?(cellStyles[styleKey(selectedCell.row,selectedCell.column)]?.background||'#ffffff'):'#ffffff'} onChange={event=>updateSelectedStyle({background:event.target.value})}/></label><span className="rows-count">{total} registros</span></div>
          <div className="table-wrap" tabIndex={0}><table><thead><tr>{visibleColumns.map(column=><th key={column.key} title="Clique para classificar por esta coluna"><button className="sort-header" onClick={()=>setSortConfig(current=>current?.key===column.key?{key:column.key,direction:current.direction==='asc'?'desc':'asc'}:{key:column.key,direction:'asc'})}>{column.label || '(sem título)'}{sortConfig?.key===column.key?(sortConfig.direction==='asc'?' ↑':' ↓'):' ↕'}</button></th>)}</tr></thead><tbody>{displayedRows.map(row=><tr key={row.id}>{visibleColumns.map(column=><td key={column.key} className={(column.editable&&token&&userRole!=='CONSULTA'?'editable-cell ':'')+(selectedCell?.row.id===row.id&&selectedCell.column.key===column.key?'selected-cell':'')} style={{fontWeight:cellStyles[styleKey(row,column)]?.bold?'bold':'normal',color:cellStyles[styleKey(row,column)]?.color,backgroundColor:cellStyles[styleKey(row,column)]?.background}} onClick={()=>setSelectedCell({row,column})}><div className="cell-content"><span contentEditable={Boolean(token&&userRole!=='CONSULTA'&&column.editable)} suppressContentEditableWarning onFocus={()=>setSelectedCell({row,column})} onBlur={event=>void saveCell(row,column,event.currentTarget.textContent||'')}>{valueText(row.data?.[column.key])}</span></div></td>)}</tr>)}</tbody></table>{!loading && displayedRows.length===0 && <div className="empty-state">{token ? 'Nenhum registro encontrado no banco para esta consulta.' : 'Conecte-se à API para visualizar os registros reais.'}</div>}</div>
          <footer className="table-footer"><span>{apiBase && token ? 'Dados do banco • edição individual com auditoria' : 'Sem dados de demonstração'}</span><span><span className="green-dot"/> {visibleColumns.length} coluna(s) selecionada(s)</span></footer>
          <div className="pagination"><button className="secondary" disabled={page<=1 || loading} onClick={()=>setPage(value=>Math.max(1,value-1))}>Anterior</button><span>Página {page} de {Math.max(1,Math.ceil(total/pageSize))}</span><button className="secondary" disabled={page>=Math.ceil(total/pageSize) || loading} onClick={()=>setPage(value=>value+1)}>Próxima</button></div>
        </section>
        </>}
        {historyTarget&&<div className="modal-backdrop" onClick={()=>setHistoryTarget(null)}><section className="history-modal" onClick={event=>event.stopPropagation()}><header><div><h2><History size={18}/> Histórico da célula</h2><p>Registro #{historyTarget.row.sequence} · {historyTarget.column.label||"Coluna sem título"}</p></div><button className="icon-button" onClick={()=>setHistoryTarget(null)}><X size={18}/></button></header>{historyLoading?<div className="empty-state">Carregando histórico…</div>:historyItems.length===0?<div className="empty-state">Nenhuma edição encontrada para esta célula.</div>:<div className="history-list">{historyItems.map(item=><article key={item.id}><div className="history-meta"><b>{item.user?.name||item.user?.email||"Usuário não identificado"}</b><time>{new Date(item.createdAt).toLocaleString("pt-BR")}</time></div><p><span>Ação:</span> {item.action}</p><p><span>Antes:</span> {valueText(item.beforeValue&&typeof item.beforeValue==="object"&&historyTarget.column.key in (item.beforeValue as Record<string,unknown>)?(item.beforeValue as Record<string,unknown>)[historyTarget.column.key]:item.beforeValue)}</p><p><span>Depois:</span> {valueText(item.afterValue&&typeof item.afterValue==="object"&&historyTarget.column.key in (item.afterValue as Record<string,unknown>)?(item.afterValue as Record<string,unknown>)[historyTarget.column.key]:item.afterValue)}</p></article>)}</div>}</section></div>}
        <footer className="app-footer">MAPA COSTALOG <span>•</span> Aplicação web operacional em desenvolvimento</footer>
      </section>
    </main>
  </div>;
}

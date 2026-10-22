import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownUp, Bell, ChevronDown, ClipboardList, Download, Filter, LayoutDashboard, Plus, Search, Settings2, Table2, Truck, Users, Waypoints } from 'lucide-react';

type Row = { id: string | number; _updatedAt?: string; container: string; cliente: string; origem: string; destino: string; status: string; cavalo: string; motorista: string; previsao: string };
const demoRows: Row[] = [
  { id: 1, container: 'ABCD1234567', cliente: 'CLIENTE DEMONSTRAÇÃO', origem: 'Santos/SP', destino: 'São Paulo/SP', status: 'Programado', cavalo: 'ABC1D23', motorista: 'Motorista exemplo', previsao: '22/10/2026' },
  { id: 2, container: 'EFGH7654321', cliente: 'CLIENTE DEMONSTRAÇÃO', origem: 'Santos/SP', destino: 'Campinas/SP', status: 'Em trânsito', cavalo: 'DEF4G56', motorista: 'Motorista exemplo', previsao: '23/10/2026' },
  { id: 3, container: 'IJKL1234567', cliente: 'CLIENTE DEMONSTRAÇÃO', origem: 'Guarujá/SP', destino: 'Jundiaí/SP', status: 'Aguardando', cavalo: 'GHI7J89', motorista: 'Motorista exemplo', previsao: '24/10/2026' },
];
const nav = [
  { name: 'Visão geral', icon: LayoutDashboard },
  { name: 'MAPA 1.0', icon: Table2 },
  { name: 'Status operacional', icon: Activity },
  { name: 'Cadastros', icon: Users },
  { name: 'Integrações', icon: Waypoints },
];
const columns: { key: keyof Row; label: string }[] = [
  { key: 'id', label: 'ID' }, { key: 'container', label: 'Container' }, { key: 'cliente', label: 'Cliente' },
  { key: 'origem', label: 'Origem' }, { key: 'destino', label: 'Destino' }, { key: 'status', label: 'Status' },
  { key: 'cavalo', label: 'Cavalo' }, { key: 'motorista', label: 'Motorista' }, { key: 'previsao', label: 'Previsão' }
];

const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
}

function fromApi(item: any): Row {
  const data = item?.data && typeof item.data === 'object' ? item.data : {};
  return {
    id: item.id ?? item.sequence ?? '',
    _updatedAt: item.updatedAt,
    container: asText(item.container ?? data.T),
    cliente: asText(item.clientName ?? data.L),
    origem: asText(data.AK),
    destino: asText(data.AQ ?? data.AN),
    status: asText(item.status ?? data.C) || 'Sem status',
    cavalo: asText(data.W),
    motorista: asText(data.Y),
    previsao: asText(data.AP ?? data.AL)
  };
}

export default function App()
  const [active, setActive] = useState('MAPA 1.0');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos os status');
  const [token, setToken] = useState(() => apiBase ? sessionStorage.getItem('mapa-costalog-token') || '' : '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>(apiBase ? [] : demoRows);
  const [notice, setNotice] = useState('Demonstração visual — os dados abaixo são fictícios.');
  const filtered = useMemo(() => rows.filter(r =>
    Object.values(r).some(v => String(v).toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))) &&
    (status === 'Todos os status' || r.status === status)
  ), [rows, query, status]);

  useEffect(() => {
    if (!apiBase || !token) return;
    let cancelled = false;
    setLoading(true);
    setApiError('');
    fetch(apiBase + '/api/v1/mapa?page=1&pageSize=100', { headers: { Authorization: 'Bearer ' + token } })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error?.message || 'Falha ao carregar registros (' + response.status + ').');
        return body;
      })
      .then(body => {
        if (cancelled) return;
        setRows(Array.isArray(body.items) ? body.items.map(fromApi) : []);
        setNotice('Dados reais carregados da API: ' + (body.total ?? body.items?.length ?? 0) + ' registro(s) no total.');
      })
      .catch(error => {
        if (cancelled) return;
        if (error instanceof Error && /Sessão|token|login/i.test(error.message)) {
          sessionStorage.removeItem('mapa-costalog-token');
          setToken('');
        }
        setApiError(error instanceof Error ? error.message : 'Não foi possível conectar à API.');
        setRows([]);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!apiBase) return;
    setLoading(true);
    setApiError('');
    try {
      const response = await fetch(apiBase + '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message || 'Não foi possível entrar.');
      sessionStorage.setItem('mapa-costalog-token', body.token);
      setToken(body.token);
      setPassword('');
      setNotice('Conectado como ' + (body.user?.name || body.user?.email || 'usuário autenticado') + '.');
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Falha no login.');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    sessionStorage.removeItem('mapa-costalog-token');
    setToken('');
    setRows([]);
    setNotice('Sessão encerrada.');
  }

  async function saveCell(row: Row, field: keyof Row, value: string) {
    const columnKey: Partial<Record<keyof Row, string>> = {
      container: 'T', cliente: 'L', origem: 'AK', destino: 'AQ',
      status: 'C', cavalo: 'W', motorista: 'Y'
    };
    if (!apiBase || !token || !columnKey[field]) {
      setRows(previous => previous.map(item => item.id === row.id ? { ...item, [field]: value } : item));
      if (apiBase && token) setNotice('Este campo ainda não está habilitado para gravação pela API.');
      return;
    }
    try {
      const response = await fetch(apiBase + '/api/v1/mapa/' + encodeURIComponent(String(row.id)), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ changes: { [columnKey[field]!]: value }, expectedUpdatedAt: row._updatedAt })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message || 'Não foi possível salvar a alteração.');
      const updatedAt = body.item?.updatedAt || new Date().toISOString();
      setRows(previous => previous.map(item => item.id === row.id ? { ...item, [field]: value, _updatedAt: updatedAt } : item));
      setNotice('Alteração salva e registrada no histórico.');
      setApiError('');
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Falha ao salvar.');
      setNotice('A alteração não foi confirmada pelo servidor. Atualize os dados antes de continuar.');
      const response = await fetch(apiBase + '/api/v1/mapa?page=1&pageSize=100', { headers: { Authorization: 'Bearer ' + token } }).catch(() => null);
      if (response?.ok) {
        const body = await response.json().catch(() => ({}));
        setRows(Array.isArray(body.items) ? body.items.map(fromApi) : []);
      }
    }
  }

  function pasteGrid(e: React.ClipboardEvent<HTMLDivElement>) {
    const raw = e.clipboardData.getData('text/plain');
    if (!raw.includes('\t') && !raw.includes('\n')) return;
    e.preventDefault();
    const matrix = raw.trimEnd().split(/\r?\n/).map(line => line.split('\t'));
    setNotice(`Colagem detectada: ${matrix.length} linha(s) × ${Math.max(...matrix.map(r => r.length))} coluna(s). A gravação em lote será habilitada após a conexão da grade com a API.`);
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Truck size={22}/></div><div><strong>COSTALOG</strong><span>OPERAÇÕES</span></div></div>
      <div className="workspace"><span className="workspace-dot"/> Ambiente de desenvolvimento <ChevronDown size={15}/></div>
      <div className="nav-label">MENU PRINCIPAL</div>
      <nav>{nav.map(item => <button key={item.name} className={`nav-item ${active === item.name ? 'active' : ''}`} onClick={() => setActive(item.name)}><item.icon size={18}/><span>{item.name}</span>{item.name === 'MAPA 1.0' && <span className="nav-count">1</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="connection"><span className="connection-dot"/> Interface local</div><div className="user"><div className="avatar">C</div><div><b>Costalog</b><small>Projeto inicial</small></div><Settings2 size={17}/></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumbs">Operações <span>/</span> <b>{active}</b></div><div className="top-actions"><button className="icon-button" title="Notificações"><Bell size={18}/></button><div className="avatar small">C</div></div></header>
      <section className="content">
        <div className="page-heading"><div><div className="eyebrow">CENTRAL DE OPERAÇÕES</div><h1>{active}</h1><p>Centralize o acompanhamento e a gestão operacional em um só lugar.</p></div><button className="primary" onClick={() => setNotice('A criação de registros será habilitada quando a grade estiver conectada ao banco de dados.')}><Plus size={17}/> Novo registro</button></div>
        <div className="notice"><ClipboardList size={17}/><span>{apiBase ? (token ? notice : 'API configurada — entre com sua conta para carregar os dados operacionais.') : notice}</span>{token && apiBase && <button onClick={logout}>Sair</button>}</div>
        {apiBase && !token && <form className="panel login-panel" onSubmit={login}>
          <div><h2>Acessar MAPA COSTALOG</h2><p>Entre com seu usuário autorizado. A senha não é salva no navegador.</p></div>
          <div className="login-fields"><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-mail corporativo" autoComplete="username"/><input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha" autoComplete="current-password"/><button className="primary" disabled={loading}>{loading ? 'Conectando...' : 'Entrar'}</button></div>
          {apiError && <p className="api-error">{apiError}</p>}
        </form>}
        {apiBase && apiError && token && <div className="notice api-error"><span>{apiError}</span><button onClick={logout}>Fazer login novamente</button></div>}
        <div className="metrics">
          <div className="metric-card"><div className="metric-top"><span>Registros exibidos</span><Table2 size={17}/></div><strong>{loading ? '…' : filtered.length}</strong><small>{apiBase && token ? 'Dados da API' : 'Somente dados de demonstração'}</small></div>
          <div className="metric-card"><div className="metric-top"><span>Em trânsito</span><Truck size={17}/></div><strong>{filtered.filter(r=>r.status.toLocaleLowerCase('pt-BR').includes('trânsito')).length}</strong><small>{apiBase && token ? 'Registros carregados' : 'Exemplo de indicador operacional'}</small></div>
          <div className="metric-card"><div className="metric-top"><span>Aguardando</span><Activity size={17}/></div><strong>{filtered.filter(r=>r.status.toLocaleLowerCase('pt-BR').includes('aguard')).length}</strong><small>{apiBase && token ? 'Registros carregados' : 'Exemplo de indicador operacional'}</small></div>
          <div className="metric-card"><div className="metric-top"><span>Usuários</span><Users size={17}/></div><strong>—</strong><small>Disponível após configurar servidor e usuários</small></div>
        </div>
        <section className="panel">
          <div className="panel-heading"><div><h2><Table2 size={19}/> Grade operacional</h2><p>Prévia da experiência de edição em formato de planilha</p></div><div className="panel-actions"><button className="secondary" onClick={()=>setNotice('A exportação será conectada à API junto com a grade operacional.')}><Download size={16}/> Exportar</button><button className="secondary" onClick={()=>setNotice('Selecione uma coluna quando a grade completa for implementada.')}><ArrowDownUp size={16}/> Ordenar</button></div></div>
          <div className="toolbar"><div className="searchbox"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar em todos os campos..."/></div><div className="select-wrap"><Filter size={16}/><select value={status} onChange={e=>setStatus(e.target.value)}><option>Todos os status</option><option>Programado</option><option>Em trânsito</option><option>Aguardando</option></select></div><span className="rows-count">{filtered.length} linhas</span></div>
          <div className="table-wrap" tabIndex={0} onPaste={pasteGrid}><table><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{filtered.map(row=><tr key={row.id}>{columns.map(c=><td key={c.key} contentEditable={c.key!=='id' && (!apiBase || !token || ['container','cliente','origem','destino','status','cavalo','motorista'].includes(c.key))} suppressContentEditableWarning onBlur={e=>{const value=e.currentTarget.textContent||'';if(c.key!=='id' && value!==String(row[c.key] ?? '')) void saveCell(row,c.key,value);}}>{row[c.key]}</td>)}</tr>)}</tbody></table></div>
          <footer className="table-footer"><span>{apiBase && token ? filtered.length + ' registros da API' : 'Prévia visual • ' + filtered.length + ' registros de demonstração'}</span><span><span className="green-dot"/> {apiBase && token ? 'Edição ainda não conectada ao salvamento' : 'Alterações ainda não são persistidas'}</span></footer>
        </section>
        <div className="next-step"><div className="next-icon"><Waypoints size={20}/></div><div><b>Próximo passo</b><p>Conectar esta grade à API, configurar o banco de homologação e validar a importação do Excel antes de usar dados operacionais.</p></div></div>
        <footer className="app-footer">MAPA COSTALOG <span>•</span> Protótipo inicial — não usar para operação real</footer>
      </section>
    </main>
  </div>;
}
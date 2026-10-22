import { useMemo, useState } from 'react';
import { Activity, ArrowDownUp, Bell, ChevronDown, ClipboardList, Download, Filter, LayoutDashboard, Plus, Search, Settings2, Table2, Truck, Users, Waypoints } from 'lucide-react';

type Row = { id: number; container: string; cliente: string; origem: string; destino: string; status: string; cavalo: string; motorista: string; previsao: string };
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

export default function App() {
  const [active, setActive] = useState('MAPA 1.0');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos os status');
  const [rows, setRows] = useState(demoRows);
  const [notice, setNotice] = useState('Demonstração visual — os dados abaixo são fictícios.');
  const filtered = useMemo(() => rows.filter(r =>
    Object.values(r).some(v => String(v).toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))) &&
    (status === 'Todos os status' || r.status === status)
  ), [rows, query, status]);

  function pasteGrid(e: React.ClipboardEvent<HTMLDivElement>) {
    const raw = e.clipboardData.getData('text/plain');
    if (!raw.includes('\t') && !raw.includes('\n')) return;
    e.preventDefault();
    const matrix = raw.trimEnd().split(/\r?\n/).map(line => line.split('\t'));
    setNotice(`Colagem detectada: ${matrix.length} linha(s) × ${Math.max(...matrix.map(r => r.length))} coluna(s). A gravação estará disponível quando a API e o banco forem implementados.`);
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
        <div className="page-heading"><div><div className="eyebrow">CENTRAL DE OPERAÇÕES</div><h1>{active}</h1><p>Centralize o acompanhamento e a gestão operacional em um só lugar.</p></div><button className="primary" onClick={() => setNotice('A criação de registros será habilitada após a API e a persistência serem configuradas.')}><Plus size={17}/> Novo registro</button></div>
        <div className="notice"><ClipboardList size={17}/><span>{notice}</span><button onClick={() => setNotice('Demonstração visual — os dados abaixo são fictícios.')}>Dispensar</button></div>
        <div className="metrics">
          <div className="metric-card"><div className="metric-top"><span>Registros exibidos</span><Table2 size={17}/></div><strong>{filtered.length}</strong><small>Somente dados de demonstração</small></div>
          <div className="metric-card"><div className="metric-top"><span>Em trânsito</span><Truck size={17}/></div><strong>{filtered.filter(r=>r.status==='Em trânsito').length}</strong><small>Exemplo de indicador operacional</small></div>
          <div className="metric-card"><div className="metric-top"><span>Aguardando</span><Activity size={17}/></div><strong>{filtered.filter(r=>r.status==='Aguardando').length}</strong><small>Exemplo de indicador operacional</small></div>
          <div className="metric-card"><div className="metric-top"><span>Usuários</span><Users size={17}/></div><strong>—</strong><small>Autenticação ainda não configurada</small></div>
        </div>
        <section className="panel">
          <div className="panel-heading"><div><h2><Table2 size={19}/> Grade operacional</h2><p>Prévia da experiência de edição em formato de planilha</p></div><div className="panel-actions"><button className="secondary" onClick={()=>setNotice('Exportação real será ligada à API depois da modelagem do banco.')}><Download size={16}/> Exportar</button><button className="secondary" onClick={()=>setNotice('Selecione uma coluna quando a grade completa for implementada.')}><ArrowDownUp size={16}/> Ordenar</button></div></div>
          <div className="toolbar"><div className="searchbox"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar em todos os campos..."/></div><div className="select-wrap"><Filter size={16}/><select value={status} onChange={e=>setStatus(e.target.value)}><option>Todos os status</option><option>Programado</option><option>Em trânsito</option><option>Aguardando</option></select></div><span className="rows-count">{filtered.length} linhas</span></div>
          <div className="table-wrap" tabIndex={0} onPaste={pasteGrid}><table><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{filtered.map(row=><tr key={row.id}>{columns.map(c=><td key={c.key} contentEditable={c.key!=='id'} suppressContentEditableWarning onBlur={e=>{const value=e.currentTarget.textContent||'';setRows(prev=>prev.map(r=>r.id===row.id?{...r,[c.key]:c.key==='id'?r.id:value}:r));}}>{row[c.key]}</td>)}</tr>)}</tbody></table></div>
          <footer className="table-footer"><span>Prévia visual • {filtered.length} registros de demonstração</span><span><span className="green-dot"/> Alterações ainda não são persistidas</span></footer>
        </section>
        <div className="next-step"><div className="next-icon"><Waypoints size={20}/></div><div><b>Próximo passo técnico</b><p>Modelar o banco de dados a partir dos cabeçalhos e regras reais do arquivo MAPA IMPORTAÇÃO, antes de conectar a grade a dados operacionais.</p></div></div>
        <footer className="app-footer">MAPA COSTALOG <span>•</span> Protótipo inicial — não usar para operação real</footer>
      </section>
    </main>
  </div>;
}
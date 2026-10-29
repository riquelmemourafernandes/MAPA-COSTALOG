import { useMemo, useState } from 'react';
import {
  Check, CheckCircle2, ClipboardPaste, Database, Edit3, Eye, FileSpreadsheet,
  LockKeyhole, Plus, Search, ShieldCheck, Trash2, X
} from 'lucide-react';
import {
  createCatalogItem, createDemoCatalog, DEMO_LISTS,
  makeSampleImportRows, mergeImportedRows, PREVIEW_COLUMNS,
  validateImportGrid, type DemoCatalog, type DemoImportRow
} from './base-prototype-data.js';
import './base-prototype.css';

type Props = { userRole: string; onOpenMapa: () => void; importOnly?: boolean };
type DemoTab = 'base' | 'import';
const safeDate = (n: number) => String(n).padStart(2,'0');
export default function BasePrototype({userRole,onOpenMapa,importOnly=false}:Props) {
  const canManage = userRole === 'ADMIN' || userRole === 'SUPERVISOR';
  const [tab,setTab] = useState<DemoTab>(importOnly?'import':'base');
  const [catalog,setCatalog] = useState<DemoCatalog>(createDemoCatalog);
  const [category,setCategory] = useState<string>('CLIENTE');
  const [search,setSearch] = useState('');
  const [formName,setFormName] = useState('');
  const [formCity,setFormCity] = useState('');
  const [formKm,setFormKm] = useState('');
  const [editingId,setEditingId] = useState<string | null>(null);
  const [selectedDemo,setSelectedDemo] = useState('');
  const [importText,setImportText] = useState('');
  const [draftRows,setDraftRows] = useState<DemoImportRow[]>([]);
  const [importedRows,setImportedRows] = useState<DemoImportRow[]>([]);
  const [previewStart,setPreviewStart] = useState(0);
  const [notice,setNotice] = useState('');
  const [error,setError] = useState('');
  const activeList = DEMO_LISTS.find(item=>item.id===category) || DEMO_LISTS[0];
  const items = catalog[category] || [];
  const shown = useMemo(()=>items.filter(item=>
    [item.label,item.city||'',item.km===undefined?'':String(item.km)]
      .join(' ').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))
  ),[items,search]);
  const sourceStats = useMemo(()=>{
    const nonEmpty = draftRows.reduce((sum,row)=>sum+row.values.filter(Boolean).length,0);
    return {cells:draftRows.length*72,nonEmpty};
  },[draftRows]);
  function clearForm(){
    setFormName('');setFormCity('');setFormKm('');setEditingId(null);
  }
  function switchCategory(key:string) {
    setCategory(key);setSearch('');setSelectedDemo('');setError('');clearForm();
  }
  function submitCatalog(event:React.FormEvent) {
    event.preventDefault();
    if(!canManage){setError('Somente administradores e supervisores podem alterar cadastros.');return;}
    try{
      const others=items.filter(item=>item.id!==editingId);
      const item=createCatalogItem(others,{label:formName,city:formCity,km:formKm});
      const next = editingId
        ? items.map(entry=>entry.id===editingId?{...item,id:editingId,active:entry.active}:entry)
        : [...items,item];
      setCatalog(current=>({...current,[category]:next}));
      setNotice(editingId?'Alteração simulada na BASE (somente nesta sessão).':'Cadastro adicionado à BASE de demonstração.');
      setError('');clearForm();
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível alterar.');}
  }
  function toggleActive(itemId:string){
    if(!canManage)return;
    setCatalog(current=>({...current,[category]:(current[category]||[]).map(item=>
      item.id===itemId?{...item,active:!item.active}:item)}));
    setNotice('Situação alterada apenas neste protótipo.');
  }
  function startEdit(itemId:string){
    if(!canManage)return;
    const item=items.find(x=>x.id===itemId);
    if(!item)return;
    setEditingId(itemId);setFormName(item.label);setFormCity(item.city||'');
    setFormKm(item.km===undefined?'':String(item.km));setError('');
  }
  function previewText(){
    const {rows,errors}=validateImportGrid(importText);
    if(errors.length){setDraftRows([]);setError(errors.join(' '));return;}
    setDraftRows(rows);setPreviewStart(0);setError('');
    setNotice('55 linhas validadas para simulação. Nenhum registro foi gravado.');
  }
  function loadExample(){
    const rows=makeSampleImportRows();
    setDraftRows(rows);setPreviewStart(0);setImportText('');setError('');
    setNotice('Exemplo fictício carregado: 55 linhas × 72 colunas. Não são os dados originais do Google Drive.');
  }
  function simulateImport(){
    if(!canManage){setError('Você não tem permissão de manutenção.');return;}
    if(draftRows.length!==55){setError('Valide as 55 linhas antes de simular a importação.');return;}
    setImportedRows(previous=>mergeImportedRows(previous,draftRows));
    setError('');
    setNotice('Importação simulada: 55 linhas, sem duplicar linhas já simuladas. Nenhum dado foi enviado ao servidor.');
  }
  const currentOptions=items.filter(item=>item.active);
  const selected= currentOptions.find(item=>item.label===selectedDemo);
  const previewRows = draftRows.length ? draftRows : importedRows;
  const previewVisible = previewRows.slice(previewStart,previewStart+8);
  return <section className="basep-page">
    {!importOnly&&<div className="basep-head">
      <div>
        <p className="basep-eyebrow">MAPA-COSTALOG / HOMOLOGAÇÃO DE INTERFACE</p>
        <h2>BASE de cadastros e importação</h2>
        <p>Modelo inspirado na aba BASE do Google Sheets e nas linhas 12202–12256 do MAPA 1.0.</p>
      </div>
      <button type="button" className="basep-link" onClick={onOpenMapa}>Abrir MAPA 2.0</button>
    </div>}
    <div className="basep-banner" role="status">
      <ShieldCheck size={18}/>
      <div><strong>Protótipo isolado — sem gravação no banco</strong>
        <span>Alterações, exclusões e importações aqui são simulações locais. Nenhuma conta, registro ou planilha é modificada.</span>
      </div>
    </div>
    {!importOnly&&<div className="basep-tabs" role="tablist" aria-label="Áreas do protótipo">
      <button type="button" role="tab" aria-selected={tab==='base'} className={tab==='base'?'active':''}
        onClick={()=>{setTab('base');setError('');}}><Database size={16}/> BASE de cadastros</button>
      <button type="button" role="tab" aria-selected={tab==='import'} className={tab==='import'?'active':''}
        onClick={()=>{setTab('import');setError('');}}><FileSpreadsheet size={16}/> Importar 55 linhas</button>
    </div>}
    {(notice||error)&& <div className={'basep-flash '+(error?'basep-error':'')} role="status">
      {error||notice}<button type="button" aria-label="Dispensar mensagem" onClick={()=>{setError('');setNotice('');}}><X size={15}/></button>
    </div>}
    {tab==='base' ? <div className="basep-layout">
      <aside className="basep-list-nav" aria-label="Listas cadastráveis">
        <p>LISTAS DA BASE</p>
        {DEMO_LISTS.map(item=><button key={item.id} className={category===item.id?'active':''}
          type="button" onClick={()=>switchCategory(item.id)}>
          <span>{item.label}</span><small>{catalog[item.id]?.length||0}</small>
        </button>)}
      </aside>
      <div className="basep-detail">
        <div className="basep-section-head">
          <div><h3>{activeList.label}</h3>
            <span>BASE!{activeList.base} → MAPA 2.0!{activeList.mapa.join(', ')}</span>
          </div>
          <span className="basep-counter">{items.length} cadastros demonstrativos</span>
        </div>
        <div className="basep-search"><Search size={16}/><input aria-label="Pesquisar cadastros"
          placeholder={'Pesquisar '+activeList.label.toLocaleLowerCase('pt-BR')+'…'}
          value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <div className="basep-table-wrap">
          <table className="basep-table">
            <thead><tr><th>Nome / opção da lista</th>
              {category==='COLETA'&&<th>Cidade vinculada</th>}
              {category==='ENTREGA'&&<th>KM</th>}
              <th>Situação</th><th>Ações</th></tr></thead>
            <tbody>{shown.map(item=><tr key={item.id}>
              <td>{item.label}</td>
              {category==='COLETA'&&<td>{item.city||'—'}</td>}
              {category==='ENTREGA'&&<td>{item.km??'—'}</td>}
              <td><span className={'basep-status '+(item.active?'good':'')}>{item.active?'Ativo':'Inativo'}</span></td>
              <td className="basep-table-actions">
                <button disabled={!canManage} type="button" title="Editar cadastro" onClick={()=>startEdit(item.id)}><Edit3 size={14}/> Editar</button>
                <button disabled={!canManage} type="button" title={item.active?'Desativar':'Reativar'} onClick={()=>toggleActive(item.id)}>
                  {item.active?<Trash2 size={14}/>:<CheckCircle2 size={14}/>}
                  {item.active?'Inativar':'Ativar'}</button>
              </td>
            </tr>)}
              {!shown.length&&<tr><td colSpan={category==='COLETA'||category==='ENTREGA'?4:3}>Nenhum cadastro encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="basep-panels">
          <form className="basep-panel" onSubmit={submitCatalog}>
            <div className="basep-panel-heading"><Plus size={16}/><strong>{editingId?'Editar cadastro':'Adicionar cadastro'}</strong></div>
            <label>Nome ou valor
              <input required maxLength={255} disabled={!canManage} value={formName}
                onChange={e=>setFormName(e.target.value)} placeholder="Ex.: Novo cliente ou terminal"/>
            </label>
            {category==='COLETA'&&<label>Cidade vinculada
              <input disabled={!canManage} value={formCity} onChange={e=>setFormCity(e.target.value)} placeholder="Ex.: SANTOS - SP"/>
            </label>}
            {category==='ENTREGA'&&<label>Quilometragem
              <input disabled={!canManage} inputMode="decimal" value={formKm}
                onChange={e=>setFormKm(e.target.value)} placeholder="Ex.: 190"/>
            </label>}
            <div className="basep-actions">
              {editingId&&<button className="basep-link" type="button" onClick={clearForm}>Cancelar</button>}
              <button className="basep-primary" disabled={!canManage} type="submit">{editingId?'Salvar exemplo':'Adicionar exemplo'}</button>
            </div>
            {!canManage&&<small><LockKeyhole size={12}/> Apenas ADMIN e SUPERVISOR simulam edições.</small>}
          </form>
          <div className="basep-panel">
            <div className="basep-panel-heading"><Eye size={16}/><strong>Como funciona no MAPA 2.0</strong></div>
            <p>Na planilha real, a coluna {activeList.mapa.join('/')} usa uma lista de seleção alimentada pela BASE.</p>
            <label>Escolha uma opção (demonstração)
              <select value={selectedDemo} onChange={e=>setSelectedDemo(e.target.value)}>
                <option value="">Selecionar…</option>
                {currentOptions.map(item=><option key={item.id} value={item.label}>{item.label}</option>)}
              </select>
            </label>
            {selected&&<div className="basep-linked">
              <Check size={16}/> Selecionado: <strong>{selected.label}</strong>
              {selected.city&&<span>Cidade: {selected.city}</span>}
              {selected.km!==undefined&&<span>KM automático: {selected.km}</span>}
            </div>}
            <p className="basep-muted">O cadastro acima aparece nesta lista imediatamente; a ligação com o MAPA operacional será feita pela API após homologação.</p>
          </div>
        </div>
      </div>
    </div> : <div className="basep-import">
      <div className="basep-section-head">
        <div><h3>Importação controlada: MAPA 2.0</h3>
          <span>Origem: A12202:BT12256 • 55 linhas • 72 colunas</span>
        </div>
        <span className="basep-counter">Destino: simulação local</span>
      </div>
      <div className="basep-import-steps">
        <div><strong>1. Preparar dados</strong><span>Copie o intervalo A12202:BT12256 do Google Sheets e cole aqui, ou carregue uma amostra fictícia.</span></div>
        <div><strong>2. Validar</strong><span>O sistema exige exatamente 55 linhas e 72 colunas, preservando células vazias.</span></div>
        <div><strong>3. Simular</strong><span>Prévia dos registros, chave de origem e proteção contra duplicações.</span></div>
      </div>
      <label className="basep-paste">Cole as células copiadas do Google Sheets (TSV)
        <textarea rows={4} value={importText} onChange={e=>setImportText(e.target.value)}
          placeholder="Selecione A12202:BT12256 na planilha, copie e cole aqui. Nenhum dado será enviado ao servidor."/>
      </label>
      <div className="basep-actions basep-import-toolbar">
        <button type="button" className="basep-link" onClick={loadExample}><FileSpreadsheet size={15}/> Carregar exemplo (55 linhas)</button>
        <button type="button" className="basep-link" disabled={!importText.trim()} onClick={previewText}><ClipboardPaste size={15}/> Validar colagem</button>
        <button type="button" className="basep-primary" disabled={!canManage||draftRows.length!==55}
          onClick={simulateImport}>Simular importação</button>
      </div>
      <div className="basep-stats">
        <div><strong>{safeDate(draftRows.length)}</strong><span>linhas validadas</span></div>
        <div><strong>72</strong><span>colunas A até BT</span></div>
        <div><strong>{sourceStats.nonEmpty}</strong><span>células preenchidas na prévia</span></div>
        <div><strong>{importedRows.length}</strong><span>linhas simuladas (sem duplicar)</span></div>
      </div>
      <div className="basep-section-head">
        <div><h3>Pré-visualização dos registros</h3><span>Colunas-chave para leitura; todas as 72 permanecem no conjunto validado.</span></div>
      </div>
      <div className="basep-table-wrap basep-import-table">
        <table className="basep-table"><thead><tr><th>Linha origem</th>
          {PREVIEW_COLUMNS.map(column=><th key={column.key}>{column.key} · {column.label}</th>)}
        </tr></thead><tbody>
          {previewVisible.map(row=><tr key={row.sourceRow}><th scope="row">{row.sourceRow}</th>
            {PREVIEW_COLUMNS.map(column=>{
              const index=column.key.split('').reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
              return <td key={column.key} title={row.values[index]||''}>{row.values[index]||'—'}</td>;
            })}</tr>)}
          {!previewVisible.length&&<tr><td colSpan={PREVIEW_COLUMNS.length+1}>
            Nenhuma linha carregada. Use “Carregar exemplo” ou cole o intervalo do Google Sheets.
          </td></tr>}</tbody></table>
      </div>
      {previewRows.length>8&&<div className="basep-pagination">
        <button type="button" className="basep-link" disabled={previewStart===0}
          onClick={()=>setPreviewStart(x=>Math.max(0,x-8))}>Anterior</button>
        <span>Linhas {previewStart+1}–{Math.min(previewStart+8,previewRows.length)} de {previewRows.length}</span>
        <button type="button" className="basep-link" disabled={previewStart+8>=previewRows.length}
          onClick={()=>setPreviewStart(x=>Math.min(previewRows.length-8,x+8))}>Próximas</button>
      </div>}
      <p className="basep-safety"><LockKeyhole size={14}/>
        Esta etapa é somente demonstração. A importação real dependerá de validação de duplicidades, permissões e ambiente de homologação separado.
      </p>
    </div>}
  </section>;
}

import { useCallback, useEffect, useState } from "react";
import { Check, Database, Pencil, Plus, Search, X } from "lucide-react";
import BasePrototype from "./BasePrototype.js";
import { DEMO_LISTS } from "./base-prototype-data.js";
import "./base-catalog-sheet.css";

type Item = {id:string;label:string;active:boolean;metadata?:{cidade?:string;km?:number};updatedAt:string};
type Props = {apiBase:string;token:string;userRole:string;onOpenMapa:()=>void};
const LISTS=[
  ...DEMO_LISTS.slice(0,4),
  {id:"CIDADE_COLETA",label:"Cidades de coleta",base:"E",mapa:["AK"]},
  ...DEMO_LISTS.slice(4)
];
function messageOf(error:unknown){return error instanceof Error?error.message:"Não foi possível concluir a solicitação.";}
export default function BaseCatalogSheet({apiBase,token,userRole,onOpenMapa}:Props) {
  const [tab,setTab]=useState<"base"|"import">("base");
  const [listName,setListName]=useState("ATENDENTE");
  const [items,setItems]=useState<Item[]>([]);
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [ready,setReady]=useState(false);
  const [backendUnavailable,setBackendUnavailable]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [editing,setEditing]=useState<string|null>(null);
  const [draft,setDraft]=useState("");
  const [city,setCity]=useState("");
  const [km,setKm]=useState("");
  const canManage=userRole==="ADMIN"||userRole==="SUPERVISOR";
  const category=LISTS.find(x=>x.id===listName)||LISTS[0];
  const fetchList=useCallback(async()=>{
    if(!token||!apiBase)return;
    setLoading(true);setReady(false);setError("");
    setBackendUnavailable(false);
    try{
      const response=await fetch(apiBase+"/api/v1/base/catalog?"+new URLSearchParams({listName}),{
        headers:{Authorization:"Bearer "+token},cache:"no-store"
      });
      const body=await response.json().catch(()=>({}));
      // A preview frontend can load successfully while its rewrite still
      // points to the older production API. Do not mistake this for an empty BASE.
      if(response.status===404||response.status===405){
        setBackendUnavailable(true);
        setItems([]);
        return;
      }
      if(!response.ok)throw new Error(body?.error?.message||
        "Não foi possível carregar os cadastros. Confira sua sessão e a API.");
      if(!Array.isArray(body.items)){
        setBackendUnavailable(true);
        setItems([]);
        return;
      }
      setBackendUnavailable(false);
      setItems(body.items as Item[]);setReady(true);
    }catch(e){setReady(false);setError(messageOf(e));setItems([]);}
    finally{setLoading(false);}
  },[apiBase,token,listName]);
  useEffect(()=>{if(tab==="base")void fetchList();},[fetchList,tab]);
  function resetDraft(){setEditing(null);setDraft("");setCity("");setKm("");}
  function edit(item:Item){setEditing(item.id);setDraft(item.label);setCity(item.metadata?.cidade||"");setKm(item.metadata?.km===undefined?"":String(item.metadata.km));}
  async function send(method:"POST"|"PATCH",path:string,payload:Record<string,unknown>){
    if(!canManage||!ready||busy)return;
    setBusy(true);setError("");setNotice("");
    try{
      const response=await fetch(apiBase+path,{
        method,headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
        body:JSON.stringify(payload)
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result?.error?.message||"Falha ao salvar cadastro.");
      setNotice("BASE atualizada. O novo valor já pode ser encontrado no menu suspenso do MAPA.");
      resetDraft();
      await fetchList();
      // Any open lookup can re-query. No page reload is needed.
      window.dispatchEvent(new CustomEvent("mapa-base-updated",{detail:{listName}}));
    }catch(e){setError(messageOf(e));}
    finally{setBusy(false);}
  }
  function submit(e:React.FormEvent) {
    e.preventDefault();
    const label=draft.trim().replace(/\s+/g," ");
    if(!label){setError("Informe o nome do cadastro.");return;}
    const metadata:Record<string,unknown>={};
    if(listName==="COLETA"&&city.trim())metadata.cidade=city.trim();
    if(listName==="ENTREGA"&&km.trim()){
      const value=Number(km.replace(",","."));
      if(!Number.isFinite(value)||value<0){setError("Quilometragem inválida.");return;}
      metadata.km=value;
    }
    if(editing)void send("PATCH","/api/v1/base/catalog/"+encodeURIComponent(editing),{label,metadata});
    else void send("POST","/api/v1/base/catalog",{listName,label,metadata});
  }
  function toggle(item:Item){
    if(!canManage||!ready)return;
    if(item.active&&!window.confirm('Inativar "'+item.label+'"? O histórico do MAPA será preservado.'))return;
    void send("PATCH","/api/v1/base/catalog/"+encodeURIComponent(item.id),{active:!item.active});
  }
  const shown=items.filter(item=>(item.label+" "+(item.metadata?.cidade||""))
    .toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  return <section className="bc-page">
    <header className="bc-head"><div>
      <p>MAPA-COSTALOG / CADASTROS</p><h2>BASE de cadastros</h2>
      <span>Uma planilha simples para alimentar os menus de seleção do MAPA 1.0.</span>
    </div><button className="bc-outline" onClick={onOpenMapa}>Abrir MAPA 1.0</button></header>
    <nav className="bc-tabs" aria-label="Cadastros e importação">
      <button className={tab==="base"?"active":""} onClick={()=>setTab("base")}>BASE de cadastros</button>
      <button className={tab==="import"?"active":""} onClick={()=>setTab("import")}>Importação de testes</button>
    </nav>
    {tab==="import"?<BasePrototype userRole={userRole} onOpenMapa={onOpenMapa} importOnly/>:
     backendUnavailable ? <div className="bc-offline-demo">
       <div className="bc-offline-notice" role="status">
         <strong>A API da BASE ainda não está conectada a esta prévia.</strong>
         <span>O site está usando a API anterior do Render. Abaixo está uma demonstração local
           para testar inclusão, edição e inativação sem gravar nada no banco.
           Esses cadastros não aparecerão no MAPA até conectarmos uma API atualizada de homologação.</span>
         <button className="bc-outline" type="button" onClick={()=>void fetchList()}
           disabled={loading}>{loading?"Verificando…":"Verificar conexão novamente"}</button>
       </div>
       <BasePrototype userRole={userRole} onOpenMapa={onOpenMapa}/>
     </div>:
    <>
      <div className="bc-info"><Database size={16}/>
        <span>Os dados são salvos na BASE do servidor. Apenas administradores e supervisores podem incluir, renomear ou inativar. Remover da lista não apaga registros antigos do MAPA.</span>
      </div>
      <div className="bc-layout">
        <aside className="bc-lists"><strong>LISTAS DA BASE</strong>
          {LISTS.map(l=><button key={l.id} className={listName===l.id?"active":""}
            onClick={()=>{setListName(l.id);setSearch("");resetDraft();setNotice("");}}>
            <span>{l.label}</span><small>{l.mapa.join(" / ")}</small>
          </button>)}
        </aside>
        <div className="bc-sheet">
          <div className="bc-sheet-head"><div><h3>{category.label}</h3>
            <p>BASE {category.base} → MAPA {category.mapa.join(", ")}</p></div>
            <span>{loading?"Carregando…":items.length+" itens"}</span></div>
          <div className="bc-search"><Search size={16}/><input aria-label="Pesquisar cadastro"
            placeholder="Pesquisar nesta lista…" value={search}
            onChange={e=>setSearch(e.target.value)}/></div>
          {error&&<p className="bc-error" role="alert">{error}</p>}
          {notice&&<p className="bc-notice" role="status">{notice}</p>}
          <div className="bc-table-wrap"><table className="bc-table">
            <thead><tr><th>#</th><th>Nome / opção do menu</th>
              {listName==="COLETA"&&<th>Cidade</th>}
              {listName==="ENTREGA"&&<th>KM</th>}
              <th>Situação</th><th>Ação</th></tr></thead>
            <tbody>
              {shown.map((item,index)=><tr key={item.id} className={!item.active?"inactive":""}>
                <td>{index+1}</td>
                {editing===item.id?<td colSpan={listName==="COLETA"||listName==="ENTREGA"?4:3}>
                  <form className="bc-inline-edit" onSubmit={submit}>
                    <input aria-label="Renomear cadastro" maxLength={255} value={draft}
                      onChange={e=>setDraft(e.target.value)} autoFocus required/>
                    {listName==="COLETA"&&<input aria-label="Cidade" placeholder="Cidade" value={city} onChange={e=>setCity(e.target.value)}/>}
                    {listName==="ENTREGA"&&<input aria-label="KM" placeholder="KM" value={km} onChange={e=>setKm(e.target.value)}/>}
                    <button type="submit" disabled={busy||!ready}><Check size={15}/> Salvar</button>
                    <button type="button" onClick={resetDraft}><X size={15}/> Cancelar</button>
                  </form>
                </td>:<>
                  <td>{item.label}</td>
                  {listName==="COLETA"&&<td>{item.metadata?.cidade||"—"}</td>}
                  {listName==="ENTREGA"&&<td>{item.metadata?.km??"—"}</td>}
                  <td><span className={"bc-status "+(item.active?"is-active":"")}>{item.active?"Ativo":"Inativo"}</span></td>
                  <td className="bc-commands">
                    <button title="Editar nome" disabled={!canManage||!ready||busy} onClick={()=>edit(item)}><Pencil size={14}/> Editar</button>
                    <button disabled={!canManage||!ready||busy}
                      onClick={()=>toggle(item)}>{item.active?"Inativar":"Reativar"}</button>
                  </td>
                </>}
              </tr>)}
              {!loading&&!shown.length&&<tr><td colSpan={5} className="bc-empty">
                {ready?"Nenhum cadastro encontrado. Inclua uma nova linha abaixo.":"Cadastros indisponíveis até a API ser atualizada."}
              </td></tr>}
            </tbody></table></div>
          <form className="bc-add" onSubmit={submit}>
            <label><Plus size={15}/> Novo {category.label.toLocaleLowerCase("pt-BR")}</label>
            <div className="bc-add-fields">
              <input aria-label="Novo nome" required maxLength={255}
                disabled={!canManage||!ready||Boolean(editing)}
                placeholder={"Digite o nome e pressione Enter…"} value={editing?"":draft}
                onChange={e=>setDraft(e.target.value)}/>
              {listName==="COLETA"&&<input aria-label="Cidade vinculada" placeholder="Cidade (opcional)"
                disabled={!canManage||!ready||Boolean(editing)} value={editing?"":city} onChange={e=>setCity(e.target.value)}/>}
              {listName==="ENTREGA"&&<input aria-label="Quilometragem" placeholder="KM"
                disabled={!canManage||!ready||Boolean(editing)} value={editing?"":km} onChange={e=>setKm(e.target.value)}/>}
              <button className="bc-primary" disabled={!canManage||!ready||busy||Boolean(editing)} type="submit">
                <Plus size={15}/> Adicionar</button>
            </div>
          </form>
          {!canManage&&<p className="bc-hint">Seu perfil é de consulta. Um administrador pode autorizar a manutenção da BASE.</p>}
        </div>
      </div>
    </>}
  </section>;
}

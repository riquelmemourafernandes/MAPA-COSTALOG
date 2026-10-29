import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { resolveDropdownValue, searchOptions } from "./sheet-dropdown-utils.js";
import "./sheet-dropdown.css";

type Props={
  columnKey:string;
  rowLabel:string;
  currentValue:string;
  initialQuery:string;
  fallbackOptions:string[];
  apiBase:string;
  token:string;
  onConfirm:(value:string,key:"Enter"|"Tab"|null,shift:boolean)=>void;
  onCancel:()=>void;
};
export default function SheetDropdownEditor({
  columnKey,rowLabel,currentValue,initialQuery,fallbackOptions,apiBase,token,onConfirm,onCancel
}:Props){
  const inputRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    // Clicking a populated dropdown selects its text, so the next keystroke
    // searches from scratch just like Google Sheets.
    if(initialQuery===currentValue) inputRef.current?.select();
  },[]);
  const [query,setQuery]=useState(initialQuery);
  const [backendOptions,setBackendOptions]=useState<string[]|null>(null);
  const [loading,setLoading]=useState(false);
  const [hasError,setHasError]=useState(false);
  const [errorMessage,setErrorMessage]=useState("");
  const [highlight,setHighlight]=useState(0);
  const [rect,setRect]=useState<{top:number;left:number;width:number}|null>(null);
  const [expanded,setExpanded]=useState(true);
  const options=useMemo(()=>
    searchOptions([...fallbackOptions,...(backendOptions||[]),currentValue].filter(Boolean),query).slice(0,150),
    [fallbackOptions,backendOptions,currentValue,query]);
  useEffect(()=>{setHighlight(0);setHasError(false);},[query]);
  useEffect(()=>{
    if(!apiBase || !token) return;
    const controller=new AbortController();
    const timer=window.setTimeout(()=>{
      setLoading(true);
      const params=new URLSearchParams({column:columnKey,q:query});
      fetch(apiBase+"/api/v1/base/options?"+params,{
        headers:{Authorization:"Bearer "+token},signal:controller.signal
      }).then(async response=>{
        if(!response.ok)throw new Error("A lista BASE ainda não está disponível nesta versão da API.");
        const body=await response.json();
        if(!Array.isArray(body.items))throw new Error("Resposta inválida da BASE.");
        setBackendOptions(body.items.filter((item:unknown):item is string=>typeof item==="string"));
        setErrorMessage("");
      }).catch(()=>{
        if(!controller.signal.aborted){
          setBackendOptions(null);
          setErrorMessage("Opções dos registros já carregados. A API da BASE precisa ser publicada para acessar toda a lista.");
        }
      }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    },170);
    return ()=>{window.clearTimeout(timer);controller.abort();};
  },[apiBase,token,columnKey,query]);
  useEffect(()=>{
    const el=inputRef.current;
    if(!el)return;
    const update=()=>{
      const r=el.getBoundingClientRect();
      setRect({
        top:Math.min(r.bottom+3,window.innerHeight-60),
        left:Math.max(8,Math.min(r.left,window.innerWidth-Math.max(260,r.width))),
        width:Math.max(260,Math.min(355,r.width))
      });
    };
    update();
    window.addEventListener("resize",update);
    // Scroll inside the sheet may reposition the selected cell.
    window.addEventListener("scroll",update,true);
    return ()=>{window.removeEventListener("resize",update);window.removeEventListener("scroll",update,true);};
  },[]);
  function confirm(key:"Enter"|"Tab"|null,shift=false,index=highlight){
    const candidate=query.trim()==="" ? "" : resolveDropdownValue(query,options,index);
    if(candidate===null){
      setHasError(true);setExpanded(true);
      return;
    }
    onConfirm(candidate,key,shift);
  }
  function onKeys(event:React.KeyboardEvent<HTMLInputElement>){
    if(event.key==="Escape"){event.preventDefault();event.stopPropagation();onCancel();return;}
    if(event.key==="ArrowDown"||event.key==="ArrowUp"){
      event.preventDefault();event.stopPropagation();setExpanded(true);
      setHighlight(prev=>Math.max(0,Math.min(options.length-1,prev+(event.key==="ArrowDown"?1:-1))));
      return;
    }
    if(event.key==="Enter"||event.key==="Tab"){
      event.preventDefault();event.stopPropagation();
      confirm(event.key,event.shiftKey);
    }
  }
  return <>
    <span className="sheet-cell-dropdown-editor">
      <input ref={inputRef} autoFocus spellCheck={false} className="sheet-cell-editor"
        role="combobox" aria-haspopup="listbox" aria-expanded={expanded}
        aria-autocomplete="list" aria-controls="sheet-cell-options"
        aria-label={"Selecionar "+rowLabel} value={query}
        onChange={event=>{setQuery(event.target.value);setExpanded(true);}}
        onKeyDown={onKeys}
        onBlur={()=>{onCancel();}}
        onClick={event=>{event.stopPropagation();setExpanded(true);}}/>
      <button type="button" className="sheet-cell-dropdown-caret" tabIndex={-1}
        aria-label="Mostrar opções da BASE"
        onMouseDown={event=>event.preventDefault()}
        onClick={event=>{event.stopPropagation();setExpanded(old=>!old);inputRef.current?.focus();}}>
        <ChevronDown size={13}/>
      </button>
    </span>
    {expanded && rect && createPortal(<div id="sheet-cell-options" className="sheet-cell-options"
      role="listbox" aria-label={"Lista de "+rowLabel}
      style={{top:rect.top,left:rect.left,width:rect.width,maxHeight:Math.max(100,window.innerHeight-rect.top-12)}}
      onMouseDown={event=>event.preventDefault()}>
      <div className="sheet-cell-options-heading"><Search size={13}/>
        <span>{loading?"Pesquisando na BASE…":"Selecione ou digite para pesquisar"}</span>
      </div>
      <div className="sheet-cell-options-scroll">
        {!query.trim()&&<button className="sheet-cell-option clear" type="button"
          role="option" aria-selected={false} onClick={()=>confirm(null,false,-1)}>
            (Deixar em branco)
          </button>}
        {options.map((option,index)=><button type="button" key={option}
          className={"sheet-cell-option "+(highlight===index?"highlighted":"")}
          role="option" aria-selected={highlight===index}
          onMouseEnter={()=>setHighlight(index)}
          onClick={()=>onConfirm(option,null,false)}>
          <span>{option}</span>{option===currentValue&&<Check size={13}/>}
        </button>)}
        {!options.length&&query.trim()&&<div className="sheet-cell-no-options">
          Nenhum valor cadastrado corresponde a “{query}”.
        </div>}
      </div>
      {hasError&&<div className="sheet-cell-options-error" role="alert">
        Selecione uma opção válida da lista antes de confirmar.
      </div>}
      {errorMessage&&<div className="sheet-cell-options-hint">{errorMessage}</div>}
    </div>,document.body)}
  </>;
}

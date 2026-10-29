import { useEffect, useRef } from "react";
import { getSheetContextOptions, safeMenuPosition, type SheetContextKind,
  type SheetContextAction } from "./sheet-context-menu.js";
import "./sheet-context-menu.css";

type Props={
  kind:SheetContextKind;
  x:number; y:number;
  onAction:(action:SheetContextAction)=>void;
  onClose:()=>void;
};
export default function SheetContextMenu({kind,x,y,onAction,onClose}:Props){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    function closeIfOutside(event:PointerEvent){
      if(!ref.current?.contains(event.target as Node))onClose();
    }
    function escape(event:KeyboardEvent){
      if(event.key==="Escape"){event.preventDefault();onClose();}
    }
    document.addEventListener("pointerdown",closeIfOutside);
    document.addEventListener("keydown",escape);
    return ()=>{document.removeEventListener("pointerdown",closeIfOutside);document.removeEventListener("keydown",escape);};
  },[onClose]);
  const actions=getSheetContextOptions(kind,true);
  const position=safeMenuPosition(x,y,270,Math.min(560,actions.length*35+16),window.innerWidth,window.innerHeight);
  return <div className="sheet-context-menu" role="menu" ref={ref}
    aria-label="Opções da planilha" style={{left:position.left,top:position.top}}>
    {actions.map(action=><button key={action.id} type="button" role="menuitem"
      className={(action.danger?"danger ":"")+(action.separator?"separator ":"")}
      onMouseDown={event=>event.preventDefault()}
      onClick={()=>onAction(action.id)}>
      <span>{action.label}</span>
      {action.shortcut&&<kbd>{action.shortcut}</kbd>}
    </button>)}
    <div className="sheet-context-caption">Ações administrativas · exclusões com confirmação</div>
  </div>;
}

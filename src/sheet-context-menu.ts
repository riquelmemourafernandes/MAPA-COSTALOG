export type SheetContextKind = "cell" | "row" | "column" | "all";
export type SheetContextAction =
  "copy" | "cut" | "paste" | "paste-values" | "select-all" |
  "clear" | "delete-rows" | "delete-column" | "hide-column" |
  "resize-row" | "resize-column" | "sort-asc" | "sort-desc" |
  "filter" | "conditional" | "dropdown" | "insert-rows";
export type SheetContextOption = {
  id: SheetContextAction; label: string; shortcut?: string;
  danger?: boolean; separator?: boolean;
};
export function getSheetContextOptions(kind: SheetContextKind, admin: boolean): SheetContextOption[] {
  if(!admin)return [];
  const common:SheetContextOption[]=[
    {id:"cut",label:"Recortar",shortcut:"Ctrl+X"},
    {id:"copy",label:"Copiar",shortcut:"Ctrl+C"},
    {id:"paste",label:"Colar",shortcut:"Ctrl+V"},
    {id:"paste-values",label:"Colar somente valores",shortcut:"Ctrl+Shift+V"},
    {id:"clear",label:"Limpar conteúdo",shortcut:"Delete",separator:true}
  ];
  if(kind==="all")return [
    ...common, {id:"select-all",label:"Selecionar todas as células carregadas",shortcut:"Ctrl+A",separator:true},
    {id:"insert-rows",label:"Adicionar várias linhas"}
  ];
  if(kind==="row")return [
    ...common,{id:"insert-rows",label:"Adicionar linhas",separator:true},
    {id:"resize-row",label:"Redimensionar altura da linha"},
    {id:"delete-rows",label:"Excluir linhas selecionadas",danger:true,separator:true}
  ];
  if(kind==="column")return [
    ...common,{id:"resize-column",label:"Redimensionar largura",separator:true},
    {id:"sort-asc",label:"Classificar A → Z"},
    {id:"sort-desc",label:"Classificar Z → A"},
    {id:"filter",label:"Criar filtro"},
    {id:"conditional",label:"Cores condicionais por status",separator:true},
    {id:"dropdown",label:"Menu suspenso / BASE"},
    {id:"hide-column",label:"Ocultar coluna",separator:true},
    {id:"delete-column",label:"Excluir coluna",danger:true}
  ];
  return [
    ...common,
    {id:"select-all",label:"Selecionar todas as células carregadas",shortcut:"Ctrl+A",separator:true},
    {id:"resize-row",label:"Altura da linha"},
    {id:"resize-column",label:"Largura da coluna"},
    {id:"insert-rows",label:"Adicionar linhas",separator:true},
    {id:"delete-rows",label:"Excluir linhas da seleção",danger:true},
    {id:"sort-asc",label:"Classificar coluna A → Z",separator:true},
    {id:"sort-desc",label:"Classificar coluna Z → A"},
    {id:"filter",label:"Filtro da coluna"},
    {id:"conditional",label:"Cores condicionais por status"},
    {id:"dropdown",label:"Menu suspenso / BASE"}
  ];
}
export function safeMenuPosition(x:number,y:number,width:number,height:number,viewportWidth:number,viewportHeight:number){
  return {
    left:Math.max(8,Math.min(x,Math.max(8,viewportWidth-width-8))),
    top:Math.max(8,Math.min(y,Math.max(8,viewportHeight-height-8)))
  };
}

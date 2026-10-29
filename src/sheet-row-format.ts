// Clone only presentation settings, never operational cell values.
// Column-level formatting remains the default for cells without an override.
export type RowFormat = {
  bold?:boolean;color?:string;background?:string;
  format?:"text"|"number"|"currency"|"date";align?:"left"|"center"|"right";
};
export type PresentationSnapshot = {
  rowStyles:Record<string,RowFormat>;
  cellStyles:Record<string,RowFormat>;
  rowHeights:Record<string,number>;
};
export function nearestPreviousRowId<T extends {id:string;sheetRowNumber?:number;sequence:number}>(
  rows:T[], targetPosition:number
):string|null{
  let nearest:T|undefined;
  let best=1;
  for(const row of rows){
    const position=row.sheetRowNumber ?? row.sequence+1;
    if(position>=targetPosition || position<2 || position<=best)continue;
    best=position;nearest=row;
  }
  return nearest?.id ?? null;
}
export function inheritRowPresentation(
  sourceId:string|null,targetId:string,keys:string[],snapshot:PresentationSnapshot
):PresentationSnapshot{
  if(!sourceId || sourceId===targetId)return snapshot;
  const rowStyles={...snapshot.rowStyles};
  const cellStyles={...snapshot.cellStyles};
  const rowHeights={...snapshot.rowHeights};
  if(snapshot.rowStyles[sourceId] && !rowStyles[targetId])
    rowStyles[targetId]={...snapshot.rowStyles[sourceId]};
  for(const columnKey of keys){
    const from=sourceId+":"+columnKey,to=targetId+":"+columnKey;
    if(snapshot.cellStyles[from] && !cellStyles[to])
      cellStyles[to]={...snapshot.cellStyles[from]};
  }
  if(snapshot.rowHeights[sourceId]!==undefined && rowHeights[targetId]===undefined)
    rowHeights[targetId]=snapshot.rowHeights[sourceId];
  return {rowStyles,cellStyles,rowHeights};
}

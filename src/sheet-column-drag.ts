// Small pure helpers for arranging columns in the "Escolher colunas" panel.
export type ColumnDropSide = 'before' | 'after';

/** Move an already visible column to the exact side of its destination. */
export function moveVisibleColumn(
  orderedKeys:readonly string[], sourceKey:string, targetKey:string, side:ColumnDropSide
):string[] {
  if(sourceKey===targetKey || !orderedKeys.includes(sourceKey) || !orderedKeys.includes(targetKey))
    return [...orderedKeys];
  const next=orderedKeys.filter(key=>key!==sourceKey);
  const index=next.indexOf(targetKey)+(side==='after'?1:0);
  next.splice(index,0,sourceKey);
  return next;
}

/** Edge-scroll speed (pixels/frame), faster near the top and bottom. */
export function columnEdgeScrollStep(
  pointerY:number,top:number,bottom:number,edgeSize=52,maxSpeed=22
):number {
  if(!Number.isFinite(pointerY)||bottom<=top||pointerY<top||pointerY>bottom)return 0;
  const edge=Math.min(edgeSize,(bottom-top)/2);
  if(pointerY<top+edge) return -Math.max(1,Math.ceil(maxSpeed*(top+edge-pointerY)/edge));
  if(pointerY>bottom-edge) return Math.max(1,Math.ceil(maxSpeed*(pointerY-(bottom-edge))/edge));
  return 0;
}

export function dropSideAt(pointerY:number,top:number,height:number):ColumnDropSide {
  return pointerY<top+height/2?'before':'after';
}

// Undo/redo helpers: only confirmed server edits enter the history.
// The history is per browser session and must never infer a change from cell selection.
export type UndoValue = string | number | boolean | null;
export type UndoRecord = {
  rowId:string;
  before:Record<string,UndoValue>;
  after:Record<string,UndoValue>;
};
type DataRow = {id:string; data:Record<string,unknown>};
function normalized(value:unknown):UndoValue {
  return value === null || value === undefined ? null :
    (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') ? value : null;
}
export function buildUndoRecord(
  before:DataRow,after:DataRow,changedKeys:string[]
):UndoRecord|null {
  if(before.id!==after.id)return null;
  const oldValues:Record<string,UndoValue>={};
  const newValues:Record<string,UndoValue>={};
  for(const key of changedKeys){
    const prior=normalized(before.data?.[key]),next=normalized(after.data?.[key]);
    if(Object.is(prior,next))continue;
    oldValues[key]=prior;
    newValues[key]=next;
  }
  if(!Object.keys(newValues).length)return null;
  return {rowId:before.id,before:oldValues,after:newValues};
}
export function matchesUndoState(
  current:DataRow|undefined,record:UndoRecord,mode:'undo'|'redo'
):boolean {
  if(!current || current.id!==record.rowId)return false;
  const expected=mode==='undo'?record.after:record.before;
  return Object.entries(expected).every(([key,value])=>
    Object.is(normalized(current.data?.[key]),value));
}
export function undoShortcut(event:{
  key:string; ctrlKey:boolean;metaKey:boolean;shiftKey:boolean;altKey?:boolean
}):'undo'|'redo'|null {
  if(!(event.ctrlKey||event.metaKey)||event.altKey)return null;
  const key=event.key.toLowerCase();
  if(key==='z')return event.shiftKey?'redo':'undo';
  if(key==='y'&&!event.shiftKey)return 'redo';
  return null;
}

import assert from 'node:assert/strict';
import test from 'node:test';
import {buildUndoRecord,matchesUndoState,undoShortcut} from './sheet-undo.js';

test('Ctrl+Z/Cmd+Z desfaz e Ctrl+Y ou Ctrl+Shift+Z refaz',()=>{
  const base={key:'z',ctrlKey:true,metaKey:false,shiftKey:false};
  assert.equal(undoShortcut(base),'undo');
  assert.equal(undoShortcut({...base,metaKey:true,ctrlKey:false}),'undo');
  assert.equal(undoShortcut({...base,shiftKey:true}),'redo');
  assert.equal(undoShortcut({...base,key:'y'}),'redo');
  assert.equal(undoShortcut({...base,ctrlKey:false}),null);
  assert.equal(undoShortcut({...base,altKey:true}),null);
});

test('registra somente campos realmente alterados e conserva tipo booleano/número',()=>{
  const before={id:'row',data:{A:'oi',B:false,C:42}};
  const after={id:'row',data:{A:'novo',B:true,C:42}};
  const row=buildUndoRecord(before,after,['A','B','C']);
  assert.deepEqual(row,{rowId:'row',before:{A:'oi',B:false},after:{A:'novo',B:true}});
  assert.equal(buildUndoRecord(before,before,['A']),null);
  assert.deepEqual(buildUndoRecord({id:'r',data:{}},{id:'r',data:{B:'x'}},['B']),
    {rowId:'r',before:{B:null},after:{B:'x'}});
});

test('não reverte valor alterado depois por outra operação',()=>{
  const before={id:'r1',data:{A:'original',B:10}};
  const after={id:'r1',data:{A:'editado',B:10}};
  const edit=buildUndoRecord(before,after,['A'])!;
  assert.equal(matchesUndoState(after,edit,'undo'),true);
  assert.equal(matchesUndoState(before,edit,'redo'),true);
  assert.equal(matchesUndoState({id:'r1',data:{A:'outra pessoa',B:10}},edit,'undo'),false);
  assert.equal(matchesUndoState(undefined,edit,'undo'),false);
  assert.equal(matchesUndoState({id:'r1',data:{A:'editado',B:11}},edit,'undo'),true);
});

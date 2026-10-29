import assert from 'node:assert/strict';
import test from 'node:test';
import {moveVisibleColumn,columnEdgeScrollStep,dropSideAt} from './sheet-column-drag.js';

test('reorder moves a column to either edge of the hovered target',()=>{
 const order=['A','B','C','D','E'];
 assert.deepEqual(moveVisibleColumn(order,'E','B','before'),['A','E','B','C','D']);
 assert.deepEqual(moveVisibleColumn(order,'A','D','after'),['B','C','D','A','E']);
 assert.deepEqual(moveVisibleColumn(order,'C','D','before'),order);
 assert.deepEqual(moveVisibleColumn(order,'B','B','after'),order);
 assert.deepEqual(order,['A','B','C','D','E']);
});
test('hidden or unavailable columns never reorder the visible list',()=>{
 assert.deepEqual(moveVisibleColumn(['A','B','D'],'B','C','before'),['A','B','D']);
 assert.deepEqual(moveVisibleColumn(['A','B','D'],'C','D','before'),['A','B','D']);
});
test('auto-scroll goes up and down smoothly only near the list edges',()=>{
 assert.equal(columnEdgeScrollStep(102,100,420),-22);
 assert.ok(columnEdgeScrollStep(140,100,420)<0);
 assert.equal(columnEdgeScrollStep(260,100,420),0);
 assert.ok(columnEdgeScrollStep(390,100,420)>0);
 assert.equal(columnEdgeScrollStep(418,100,420),22);
 assert.equal(columnEdgeScrollStep(99,100,420),0);
 assert.equal(columnEdgeScrollStep(421,100,420),0);
 assert.equal(dropSideAt(110,100,34),'before');
 assert.equal(dropSideAt(130,100,34),'after');
});

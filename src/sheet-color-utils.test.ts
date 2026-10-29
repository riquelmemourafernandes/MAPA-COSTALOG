import assert from "node:assert/strict";
import test from "node:test";
import {SHEET_PALETTE, STANDARD_COLORS, hexToRgb,normalizeHex,rgbToHex,rgbToHsv,hsvToHex,uniqueRecentColors} from "./sheet-color-utils.js";
test("paleta tem 10 colunas, tons de cinza, cores e tons de fundo",()=>{
  assert.equal(SHEET_PALETTE.length,8);
  assert.ok(SHEET_PALETTE.every(row=>row.length===10));
  assert.equal(STANDARD_COLORS.length,10);
});
test("espectro HSV e RGB reproduz hexadecimal sem perda relevante",()=>{
  for(const hex of ["#980000","#CC0000","#ABCDEF","#FFFFFF","#000000","#FF9900"]){
    const [r,g,b]=hexToRgb(hex);
    const hsv=rgbToHsv(r,g,b);
    const out=hsvToHex(hsv.h,hsv.s,hsv.v);
    const [rr,gg,bb]=hexToRgb(out);
    assert.ok(Math.abs(r-rr)<=1&&Math.abs(g-gg)<=1&&Math.abs(b-bb)<=1,hex+" "+out);
  }
  assert.equal(rgbToHex(152,0,0),"#980000");
  assert.equal(normalizeHex("#abc"),"#AABBCC");
  assert.equal(normalizeHex("wrong"),null);
});
test("últimas cores próprias permanecem únicas e limitadas",()=>{
  assert.deepEqual(uniqueRecentColors(["#FF0000"],"#ff0000"),["#FF0000"]);
  assert.equal(uniqueRecentColors(Array(10).fill("#000000"),"#123456").length,10);
});

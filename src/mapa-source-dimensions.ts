/* Pixel dimensions transcribed from the user-supplied "MAPA IMPORTAÇÃO.xlsx",
 * worksheet MAPA 1.0, 2026-10-29. Excel column-width units have been
 * converted to CSS pixels with the standard 7px-digit conversion.
 * The source XLSX uses a 15pt fallback row height and 14.25pt from row 3.
 * Manual user widths/heights take precedence over these imported defaults.
 */
export const MAPA_1_COLUMN_WIDTHS_PX:Readonly<Record<string,number>>={
  A:100,B:72,C:109,D:37,E:99,F:97,G:38,H:39,I:38,J:38,K:32,L:136,
  M:30,N:96,O:88,P:96,Q:84,R:23,S:49,T:88,U:47,V:38,W:71,X:71,
  Y:220,Z:132,AA:46,AB:74,AC:73,AD:59,AE:71,AF:58,AG:67,AH:318,
  AI:66,AJ:132,AK:110,AL:218,AM:78,AN:141,AO:22,AP:84,AQ:287,
  AR:84,AS:82,AT:238,AU:117,AV:117,AW:117,AX:117,AY:210,AZ:73,
  BA:242,BB:149,BC:63,BD:103,BE:106,BF:167,BG:47,BH:96,BI:74,
  BJ:74,BK:106,BL:74,BM:74,BN:74,BO:74,BP:74,BQ:74,BR:74,
  BS:56,BT:58,BU:74
};
export const MAPA_1_ROW_HEADER_HEIGHT_PX=30;
export const MAPA_1_ROW_HEIGHT_PX=19;
export const MAPA_1_FIRST_BODY_ROW_HEIGHT_PX=20;
export const MAPA_1_DEFAULT_COLUMN_WIDTH_PX=88;

export function sourceColumnWidth(key:string):number{
  return MAPA_1_COLUMN_WIDTHS_PX[key]??MAPA_1_DEFAULT_COLUMN_WIDTH_PX;
}
export function sourceRowHeight(sheetRowNumber:number):number{
  return sheetRowNumber===2?MAPA_1_FIRST_BODY_ROW_HEIGHT_PX:MAPA_1_ROW_HEIGHT_PX;
}

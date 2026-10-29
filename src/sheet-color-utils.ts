// Spreadsheet-style swatches; no assets, browser-only APIs or subscriptions.
// Rows follow the Google Sheets palette: grayscale then hue/shade bands.
export const SHEET_PALETTE: string[][] = [
  ["#000000","#434343","#666666","#999999","#B7B7B7","#CCCCCC","#D9D9D9","#EFEFEF","#F3F3F3","#FFFFFF"],
  ["#980000","#FF0000","#FF9900","#FFFF00","#00FF00","#00FFFF","#4A86E8","#0000FF","#9900FF","#FF00FF"],
  ["#E6B8AF","#F4CCCC","#FCE5CD","#FFF2CC","#D9EAD3","#D0E0E3","#C9DAF8","#CFE2F3","#D9D2E9","#EAD1DC"],
  ["#DD7E6B","#EA9999","#F9CB9C","#FFE599","#B6D7A8","#A2C4C9","#A4C2F4","#9FC5E8","#B4A7D6","#D5A6BD"],
  ["#CC4125","#E06666","#F6B26B","#FFD966","#93C47D","#76A5AF","#6D9EEB","#6FA8DC","#8E7CC3","#C27BA0"],
  ["#A61C00","#CC0000","#E69138","#F1C232","#6AA84F","#45818E","#3C78D8","#3D85C6","#674EA7","#A64D79"],
  ["#85200C","#990000","#B45F06","#BF9000","#38761D","#134F5C","#1155CC","#0B5394","#351C75","#741B47"],
  ["#5B0F00","#660000","#783F04","#7F6000","#274E13","#0C343D","#1C4587","#073763","#20124D","#4C1130"]
] as const as unknown as string[][];
export const STANDARD_COLORS = ["#000000","#CC0000","#3C78D8","#8E7CC3","#6AA84F","#FF9900","#E69138","#46BDCF","#999999","#FFFFFF"];

export function clamp(value: number, low = 0, high = 1) {
  return Math.min(high,Math.max(low,value));
}
export function normalizeHex(value: string): string | null {
  const hex=value.trim().replace(/^#/,"");
  if (/^[0-9a-f]{3}$/i.test(hex)) return "#"+hex.split("").map(c=>c+c).join("").toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(hex)) return "#"+hex.toUpperCase();
  return null;
}
export function hexToRgb(hex: string): [number,number,number] {
  const normalized=normalizeHex(hex) || "#000000";
  return [1,3,5].map(i=>parseInt(normalized.slice(i,i+2),16)) as [number,number,number];
}
export function rgbToHex(red: number, green: number, blue: number): string {
  return "#"+[red,green,blue].map(value=>Math.round(clamp(value,0,255)).toString(16).padStart(2,"0")).join("").toUpperCase();
}
export type HsvColor = {h:number; s:number; v:number};
export function rgbToHsv(red:number,green:number,blue:number): HsvColor {
  const r=clamp(red/255),g=clamp(green/255),b=clamp(blue/255);
  const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
  let h=0;
  if(delta>0){
    if(max===r) h=60*(((g-b)/delta)%6);
    else if(max===g) h=60*((b-r)/delta+2);
    else h=60*((r-g)/delta+4);
  }
  return {h:(h+360)%360,s:max===0?0:delta/max,v:max};
}
export function hsvToRgb(h:number,s:number,v:number): [number,number,number] {
  const hue=((h%360)+360)%360,sat=clamp(s),val=clamp(v);
  const chroma=val*sat,x=chroma*(1-Math.abs((hue/60)%2-1)),m=val-chroma;
  let r=0,g=0,b=0;
  if(hue<60){r=chroma;g=x;}
  else if(hue<120){r=x;g=chroma;}
  else if(hue<180){g=chroma;b=x;}
  else if(hue<240){g=x;b=chroma;}
  else if(hue<300){r=x;b=chroma;}
  else{r=chroma;b=x;}
  return [r,g,b].map(z=>Math.round((z+m)*255)) as [number,number,number];
}
export function hsvToHex(h:number,s:number,v:number) {
  return rgbToHex(...hsvToRgb(h,s,v));
}
export function uniqueRecentColors(current:string[],color:string): string[] {
  const normalized=normalizeHex(color);
  return normalized?[normalized,...current.filter(c=>c.toUpperCase()!==normalized)].slice(0,10):current;
}

// Presentation and strict validation for the operational spreadsheet.
export type SheetNumberFormat = "text"|"number"|"currency"|"date";
export const LOCKED_COLUMN_FORMAT: Record<string,SheetNumberFormat> = {
  A:"date",Q:"currency"
};
export function toDateInput(value:unknown):string {
  if(typeof value!=="string"||!value.trim())return "";
  const input=value.trim();
  const iso=/^(\d{4})-(\d{2})-(\d{2})/;
  const br=/^(\d{2})\/(\d{2})\/(\d{4})/;
  let day="",month="",year="";
  const a=input.match(iso),b=input.match(br);
  if(a){year=a[1];month=a[2];day=a[3];}
  else if(b){day=b[1];month=b[2];year=b[3];}
  else return "";
  const candidate=year+"-"+month+"-"+day;
  const dt=new Date(candidate+"T12:00:00Z");
  return !Number.isNaN(dt.valueOf()) &&
    dt.getUTCFullYear()===Number(year)&&dt.getUTCMonth()+1===Number(month)&&dt.getUTCDate()===Number(day)
    ?candidate:"";
}
export function parseCurrency(value:string):number|null {
  let input=value.trim().replace(/^R\$\s*/i,"").replace(/\s/g,"");
  if(!input)return null;
  // Brazilian decimal ","; grouping "."; imported numeric "1234.56" also accepted.
  if(input.includes(","))input=input.replace(/\./g,"").replace(",",".");
  else if(/^\d{1,3}(\.\d{3})+$/.test(input))input=input.replace(/\./g,"");
  if(!/^-?\d+(\.\d+)?$/.test(input))return null;
  const amount=Number(input);
  return Number.isFinite(amount)?amount:null;
}
export function formatSheetValue(value:unknown,kind:SheetNumberFormat):string{
  if(value===null||value===undefined||value==="")return "";
  if(kind==="date"){
    const iso=toDateInput(value);
    return iso?iso.slice(8,10)+"/"+iso.slice(5,7)+"/"+iso.slice(0,4):String(value);
  }
  if(kind==="currency"){
    const amount=typeof value==="number"?value:parseCurrency(String(value));
    return amount===null?String(value):new Intl.NumberFormat("pt-BR",{
      style:"currency",currency:"BRL",minimumFractionDigits:2,maximumFractionDigits:2
    }).format(amount);
  }
  if(kind==="number"&&typeof value==="number")return new Intl.NumberFormat("pt-BR").format(value);
  return String(value);
}
export function parseSheetValue(value:string,kind:SheetNumberFormat):
  {ok:true;value:string|number|null}|{ok:false;message:string}{
  if(!value.trim())return {ok:true,value:null};
  if(kind==="date"){
    const date=toDateInput(value);
    return date?{ok:true,value:date}:{ok:false,message:"Use uma data válida (DD/MM/AAAA)."};
  }
  if(kind==="currency"||kind==="number"){
    const n=parseCurrency(value);
    return n===null?{ok:false,message:"Informe um número ou valor monetário válido."}:{ok:true,value:n};
  }
  return {ok:true,value};
}

import { useEffect, useRef, useState } from "react";
import { Check, PaintBucket, Palette, Plus, RotateCcw, X } from "lucide-react";
import {
  SHEET_PALETTE, STANDARD_COLORS, clamp, hexToRgb, hsvToHex,
  normalizeHex, rgbToHex, rgbToHsv, uniqueRecentColors
} from "./sheet-color-utils.js";
import "./sheet-color-picker.css";

type Props = {
  kind: "text" | "background";
  value: string;
  disabled?: boolean;
  onSelect: (color: string) => void;
};

const STORAGE_KEY = "mapa-costalog-custom-colors:v1";
export default function SheetColorPicker({kind,value,disabled=false,onSelect}: Props) {
  const [open,setOpen] = useState(false);
  const [custom,setCustom] = useState(false);
  const [recent,setRecent] = useState<string[]>([]);
  const [draft,setDraft] = useState(normalizeHex(value)||"#980000");
  const [hexInput,setHexInput] = useState(draft);
  const [hue,setHue] = useState(0);
  const [sat,setSat] = useState(1);
  const [brightness,setBrightness] = useState(1);
  const root = useRef<HTMLDivElement>(null);
  const rgb=hexToRgb(draft);
  useEffect(()=>{
    try {
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");
      if(Array.isArray(saved)) setRecent(saved.filter((x):x is string=>typeof x==="string"&&Boolean(normalizeHex(x))).slice(0,10));
    }catch { setRecent([]); }
  },[]);
  useEffect(()=>{
    if(!open)return;
    function outside(event:PointerEvent){
      if(!root.current?.contains(event.target as Node)) {
        setOpen(false);setCustom(false);
      }
    }
    function escape(event:KeyboardEvent){
      if(event.key==="Escape"){setOpen(false);setCustom(false);}
    }
    document.addEventListener("pointerdown",outside);
    document.addEventListener("keydown",escape);
    return ()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);};
  },[open]);
  function choose(hex:string,track=false){
    const normalized=normalizeHex(hex);
    if(!normalized)return;
    onSelect(normalized);
    if(track){
      const updated=uniqueRecentColors(recent,normalized);
      setRecent(updated);
      localStorage.setItem(STORAGE_KEY,JSON.stringify(updated));
    }
    setOpen(false);setCustom(false);
  }
  function setColor(hex:string,keepHue=false){
    const normalized=normalizeHex(hex);
    if(!normalized)return;
    setDraft(normalized);setHexInput(normalized);
    const hsv=rgbToHsv(...hexToRgb(normalized));
    if(!keepHue)setHue(hsv.h);
    setSat(hsv.s);setBrightness(hsv.v);
  }
  function openCustom(){
    setColor(normalizeHex(value)||"#980000");
    setCustom(true);
  }
  function updateSpectrum(x:number,y:number){
    const nextS=clamp(x),nextV=1-clamp(y);
    setSat(nextS);setBrightness(nextV);
    const hex=hsvToHex(hue,nextS,nextV);
    setDraft(hex);setHexInput(hex);
  }
  function onSpectrumPointer(event:React.PointerEvent<HTMLDivElement>){
    const rect=event.currentTarget.getBoundingClientRect();
    updateSpectrum((event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height);
  }
  function updateChannel(index:number,text:string) {
    if(!/^\d{1,3}$/.test(text))return;
    const channels=[...rgb];
    channels[index]=Math.min(255,Math.max(0,Number(text)));
    setColor(rgbToHex(channels[0],channels[1],channels[2]));
  }
  const defaultColor=kind==="text"?"#47584E":"#FFFFFF";
  return <div className="sheet-picker" ref={root}>
    <button type="button" className="sheet-picker-trigger" disabled={disabled}
      title={kind==="text"?"Cor do texto":"Cor de preenchimento"}
      aria-label={kind==="text"?"Abrir paleta de cor do texto":"Abrir paleta de cor de preenchimento"}
      aria-expanded={open}
      onClick={()=>{setOpen(previous=>!previous);setCustom(false);}}>
      {kind==="text"?<Palette size={15}/>:<PaintBucket size={15}/>}
      <span className="sheet-picker-line" style={{background:normalizeHex(value)||defaultColor}} />
      <span className="sheet-picker-caret" aria-hidden="true">▾</span>
    </button>
    {open&&<div className="sheet-picker-popover" role="dialog"
      aria-label={kind==="text"?"Paleta de cor da letra":"Paleta de cor do fundo"}>
      {!custom?<div className="sheet-picker-main">
        <button className="sheet-picker-reset" type="button" onClick={()=>choose(defaultColor)}>
          <RotateCcw size={14}/> Redefinir
        </button>
        <div className="sheet-picker-swatches" role="group" aria-label="Paleta de cores">
          {SHEET_PALETTE.flatMap((line,ri)=>line.map((hex,ci)=>
            <button type="button" key={ri+"-"+ci} className="sheet-picker-swatch"
              style={{backgroundColor:hex}}
              title={hex} aria-label={"Selecionar cor "+hex}
              aria-pressed={normalizeHex(value)===hex}
              onClick={()=>choose(hex)}>
              {normalizeHex(value)===hex&&<Check size={13} strokeWidth={3}
                color={["#000000","#434343","#660000","#980000","#990000","#073763","#20124D"].includes(hex)?"#ffffff":"#162318"}/>}
            </button>))}
        </div>
        <div className="sheet-picker-subhead">PADRÃO</div>
        <div className="sheet-picker-swatches" role="group" aria-label="Cores padrão">
          {STANDARD_COLORS.map((hex,i)=><button type="button" className="sheet-picker-swatch"
            key={hex+"-"+i} style={{background:hex}} title={hex}
            aria-label={"Selecionar cor padrão "+hex} onClick={()=>choose(hex)}>
              {normalizeHex(value)===hex&&<Check size={13} color={i<2?"#fff":"#203224"}/>}
            </button>)}
        </div>
        <div className="sheet-picker-subhead sheet-picker-custom-head">CORES PERSONALIZADAS</div>
        <div className="sheet-picker-swatches sheet-picker-recent" role="group" aria-label="Cores recentes personalizadas">
          {recent.map((hex,i)=><button key={hex+"-"+i} type="button"
            className="sheet-picker-swatch" aria-label={"Selecionar cor personalizada "+hex}
            title={hex} style={{background:hex}} onClick={()=>choose(hex)}/>)}
          <button type="button" className="sheet-picker-add" title="Adicionar cor personalizada"
            aria-label="Criar cor personalizada" onClick={openCustom}><Plus size={16}/></button>
        </div>
      </div>:<div className="sheet-picker-custom">
        <div className="sheet-picker-custom-headline">
          <strong>Cor personalizada</strong>
          <button type="button" aria-label="Voltar às cores" onClick={()=>setCustom(false)}><X size={16}/></button>
        </div>
        <div className="sheet-picker-spectrum" role="slider" tabIndex={0}
          aria-label="Espectro de saturação e luminosidade" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={Math.round(sat*100)}
          style={{backgroundColor:hsvToHex(hue,1,1)}}
          onPointerDown={event=>{
            event.currentTarget.setPointerCapture(event.pointerId);
            onSpectrumPointer(event);
          }}
          onPointerMove={event=>{if(event.buttons!==0 && event.currentTarget.hasPointerCapture(event.pointerId))onSpectrumPointer(event);}}
          onKeyDown={event=>{
            const nextS=event.key==="ArrowRight"?sat+.01:event.key==="ArrowLeft"?sat-.01:sat;
            const nextV=event.key==="ArrowUp"?brightness+.01:event.key==="ArrowDown"?brightness-.01:brightness;
            if(nextS!==sat||nextV!==brightness){event.preventDefault();updateSpectrum(nextS,1-nextV);}
          }}>
          <div className="sheet-picker-spectrum-white"/><div className="sheet-picker-spectrum-black"/>
          <span className="sheet-picker-spectrum-cursor"
            style={{left:(sat*100)+"%",top:((1-brightness)*100)+"%"}}/>
        </div>
        <div className="sheet-picker-hue-row">
          <span className="sheet-picker-preview" style={{background:draft}} aria-label={"Cor atual "+draft}/>
          <input type="range" min={0} max={359} value={Math.round(hue)}
            title="Espectro de tons" aria-label="Selecionar tom da cor"
            className="sheet-picker-hue"
            onChange={event=>{
              const h=Number(event.target.value);setHue(h);
              const color=hsvToHex(h,sat,brightness);setDraft(color);setHexInput(color);
            }}/>
        </div>
        <div className="sheet-picker-rgb">
          <label>Hexadecimal<input aria-label="Cor hexadecimal" maxLength={7} value={hexInput}
            onChange={event=>{const val=event.target.value;setHexInput(val);if(normalizeHex(val))setColor(val);}}
            onBlur={()=>setHexInput(draft)}/></label>
          {(["Vermelho","Verde","Azul"] as const).map((label,index)=>
            <label key={label}>{label}<input type="number" min={0} max={255} step={1}
              aria-label={label} value={rgb[index]}
              onChange={event=>updateChannel(index,event.target.value)}/></label>)}
        </div>
        <div className="sheet-picker-custom-actions">
          <button type="button" onClick={()=>setCustom(false)}>Cancelar</button>
          <button type="button" className="sheet-picker-okay" onClick={()=>choose(draft,true)}>OK</button>
        </div>
      </div>}
    </div>}
  </div>;
}

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import {
  confirmDropdownValue, initialDropdownSearch, searchOptions
} from "./sheet-dropdown-utils.js";
import { STATUS_COLORS, statusRowColor } from "./sheet-status-rules.js";
import "./sheet-dropdown.css";

type Props = {
  columnKey: string;
  rowLabel: string;
  currentValue: string;
  initialQuery: string;
  fallbackOptions: string[];
  apiBase: string;
  token: string;
  onConfirm: (value: string, key: "Enter" | "Tab" | null, shift: boolean) => void;
  onCancel: () => void;
  onPasteCell: (text: string) => void;
};

export default function SheetDropdownEditor({
  columnKey, rowLabel, currentValue, initialQuery, fallbackOptions,
  apiBase, token, onConfirm, onCancel, onPasteCell
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // A click on an existing cell shows ALL choices, not only matching old text.
  // The old value stays visible as a placeholder until the user types.
  const [query, setQuery] = useState(() => initialDropdownSearch(currentValue, initialQuery));
  const [backendOptions, setBackendOptions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [invalidChoice, setInvalidChoice] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const options = useMemo(() => {
    const available = backendOptions === null ? fallbackOptions : backendOptions;
    // The 16 agreed status templates are always available in the STATUS menu.
    const withDefaults = columnKey === "C"
      ? [...STATUS_COLORS.map(rule => rule.status), ...available]
      : available;
    return searchOptions(withDefaults, query).slice(0, 2000);
  }, [backendOptions, fallbackOptions, query, columnKey]);

  useEffect(() => {
    setHighlight(query.trim() ? 0 : -1);
    setInvalidChoice(false);
  }, [query]);

  useEffect(() => {
    if (!apiBase || !token) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ column: columnKey, q: query });
      fetch(apiBase + "/api/v1/base/options?" + params, {
        headers: { Authorization: "Bearer " + token },
        signal: controller.signal
      }).then(async response => {
        if (!response.ok) throw new Error("API da BASE não disponível nesta versão.");
        const body = await response.json();
        if (!Array.isArray(body.items)) throw new Error("Resposta inválida da BASE.");
        setBackendOptions(body.items.filter((item: unknown): item is string => typeof item === "string"));
        setErrorMessage("");
      }).catch(() => {
        if (!controller.signal.aborted) {
          // Existing rows remain usable until the BASE endpoint is published.
          setBackendOptions(null);
          setErrorMessage("BASE ainda não publicada: exibindo apenas os valores da página carregada.");
        }
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    }, 130);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [apiBase, token, columnKey, query]);

  useEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    function positionMenu() {
      const bounds = element!.getBoundingClientRect();
      const width = Math.min(Math.max(bounds.width, 164), 228, window.innerWidth - 16);
      const estimatedHeight = Math.min(216, 32 + (options.length + 1) * 25);
      const below = window.innerHeight - bounds.bottom;
      const above = bounds.top;
      const top = below >= Math.min(estimatedHeight, 110) || below >= above
        ? Math.min(bounds.bottom + 1, window.innerHeight - 55)
        : Math.max(8, bounds.top - estimatedHeight);
      setRect({
        top,
        left: Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8)),
        width
      });
    }
    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [options.length]);

  function confirm(key: "Enter" | "Tab" | null, shift = false, index = highlight) {
    const candidate = confirmDropdownValue(query, currentValue, options, index);
    if (candidate === null) {
      setInvalidChoice(true);
      setExpanded(true);
      return;
    }
    onConfirm(candidate, key, shift);
  }

  function onKeys(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!query && (event.key === "Delete" || event.key === "Backspace")) {
      event.preventDefault(); event.stopPropagation();
      onConfirm("", null, false);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation(); onCancel(); return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); event.stopPropagation(); setExpanded(true);
      setHighlight(previous => event.key === "ArrowDown"
        ? Math.min(options.length - 1, previous + 1)
        : previous < 0 ? options.length - 1 : Math.max(0, previous - 1));
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault(); event.stopPropagation();
      confirm(event.key, event.shiftKey);
    }
  }

  return <>
    <span className="sheet-cell-dropdown-editor">
      <input ref={inputRef} autoFocus spellCheck={false} className="sheet-cell-editor"
        role="combobox" aria-haspopup="listbox" aria-expanded={expanded}
        aria-autocomplete="list" aria-controls="sheet-cell-options"
        aria-label={"Selecionar " + rowLabel}
        placeholder={currentValue || "Selecionar…"} value={query}
        onChange={event => { setQuery(event.target.value); setExpanded(true); }}
        onKeyDown={onKeys}
        onPaste={event => {
          event.preventDefault(); event.stopPropagation();
          onPasteCell(event.clipboardData.getData("text/plain"));
        }}
        onBlur={onCancel}
        onClick={event => { event.stopPropagation(); setExpanded(true); }}
      />
      <button type="button" className="sheet-cell-dropdown-caret" tabIndex={-1}
        aria-label="Mostrar todas as opções da BASE"
        onMouseDown={event => event.preventDefault()}
        onClick={event => {
          event.stopPropagation();
          if (!expanded) setExpanded(true);
          else {
            // Clicking the arrow again restores the complete unfiltered list.
            setQuery("");
            setHighlight(-1);
          }
          inputRef.current?.focus();
        }}>
        <ChevronDown size={12}/>
      </button>
    </span>
    {expanded && rect && createPortal(
      <div id="sheet-cell-options" role="listbox"
        className="sheet-cell-options"
        aria-label={"Lista de " + rowLabel}
        title={errorMessage || undefined}
        style={{ top: rect.top, left: rect.left, width: rect.width }}
        onMouseDown={event => event.preventDefault()}>
        <div className="sheet-cell-options-scroll">
          {!query && currentValue && <button className="sheet-cell-option sheet-cell-option-clear"
            type="button" role="option" aria-selected={false}
            onClick={() => onConfirm("", null, false)}>
            (Limpar célula)
          </button>}
          {options.map((option, index) => (
            <button type="button" key={option}
              className={"sheet-cell-option" + (highlight === index ? " highlighted" : "")}
              role="option" aria-selected={highlight === index}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => onConfirm(option, null, false)}>
              {columnKey === "C" && statusRowColor(option) &&
                <span className="sheet-status-option-swatch"
                  style={{backgroundColor:statusRowColor(option) || undefined}} aria-hidden="true"/>}
              <span>{option}</span>
              {option === currentValue && <Check size={12} />}
            </button>
          ))}
          {!options.length && !loading &&
            <div className="sheet-cell-no-options">
              {query ? "Nenhuma opção encontrada." : "Nenhuma opção cadastrada."}
            </div>}
          {loading && !options.length && <div className="sheet-cell-no-options">Carregando…</div>}
        </div>
        {invalidChoice &&
          <div className="sheet-cell-options-error" role="alert">Escolha um item da lista.</div>}
      </div>, document.body)}
  </>;
}

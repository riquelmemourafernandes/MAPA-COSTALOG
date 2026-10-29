export type FormulaValue = string | number | boolean | null;
export type FormulaCellResolver = (row: number, column: string, stack?: Set<string>) => FormulaValue;
type Token = { kind: 'number' | 'string' | 'identifier' | 'operator' | 'eof'; value: string };
type Ref = { row: number; column: string };
type Node =
  | { kind: 'literal'; value: FormulaValue }
  | { kind: 'cell'; row: number; column: string }
  | { kind: 'range'; start: Ref; end: Ref }
  | { kind: 'unary' | 'postfix'; operator: string; child: Node }
  | { kind: 'binary'; operator: string; left: Node; right: Node }
  | { kind: 'call'; name: string; args: Node[] };
const isError = (v: unknown): v is string => typeof v === 'string' && /^#(?:REF!|DIV\/0!|VALUE!|NAME\?|NUM!|N\/A|ERROR!)/i.test(v);
const FORMULA_ALIASES: Record<string, string> = {
  SOMA: 'SUM', MÉDIA: 'AVERAGE', MEDIA: 'AVERAGE', 'CONT.NÚM': 'COUNT',
  'CONT.VALORES': 'COUNTA', MÍNIMO: 'MIN', MINIMO: 'MIN', MÁXIMO: 'MAX', MAXIMO: 'MAX',
  SE: 'IF', SEERRO: 'IFERROR', E: 'AND', OU: 'OR', NÃO: 'NOT', HOJE: 'TODAY', AGORA: 'NOW',
  ARRED: 'ROUND', 'ARREDONDAR.PARA.CIMA': 'ROUNDUP', 'ARREDONDAR.PARA.BAIXO': 'ROUNDDOWN',
  POTÊNCIA: 'POWER', RAIZ: 'SQRT', SOMASE: 'SUMIF', 'CONT.SE': 'COUNTIF',
  DATA: 'DATE', ANO: 'YEAR', MÊS: 'MONTH', DIA: 'DAY', ESQUERDA: 'LEFT', DIREITA: 'RIGHT',
  'EXT.TEXTO': 'MID', 'NÚM.CARACT': 'LEN', MAIÚSCULA: 'UPPER', MINÚSCULA: 'LOWER',
  ARRUMAR: 'TRIM', VALOR: 'VALUE', 'ÉCÉL.VAZIA': 'ISBLANK', 'ÉNÚM': 'ISNUMBER',
  'ÉTEXTO': 'ISTEXT', 'ÉERROS': 'ISERROR', SUBSTITUIR: 'SUBSTITUTE',
  LOCALIZAR: 'FIND', PROCURAR: 'SEARCH'
};
export function columnKeyToIndex(key: string): number {
  let n = 0; for (const char of key.toUpperCase()) { const c = char.charCodeAt(0); if (c < 65 || c > 90) return -1; n = n * 26 + c - 64; } return n - 1;
}
export function columnIndexToKey(index: number): string {
  if (!Number.isInteger(index) || index < 0) return '';
  let n = index + 1, result = ''; while (n > 0) { n--; result = String.fromCharCode(65 + n % 26) + result; n = Math.floor(n / 26); } return result;
}
export function parseCellAddress(input: string): Ref | null {
  const m = /^\$?([A-Z]{1,3})\$?([1-9]\d*)$/i.exec(input.trim());
  if (!m) return null; const column = m[1].toUpperCase();
  return columnKeyToIndex(column) >= 0 && columnKeyToIndex(column) < 18278 ? { row: Number(m[2]), column } : null;
}
function tokenize(s: string): Token[] {
  const out: Token[] = []; let i = 0;
  while (i < s.length) {
    const r = s.slice(i);
    if (/^\s+/.test(r)) { i += r.match(/^\s+/)![0].length; continue; }
    const q = /^"(?:""|[^"])*"/.exec(r);
    if (q) { out.push({ kind: 'string', value: q[0].slice(1, -1).replace(/""/g, '"') }); i += q[0].length; continue; }
    const n = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?/.exec(r);
    if (n) { out.push({ kind: 'number', value: n[0] }); i += n[0].length; continue; }
    const ref = /^\$?[A-Z]{1,3}\$?[1-9]\d*/i.exec(r);
    if (ref) { out.push({ kind: 'identifier', value: ref[0] }); i += ref[0].length; continue; }
    const id = /^[\p{L}_][\p{L}0-9_.]*/iu.exec(r);
    if (id) { out.push({ kind: 'identifier', value: id[0] }); i += id[0].length; continue; }
    const op = /^(?:<=|>=|<>|!=|==|[+\-*/^&%=<>():;,])/.exec(r);
    if (op) { out.push({ kind: 'operator', value: op[0] }); i += op[0].length; continue; }
    const formulaError = /^#(?:REF!|DIV\/0!|VALUE!|NAME\?|NUM!|N\/A|ERROR!)/i.exec(r);
    if (formulaError) { out.push({ kind: 'identifier', value: formulaError[0] }); i += formulaError[0].length; continue; }
    return [{ kind: 'identifier', value: '#ERROR!' }, { kind: 'eof', value: '' }];
  }
  out.push({ kind: 'eof', value: '' }); return out;
}
class Parser {
  private i = 0; constructor(private tokens: Token[]) {}
  private cur(): Token { return this.tokens[this.i] || { kind: 'eof', value: '' }; }
  private take(): Token { return this.tokens[this.i++] || { kind: 'eof', value: '' }; }
  private accept(s: string): boolean { if (this.cur().value === s) { this.take(); return true; } return false; }
  parse(): Node { const n = this.compare(); if (this.cur().kind !== 'eof') throw Error('Unexpected token'); return n; }
  private compare(): Node {
    let n = this.concat();
    while (['=', '==', '<>', '!=', '<', '>', '<=', '>='].includes(this.cur().value)) { const op = this.take().value; n = { kind: 'binary', operator: op, left: n, right: this.concat() }; }
    return n;
  }
  private concat(): Node { let n = this.add(); while (this.accept('&')) n = { kind: 'binary', operator: '&', left: n, right: this.add() }; return n; }
  private add(): Node { let n = this.mul(); while (['+', '-'].includes(this.cur().value)) { const op = this.take().value; n = { kind: 'binary', operator: op, left: n, right: this.mul() }; } return n; }
  private mul(): Node { let n = this.power(); while (['*', '/'].includes(this.cur().value)) { const op = this.take().value; n = { kind: 'binary', operator: op, left: n, right: this.power() }; } return n; }
  private power(): Node { let n = this.unary(); if (this.accept('^')) n = { kind: 'binary', operator: '^', left: n, right: this.power() }; return n; }
  private unary(): Node { if (['+', '-'].includes(this.cur().value)) return { kind: 'unary', operator: this.take().value, child: this.unary() }; return this.postfix(); }
  private postfix(): Node { let n = this.primary(); while (this.accept('%')) n = { kind: 'postfix', operator: '%', child: n }; return n; }
  private primary(): Node {
    const t = this.take();
    if (t.kind === 'number') return { kind: 'literal', value: Number(t.value) };
    if (t.kind === 'string') return { kind: 'literal', value: t.value };
    if (t.value === '(') { const n = this.compare(); if (!this.accept(')')) throw Error('Expected )'); return n; }
    if (t.kind === 'identifier') {
      if (/^#(?:REF!|DIV\/0!|VALUE!|NAME\?|NUM!|N\/A|ERROR!)$/i.test(t.value)) return { kind: 'literal', value: t.value };
      const ref = parseCellAddress(t.value);
      if (ref) {
        if (this.accept(':')) { const end = this.take(); const ref2 = end.kind === 'identifier' ? parseCellAddress(end.value) : null; if (!ref2) throw Error('Invalid range'); return { kind: 'range', start: ref, end: ref2 }; }
        return { kind: 'cell', ...ref };
      }
      const rawName = t.value.toLocaleUpperCase('pt-BR');
      const name = FORMULA_ALIASES[rawName] || rawName;
      if (name === 'TRUE') return { kind: 'literal', value: true };
      if (name === 'FALSE') return { kind: 'literal', value: false };
      if (this.accept('(')) {
        const args: Node[] = [];
        if (!this.accept(')')) { do { args.push(this.compare()); } while (this.accept(',') || this.accept(';')); if (!this.accept(')')) throw Error('Expected )'); }
        return { kind: 'call', name, args };
      }
    }
    throw Error('Unexpected token');
  }
}
type Context = { resolveCell: FormulaCellResolver; stack: Set<string> };
const str = (v: FormulaValue): string => v === null ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v);
function num(v: FormulaValue): number {
  if (v === null || v === '') return 0; if (typeof v === 'boolean') return v ? 1 : 0; if (typeof v === 'number') return v;
  const s = v.trim().replace(/\s/g, '').replace(/(?<=\d)\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'); return s === '' ? 0 : Number(s);
}
const flatten = (v: unknown): FormulaValue[] => Array.isArray(v) ? v.flatMap(flatten) : [v as FormulaValue];
function getCell(row: number, col: string, ctx: Context): FormulaValue {
  if (row < 1 || row > 1000000 || columnKeyToIndex(col) < 0) return '#REF!';
  const key = col + row; if (ctx.stack.has(key)) return '#REF!';
  const stack = new Set(ctx.stack); stack.add(key); return ctx.resolveCell(row, col, stack);
}
function evalNode(n: Node, ctx: Context): FormulaValue | FormulaValue[] {
  if (n.kind === 'literal') return n.value;
  if (n.kind === 'cell') return getCell(n.row, n.column, ctx);
  if (n.kind === 'range') {
    const r1 = Math.min(n.start.row, n.end.row), r2 = Math.max(n.start.row, n.end.row);
    const c1 = Math.min(columnKeyToIndex(n.start.column), columnKeyToIndex(n.end.column)), c2 = Math.max(columnKeyToIndex(n.start.column), columnKeyToIndex(n.end.column));
    if ((r2 - r1 + 1) * (c2 - c1 + 1) > 10000) return ['#NUM!'];
    const values: FormulaValue[] = []; for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) values.push(getCell(r, columnIndexToKey(c), ctx)); return values;
  }
  if (n.kind === 'unary' || n.kind === 'postfix') {
    const v = evalNode(n.child, ctx); if (Array.isArray(v)) return '#VALUE!'; if (isError(v)) return v;
    const x = num(v); if (!Number.isFinite(x)) return '#VALUE!'; return n.kind === 'postfix' ? x / 100 : n.operator === '-' ? -x : x;
  }
  if (n.kind === 'binary') {
    const l = evalNode(n.left, ctx), r = evalNode(n.right, ctx); if (Array.isArray(l) || Array.isArray(r)) return '#VALUE!';
    if (isError(l)) return l; if (isError(r)) return r; if (n.operator === '&') return str(l) + str(r);
    if (['=', '==', '<>', '!=', '<', '>', '<=', '>='].includes(n.operator)) {
      const a: number | string = typeof l === 'number' ? l : str(l).toLocaleLowerCase('pt-BR'), b: number | string = typeof r === 'number' ? r : str(r).toLocaleLowerCase('pt-BR');
      switch (n.operator) { case '=': case '==': return a === b; case '<>': case '!=': return a !== b; case '<': return a < b; case '>': return a > b; case '<=': return a <= b; default: return a >= b; }
    }
    const a = num(l), b = num(r); if (!Number.isFinite(a) || !Number.isFinite(b)) return '#VALUE!';
    if (n.operator === '+') return a + b; if (n.operator === '-') return a - b; if (n.operator === '*') return a * b;
    if (n.operator === '/') return b === 0 ? '#DIV/0!' : a / b;
    if (n.operator === '^') { const result = Math.pow(a, b); return Number.isFinite(result) ? result : '#NUM!'; }
  }
  if (n.kind === 'call') {
    const arg = (i: number): FormulaValue | FormulaValue[] => n.args[i] ? evalNode(n.args[i], ctx) : null;
    if (n.name === 'IF') { const v = arg(0); if (Array.isArray(v) || isError(v)) return Array.isArray(v) ? '#VALUE!' : v; return arg(num(v) !== 0 && str(v).toUpperCase() !== 'FALSE' ? 1 : 2); }
    if (n.name === 'IFERROR') { const v = arg(0); return !Array.isArray(v) && isError(v) ? arg(1) : v; }
    const args = n.args.map((_, i) => arg(i)), flat = args.flatMap(flatten), found = flat.find(isError);
    if (found && n.name !== 'ISERROR') return found;
    const scalar = (i: number): FormulaValue => { const v = args[i]; return Array.isArray(v) ? (v[0] ?? null) : (v ?? null); };
    const nums = flat.filter(v => v !== null && v !== '' && typeof v !== 'boolean').map(num).filter(Number.isFinite);
    switch (n.name) {
      case 'SUM': return nums.reduce((a, b) => a + b, 0);
      case 'AVERAGE': return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : '#DIV/0!';
      case 'COUNT': return nums.length;
      case 'COUNTA': return flat.filter(v => v !== null && v !== '').length;
      case 'MIN': return nums.length ? Math.min(...nums) : 0;
      case 'MAX': return nums.length ? Math.max(...nums) : 0;
      case 'PRODUCT': return nums.reduce((a, b) => a * b, 1);
      case 'ABS': return Math.abs(num(scalar(0)));
      case 'ROUND': return roundTo(num(scalar(0)), Math.trunc(num(scalar(1))));
      case 'ROUNDUP': return roundAway(num(scalar(0)), Math.trunc(num(scalar(1))));
      case 'ROUNDDOWN': { const x = num(scalar(0)), d = Math.trunc(num(scalar(1))), f = Math.pow(10, Math.max(-12, Math.min(12, d))); return Math.trunc(x * f) / f; }
      case 'INT': return Math.floor(num(scalar(0)));
      case 'MOD': return num(scalar(1)) === 0 ? '#DIV/0!' : num(scalar(0)) % num(scalar(1));
      case 'POWER': return Math.pow(num(scalar(0)), num(scalar(1)));
      case 'SQRT': return num(scalar(0)) < 0 ? '#NUM!' : Math.sqrt(num(scalar(0)));
      case 'PI': return Math.PI;
      case 'AND': return flat.every(v => num(v) !== 0 && str(v).toUpperCase() !== 'FALSE');
      case 'OR': return flat.some(v => num(v) !== 0 || str(v).toUpperCase() === 'TRUE');
      case 'NOT': return !(num(scalar(0)) !== 0 && str(scalar(0)).toUpperCase() !== 'FALSE');
      case 'ISBLANK': return scalar(0) === null || scalar(0) === '';
      case 'ISNUMBER': { const value = scalar(0); return typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(num(value))); }
      case 'ISTEXT': return typeof scalar(0) === 'string' && !isError(scalar(0));
      case 'ISERROR': return isError(scalar(0));
      case 'LEN': return str(scalar(0)).length;
      case 'LOWER': return str(scalar(0)).toLocaleLowerCase('pt-BR');
      case 'UPPER': return str(scalar(0)).toLocaleUpperCase('pt-BR');
      case 'PROPER': return str(scalar(0)).toLocaleLowerCase('pt-BR').replace(/(^|[\s-])([\p{L}\p{N}])/gu, (_m, a, b) => a + b.toLocaleUpperCase('pt-BR'));
      case 'TRIM': return str(scalar(0)).trim().replace(/\s+/g, ' ');
      case 'LEFT': return str(scalar(0)).slice(0, Math.max(0, Math.trunc(num(scalar(1) ?? 1))));
      case 'RIGHT': { const s = str(scalar(0)), count = Math.max(0, Math.trunc(num(scalar(1) ?? 1))); return count ? s.slice(-count) : ''; }
      case 'MID': { const start = Math.max(0, Math.trunc(num(scalar(1)) - 1)); return str(scalar(0)).slice(start, start + Math.max(0, Math.trunc(num(scalar(2))))); }
      case 'CONCAT': case 'CONCATENATE': return flat.map(str).join('');
      case 'SUBSTITUTE': { const s = str(scalar(0)), old = str(scalar(1)), replacement = str(scalar(2)); if (!old) return s; const occurrence = Math.trunc(num(scalar(3) ?? 0)); if (occurrence > 0) { let count = 0; return s.replace(new RegExp(old.replace(/[.*+?^$()|[\]\\]/g, '\\$&'), 'g'), match => ++count === occurrence ? replacement : match); } return s.split(old).join(replacement); }
      case 'VALUE': { const x = num(scalar(0)); return Number.isFinite(x) ? x : '#VALUE!'; }
      case 'N': return typeof scalar(0) === 'number' ? scalar(0) as number : typeof scalar(0) === 'boolean' ? (scalar(0) ? 1 : 0) : 0;
      case 'T': return typeof scalar(0) === 'string' ? scalar(0) : '';
      case 'DATE': { const y = Math.trunc(num(scalar(0))), m = Math.trunc(num(scalar(1))), d = Math.trunc(num(scalar(2))); return new Date(Date.UTC(y < 1900 ? y + 1900 : y, m - 1, d)).toISOString().slice(0, 10); }
      case 'YEAR': case 'MONTH': case 'DAY': { const s = str(scalar(0)), date = new Date(s.length === 10 ? s + 'T00:00:00Z' : s); if (Number.isNaN(date.getTime())) return '#VALUE!'; return n.name === 'YEAR' ? date.getUTCFullYear() : n.name === 'MONTH' ? date.getUTCMonth() + 1 : date.getUTCDate(); }
      case 'TODAY': return new Date().toISOString().slice(0, 10);
      case 'NOW': return new Date().toISOString();
      case 'COUNTIF': case 'SUMIF': { const range = args[0] ? flatten(args[0]) : [], criteria = str(scalar(1)); const matching = range.map((v, i) => ({ v, i })).filter(({ v }) => matchesCriteria(v, criteria)); if (n.name === 'COUNTIF') return matching.length; const sumRange = args[2] ? flatten(args[2]) : range; return matching.reduce((sum, item) => sum + num(sumRange[item.i] ?? 0), 0); }
      default: return '#NAME?';
    }
  }
  return '#ERROR!';
}
function roundTo(value: number, digits: number): number { const f = Math.pow(10, Math.max(-12, Math.min(12, digits))); return Math.round((value + Number.EPSILON) * f) / f; }
function roundAway(value: number, digits: number): number { const f = Math.pow(10, Math.max(-12, Math.min(12, digits))); return Math.sign(value) * Math.ceil(Math.abs(value) * f) / f; }
function matchesCriteria(value: FormulaValue, criteria: string): boolean {
  const m = /^(>=|<=|<>|>|<|=)(.*)$/.exec(criteria); if (!m) return str(value).toLocaleLowerCase('pt-BR') === criteria.toLocaleLowerCase('pt-BR');
  const a = typeof value === 'number' ? value : num(value), b = num(m[2]);
  switch (m[1]) { case '>=': return a >= b; case '<=': return a <= b; case '>': return a > b; case '<': return a < b; case '<>': return str(value) !== m[2]; default: return str(value) === m[2]; }
}
export function evaluateFormula(formula: string, resolveCell: FormulaCellResolver, stack: Set<string> = new Set()): FormulaValue {
  const source = formula.trim().replace(/^=/, ''); if (!source) return '';
  try { const result = evalNode(new Parser(tokenize(source)).parse(), { resolveCell, stack }); if (Array.isArray(result)) return '#VALUE!'; if (typeof result === 'number' && !Number.isFinite(result)) return '#NUM!'; return result; }
  catch { return '#ERROR!'; }
}


/** Copies a formula while shifting only relative A1 references. Text literals stay untouched. */
export function translateFormulaReferences(formula: string, rowOffset: number, columnOffset: number): string {
  let output = '', i = 0, quoted = false;
  while (i < formula.length) {
    const char = formula[i];
    if (char === '"') {
      output += char;
      if (quoted && formula[i + 1] === '"') { output += '"'; i += 2; continue; }
      quoted = !quoted; i++; continue;
    }
    if (!quoted && (/[A-Z_$]/i.test(char)) &&
        (i === 0 || !/[A-Z0-9_.]/i.test(formula[i - 1]))) {
      const match = /^(\$?)([A-Z]{1,3})(\$?)([1-9]\d*)/i.exec(formula.slice(i));
      if (match && formula[i + match[0].length] !== '(') {
        const originalColumn = columnKeyToIndex(match[2]);
        const nextColumn = originalColumn + (match[1] ? 0 : columnOffset);
        const nextRow = Number(match[4]) + (match[3] ? 0 : rowOffset);
        if (nextColumn < 0 || nextColumn >= 18278 || nextRow < 1 || nextRow > 1000000) output += '#REF!';
        else output += match[1] + columnIndexToKey(nextColumn) + match[3] + nextRow;
        i += match[0].length; continue;
      }
    }
    output += char; i++;
  }
  return output;
}

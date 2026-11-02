import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Dialog, validateNumber, type NumberRules } from '../components/dialog';
import type { DrawingEntity, TextParagraph, TextRun, TextStyle } from './types';
import { DrawingTextIcon, type DrawingTextIconKind } from './DrawingTextIcon';
import './drawing.css';

export interface TextEditorProps {
  entity: DrawingEntity;
  styles: TextStyle[];
  onConfirm: (entity: DrawingEntity) => void;
  onCancel: () => void;
  onApply?: (entity: DrawingEntity) => void;
}

const FALLBACK: TextStyle = {
  id: 'default', name: 'Стандартный', fontFamily: 'Arial', height: 3.5,
  bold: false, italic: false, underline: false, overline: false, strike: false,
  color: '#202935', widthFactor: 1, oblique: 0, tracking: 0, lineSpacing: 1.2,
  spaceBefore: 0, spaceAfter: 0, paragraphAlign: 'left', anchor: 'top-left',
  mask: false, maskColor: '#ffffff', maskPadding: 1, frame: 'none', layer: '0',
  printable: true, visible: true, scaleMode: 'paper', direction: 'ltr', writingMode: 'horizontal'
};
const copy = <T,>(value: T): T => structuredClone(value);
export const paragraphText = (paragraph: TextParagraph): string => paragraph.runs.map(run => run.text).join('');

/** Split only ordinary text. Fields/stacks are atomic structured fragments. */
export function formatTextRange(runs: TextRun[], start: number, end: number, patch: Partial<TextRun>, format?: Partial<TextStyle>): TextRun[] {
  if (start >= end) return copy(runs);
  let offset = 0;
  return runs.flatMap(run => {
    const from = Math.max(0, start - offset), to = Math.min(run.text.length, end - offset);
    offset += run.text.length;
    if (from >= to) return [copy(run)];
    const atomic = Boolean(run.field || run.stack);
    const a = atomic ? 0 : from, b = atomic ? run.text.length : to;
    const changed: TextRun = {...copy(run), ...copy(patch), text: run.text.slice(a, b)};
    if (format) changed.format = {...run.format, ...format};
    return [...(a ? [{...copy(run), text: run.text.slice(0, a)}] : []), changed,
      ...(b < run.text.length ? [{...copy(run), text: run.text.slice(b)}] : [])];
  });
}

/** Apply a plain-text edit while retaining formatting and untouched field references. */
export function replaceTextRange(runs: TextRun[], start: number, end: number, inserted: string): TextRun[] {
  let offset = 0;
  const before: TextRun[] = [], after: TextRun[] = [];
  let inherited: TextRun | undefined;
  for (const run of runs) {
    const runStart = offset, runEnd = offset + run.text.length;
    if (runStart <= start && runEnd >= start) inherited = run;
    if (runEnd <= start) before.push(copy(run));
    else if (runStart < start) before.push({...copy(run), text: run.text.slice(0, start - runStart), field: undefined, stack: undefined});
    if (runStart >= end) after.push(copy(run));
    else if (runEnd > end) after.push({...copy(run), text: run.text.slice(end - runStart), field: undefined, stack: undefined});
    offset = runEnd;
  }
  const result = [...before, ...(inserted ? [{text: inserted, format: copy(inherited?.format), script: inherited?.script}] : []), ...after];
  return result.length ? result : [{text: ''}];
}

export function updateParagraphText(paragraph: TextParagraph, next: string): TextParagraph {
  const previous = paragraphText(paragraph);
  let start = 0, suffix = 0;
  while (start < previous.length && start < next.length && previous[start] === next[start]) start++;
  while (suffix < previous.length - start && suffix < next.length - start && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix++;
  if (start === previous.length && start === next.length) return copy(paragraph);
  return {...paragraph, runs: replaceTextRange(paragraph.runs, start, previous.length - suffix, next.slice(start, next.length - suffix))};
}

function Field({label, icon = 'text', children, help}: {label: string; icon?: DrawingTextIconKind; children: (id: string) => ReactNode; help?: string}) {
  const id = useId();
  return <div className="drawing-editor-field"><label htmlFor={id} title={help}><DrawingTextIcon kind={icon}/>{label}</label>{children(id)}{help && <small>{help}</small>}</div>;
}

function NumericField({name, label, value, change, rules = {}, unit = 'мм', icon = 'height', validity, integer = false}: {
  name: string; label: string; value: number; change: (value: number) => void; rules?: NumberRules;
  unit?: string; icon?: DrawingTextIconKind; validity: (name: string, error?: string) => void; integer?: boolean;
}) {
  const [raw, setRaw] = useState(String(value));
  useEffect(() => setRaw(previous => Number(previous) === value ? previous : String(value)), [value]);
  const error = validateNumber(raw, rules) || (integer && !Number.isInteger(Number(raw)) ? 'Введите целое число' : undefined);
  useEffect(() => { validity(name, error); return () => validity(name, undefined); }, [name, error, validity]);
  return <Field label={label} icon={icon}>{id => <><div className="drawing-number"><input id={id} type="text" inputMode="decimal" value={raw} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
    onChange={event => {const text = event.target.value; setRaw(text); if (!validateNumber(text, rules)) change(Number(text));}}/><span>{unit}</span></div>{error && <span id={`${id}-error`} className="drawing-editor-error" role="alert">{error}</span>}</>}</Field>;
}

const anchors: [TextStyle['anchor'], string][] = [
  ['top-left', 'Сверху слева'], ['top-center', 'Сверху по центру'], ['top-right', 'Сверху справа'],
  ['middle-left', 'Посередине слева'], ['middle-center', 'Центр'], ['middle-right', 'Посередине справа'],
  ['bottom-left', 'Снизу слева'], ['bottom-center', 'Снизу по центру'], ['bottom-right', 'Снизу справа'], ['baseline-left', 'Базовая линия слева']
];
const symbols = [['⌀', 'Диаметр'], ['±', 'Плюс-минус'], ['°', 'Градус'], ['∠', 'Угол'], ['⊥', 'Перпендикулярность'], ['∥', 'Параллельность'], ['⌖', 'Позиционный допуск'], ['µ', 'Микро'], ['Ω', 'Ом'], ['²', 'Квадрат'], ['³', 'Куб'], ['\u00a0', 'Неразрывный пробел']];

export function TextEditor({entity, styles, onConfirm, onCancel, onApply}: TextEditorProps) {
  const [draft, setDraft] = useState(() => copy(entity));
  const [selection, setSelection] = useState({paragraph: 0, start: 0, end: 0});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stackTop, setStackTop] = useState('1');
  const [stackBottom, setStackBottom] = useState('2');
  const [stackKind, setStackKind] = useState<'fraction'|'diagonal'|'tolerance'>('fraction');
  const [script, setScript] = useState<'normal'|'super'|'sub'>('normal');
  const inputs = useRef<(HTMLTextAreaElement|null)[]>([]);
  const base = styles.find(style => style.id === draft.styleId) || styles[0] || FALLBACK;
  const style = {...base, ...draft.overrides};
  const activeParagraph = draft.paragraphs[selection.paragraph] || draft.paragraphs[0] || {runs: [{text: ''}]};
  const hasSelection = selection.end > selection.start;
  let runOffset = 0;
  const selectedRun = activeParagraph.runs.find(run => {const end = runOffset + run.text.length; const found = selection.start >= runOffset && selection.start < end; runOffset = end; return found;});
  const character = hasSelection ? {...style, ...selectedRun?.format} : style;
  const validity = useCallback((name: string, error?: string) => setErrors(previous => {
    if (previous[name] === error) return previous;
    const next = {...previous}; if (error) next[name] = error; else delete next[name]; return next;
  }), []);
  const setEntity = <K extends keyof DrawingEntity,>(key: K, value: DrawingEntity[K]) => setDraft(previous => ({...previous, [key]: value}));
  const setStyle = <K extends keyof TextStyle,>(key: K, value: TextStyle[K]) => setDraft(previous => ({...previous, overrides: {...previous.overrides, [key]: value}}));
  const setParagraph = (patch: Partial<TextParagraph>) => setDraft(previous => ({...previous, paragraphs: previous.paragraphs.map((paragraph, index) => index === selection.paragraph ? {...paragraph, ...patch} : paragraph)}));
  const restoreSelection = (focus = false) => requestAnimationFrame(() => {
    const input = inputs.current[selection.paragraph]; if (!input) return;
    if (focus) input.focus(); input.setSelectionRange(selection.start, selection.end);
  });
  const setCharacter = (patch: Partial<TextStyle>, runPatch: Partial<TextRun> = {}) => {
    if (hasSelection) setDraft(previous => ({...previous, paragraphs: previous.paragraphs.map((paragraph, index) => index === selection.paragraph ? {...paragraph, runs: formatTextRange(paragraph.runs, selection.start, selection.end, runPatch, patch)} : paragraph)}));
    else if (Object.keys(runPatch).length) setParagraph({runs: activeParagraph.runs.map(run => ({...run, ...runPatch}))});
    else setDraft(previous => ({...previous, overrides: {...previous.overrides, ...patch}, paragraphs: previous.paragraphs.map(paragraph => ({...paragraph, runs: paragraph.runs.map(run => ({...run, format: {...run.format, ...patch}}))}))}));
    restoreSelection();
  };
  const insertText = (text: string, stack?: TextRun['stack']) => {
    const paragraph = selection.paragraph;
    setDraft(previous => ({...previous, paragraphs: previous.paragraphs.map((item, index) => {
      if (index !== paragraph) return item;
      let runs = replaceTextRange(item.runs, selection.start, selection.end, text);
      if (stack) runs = formatTextRange(runs, selection.start, selection.start + text.length, {stack});
      return {...item, runs};
    })}));
    const cursor = selection.start + text.length;
    setSelection({paragraph, start: cursor, end: cursor});
    requestAnimationFrame(() => {const input = inputs.current[paragraph]; input?.focus(); input?.setSelectionRange(cursor, cursor);});
  };
  const contentError = !draft.paragraphs.some(paragraph => paragraph.runs.some(run => run.text.trim() || run.field || run.stack)) ? 'Введите текст: пустой объект не сохраняется' : undefined;
  const nameError = !draft.name.trim() ? 'Введите имя объекта' : undefined;
  const fontError = !character.fontFamily.trim() ? 'Введите имя шрифта' : undefined;
  const layerError = !style.layer.trim() ? 'Введите имя слоя' : undefined;
  const invalid = Boolean(contentError || nameError || fontError || layerError || Object.keys(errors).length);
  const confirm = () => {if (!invalid) onConfirm(copy(draft));};
  const charNumber = (key: 'height'|'widthFactor'|'oblique'|'tracking', label: string, rules: NumberRules = {}, unit = 'мм') => <NumericField key={key} name={key} label={label} value={character[key]} change={value => setCharacter({[key]: value})} rules={rules} unit={unit} validity={validity}/>;
  const styleNumber = (key: 'lineSpacing'|'spaceBefore'|'spaceAfter'|'maskPadding', label: string, rules: NumberRules = {min: 0}, unit = 'мм') => <NumericField key={key} name={key} label={label} value={style[key]} change={value => setStyle(key, value)} rules={rules} unit={unit} icon="paragraph" validity={validity}/>;
  const selectStyle = <K extends keyof TextStyle,>(key: K, label: string, options: [string, string][], icon: DrawingTextIconKind) => <Field label={label} icon={icon}>{id => <select id={id} value={String(style[key])} onChange={event => setStyle(key, event.target.value as TextStyle[K])}>{options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>}</Field>;

  return <Dialog open title="Редактор текста чертежа" onCancel={onCancel} onConfirm={confirm} confirmDisabled={invalid} onApply={onApply ? () => {if (!invalid) onApply(copy(draft));} : undefined}>
    <div className="drawing-text-editor" data-testid="drawing-text-editor" onKeyDown={event => {
      if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
        if (event.ctrlKey || event.metaKey) {event.preventDefault(); confirm();}
        else if (!(event.target instanceof HTMLTextAreaElement) && !(event.target instanceof HTMLButtonElement)) event.preventDefault();
      }
    }}>
      <p className="drawing-editor-hint">Enter — новая строка, Ctrl+Enter — подтвердить, Esc — отменить. Размеры в единицах листа; предпросмотр использует доступные браузеру шрифты.</p>
      <fieldset><legend><DrawingTextIcon/>Содержание</legend>
        <Field label="Имя объекта">{id => <input id={id} value={draft.name} aria-invalid={Boolean(nameError)} onChange={event => setEntity('name', event.target.value)}/>}</Field>
        {nameError && <p className="drawing-editor-error" role="alert">{nameError}</p>}
        {draft.paragraphs.map((paragraph, index) => <section key={index} className="drawing-paragraph-editor">
          <Field label={`Абзац ${index + 1}`} icon="paragraph">{id => <textarea id={id} ref={element => {inputs.current[index] = element;}} rows={3} value={paragraphText(paragraph)} spellCheck
            onSelect={event => setSelection({paragraph: index, start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd})}
            onFocus={event => setSelection({paragraph: index, start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd})}
            onChange={event => {const text = event.target.value; const start = event.target.selectionStart; const end = event.target.selectionEnd;
              setDraft(previous => ({...previous, paragraphs: previous.paragraphs.map((item, p) => p === index ? updateParagraphText(item, text) : item)}));
              setSelection({paragraph: index, start, end});}}/>}</Field>
          <button type="button" disabled={draft.paragraphs.length < 2} onClick={() => {
            setEntity('paragraphs', draft.paragraphs.filter((_, p) => p !== index)); setSelection({paragraph: 0, start: 0, end: 0});
          }}><DrawingTextIcon kind="paragraph"/>Удалить абзац {index + 1}</button>
        </section>)}
        <button type="button" onClick={() => {
          const index = draft.paragraphs.length; setEntity('paragraphs', [...draft.paragraphs, {runs: [{text: ''}]}]); setSelection({paragraph: index, start: 0, end: 0}); requestAnimationFrame(() => inputs.current[index]?.focus());
        }}><DrawingTextIcon kind="paragraph"/>Добавить абзац</button>
        {contentError && <p className="drawing-editor-error" role="alert">{contentError}</p>}
      </fieldset>

      <fieldset><legend><DrawingTextIcon kind="font"/>Шрифт и фрагменты</legend>
        <p className="drawing-format-scope" role="status">{hasSelection ? `Выделенный фрагмент: ${selection.end - selection.start} знаков, абзац ${selection.paragraph + 1}` : 'Оформление всего объекта; выделите текст для оформления фрагмента'}</p>
        <div className="drawing-editor-grid">
          <Field label="Стиль текста" icon="font">{id => <select id={id} value={draft.styleId} onChange={event => setDraft(previous => ({...previous, styleId: event.target.value, overrides: {}}))}>
            {!styles.length && <option value={draft.styleId}>Стандартный</option>}{styles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>}</Field>
          <Field label="Шрифт" icon="font" help="Имя семейства; отсутствующий шрифт подменяется браузером. SHX не поддерживается.">{id => <input id={id} value={character.fontFamily} onChange={event => setCharacter({fontFamily: event.target.value})}/>}</Field>
          {charNumber('height', 'Высота текста', {min: 0, exclusiveMin: true})}
          {charNumber('widthFactor', 'Коэффициент ширины', {min: 0, exclusiveMin: true}, '×')}
          {charNumber('oblique', 'Наклон символов', {min: -85, max: 85}, '°')}
          {charNumber('tracking', 'Межсимвольный интервал', {min: -10, max: 100}, 'мм')}
          <Field label="Цвет текста" icon="color">{id => <input id={id} type="color" value={/^#[0-9a-f]{6}$/i.test(character.color) ? character.color : '#202935'} onChange={event => setCharacter({color: event.target.value})}/>}</Field>
          {(['bold', 'italic', 'underline', 'overline', 'strike'] as const).map((key, index) => <Field key={key} label={['Жирный', 'Курсив', 'Подчёркивание', 'Надчёркивание', 'Зачёркивание'][index]} icon="font">{id => <input id={id} type="checkbox" checked={character[key]} onChange={event => setCharacter({[key]: event.target.checked})}/>}</Field>)}
          <Field label="Индекс" icon="font">{id => <select id={id} value={script} onChange={event => {const value = event.target.value as typeof script; setScript(value); setCharacter({}, {script: value});}}><option value="normal">Обычный</option><option value="super">Верхний</option><option value="sub">Нижний</option></select>}</Field>
        </div>
        <div className="drawing-symbol-palette" aria-label="Инженерные символы">{symbols.map(([symbol, label]) => <button type="button" key={label} title={label} aria-label={`Вставить: ${label}`} onClick={() => insertText(symbol)}><DrawingTextIcon kind="symbol"/>{symbol === '\u00a0' ? 'NBSP' : symbol}</button>)}</div>
        <div className="drawing-editor-grid">
          <Field label="Числитель / верх" icon="symbol">{id => <input id={id} value={stackTop} onChange={event => setStackTop(event.target.value)}/>}</Field>
          <Field label="Знаменатель / низ" icon="symbol">{id => <input id={id} value={stackBottom} onChange={event => setStackBottom(event.target.value)}/>}</Field>
          <Field label="Тип дроби / допуска" icon="symbol">{id => <select id={id} value={stackKind} onChange={event => setStackKind(event.target.value as typeof stackKind)}><option value="fraction">Горизонтальная дробь</option><option value="diagonal">Диагональная дробь</option><option value="tolerance">Двухстрочный допуск</option></select>}</Field>
          <button type="button" disabled={!stackTop.trim() || !stackBottom.trim()} onClick={() => insertText(`${stackTop}/${stackBottom}`, {top: stackTop, bottom: stackBottom, kind: stackKind})}><DrawingTextIcon kind="symbol"/>Вставить дробь / допуск</button>
        </div>
      </fieldset>

      <fieldset><legend><DrawingTextIcon kind="paragraph"/>Абзац {selection.paragraph + 1} и интервалы</legend><div className="drawing-editor-grid">
        <Field label="Выравнивание абзаца" icon="paragraph">{id => <select id={id} value={activeParagraph.align || style.paragraphAlign} onChange={event => setParagraph({align: event.target.value as TextParagraph['align']})}><option value="left">Слева</option><option value="center">По центру</option><option value="right">Справа</option><option value="justify">По ширине</option></select>}</Field>
        <Field label="Список" icon="paragraph">{id => <select id={id} value={activeParagraph.list || 'none'} onChange={event => setParagraph({list: event.target.value as TextParagraph['list']})}><option value="none">Нет</option><option value="bullet">Маркированный</option><option value="number">Нумерованный</option><option value="letter">Буквенный</option></select>}</Field>
        <NumericField name="listStart" label="Начальный номер" value={activeParagraph.listStart ?? 1} integer rules={{min: 1, max: 1000000}} unit="" icon="paragraph" validity={validity} change={value => setParagraph({listStart: value})}/>
        <NumericField name="indent" label="Отступ абзаца" value={activeParagraph.indent ?? 0} icon="paragraph" validity={validity} change={value => setParagraph({indent: value})}/>
        <NumericField name="firstIndent" label="Отступ первой строки" value={activeParagraph.firstIndent ?? 0} icon="paragraph" validity={validity} change={value => setParagraph({firstIndent: value})}/>
        <Field label="Табуляция, мм через ;" icon="paragraph">{id => <input id={id} defaultValue={(activeParagraph.tabs || []).join('; ')} key={selection.paragraph} onChange={event => {
          const values = event.target.value.trim() ? event.target.value.split(';').map(value => value.trim()) : [];
          const error = values.some(value => Boolean(validateNumber(value, {min: 0}))) ? 'Точки табуляции: неотрицательные числа через ;' : undefined;
          validity('tabs', error); if (!error) setParagraph({tabs: values.map(Number).sort((a, b) => a - b)});
        }}/>}</Field>
        {styleNumber('lineSpacing', 'Межстрочный интервал', {min: 0, exclusiveMin: true}, '×')}
        {styleNumber('spaceBefore', 'Интервал до абзаца')}{styleNumber('spaceAfter', 'Интервал после абзаца')}
      </div></fieldset>

      <fieldset><legend><DrawingTextIcon kind="position"/>Положение и контейнер</legend><div className="drawing-editor-grid">
        {(['x', 'y', 'width', 'height', 'rotation'] as const).map((key, index) => <NumericField key={key} name={`entity-${key}`} label={['X', 'Y', 'Ширина контейнера', 'Высота контейнера', 'Поворот'][index]} value={draft[key]} rules={key === 'width' || key === 'height' ? {min: 0, exclusiveMin: true} : {}} unit={key === 'rotation' ? '°' : 'мм'} icon={key === 'rotation' ? 'rotation' : 'position'} validity={validity} change={value => setEntity(key, value)}/>)}
        {selectStyle('anchor', 'Якорь', anchors, 'anchor')}
        {selectStyle('scaleMode', 'Размеры текста', [['paper', 'На бумаге'], ['model', 'В масштабе модели']], 'height')}
      </div></fieldset>

      <fieldset><legend><DrawingTextIcon kind="frame"/>Маска, рамка и печать</legend><div className="drawing-editor-grid">
        <Field label="Маска фона" icon="frame">{id => <input id={id} type="checkbox" checked={style.mask} onChange={event => setStyle('mask', event.target.checked)}/>}</Field>
        <Field label="Цвет маски" icon="color">{id => <input id={id} type="color" value={/^#[0-9a-f]{6}$/i.test(style.maskColor) ? style.maskColor : '#ffffff'} onChange={event => setStyle('maskColor', event.target.value)}/>}</Field>
        {styleNumber('maskPadding', 'Отступ маски')}
        {selectStyle('frame', 'Рамка', [['none', 'Нет'], ['rectangle', 'Прямоугольная'], ['circle', 'Круглая'], ['capsule', 'Капсула']], 'frame')}
        <Field label="Слой" icon="layer">{id => <input id={id} value={style.layer} onChange={event => setStyle('layer', event.target.value)}/>}</Field>
        <Field label="Печатать" icon="print">{id => <input id={id} type="checkbox" checked={style.printable} onChange={event => setStyle('printable', event.target.checked)}/>}</Field>
        <Field label="Видимость" icon="layer">{id => <input id={id} type="checkbox" checked={style.visible} onChange={event => setStyle('visible', event.target.checked)}/>}</Field>
        <Field label="Блокировка" icon="layer">{id => <input id={id} type="checkbox" checked={Boolean(draft.locked)} onChange={event => setEntity('locked', event.target.checked)}/>}</Field>
      </div></fieldset>
      <section className="drawing-editor-preview" data-testid="drawing-text-preview" aria-label="Предпросмотр текста" style={{background: style.mask ? style.maskColor : undefined, padding: 12 + style.maskPadding * 2, borderStyle: style.frame === 'none' ? 'dashed' : 'solid', borderRadius: style.frame === 'circle' || style.frame === 'capsule' ? '50%' : 0}}>
        {draft.paragraphs.map((paragraph, index) => <p key={index} style={{textAlign: paragraph.align || style.paragraphAlign, lineHeight: style.lineSpacing, marginTop: style.spaceBefore, marginBottom: style.spaceAfter, paddingLeft: paragraph.indent || 0, textIndent: paragraph.firstIndent || 0}}>
          {paragraph.list && paragraph.list !== 'none' && <span>{paragraph.list === 'bullet' ? '• ' : paragraph.list === 'letter' ? `${String.fromCharCode(64 + (paragraph.listStart || 1))}. ` : `${paragraph.listStart || 1}. `}</span>}
          {paragraph.runs.map((run, r) => {const format = {...style, ...run.format}; return <span key={r} title={run.field ? `Поле: ${run.field.kind}.${run.field.key}` : undefined} style={{fontFamily: format.fontFamily, fontSize: `${format.height * 3}px`, fontWeight: format.bold ? 'bold' : 'normal', fontStyle: format.italic ? 'italic' : 'normal', color: format.color, textDecoration: [format.underline && 'underline', format.overline && 'overline', format.strike && 'line-through'].filter(Boolean).join(' ') || 'none', verticalAlign: run.script === 'super' ? 'super' : run.script === 'sub' ? 'sub' : 'baseline', letterSpacing: format.tracking, whiteSpace: 'pre-wrap'}}>{run.stack ? <span className={`drawing-stack ${run.stack.kind}`}><span>{run.stack.top}</span><span>{run.stack.bottom}</span></span> : run.text}</span>;})}
        </p>)}
      </section>
      {[fontError, layerError].filter(Boolean).map(error => <p key={error} className="drawing-editor-error" role="alert">{error}</p>)}
      {Object.entries(errors).map(([name, error]) => <p key={name} className="drawing-editor-error" role="alert">{error}</p>)}
    </div>
  </Dialog>;
}

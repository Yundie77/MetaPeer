import { buttons, forms, helpers, lists, surfaces, tables, text } from './ui.js';

export const sectionIntroText = {
  ...text.caption
};

export const formRow = {
  ...helpers.rowWrap('1rem', 'flex-end'),
  margin: '1.5rem 0'
};

export const formGrid = {
  ...helpers.gridAutoFit(220),
  marginTop: '1rem',
  marginBottom: '1rem'
};

export const formStack = {
  ...forms.formStack,
  margin: '1.5rem 0'
};

export const cardList = lists.stackList;

export const cardItem = {
  padding: '0.75rem 1rem',
  border: '1px solid #e0e0e0',
  borderRadius: '6px',
  background: '#fff',
  display: 'flex',
  justifyContent: 'space-between'
};

export const panelHeaderRow = surfaces.sectionHeaderRow;

export const panelTitle = {
  margin: 0
};

export const actionsRow = {
  ...helpers.rowWrap('0.75rem')
};

export const tableWrap = tables.wrap;
export const tableBase = tables.table;
export const tableHeaderCell = tables.headerCell;
export const tableBodyCell = tables.bodyCell;

export const noticeWarning = {
  marginTop: '0.75rem',
  marginBottom: '1rem',
  padding: '0.85rem 1rem',
  border: '1px solid #f4d28a',
  background: '#fffbe8',
  borderRadius: '8px',
  color: '#5b4300'
};

export const noticeInfo = {
  marginTop: '0.75rem',
  padding: '0.85rem 1rem',
  border: '1px solid #d1e3ff',
  background: '#f7fbff',
  borderRadius: '8px',
  color: '#1f3a8a'
};

export const primaryButton = buttons.primary;
export const secondaryButton = buttons.secondary;
export const mutedButton = buttons.muted;
export const baseLabel = forms.label;
export const baseInput = forms.input;
export const errorText = text.error;
export const successText = text.successAlt;

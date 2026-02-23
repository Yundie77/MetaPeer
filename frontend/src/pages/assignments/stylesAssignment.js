import { badges, buttons, feedback, forms, helpers, lists, surfaces } from '../../styles/ui.js';

export const formStyle = {
  ...helpers.gridAutoFit(220),
  margin: '1.5rem 0'
};

export const labelStyle = forms.label;

export const inputStyle = forms.input;

export const buttonStyle = buttons.primaryNarrow;

export const errorStyle = {
  ...feedback.errorText,
  marginBottom: '1rem'
};

export const successStyle = {
  ...feedback.successText,
  marginBottom: '1rem'
};

export const listStyle = lists.stackList;

export const cardStyle = {
  padding: '1rem',
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  background: '#fff',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  alignItems: 'center'
};

export const actionsStyle = {
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'flex-end',
  flexWrap: 'wrap'
};

export const smallButton = buttons.outlineBrandSoft;

export const metaStyle = {
  fontSize: '0.85rem',
  color: '#666'
};

export const descStyle = {
  marginTop: '0.35rem',
  fontSize: '0.9rem',
  color: '#444'
};

export const panelStyle = {
  ...surfaces.panelMuted,
  marginTop: '2rem',
};

export const miniCard = {
  padding: '0.75rem',
  borderRadius: '6px',
  border: '1px solid #dcdcdc',
  background: '#fff'
};

export const miniMeta = feedback.miniMeta;

export const rubricRowStyle = {
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'center',
  marginBottom: '0.5rem'
};

export const rubricNumberStyle = {
  width: '90px',
  padding: '0.45rem 0.6rem',
  borderRadius: '4px',
  border: '1px solid #ccc'
};

export const modalOverlay = surfaces.modalOverlay;

export const modalContent = surfaces.modalContent;

export const dangerModalContent = {
  ...modalContent,
  border: '2px solid #b91c1c',
  background: '#fff1f2'
};

export const modalHeader = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem'
};

export const modalFormRow = {
  ...forms.fieldRow,
  marginTop: '1rem'
};

export const plainLinkButton = buttons.linkText;

export const warningListStyle = {
  listStyle: 'disc',
  margin: '0.5rem 0 0',
  paddingLeft: '1.2rem',
  color: '#b45309'
};

export const warningItemStyle = {
  marginBottom: '0.2rem',
  fontSize: '0.92rem'
};

export const previewGrid = {
  ...helpers.gridAutoFit(280),
  marginTop: '1rem'
};

export const previewColumn = {
  padding: '0.5rem',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  background: '#f9fafb'
};

export const tagsRow = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.35rem',
  marginTop: '0.35rem'
};

export const tag = {
  background: '#eef2ff',
  color: '#1e3a8a',
  padding: '0.2rem 0.55rem',
  borderRadius: '12px',
  fontSize: '0.85rem',
  border: '1px solid #d4d8ff'
};

export const dangerHeader = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  padding: '0.75rem 0.9rem',
  borderRadius: '8px',
  background: '#b91c1c',
  color: '#fff'
};

export const dangerIcon = {
  width: '36px',
  height: '36px',
  borderRadius: '50%',
  background: '#fff',
  color: '#b91c1c',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  fontSize: '1.1rem'
};

export const dangerBody = {
  marginTop: '1rem',
  padding: '0.9rem',
  background: '#fee2e2',
  border: '1px solid #b91c1c',
  borderRadius: '8px',
  color: '#7f1d1d',
  lineHeight: 1.4
};

export const dangerListStyle = {
  margin: '0.35rem 0 0.5rem',
  paddingLeft: '1.1rem',
  color: '#7f1d1d',
  listStyle: 'disc'
};

export const dangerActions = {
  display: 'flex',
  gap: '0.75rem',
  justifyContent: 'flex-end',
  marginTop: '1rem',
  flexWrap: 'wrap'
};

export const dangerButton = buttons.danger;

export const dangerCancelButton = buttons.neutral;

export const tabRow = {
  display: 'flex',
  gap: '0.5rem',
  marginTop: '1rem',
  flexWrap: 'wrap'
};

export const tabButton = {
  border: '1px solid #cbd5f5',
  background: '#f8faff',
  color: '#1e3a8a',
  padding: '0.35rem 0.7rem',
  borderRadius: '999px',
  cursor: 'pointer',
  fontWeight: 600
};

export const tabButtonActive = {
  ...tabButton,
  background: '#0b74de',
  color: '#fff',
  borderColor: '#0b74de'
};

export const summaryGrid = {
  ...helpers.gridAutoFit(220, '0.75rem'),
  marginTop: '1rem'
};

export const summaryCard = {
  padding: '0.75rem',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  background: '#f8fafc'
};

export const summaryLabel = {
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#64748b',
  marginBottom: '0.25rem'
};

export const statusList = {
  ...lists.statusListBase,
  margin: '1rem 0 0'
};

export const statusItem = lists.statusItem;

export const statusBadge = badges.statusBase;

export const statusBadgePending = {
  ...statusBadge,
  ...badges.pending
};

export const statusBadgeSubmitted = {
  ...statusBadge,
  ...badges.submitted
};

export const statusBadgeGraded = {
  ...statusBadge,
  ...badges.graded
};

export const statusActions = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexWrap: 'wrap'
};

export const linkPill = buttons.linkPill;


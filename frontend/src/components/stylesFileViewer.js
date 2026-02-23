import { buttons, helpers, text, tokens } from '../styles/ui.js';

export const viewerTextFileName = {
  fontFamily: 'Consolas, SFMono-Regular, Menlo, monospace',
  fontSize: '0.88rem'
};

export const iconGap6 = {
  marginRight: 6
};

export const fileTreeList = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  whiteSpace: 'nowrap',
  minWidth: '100%',
  width: 'max-content'
};

export const fileTreeItem = {
  listStyle: 'none'
};

export const fileTreeRow = helpers.row('0.4rem', 'center');

export const fileTreeDirButton = {
  display: 'flex',
  alignItems: 'center',
  width: 'max-content',
  textAlign: 'left',
  padding: '0.35rem 0.4rem',
  borderRadius: 4,
  border: '1px solid transparent',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '0.92rem',
  fontWeight: 600,
  color: '#1f2328'
};

export const fileTreeFileButton = {
  display: 'flex',
  alignItems: 'center',
  width: 'max-content',
  textAlign: 'left',
  padding: '0.35rem 0.4rem',
  borderRadius: 4,
  border: '1px solid transparent',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '0.9rem',
  color: '#24292f'
};

export const fileTreeDirButtonAtDepth = (paddingLeft) => ({
  ...fileTreeDirButton,
  paddingLeft
});

export const fileTreeFileButtonAtDepth = (paddingLeft, isSelected) => ({
  ...fileTreeFileButton,
  paddingLeft,
  backgroundColor: isSelected ? '#d9ecff' : 'transparent',
  borderColor: isSelected ? '#8cc4ff' : 'transparent'
});

export const fileTreeCommentBadge = {
  ...buttons.pill,
  padding: '0.1rem 0.5rem',
  fontSize: '0.72rem',
  fontWeight: 600
};

export const breadcrumbsWrap = {
  ...helpers.row('0.4rem', 'center'),
  padding: '0.5rem 0.75rem',
  border: '1px solid #ddd',
  borderRadius: '6px 6px 0 0',
  backgroundColor: '#f5f7fb',
  color: '#1a1a1a',
  overflow: 'auto'
};

export const breadcrumbsSep = {
  color: '#777'
};

export const breadcrumbsButton = {
  border: 'none',
  background: 'transparent',
  color: '#0366d6',
  cursor: 'pointer',
  padding: 0,
  fontSize: '0.95rem'
};

export const zipViewerContainer = helpers.column('1rem');

export const zipViewerLabel = {
  fontWeight: 600
};

export const zipViewerFileInput = {
  border: `1px solid ${tokens.colors.border}`,
  padding: '0.5rem',
  borderRadius: 4
};

export const zipViewerStatusText = text.muted;

export const zipViewerErrorText = text.error;

export const zipViewerViewerArea = {
  display: 'grid',
  gridTemplateColumns: '340px 1fr',
  gap: '1rem',
  minHeight: 'calc(100vh - 200px)'
};

export const zipViewerLeftPane = {
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid #ddd',
  borderRadius: 6,
  background: '#fdfdfd',
  height: 'calc(100vh - 200px)',
  position: 'sticky',
  top: 96
};

export const zipViewerLeftHeader = {
  padding: '0.5rem 0.75rem',
  fontWeight: 600,
  borderBottom: '1px solid #ececec',
  background: '#f5f7fb'
};

export const zipViewerLeftScroll = {
  flex: 1,
  overflowY: 'auto',
  padding: '0.5rem'
};

export const zipViewerRightPane = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 'calc(100vh - 200px)'
};

export const zipViewerRightContent = {
  flex: 1,
  display: 'flex'
};

export const zipViewerPlaceholder = {
  margin: 'auto',
  color: '#555',
  border: '1px dashed #ddd',
  borderRadius: 6,
  padding: '1rem',
  width: '100%',
  textAlign: 'center'
};

export const lineMenu = {
  position: 'absolute',
  zIndex: 30,
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 6,
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  padding: '0.5rem',
  minWidth: 200
};

export const lineMenuAt = (x, y) => ({
  ...lineMenu,
  left: x,
  top: y
});

export const lineMenuRow = {
  display: 'flex',
  alignItems: 'center',
  marginBottom: '0.4rem'
};

export const lineMenuCommentRow = {
  ...lineMenuRow,
  alignItems: 'stretch',
  gap: '0.4rem'
};

export const lineMenuButton = {
  border: '1px solid #ddd',
  background: '#f6f8fa',
  padding: '0.25rem 0.5rem',
  borderRadius: 4,
  cursor: 'pointer'
};

export const lineMenuPrimaryButton = {
  ...lineMenuButton,
  background: '#2ea44f',
  color: '#fff',
  borderColor: '#2ea44f'
};

export const lineMenuInput = {
  flex: 1,
  padding: '0.25rem 0.4rem',
  border: '1px solid #ccc',
  borderRadius: 4
};

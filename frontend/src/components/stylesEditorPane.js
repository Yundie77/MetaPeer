export const editorPaneContainer = {
  position: 'relative',
  width: '100%',
  boxSizing: 'border-box',
  minWidth: 0,
  border: '1px solid #ddd',
  borderTop: 'none',
  borderRadius: '0 0 6px 6px',
  overflow: 'hidden',
  background: '#fafafa'
};

export const editorPaneContainerWithHeight = (height) => ({
  ...editorPaneContainer,
  height
});

export const editorPaneRenderErrorBanner = {
  padding: '0.5rem 0.75rem',
  color: 'crimson',
  background: '#fff2f2'
};

export const editorPaneLineActionButton = (left, top) => ({
  position: 'absolute',
  left,
  top,
  zIndex: 20,
  background: '#f6f8fa',
  border: '1px solid #d0d7de',
  borderRadius: '6px',
  padding: '2px 6px',
  cursor: 'pointer',
  color: '#0969da',
  fontSize: '16px',
  lineHeight: 1.2
});

export const editorBoundaryErrorBanner = {
  padding: '0.75rem 1rem',
  color: 'crimson',
  background: '#fff2f2',
  border: '1px solid #f5c2c7'
};

export const editorBoundaryRetryButton = {
  marginLeft: '0.5rem'
};

export const commentWidgetWrapCssText = `
  margin: 6px 0 10px 0;
  padding: 8px 12px;
  background: #fff8dc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  color: #333;
  word-break: break-word;
`;

export const commentWidgetRowStyle = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '6px'
};

export const commentWidgetAliasStyle = {
  fontWeight: '600',
  color: '#333'
};

export const commentWidgetTimeStyle = {
  color: '#555',
  fontSize: '12px'
};

export const commentWidgetDashStyle = {
  color: '#666'
};

export const commentWidgetTextStyle = {
  color: '#333'
};

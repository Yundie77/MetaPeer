export const panelStyle = {
  border: '1px solid #dadada',
  borderRadius: '8px',
  padding: '1rem',
  background: '#fff'
};

export const reviewsLayout = {
  display: 'flex',
  gap: '1rem',
  alignItems: 'flex-start'
};

export const taskListStyle = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  width: '240px',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem'
};

export const taskButtonStyle = (active) => ({
  width: '100%',
  padding: '0.6rem 0.75rem',
  borderRadius: '6px',
  border: active ? '2px solid #0b74de' : '1px solid #d0d0d0',
  background: active ? '#eaf2ff' : '#f8f8f8',
  cursor: 'pointer',
  textAlign: 'left'
});

export const reviewFormStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
};

export const reviewRightColumn = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
};

export const rubricFieldStyle = {
  display: 'flex',
  flexDirection: 'column'
};

export const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontWeight: 600
};

export const inputStyle = {
  padding: '0.5rem 0.65rem',
  borderRadius: '4px',
  border: '1px solid #ccc'
};

export const buttonStyle = {
  padding: '0.6rem 0.9rem',
  background: '#0b74de',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 600
};

export const errorStyle = {
  color: 'crimson'
};

export const successStyle = {
  color: '#1f7a1f'
};

export const listStyle = {
  listStyle: 'none',
  padding: 0,
  margin: '1.5rem 0',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
};

export const metaCardStyle = {
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  padding: '1rem',
  background: '#fafafa',
  display: 'flex',
  gap: '1rem',
  justifyContent: 'space-between'
};

export const metaInfoStyle = {
  fontSize: '0.85rem',
  color: '#666'
};

export const viewerCard = {
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  padding: '0.75rem',
  background: '#fdfdfd',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem'
};

export const viewerHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

export const viewerGrid = {
  display: 'grid',
  gridTemplateColumns: '280px 1fr',
  gap: '1rem'
};

export const viewerSidebar = {
  border: '1px solid #e5e5e5',
  borderRadius: '6px',
  padding: '0.5rem',
  maxHeight: '520px',
  overflowY: 'auto',
  background: '#fff'
};

export const viewerContent = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem'
};

export const anchorBar = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap',
  alignItems: 'center'
};

export const anchorButton = {
  border: '1px solid #0b74de',
  background: 'transparent',
  color: '#0b74de',
  borderRadius: '999px',
  padding: '0.2rem 0.6rem',
  cursor: 'pointer',
  fontSize: '0.85rem'
};

export const binaryWarning = {
  padding: '1rem',
  border: '1px dashed #d97706',
  borderRadius: '6px',
  background: '#fff7ed',
  color: '#92400e'
};

export const linkButton = {
  border: '1px solid #0b74de',
  borderRadius: '4px',
  padding: '0.35rem 0.75rem',
  color: '#0b74de',
  background: '#fff',
  fontWeight: 600,
  cursor: 'pointer'
};

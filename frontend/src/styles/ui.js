export const tokens = {
  colors: {
    brand: '#0b74de',
    brandAlt: '#2563eb',
    brandDark: '#1e3a8a',
    white: '#fff',
    black: '#000',
    text: '#333',
    textMuted: '#555',
    textMutedSoft: '#666',
    textSubtle: '#64748b',
    border: '#ccc',
    borderStrong: '#d0d0d0',
    borderSoft: '#e0e0e0',
    borderSubtle: '#e5e7eb',
    borderTable: '#d1d5db',
    borderTableSoft: '#eef2f7',
    surface: '#fff',
    surfaceMuted: '#fafafa',
    surfaceSoft: '#f8fafc',
    danger: 'crimson',
    success: '#0f7b0f',
    successAlt: '#1f7a1f'
  },
  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '10px',
    pill: '999px'
  },
  space: {
    xs: '0.35rem',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem'
  },
  shadow: {
    sm: '0 2px 6px rgba(0,0,0,0.05)',
    md: '0 4px 16px rgba(0,0,0,0.08)',
    modal: '0 10px 30px rgba(0,0,0,0.15)',
    modalStrong: '0 12px 30px rgba(0,0,0,0.2)'
  },
  fontSizes: {
    xs: '0.78rem',
    sm: '0.85rem',
    md: '0.9rem'
  },
  zIndex: {
    overlay: 30,
    overlayHigh: 1000
  }
};

export const compose = (...styles) => Object.assign({}, ...styles.filter(Boolean));

export const helpers = {
  row: (gap = tokens.space.sm, alignItems = 'center') => ({
    display: 'flex',
    gap,
    alignItems
  }),
  rowWrap: (gap = tokens.space.sm, alignItems = 'center') => ({
    display: 'flex',
    gap,
    alignItems,
    flexWrap: 'wrap'
  }),
  betweenRow: (gap = tokens.space.sm, alignItems = 'center') => ({
    display: 'flex',
    gap,
    alignItems,
    justifyContent: 'space-between'
  }),
  column: (gap = tokens.space.sm) => ({
    display: 'flex',
    flexDirection: 'column',
    gap
  }),
  gridAutoFit: (minWidth = 220, gap = tokens.space.lg) => ({
    display: 'grid',
    gap,
    gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`
  })
};

export const text = {
  muted: {
    color: tokens.colors.textMuted
  },
  meta: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.textMutedSoft
  },
  error: {
    color: tokens.colors.danger
  },
  success: {
    color: tokens.colors.success
  },
  successAlt: {
    color: tokens.colors.successAlt
  },
  caption: {
    color: tokens.colors.textMuted,
    fontSize: tokens.fontSizes.md
  }
};

export const forms = {
  label: {
    display: 'flex',
    flexDirection: 'column',
    fontWeight: 600,
    gap: tokens.space.xs
  },
  input: {
    padding: '0.5rem 0.65rem',
    borderRadius: tokens.radius.xs,
    border: `1px solid ${tokens.colors.border}`
  },
  textarea: {
    padding: '0.5rem 0.65rem',
    borderRadius: tokens.radius.xs,
    border: `1px solid ${tokens.colors.border}`,
    resize: 'vertical',
    fontFamily: 'inherit'
  },
  select: {
    padding: '0.5rem 0.65rem',
    borderRadius: tokens.radius.xs,
    border: `1px solid ${tokens.colors.border}`,
    background: tokens.colors.white
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: tokens.space.lg,
    flexWrap: 'wrap'
  },
  formStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.space.lg
  },
  formGrid: helpers.gridAutoFit(220)
};

export const buttons = {
  primary: {
    padding: '0.6rem 0.9rem',
    background: tokens.colors.brand,
    color: tokens.colors.white,
    border: 'none',
    borderRadius: tokens.radius.xs,
    cursor: 'pointer',
    fontWeight: 600
  },
  primaryNarrow: {
    padding: '0.6rem 0.3rem',
    background: tokens.colors.brand,
    color: tokens.colors.white,
    border: 'none',
    borderRadius: tokens.radius.xs,
    cursor: 'pointer',
    fontWeight: 600
  },
  secondary: {
    padding: '0.4rem 0.75rem',
    background: tokens.colors.brandAlt,
    color: tokens.colors.white,
    border: 'none',
    borderRadius: tokens.radius.xs,
    cursor: 'pointer'
  },
  muted: {
    padding: '0.4rem 0.75rem',
    background: '#4b5563',
    color: tokens.colors.white,
    border: 'none',
    borderRadius: tokens.radius.xs,
    cursor: 'pointer'
  },
  ghost: {
    background: 'transparent',
    border: '1px solid #d0d7de',
    color: '#1f2328',
    padding: '0.3rem 0.6rem',
    borderRadius: tokens.radius.xs,
    cursor: 'pointer'
  },
  outlineBrandSoft: {
    background: '#f0f4ff',
    border: `1px solid ${tokens.colors.brand}`,
    color: tokens.colors.brand,
    padding: '0.4rem 0.7rem',
    borderRadius: tokens.radius.xs,
    cursor: 'pointer',
    fontWeight: 600
  },
  linkText: {
    background: 'transparent',
    border: 'none',
    color: tokens.colors.brand,
    fontWeight: 700,
    cursor: 'pointer'
  },
  pill: {
    border: '1px solid #2563eb',
    background: '#eff6ff',
    color: '#1e3a8a',
    borderRadius: tokens.radius.pill,
    padding: '0.2rem 0.6rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer'
  },
  pillActive: {
    border: '1px solid #1d4ed8',
    background: '#dbeafe',
    color: '#1e3a8a',
    borderRadius: tokens.radius.pill,
    padding: '0.2rem 0.6rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer'
  },
  linkPill: {
    background: '#eef2ff',
    color: '#1e3a8a',
    padding: '0.2rem 0.6rem',
    borderRadius: tokens.radius.pill,
    fontSize: '0.8rem',
    border: '1px solid #c7d2fe',
    textDecoration: 'none',
    fontWeight: 600
  },
  danger: {
    background: '#b91c1c',
    border: '1px solid #7f1d1d',
    color: tokens.colors.white,
    padding: '0.4rem 0.7rem',
    borderRadius: tokens.radius.xs,
    cursor: 'pointer',
    fontWeight: 700
  },
  neutral: {
    background: tokens.colors.white,
    border: '1px solid #9ca3af',
    color: '#374151',
    padding: '0.4rem 0.7rem',
    borderRadius: tokens.radius.xs,
    cursor: 'pointer',
    fontWeight: 600
  }
};

export const surfaces = {
  card: {
    border: `1px solid ${tokens.colors.borderSoft}`,
    borderRadius: tokens.radius.md,
    padding: tokens.space.lg,
    background: tokens.colors.surface
  },
  cardMuted: {
    border: `1px solid ${tokens.colors.borderStrong}`,
    borderRadius: tokens.radius.sm,
    padding: '0.6rem',
    background: tokens.colors.surfaceMuted
  },
  panel: {
    border: '1px solid #dadada',
    borderRadius: tokens.radius.md,
    padding: tokens.space.lg,
    background: tokens.colors.surface,
    width: '100%',
    boxSizing: 'border-box'
  },
  panelMuted: {
    padding: tokens.space.lg,
    borderRadius: tokens.radius.md,
    border: `1px solid ${tokens.colors.borderStrong}`,
    background: tokens.colors.surfaceMuted
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.35)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '3vh 1rem',
    zIndex: tokens.zIndex.overlay
  },
  modalContent: {
    background: tokens.colors.surface,
    borderRadius: tokens.radius.lg,
    padding: tokens.space.lg,
    width: 'min(1100px, 100%)',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: tokens.shadow.modal,
    border: `1px solid ${tokens.colors.borderSubtle}`
  },
  sectionHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap'
  }
};

export const lists = {
  stackList: {
    listStyle: 'none',
    padding: 0,
    margin: '1.5rem 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  },
  denseList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  statusListBase: {
    listStyle: 'none',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  statusItem: {
    padding: '0.75rem',
    borderRadius: tokens.radius.md,
    border: `1px solid ${tokens.colors.borderSubtle}`,
    background: tokens.colors.surface,
    display: 'flex',
    gap: '1rem',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap'
  }
};

export const badges = {
  statusBase: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    borderRadius: tokens.radius.pill,
    padding: '0.2rem 0.6rem',
    fontSize: '0.78rem',
    fontWeight: 700
  },
  pending: {
    background: '#fef3c7',
    color: '#92400e',
    border: '1px solid #f59e0b'
  },
  submitted: {
    background: '#dbeafe',
    color: '#1e40af',
    border: '1px solid #60a5fa'
  },
  graded: {
    background: '#dcfce7',
    color: '#166534',
    border: '1px solid #22c55e'
  },
  warning: {
    background: '#fff7ed',
    color: '#92400e',
    border: '1px solid #d97706'
  },
  info: {
    background: '#eff6ff',
    color: '#1e3a8a',
    border: '1px solid #2563eb'
  }
};

export const tables = {
  wrap: {
    overflowX: 'auto',
    border: `1px solid ${tokens.colors.borderTable}`,
    borderRadius: tokens.radius.sm,
    background: tokens.colors.surface
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  headerCell: {
    textAlign: 'left',
    padding: '0.5rem 0.6rem',
    borderBottom: `1px solid ${tokens.colors.borderTable}`,
    fontSize: tokens.fontSizes.md
  },
  bodyCell: {
    padding: '0.5rem 0.6rem',
    borderBottom: `1px solid ${tokens.colors.borderTableSoft}`,
    fontSize: tokens.fontSizes.md
  },
  headerRow: surfaces.sectionHeaderRow,
  toolbarRow: helpers.rowWrap('0.75rem')
};

export const feedback = {
  errorText: text.error,
  successText: text.success,
  successTextAlt: text.successAlt,
  miniMeta: text.meta
};

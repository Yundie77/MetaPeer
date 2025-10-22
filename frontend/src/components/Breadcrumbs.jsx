import React, { useMemo } from 'react';

// Breadcrumbs sencillos tipo GitHub.
// "repo / carpeta / sub / archivo.ext"
// Cada segmento es clicable para navegar al directorio correspondiente.

export default function Breadcrumbs({ path = '', onNavigate }) {
  const parts = useMemo(() => {
    const clean = (path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    return clean ? clean.split('/') : [];
  }, [path]);

  const segments = useMemo(() => {
    const acc = [];
    let current = '';
    parts.forEach((p) => {
      current = current ? `${current}/${p}` : p;
      acc.push({ name: p, path: current });
    });
    return acc;
  }, [parts]);

  const go = (segPath) => onNavigate && onNavigate(segPath);

  return (
    <div style={wrap}>
      <button type="button" style={crumbBtn} onClick={() => go('')} title="Ir a raíz">repo</button>
      {segments.map((seg, i) => (
        <React.Fragment key={seg.path}>
          <span style={sep}>/</span>
          <button
            type="button"
            style={crumbBtn}
            onClick={() => go(seg.path)}
            title={seg.path}
          >
            {seg.name}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

const wrap = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.5rem 0.75rem',
  border: '1px solid #ddd',
  borderRadius: '6px 6px 0 0',
  backgroundColor: '#f5f7fb',
  color: '#1a1a1a',
  overflow: 'auto'
};

const sep = { color: '#777' };

const crumbBtn = {
  border: 'none',
  background: 'transparent',
  color: '#0366d6',
  cursor: 'pointer',
  padding: 0,
  fontSize: '0.95rem'
};


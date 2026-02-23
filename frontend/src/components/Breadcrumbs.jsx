import React, { useMemo } from 'react';
import { breadcrumbsButton, breadcrumbsSep, breadcrumbsWrap } from './stylesFileViewer.js';

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
    <div style={breadcrumbsWrap}>
      <button type="button" style={breadcrumbsButton} onClick={() => go('')} title="Ir a raíz">repo</button>
      {segments.map((seg, i) => (
        <React.Fragment key={seg.path}>
          <span style={breadcrumbsSep}>/</span>
          <button
            type="button"
            style={breadcrumbsButton}
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



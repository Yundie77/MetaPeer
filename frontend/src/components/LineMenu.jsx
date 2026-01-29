import React, { useState } from 'react';

// Menú flotante muy simple para una línea: Copy, Permalink, Add comment
// Aparece en una posición absoluta dentro del contenedor del editor.

export default function LineMenu({
  visible,
  x,
  y,
  line,
  onCopyLine,
  onCopyPermalink,
  onAddComment,
  onClose,
  allowComment = true
}) {
  const [comment, setComment] = useState('');

  React.useEffect(() => {
    if (visible) {
      setComment('');
    }
  }, [visible, line]);

  if (!visible) return null;

  const add = () => {
    if (!comment.trim()) return;
    onAddComment && onAddComment(comment.trim());
    setComment('');
    onClose && onClose();
  };

  return (
    <div style={{ ...menuStyle, left: x, top: y }}>
      <div style={row}>
        <button type="button" style={btn} onClick={onCopyLine}>Copiar línea</button>
      </div>
      <div style={row}>
        <button type="button" style={btn} onClick={onCopyPermalink}>Copiar enlace</button>
      </div>
      {allowComment && (
        <div style={{ ...row, alignItems: 'stretch', gap: '0.4rem' }}>
          <input
            placeholder={`Comentario en la línea ${line}`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={input}
          />
          <button type="button" style={btnPrimary} onClick={add}>Agregar</button>
        </div>
      )}
    </div>
  );
}

const menuStyle = {
  position: 'absolute',
  zIndex: 30,
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 6,
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  padding: '0.5rem',
  minWidth: 200
};

const row = { display: 'flex', alignItems: 'center', marginBottom: '0.4rem' };
const btn = { border: '1px solid #ddd', background: '#f6f8fa', padding: '0.25rem 0.5rem', borderRadius: 4, cursor: 'pointer' };
const btnPrimary = { ...btn, background: '#2ea44f', color: '#fff', borderColor: '#2ea44f' };
const input = { flex: 1, padding: '0.25rem 0.4rem', border: '1px solid #ccc', borderRadius: 4 };

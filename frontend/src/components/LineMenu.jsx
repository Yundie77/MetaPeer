import React, { useState } from 'react';
import {
  lineMenuAt,
  lineMenuButton,
  lineMenuCommentRow,
  lineMenuInput,
  lineMenuPrimaryButton,
  lineMenuRow
} from './stylesFileViewer.js';

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
    <div style={lineMenuAt(x, y)}>
      <div style={lineMenuRow}>
        <button type="button" style={lineMenuButton} onClick={onCopyLine}>Copiar línea</button>
      </div>
      <div style={lineMenuRow}>
        <button type="button" style={lineMenuButton} onClick={onCopyPermalink}>Copiar enlace</button>
      </div>
      {allowComment && (
        <div style={lineMenuCommentRow}>
          <input
            placeholder={`Comentario en la línea ${line}`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={lineMenuInput}
          />
          <button type="button" style={lineMenuPrimaryButton} onClick={add}>Agregar</button>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, Decoration, ViewPlugin } from '@codemirror/view';
import { StateField, Compartment } from '@codemirror/state';
import { lineNumbers } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import LineMenu from './LineMenu.jsx';
import { buildPermalink } from '../utils/permalink.js';

// Editor de solo lectura con:
// - números de línea
// - scroll y resaltado de línea
// - menú de línea y comentarios en memoria

export default function EditorPane({
  path,
  code,
  height, // CSS height (e.g., '100%')
  initialLine = 0,
  commentsByLine = new Map(), // Map<number, string[]>
  onAddComment // (line, text) => void
}) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);

  // Estado para el botón "..." en el gutter y el menú.
  const [hoverLine, setHoverLine] = useState(null);
  const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, line: 0 });

  // Compartimentos para reconfigurar extensiones dinámicamente (persisten entre renders)
  const commentsCompartmentRef = useRef(new Compartment());
  const highlightCompartmentRef = useRef(new Compartment());

  // Construye decoración de comentarios (widgets bajo líneas y marker en gutter)
  const commentsExtension = useMemo(() => buildCommentsExtension(commentsByLine), [commentsByLine]);

  // Resalte temporal de una línea (cuando venimos de permalink)
  const highlightExtension = useMemo(() => buildHighlightExtension(initialLine), [initialLine]);

  // Manejar hover sobre gutter para mostrar el botón "..."
  useEffect(() => {
    const container = containerRef.current;
    const view = viewRef.current;
    if (!container || !view) return;

    const onMouseMove = (e) => {
      const rect = view.dom.getBoundingClientRect();
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (!pos) {
        setHoverLine(null);
        return;
      }
      const line = view.state.doc.lineAt(pos.pos).number;
      // Solo mostrar si el cursor está sobre el gutter (aproximación: x < rect.left + 60)
      const inGutter = e.clientX < rect.left + 60;
      setHoverLine(inGutter ? line : null);
    };
    const onMouseLeave = () => setHoverLine(null);
    view.dom.addEventListener('mousemove', onMouseMove);
    view.dom.addEventListener('mouseleave', onMouseLeave);
    return () => {
      view.dom.removeEventListener('mousemove', onMouseMove);
      view.dom.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  // Al montar/actualizar CodeMirror, inyectamos compartimentos dinámicos.
  const extensions = useMemo(() => [
    lineNumbers(),
    EditorView.editable.of(false),
    javascript(),
    commentsCompartmentRef.current.of(commentsExtension),
    highlightCompartmentRef.current.of(highlightExtension),
    EditorView.theme({
      '.cm-scroller': { fontFamily: 'Consolas, SFMono-Regular, Menlo, monospace' }
    }),
  ], [commentsExtension, highlightExtension]);

  // Cada vez que commentsExtension o highlight cambia, reconfiguramos.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: commentsCompartmentRef.current.reconfigure(commentsExtension) });
  }, [commentsExtension]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: highlightCompartmentRef.current.reconfigure(highlightExtension) });
    if (initialLine > 0) {
      const line = view.state.doc.line(initialLine);
      view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: 'center' }) });
    }
  }, [highlightExtension, initialLine]);

  // Posicionar el botón "..." al lado del número de línea (absoluto dentro del contenedor).
  const moreBtn = useMemo(() => {
    if (!hoverLine || !viewRef.current) return null;
    const view = viewRef.current;
    const block = view.lineBlockAt(view.state.doc.line(hoverLine).from);
    const rect = view.coordsAtPos(block.from);
    if (!rect) return null;
    const containerRect = containerRef.current.getBoundingClientRect();
    const x = 8; // margen desde el borde izquierdo del editor
    const y = rect.top - containerRect.top;
    return { x, y };
  }, [hoverLine]);

  // Acciones del menú
  const openMenu = (line) => {
    const pos = calcLineTop(viewRef.current, containerRef.current, line);
    if (!pos) return;
    setMenu({ visible: true, x: 24, y: pos.y, line });
  };
  const closeMenu = () => setMenu((m) => ({ ...m, visible: false }));

  const copyLine = async () => {
    const view = viewRef.current;
    if (!view || !menu.line) return;
    const ln = view.state.doc.line(menu.line);
    await navigator.clipboard.writeText(ln.text);
    closeMenu();
  };

  const copyPermalink = async () => {
    const url = buildPermalink({ path, line: menu.line });
    await navigator.clipboard.writeText(url);
    closeMenu();
  };

  const addComment = (text) => {
    onAddComment && onAddComment(menu.line, text);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', height, display: 'flex', border: '1px solid #ddd', borderTop: 'none', borderRadius: '0 0 6px 6px', background: '#fafafa' }}>
      {/* Botón de menú sobre el gutter, aparece al pasar el ratón */}
      {moreBtn && (
        <button
          type="button"
          onClick={() => openMenu(hoverLine)}
          style={{ position: 'absolute', left: moreBtn.x, top: moreBtn.y, zIndex: 20, border: '1px solid #ddd', borderRadius: 4, background: '#f6f8fa', cursor: 'pointer', padding: '0 6px' }}
          title="Más acciones de línea"
        >
          …
        </button>
      )}

      {/* Editor CodeMirror */}
      <div style={{ flex: 1 }}>
        <CodeMirror
          value={code}
          height={height}
          extensions={extensions}
          editable={false}
          basicSetup={{ highlightActiveLine: false, highlightActiveLineGutter: false }}
          onCreateEditor={(view) => { viewRef.current = view; }}
        />
      </div>

      {/* Menú contextual */}
      <LineMenu
        visible={menu.visible}
        x={menu.x}
        y={menu.y}
        line={menu.line}
        onCopyLine={copyLine}
        onCopyPermalink={copyPermalink}
        onAddComment={addComment}
        onClose={closeMenu}
      />
    </div>
  );
}

// Utilidad: coordenada Y superior de la línea en el contenedor
function calcLineTop(view, container, line) {
  if (!view || !container) return null;
  const from = view.state.doc.line(line).from;
  const rect = view.coordsAtPos(from);
  if (!rect) return null;
  const c = container.getBoundingClientRect();
  return { y: rect.top - c.top };
}

// Construye una extensión para pintar widgets de comentarios bajo líneas
function buildCommentsExtension(commentsByLine) {
  // Construye un DecorationSet con widgets bajo las líneas comentadas.
  const field = StateField.define({
    create(state) {
      const widgets = [];
      commentsByLine.forEach((list, line) => {
        if (!Array.isArray(list) || list.length === 0) return;
        const ln = state.doc.line(Number(line) || 0);
        const deco = Decoration.widget({
          side: 1,
          block: true,
          widget: {
            toDOM() {
              const wrap = document.createElement('div');
              wrap.style.cssText = 'margin:2px 0 6px 0;padding:6px 8px;border:1px solid #e5e7eb;border-radius:6px;background:#fff6d8;color:#333;font-size:0.9rem;';
              list.forEach((txt) => {
                const p = document.createElement('div');
                p.textContent = `💬 ${txt}`;
                wrap.appendChild(p);
              });
              return wrap;
            }
          }
        }).range(ln.to);
        widgets.push(deco);
      });
      return Decoration.set(widgets, true);
    },
    update(set, tr) {
      // Documento no cambia (solo lectura). Mantener set.
      return set;
    },
    provide: (f) => EditorView.decorations.from(f)
  });
  return [field];
}

// Extensión para resaltar una línea (temporal): añade una clase a la línea
function buildHighlightExtension(lineNumber) {
  if (!lineNumber || lineNumber <= 0) return [];
  const decoField = StateField.define({
    create(state) {
      const line = state.doc.line(lineNumber);
      const deco = Decoration.line({ attributes: { class: 'cm-highlight-line' } }).range(line.from);
      return Decoration.set([deco]);
    },
    update(set, tr) {
      return set;
    },
    provide: (f) => EditorView.decorations.from(f)
  });

  const theme = EditorView.theme({
    '.cm-highlight-line': { backgroundColor: 'rgba(255, 235, 59, 0.35)' }
  });

  // Quitar el resaltado tras 2.5s usando un plugin que lo limpia (visual)
  // Resaltado simple; dejamos la marca y hacemos scroll al centro.
  return [decoField, theme];
}

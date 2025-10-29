import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, lineNumbers, Decoration } from '@codemirror/view';
import { Compartment, StateField } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import LineMenu from './LineMenu.jsx';
import { buildPermalink } from '../utils/permalink.js';

// Pequeño editor de solo lectura inspirado en GitHub.
// Funciona así:
// 1. Click en el número de línea -> resalta la línea y aparece el botón "...".
// 2. Click en "..." -> abre un menú con Copy line / Copy permalink / Add comment.
// 3. Los comentarios se guardan en memoria y se muestran debajo de la línea.

// Tema básico del editor (fuente mono y cuidado con los números de línea).
const baseTheme = EditorView.theme({
  '.cm-scroller': {
    fontFamily: 'Consolas, SFMono-Regular, Menlo, monospace',
    fontSize: '14px'
  },
  '.cm-lineNumbers': {
    cursor: 'pointer',
    userSelect: 'none',
    minWidth: '48px',
    paddingRight: '8px',
    color: '#57606a'
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 4px',
    textAlign: 'right'
  },
  '.cm-lineNumbers .cm-gutterElement:hover': {
    backgroundColor: '#f6f8fa'
  },
  '.codex-highlight-line': {
    backgroundColor: '#fff8c5'
  }
});

export default function EditorPane({
  path,
  code,
  height,
  initialLine = 0,
  commentsByLine = new Map(),
  onAddComment
}) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);

  // Compartimentos para intercambiar extensiones dinámicas (resaltado + comentarios).
  const highlightCompartmentRef = useRef(new Compartment());
  const commentsCompartmentRef = useRef(new Compartment());

  const [editorReady, setEditorReady] = useState(false);
  const [selectedLine, setSelectedLine] = useState(initialLine || 0);
  const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, line: 0 });

  // Siempre que cambiamos de archivo o llega un permalink nuevo, sincronizamos el estado.
  useEffect(() => {
    setSelectedLine(initialLine || 0);
    setMenu({ visible: false, x: 0, y: 0, line: 0 });
  }, [initialLine, code, path]);

  // Construimos extensiones dependientes del estado.
  const highlightExtension = useMemo(
    () => buildHighlightExtension(selectedLine),
    [selectedLine]
  );

  const commentsExtension = useMemo(
    () => buildCommentsExtension(commentsByLine),
    [commentsByLine]
  );

  // Reconfiguramos el resaltado cuando cambia la línea seleccionada.
  useEffect(() => {
    if (!editorReady || !viewRef.current) return;
    viewRef.current.dispatch({
      effects: highlightCompartmentRef.current.reconfigure(highlightExtension)
    });
  }, [highlightExtension, editorReady]);

  // Reconfiguramos los comentarios cuando cambian.
  useEffect(() => {
    if (!editorReady || !viewRef.current) return;
    viewRef.current.dispatch({
      effects: commentsCompartmentRef.current.reconfigure(commentsExtension)
    });
  }, [commentsExtension, editorReady]);

  // Al seleccionar una línea la llevamos suavemente al centro.
  useEffect(() => {
    if (!editorReady || !viewRef.current || !selectedLine) return;
    try {
      const line = viewRef.current.state.doc.line(selectedLine);
      viewRef.current.dispatch({
        effects: EditorView.scrollIntoView(line.from, { y: 'center' })
      });
    } catch (error) {
      console.warn('No se pudo desplazar a la línea seleccionada', error);
    }
  }, [selectedLine, editorReady]);

  // Maneja el click en el número de línea.
  const onGutterMouseDown = useCallback((event) => {
    const target = event.target instanceof Element
      ? event.target.closest('.cm-lineNumbers .cm-gutterElement')
      : null;
    if (!target) {
      return;
    }

    event.preventDefault();
    const lineNum = Number(target.textContent?.trim() || 0);
    if (!lineNum) {
      return;
    }

    setSelectedLine(lineNum);
    setMenu({ visible: false, x: 0, y: 0, line: 0 });
  }, []);

  // Registramos el listener una vez que el editor está listo.
  useEffect(() => {
    if (!editorReady || !viewRef.current) return;
    const view = viewRef.current;
    view.dom.addEventListener('mousedown', onGutterMouseDown);
    return () => view.dom.removeEventListener('mousedown', onGutterMouseDown);
  }, [editorReady, onGutterMouseDown]);

  // Abre el menú "..." para una línea concreta.
  const openMenuForLine = (lineNum) => {
    if (!viewRef.current || !containerRef.current) return;
    const view = viewRef.current;
    const container = containerRef.current;

    try {
      const line = view.state.doc.line(lineNum);
      const coords = view.coordsAtPos(line.from);
      if (!coords) return;

      const containerRect = container.getBoundingClientRect();
      const gutterRect = view.dom.querySelector('.cm-gutters')?.getBoundingClientRect();
      const x = gutterRect ? gutterRect.right - containerRect.left + 8 : 60;
      const y = coords.top - containerRect.top;

      setSelectedLine(lineNum);
      setMenu({ visible: true, x, y, line: lineNum });
    } catch (error) {
      console.warn('No se pudo abrir el menú para la línea', lineNum, error);
    }
  };

  // Acciones del menú principal.
  const closeMenu = () => setMenu((prev) => ({ ...prev, visible: false }));

  const copyLine = async () => {
    if (!viewRef.current || !menu.line) return;
    const line = viewRef.current.state.doc.line(menu.line);
    await navigator.clipboard.writeText(line.text);
    closeMenu();
  };

  const copyPermalink = async () => {
    if (!menu.line) return;
    const url = buildPermalink({ path, line: menu.line });
    await navigator.clipboard.writeText(url);
    closeMenu();
  };

  const addComment = (text) => {
    if (onAddComment && menu.line) {
      onAddComment(menu.line, text);
    }
  };

  // Extensiones estáticas (se crean una vez).
  const staticExtensions = useMemo(() => (
    [
      javascript(),
      EditorView.editable.of(false),
      lineNumbers(),
      baseTheme,
      highlightCompartmentRef.current.of([]),
      commentsCompartmentRef.current.of([])
    ]
  ), []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        height,
        border: '1px solid #ddd',
        borderTop: 'none',
        borderRadius: '0 0 6px 6px',
        overflow: 'hidden',
        background: '#fafafa'
      }}
    >
      <CodeMirror
        value={code}
        height={height}
        extensions={staticExtensions}
        editable={false}
        basicSetup={{
          lineNumbers: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false
        }}
        onCreateEditor={(view) => {
          viewRef.current = view;
          setEditorReady(true);
          // Aplicamos la configuración inicial.
          view.dispatch({
            effects: [
              highlightCompartmentRef.current.reconfigure(highlightExtension),
              commentsCompartmentRef.current.reconfigure(commentsExtension)
            ]
          });
        }}
      />

      {/* Botón "..." alineado con la línea activa */}
      {editorReady && selectedLine > 0 && viewRef.current && containerRef.current && (() => {
        try {
          const view = viewRef.current;
          const line = view.state.doc.line(selectedLine);
          const coords = view.coordsAtPos(line.from);
          if (!coords) return null;

          const containerRect = containerRef.current.getBoundingClientRect();
          const gutterRect = view.dom.querySelector('.cm-gutters')?.getBoundingClientRect();
          if (!gutterRect) return null;

          const left = gutterRect.right - containerRect.left + 4;
          const top = coords.top - containerRect.top;

          return (
            <button
              type="button"
              onClick={() => openMenuForLine(selectedLine)}
              style={{
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
              }}
              title="Acciones de línea"
            >
              …
            </button>
          );
        } catch (error) {
          console.warn('No se pudo posicionar el botón de acciones', error);
          return null;
        }
      })()}

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

// ----- Extensiones auxiliares -----

function buildHighlightExtension(lineNumber) {
  if (!lineNumber || lineNumber <= 0) {
    return [];
  }

  const field = StateField.define({
    create(state) {
      try {
        const line = state.doc.line(lineNumber);
        const deco = Decoration.line({ attributes: { class: 'codex-highlight-line' } }).range(line.from);
        return Decoration.set([deco]);
      } catch (error) {
        return Decoration.none;
      }
    },
    update(value) {
      return value;
    },
    provide: (f) => EditorView.decorations.from(f)
  });

  return [field];
}

function buildCommentsExtension(commentsByLine) {
  if (!commentsByLine || commentsByLine.size === 0) {
    return [];
  }

  const field = StateField.define({
    create(state) {
      const widgets = [];

      commentsByLine.forEach((comments, key) => {
        const lineNum = Number(key);
        if (!Array.isArray(comments) || comments.length === 0 || !lineNum) {
          return;
        }

        try {
          const line = state.doc.line(lineNum);
          const widget = Decoration.widget({
            block: true,
            side: 1,
            widget: new CommentWidget(comments)
          }).range(line.to);
          widgets.push(widget);
        } catch (error) {
          console.warn('Comentario inválido en la línea', key, error);
        }
      });

      return Decoration.set(widgets, true);
    },
    update(value) {
      return value;
    },
    provide: (f) => EditorView.decorations.from(f)
  });

  return [field];
}

class CommentWidget {
  constructor(comments) {
    this.comments = comments;
  }

  toDOM() {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
      margin: 6px 0 10px 0;
      padding: 8px 12px;
      background: #fff8dc;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      font-size: 13px;
      color: #333;
    `;

    this.comments.forEach((text) => {
      const comment = document.createElement('div');
      comment.textContent = `💬 ${text}`;
      comment.style.marginBottom = '4px';
      wrap.appendChild(comment);
    });

    return wrap;
  }
}


import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, lineNumbers, Decoration, WidgetType } from '@codemirror/view';
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
  onAddComment,
  revisionId
}) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const pendingLineRef = useRef(Number(initialLine) || 0);

  const highlightCompartmentRef = useRef(new Compartment());
  const commentsCompartmentRef = useRef(new Compartment());

  const [editorReady, setEditorReady] = useState(false);
  const [selectedLine, setSelectedLine] = useState(0);
  const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, line: 0 });
  const [renderError, setRenderError] = useState('');

  const setSelectedLineSafe = useCallback((lineNumber) => {
    const parsed = Number(lineNumber);
    const safeLine = Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
    pendingLineRef.current = safeLine;
    setSelectedLine(safeLine);
  }, []);

  useEffect(() => {
    const safeLine = Number(initialLine) || 0;
    pendingLineRef.current = safeLine;
    setSelectedLine(0);
    setMenu({ visible: false, x: 0, y: 0, line: 0 });
    if (renderError) {
      setRenderError('');
    }
  }, [initialLine, code, path, renderError]);

  useEffect(() => {
    if (!editorReady || !viewRef.current || renderError) return;
    const doc = viewRef.current.state?.doc;
    if (!doc) return;
    const target = pendingLineRef.current;
    const isValidTarget = Number.isFinite(target) && target > 0 && target <= doc.lines;
    const nextLine = isValidTarget ? target : 0;
    if (nextLine === selectedLine) return;
    const raf = requestAnimationFrame(() => setSelectedLineSafe(nextLine));
    return () => cancelAnimationFrame(raf);
  }, [editorReady, code, path, initialLine, selectedLine, renderError, setSelectedLineSafe]);

  const highlightExtension = useMemo(
    () => buildHighlightExtension(selectedLine),
    [selectedLine]
  );

  const commentsExtension = useMemo(
    () => buildCommentsExtension(commentsByLine),
    [commentsByLine]
  );

  useEffect(() => {
    if (!editorReady || !viewRef.current || renderError) return;
    try {
      viewRef.current.dispatch({
        effects: highlightCompartmentRef.current.reconfigure(highlightExtension)
      });
    } catch (error) {
      setRenderError(error.message || 'No se pudo resaltar la línea.');
    }
  }, [highlightExtension, editorReady, renderError]);

  useEffect(() => {
    if (!editorReady || !viewRef.current || renderError) return;
    try {
      viewRef.current.dispatch({
        effects: commentsCompartmentRef.current.reconfigure(commentsExtension)
      });
    } catch (error) {
      setRenderError(error.message || 'No se pudieron mostrar los comentarios.');
    }
  }, [commentsExtension, editorReady, renderError]);

  useEffect(() => {
    if (!editorReady || !viewRef.current || !selectedLine || renderError) return;
    const timer = setTimeout(() => {
      try {
        const doc = viewRef.current.state.doc;
        const line = getValidLine(doc, selectedLine);
        if (!line) return;
        viewRef.current.dispatch({
          effects: EditorView.scrollIntoView(line.from, { y: 'center' })
        });
      } catch (error) {
        console.warn('No se pudo desplazar a la línea seleccionada', error);
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [selectedLine, editorReady, renderError]);

  const onGutterMouseDown = useCallback((event) => {
    const target = event.target instanceof Element
      ? event.target.closest('.cm-lineNumbers .cm-gutterElement')
      : null;
    if (!target) return;
    event.preventDefault();
    const lineNum = Number(target.textContent?.trim() || 0);
    const doc = viewRef.current?.state?.doc;
    if (!lineNum || !getValidLine(doc, lineNum)) return;
    setSelectedLineSafe(lineNum);
    setMenu({ visible: false, x: 0, y: 0, line: 0 });
  }, [setSelectedLineSafe]);

  useEffect(() => {
    if (!editorReady || !viewRef.current || renderError) return;
    const view = viewRef.current;
    view.dom.addEventListener('mousedown', onGutterMouseDown);
    return () => view.dom.removeEventListener('mousedown', onGutterMouseDown);
  }, [editorReady, onGutterMouseDown, renderError]);

  const openMenuForLine = (lineNum) => {
    if (!viewRef.current || !containerRef.current) return;
    const view = viewRef.current;
    const container = containerRef.current;
    try {
      const doc = view.state.doc;
      const line = getValidLine(doc, lineNum);
      if (!line) return;
      const coords = view.coordsAtPos(line.from);
      if (!coords) return;
      const containerRect = container.getBoundingClientRect();
      const gutterRect = view.dom.querySelector('.cm-gutters')?.getBoundingClientRect();
      const x = gutterRect ? gutterRect.right - containerRect.left + 8 : 60;
      const y = coords.top - containerRect.top;
      setSelectedLineSafe(lineNum);
      setMenu({ visible: true, x, y, line: lineNum });
    } catch (error) {
      console.warn('No se pudo abrir el menú para la línea', lineNum, error);
    }
  };

  const closeMenu = () => setMenu((prev) => ({ ...prev, visible: false }));

  const copyLine = async () => {
    if (!viewRef.current || !menu.line) return;
    const line = getValidLine(viewRef.current.state.doc, menu.line);
    if (!line) return;
    await navigator.clipboard.writeText(line.text);
    closeMenu();
  };

  const copyPermalink = async () => {
    const lineNumber = Number(menu.line) || 0;
    if (!lineNumber) return;
    const doc = viewRef.current?.state?.doc;
    if (doc && !getValidLine(doc, lineNumber)) return;
    const url = buildPermalink({ path, line: lineNumber, revisionId });
    await navigator.clipboard.writeText(url);
    closeMenu();
  };

  const addComment = (text) => {
    if (onAddComment && menu.line) {
      const doc = viewRef.current?.state?.doc;
      if (doc && !getValidLine(doc, menu.line)) return;
      onAddComment(menu.line, text);
    }
  };

  const staticExtensions = useMemo(
    () => [
      javascript(),
      EditorView.editable.of(false),
      lineNumbers(),
      baseTheme,
      highlightCompartmentRef.current.of([]),
      commentsCompartmentRef.current.of([])
    ],
    []
  );

  return (
    <EditorErrorBoundary onReset={() => setRenderError('')}>
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
        {renderError && (
          <div style={{ padding: '0.5rem 0.75rem', color: 'crimson', background: '#fff2f2' }}>
            Error al renderizar el editor. {renderError}{' '}
            <button type="button" onClick={() => setRenderError('')}>
              Reintentar
            </button>
          </div>
        )}
        {!renderError && (
          <CodeMirror
            value={code || ''}
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
              try {
                view.dispatch({
                  effects: [
                    highlightCompartmentRef.current.reconfigure(highlightExtension),
                    commentsCompartmentRef.current.reconfigure(commentsExtension)
                  ]
                });
              } catch (error) {
                setRenderError(error.message || 'No se pudo inicializar el editor');
              }
            }}
          />
        )}

        {editorReady && !renderError && selectedLine > 0 && viewRef.current && containerRef.current && (() => {
          try {
            const view = viewRef.current;
            const doc = view.state.doc;
            const line = getValidLine(doc, selectedLine);
            if (!line) return null;
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
    </EditorErrorBoundary>
  );
}

// ----- Extensiones auxiliares -----

function normalizeLineNumber(value) {
  const num = Number(value);
  return Number.isInteger(num) ? num : 0;
}

function getValidLine(doc, lineNumber) {
  if (!doc) return null;
  const num = normalizeLineNumber(lineNumber);
  if (!num || num <= 0 || num > doc.lines) return null;
  return doc.line(num);
}

function sanitizeCommentsList(comments) {
  if (!Array.isArray(comments)) return [];
  return comments
    .map((text) => String(text ?? '').trim())
    .filter((text) => text.length > 0);
}

function buildHighlightExtension(lineNumber) {
  const target = normalizeLineNumber(lineNumber);
  if (!target || target <= 0) return [];

  const buildDecorations = (state) => {
    try {
      const line = getValidLine(state.doc, target);
      if (!line) return Decoration.none;
      const deco = Decoration.line({ attributes: { class: 'codex-highlight-line' } }).range(line.from);
      return Decoration.set([deco]);
    } catch (_error) {
      return Decoration.none;
    }
  };

  const field = StateField.define({
    create: buildDecorations,
    update(value, tr) {
      if (tr.docChanged) {
        return buildDecorations(tr.state);
      }
      return value;
    },
    provide: (f) => EditorView.decorations.from(f)
  });

  return [field];
}

function buildCommentsExtension(commentsByLine) {
  const entries = commentsByLine instanceof Map ? Array.from(commentsByLine.entries()) : [];
  const normalizedEntries = entries
    .map(([lineKey, comments]) => ({
      line: normalizeLineNumber(lineKey),
      comments: sanitizeCommentsList(comments)
    }))
    .filter(({ line, comments }) => line > 0 && comments.length > 0);

  if (normalizedEntries.length === 0) return [];

  const createDecorationSet = (state) => {
    try {
      const doc = state.doc;
      if (!doc) return Decoration.none;
      const widgets = [];
      normalizedEntries
        .sort((a, b) => a.line - b.line)
        .forEach(({ line, comments }) => {
          const lineInfo = getValidLine(doc, line);
          if (!lineInfo) return;
          const widget = Decoration.widget({
            block: true,
            side: 1,
            widget: new CommentWidget(comments)
          }).range(lineInfo.to);
          widgets.push(widget);
        });
      if (!widgets.length) return Decoration.none;
      return Decoration.set(widgets, true);
    } catch (error) {
      console.warn('No se pudieron renderizar los comentarios', error);
      return Decoration.none;
    }
  };

  const field = StateField.define({
    create: createDecorationSet,
    update(value, tr) {
      if (tr.docChanged) {
        return createDecorationSet(tr.state);
      }
      return value;
    },
    provide: (f) => EditorView.decorations.from(f)
  });

  return [field];
}

class CommentWidget extends WidgetType {
  constructor(comments) {
    super();
    this.comments = sanitizeCommentsList(comments);
  }

  eq(other) {
    if (!(other instanceof CommentWidget)) return false;
    const current = Array.isArray(this.comments) ? this.comments : [];
    const next = Array.isArray(other.comments) ? other.comments : [];
    if (current.length !== next.length) return false;
    return current.every((c, idx) => c === next[idx]);
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

    const list = Array.isArray(this.comments) ? this.comments : [];
    list.forEach((text) => {
      const comment = document.createElement('div');
      comment.textContent = `💬 ${text}`;
      comment.style.marginBottom = '4px';
      wrap.appendChild(comment);
    });

    return wrap;
  }
}

class EditorErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Error en el editor' };
  }

  componentDidCatch(error, info) {
    console.error('Error en EditorPane:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '0.75rem 1rem', color: 'crimson', background: '#fff2f2', border: '1px solid #f5c2c7' }}>
          Error al renderizar el editor: {this.state.message}
          <button
            type="button"
            style={{ marginLeft: '0.5rem' }}
            onClick={() => this.setState({ hasError: false, message: '' }, this.props.onReset)}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

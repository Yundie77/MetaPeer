import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, lineNumbers, Decoration, WidgetType } from '@codemirror/view';
import { Compartment, StateField } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import LineMenu from './LineMenu.jsx';
import { buildPermalink } from '../utils/permalink.js';

const baseTheme = EditorView.theme({
  '.cm-scroller': {
    fontFamily: 'Consolas, SFMono-Regular, Menlo, monospace',
    fontSize: '14px',
    overflow: 'auto'
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

/**
 * Editor de solo lectura que resalta líneas, permite comentarios en línea y acciones rápidas.
 */
export default function EditorPane({
  path,
  code,
  height,
  initialLine = 0,
  commentsByLine = new Map(),
  onAddComment,
  revisionId,
  fileId,
  readOnly = false
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

  /**
   * Ajusta la línea seleccionada asegurando que sea un entero positivo.
   */
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

  /**
   * Detecta clicks en el gutter para seleccionar línea sin abrir menú.
   */
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

  /**
   * Calcula y posiciona el menú contextual sobre una línea.
   */
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

  /**
   * Oculta el menú contextual.
   */
  const closeMenu = () => setMenu((prev) => ({ ...prev, visible: false }));

  /**
   * Copia el texto completo de la línea seleccionada al portapapeles.
   */
  const copyLine = async () => {
    if (!viewRef.current || !menu.line) return;
    const line = getValidLine(viewRef.current.state.doc, menu.line);
    if (!line) return;
    await navigator.clipboard.writeText(line.text);
    closeMenu();
  };

  /**
   * Copia un enlace permanente a la línea seleccionada.
   */
  const copyPermalink = async () => {
    const lineNumber = Number(menu.line) || 0;
    if (!lineNumber) return;
    const doc = viewRef.current?.state?.doc;
    if (doc && !getValidLine(doc, lineNumber)) return;
    const url = buildPermalink({ path, line: lineNumber, revisionId, fileId, useRevisionId: readOnly });
    await navigator.clipboard.writeText(url);
    closeMenu();
  };

  /**
   * Notifica hacia arriba la creación de un comentario en la línea seleccionada.
   */
  const addComment = (text) => {
    if (readOnly) return;
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
          width: '100%',
          boxSizing: 'border-box',
          minWidth: 0,
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
          allowComment={!readOnly}
        />
      </div>
    </EditorErrorBoundary>
  );
}

// ----- Extensiones auxiliares -----

/**
 * Convierte un valor a número de línea entero o 0 si no es válido.
 */
function normalizeLineNumber(value) {
  const num = Number(value);
  return Number.isInteger(num) ? num : 0;
}

/**
 * Homogeneiza la estructura de un comentario para renderizarlo en el editor.
 */
function normalizeCommentItem(entry) {
  if (entry && typeof entry === 'object') {
    const message = String(entry.message ?? entry.text ?? entry.contenido ?? '').trim();
    if (!message) return null;
    const alias = String(entry.alias ?? '').trim();
    const aliasTitle = String(entry.aliasTitle ?? entry.fullName ?? '').trim();
    const timeText = String(entry.timeText ?? '').trim();
    const timeTitle = String(entry.timeTitle ?? '').trim();
    return {
      id: entry.id ?? entry.commentId ?? undefined,
      message,
      alias,
      aliasTitle,
      timeText,
      timeTitle
    };
  }

  const message = String(entry ?? '').trim();
  if (!message) return null;
  return {
    id: undefined,
    message,
    alias: '',
    aliasTitle: '',
    timeText: '',
    timeTitle: ''
  };
}

/**
 * Compara dos comentarios normalizados para reutilizar widgets sin re-render.
 */
function areCommentItemsEqual(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.message === b.message &&
    a.alias === b.alias &&
    a.aliasTitle === b.aliasTitle &&
    a.timeText === b.timeText &&
    a.timeTitle === b.timeTitle
  );
}

/**
 * Valida que la línea exista en el documento y devuelve su info.
 */
function getValidLine(doc, lineNumber) {
  if (!doc) return null;
  const num = normalizeLineNumber(lineNumber);
  if (!num || num <= 0 || num > doc.lines) return null;
  return doc.line(num);
}

/**
 * Limpia y filtra una lista de comentarios en bruto.
 */
function sanitizeCommentsList(comments) {
  if (!Array.isArray(comments)) return [];
  return comments
    .map((entry) => normalizeCommentItem(entry))
    .filter(Boolean);
}

/**
 * Genera la extensión de resaltado para una línea concreta.
 */
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

/**
 * Construye la extensión que coloca widgets de comentarios bajo sus líneas.
 */
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

/**
 * Widget que renderiza la lista de comentarios de una línea.
 */
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
    return current.every((c, idx) => areCommentItemsEqual(c, next[idx]));
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
      word-break: break-word;
    `;

    const list = Array.isArray(this.comments) ? this.comments : [];
    list.forEach((item, idx) => {
      const comment = document.createElement('div');
      comment.style.display = 'flex';
      comment.style.alignItems = 'center';
      comment.style.flexWrap = 'wrap';
      comment.style.gap = '6px';
      comment.style.marginBottom = idx === list.length - 1 ? '0' : '6px';

      const icon = document.createElement('span');
      icon.textContent = '💬';
      comment.appendChild(icon);

      const hasAlias = !!item?.alias;
      const hasTime = !!item?.timeText;
      if (hasAlias) {
        const alias = document.createElement('span');
        alias.textContent = item.alias;
        if (item.aliasTitle) {
          alias.title = item.aliasTitle;
        }
        alias.style.fontWeight = '600';
        alias.style.color = '#333';
        comment.appendChild(alias);
      }

      if (hasTime) {
        const time = document.createElement('span');
        time.textContent = item.timeText;
        if (item.timeTitle) {
          time.title = item.timeTitle;
        }
        time.style.color = '#555';
        time.style.fontSize = '12px';
        comment.appendChild(time);
      }

      if (hasAlias || hasTime) {
        const dash = document.createElement('span');
        dash.textContent = '-';
        dash.style.color = '#666';
        comment.appendChild(dash);
      }

      const text = document.createElement('span');
      text.textContent = item?.message || '';
      text.style.color = '#333';
      comment.appendChild(text);

      wrap.appendChild(comment);
    });

    return wrap;
  }
}

/**
 * Límite de error para aislar fallos de render del editor.
 */
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

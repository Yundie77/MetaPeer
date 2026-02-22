import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { getJson, postJson } from '../api.js';

const CREDENTIALS_HISTORY_STORAGE_KEY = 'metaPeer:adminDbCredentialsHistory';
const CREDENTIALS_HISTORY_TTL_MS = 15 * 60 * 1000; // 15 min

function isHistoryEntryValid(entry) {
  return !!(entry && typeof entry.csvText === 'string' && entry.csvText.trim() && entry.createdAt);
}

function isHistoryEntryExpired(entry) {
  if (!isHistoryEntryValid(entry)) {
    return true;
  }
  const createdAtMs = new Date(entry.createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) {
    return true;
  }
  return Date.now() - createdAtMs > CREDENTIALS_HISTORY_TTL_MS;
}

function normalizeCredentialsHistory(rawHistory) {
  const currentCandidate = isHistoryEntryValid(rawHistory?.current) ? rawHistory.current : null;
  const previousCandidate = isHistoryEntryValid(rawHistory?.previous) ? rawHistory.previous : null;
  const current = currentCandidate && !isHistoryEntryExpired(currentCandidate) ? currentCandidate : null;
  const previous = previousCandidate && !isHistoryEntryExpired(previousCandidate) ? previousCandidate : null;

  if (current) {
    return { current, previous };
  }
  if (previous) {
    // Si expira/desaparece el actual, promovemos el anterior.
    return { current: previous, previous: null };
  }
  return { current: null, previous: null };
}

function areHistoriesEqual(a, b) {
  return JSON.stringify(a || { current: null, previous: null }) === JSON.stringify(b || { current: null, previous: null });
}

function loadCredentialsHistory() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { current: null, previous: null };
  }

  try {
    const raw = window.localStorage.getItem(CREDENTIALS_HISTORY_STORAGE_KEY);
    if (!raw) {
      return { current: null, previous: null };
    }
    const parsed = JSON.parse(raw);
    return normalizeCredentialsHistory(parsed);
  } catch (_error) {
    return { current: null, previous: null };
  }
}

function saveCredentialsHistory(history) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(CREDENTIALS_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (_error) {}
}

function formatStoredDate(isoDate) {
  if (!isoDate) {
    return 'sin fecha';
  }
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return 'sin fecha';
  }
  return parsed.toLocaleString('es-ES');
}

function downloadCsvFromText(filename, text) {
  if (!text) {
    return;
  }
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default function AdminDB() {
  const { role } = useAuth();
  const isAdmin = useMemo(() => role === 'ADMIN', [role]);
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [csvText, setCsvText] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [credentialsHistory, setCredentialsHistory] = useState(() => loadCredentialsHistory());

  useEffect(() => {
    // Limpia entradas caducadas al abrir la pantalla.
    saveCredentialsHistory(credentialsHistory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCredentialsHistory((prev) => {
        const normalized = normalizeCredentialsHistory(prev);
        if (areHistoriesEqual(prev, normalized)) {
          return prev;
        }
        saveCredentialsHistory(normalized);
        return normalized;
      });
    }, 30000); // Cada 30 segundos, para no depender solo de la apertura de la pantalla para limpiar entradas caducadas.

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getJson('/asignaturas');
        setSubjects(data);
        if (data.length > 0) {
          setSubjectId(String(data[0].id));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (isAdmin) {
      loadSubjects();
    }
  }, [isAdmin]);

  const handleFileChange = (event) => {
    const file = event.target.files && event.target.files[0];
    setSummary(null);
    if (!file) {
      setCsvText('');
      setSelectedFileName('');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Selecciona un archivo con extensión .csv.');
      setCsvText('');
      setSelectedFileName('');
      return;
    }

    setReadingFile(true);
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const text = typeof loadEvent.target?.result === 'string' ? loadEvent.target.result : '';
      setCsvText(text);
      setSelectedFileName(file.name);
      setError('');
      setReadingFile(false);
    };
    reader.onerror = () => {
      setError('No pudimos leer el archivo seleccionado.');
      setCsvText('');
      setSelectedFileName('');
      setReadingFile(false);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!csvText.trim()) {
      setError('Selecciona un archivo CSV antes de importar.');
      return;
    }
    if (!subjectId) {
      setError('Selecciona una asignatura.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const result = await postJson('/admin/import-roster', {
        csvText,
        asignaturaId: Number(subjectId)
      });
      setSummary(result);

      const resultCsv = typeof result?.credencialesCsv === 'string' ? result.credencialesCsv.trim() : '';
      if (resultCsv) {
        const createdCount = Array.isArray(result?.credencialesCreadas) ? result.credencialesCreadas.length : 0;
        setCredentialsHistory((prev) => {
          const normalizedPrev = normalizeCredentialsHistory(prev);
          const nextHistory = {
            current: {
              csvText: resultCsv,
              createdAt: new Date().toISOString(),
              subjectId: Number(subjectId),
              createdCount
            },
            previous: normalizedPrev?.current || null
          };
          const normalized = normalizeCredentialsHistory(nextHistory);
          saveCredentialsHistory(normalized);
          return normalized;
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return <p>Solo los administradores pueden acceder a esta sección.</p>;
  }

  const credencialesCreadas = Array.isArray(summary?.credencialesCreadas) ? summary.credencialesCreadas : [];
  const credencialesCsv = typeof summary?.credencialesCsv === 'string' ? summary.credencialesCsv : '';
  const currentSavedCsv = credentialsHistory?.current || null;
  const previousSavedCsv = credentialsHistory?.previous || null;
  const handleDownloadSavedCsv = (slot) => {
    setCredentialsHistory((prev) => {
      const normalizedPrev = normalizeCredentialsHistory(prev);
      const target = normalizedPrev?.[slot];
      if (!target?.csvText) {
        return normalizedPrev;
      }

      const filename = slot === 'current' ? 'credenciales-guardadas-actual.csv' : 'credenciales-guardadas-anterior.csv';
      downloadCsvFromText(filename, target.csvText);

      const nextHistory =
        slot === 'current'
          ? { current: null, previous: normalizedPrev.previous || null }
          : { current: normalizedPrev.current || null, previous: null };

      const normalized = normalizeCredentialsHistory(nextHistory);
      saveCredentialsHistory(normalized);
      return normalized;
    });
  };

  return (
    <section>
      <h2>Importar alumnos (CSV)</h2>
      <p style={{ color: '#555', fontSize: '0.9rem' }}>
        Importa el CSV exportado desde el campus virtual. Se crearán usuarios y grupos automáticamente.
      </p>

      <form onSubmit={handleSubmit} style={formStyle}>
        <label style={labelStyle}>
          Asignatura
          <select
            style={inputStyle}
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            disabled={loading}
          >
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.nombre}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Archivo CSV
          <input
            style={inputStyle}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            disabled={saving || readingFile}
          />
          {selectedFileName && <span style={fileInfoStyle}>Seleccionado: {selectedFileName}</span>}
        </label>
        <button type="submit" style={buttonStyle} disabled={saving || readingFile}>
          {saving ? 'Importando...' : readingFile ? 'Leyendo archivo...' : 'Importar CSV'}
        </button>
      </form>

      {error && <p style={errorStyle}>{error}</p>}

      {(currentSavedCsv || previousSavedCsv) && (
        <div style={historyStyle}>
          <div style={previewHeaderStyle}>
            <h3 style={previewTitleStyle}>CSV guardados localmente</h3>
            <button
              type="button"
              style={clearHistoryButtonStyle}
              onClick={() => {
                const emptyHistory = { current: null, previous: null };
                saveCredentialsHistory(emptyHistory);
                setCredentialsHistory(emptyHistory);
              }}
            >
              Limpiar historial
            </button>
          </div>
          <p style={historyHintStyle}>
            Se guardan localmente, se borran al descargarlos y caducan automáticamente a los 15 minutos.
          </p>

          {currentSavedCsv && (
            <div style={historyItemStyle}>
              <strong>Último CSV guardado</strong>
              <p style={historyMetaStyle}>
                {formatStoredDate(currentSavedCsv.createdAt)} · credenciales: {currentSavedCsv.createdCount || 0}
              </p>
              <button
                type="button"
                style={downloadButtonStyle}
                onClick={() => handleDownloadSavedCsv('current')}
              >
                Descargar último CSV
              </button>
            </div>
          )}

          {previousSavedCsv && (
            <div style={historyItemStyle}>
              <strong>CSV anterior</strong>
              <p style={historyMetaStyle}>
                {formatStoredDate(previousSavedCsv.createdAt)} · credenciales: {previousSavedCsv.createdCount || 0}
              </p>
              <button
                type="button"
                style={downloadButtonStyle}
                onClick={() => handleDownloadSavedCsv('previous')}
              >
                Descargar CSV anterior
              </button>
            </div>
          )}
        </div>
      )}

      {summary && (
        <div style={summaryStyle}>
          <h3>Resumen</h3>
          <p>Alumnos creados: {summary.alumnosCreados}</p>
          <p>Equipos creados: {summary.equiposCreados}</p>
          <p>Membresías nuevas: {summary.membresiasInsertadas}</p>
          <p>Filas ignoradas: {summary.ignoradas}</p>
          <p>Credenciales nuevas: {credencialesCreadas.length}</p>

          <div style={credentialsBlockStyle}>
            <div style={previewHeaderStyle}>
              <h4 style={previewTitleStyle}>Credenciales creadas</h4>
              <button
                type="button"
                style={downloadButtonStyle}
                onClick={() => downloadCsvFromText('credenciales-importacion.csv', credencialesCsv)}
                disabled={!credencialesCsv}
              >
                Descargar CSV credenciales
              </button>
            </div>

            {credencialesCreadas.length === 0 ? (
              <p style={emptyCredentialsStyle}>No se generaron credenciales nuevas.</p>
            ) : (
              <div style={credentialsTableWrapStyle}>
                <table style={credentialsTableStyle}>
                  <thead>
                    <tr>
                      <th style={tableHeaderCellStyle}>Email</th>
                      <th style={tableHeaderCellStyle}>Contraseña</th>
                    </tr>
                  </thead>
                  <tbody>
                    {credencialesCreadas.map((credential) => (
                      <tr key={`${credential.email}-${credential.password}`}>
                        <td style={tableCellStyle}>{credential.email}</td>
                        <td style={{ ...tableCellStyle, fontFamily: 'monospace' }}>{credential.password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

const formStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  margin: '1.5rem 0'
};

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontWeight: 600
};

const inputStyle = {
  padding: '0.6rem 0.75rem',
  border: '1px solid #ccc',
  borderRadius: '4px',
  fontFamily: 'inherit'
};

const buttonStyle = {
  padding: '0.6rem 0.9rem',
  background: '#0b74de',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  maxWidth: '180px'
};

const errorStyle = {
  color: 'crimson'
};

const fileInfoStyle = {
  fontSize: '0.85rem',
  color: '#555',
  marginTop: '0.35rem'
};

const summaryStyle = {
  marginTop: '1.5rem',
  padding: '1rem',
  borderRadius: '8px',
  border: '1px solid #d0d0d0',
  background: '#fafafa'
};

const historyStyle = {
  marginTop: '1rem',
  padding: '1rem',
  borderRadius: '8px',
  border: '1px solid #d0d0d0',
  background: '#fff'
};

const historyItemStyle = {
  marginTop: '0.85rem',
  paddingTop: '0.85rem',
  borderTop: '1px solid #eef2f7'
};

const historyMetaStyle = {
  margin: '0.35rem 0 0.65rem',
  color: '#555',
  fontSize: '0.9rem'
};

const historyHintStyle = {
  marginTop: '0.5rem',
  marginBottom: 0,
  color: '#555',
  fontSize: '0.88rem'
};

const credentialsBlockStyle = {
  marginTop: '1rem',
  borderTop: '1px solid #e5e7eb',
  paddingTop: '1rem'
};

const previewHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  flexWrap: 'wrap'
};

const previewTitleStyle = {
  margin: 0
};

const downloadButtonStyle = {
  padding: '0.4rem 0.75rem',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer'
};

const clearHistoryButtonStyle = {
  padding: '0.4rem 0.75rem',
  background: '#4b5563',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer'
};

const emptyCredentialsStyle = {
  marginTop: '0.75rem',
  color: '#555'
};

const credentialsTableWrapStyle = {
  marginTop: '0.75rem',
  overflowX: 'auto'
};

const credentialsTableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#fff'
};

const tableHeaderCellStyle = {
  textAlign: 'left',
  padding: '0.5rem 0.6rem',
  borderBottom: '1px solid #d1d5db',
  fontSize: '0.9rem'
};

const tableCellStyle = {
  padding: '0.5rem 0.6rem',
  borderBottom: '1px solid #eef2f7',
  fontSize: '0.9rem'
};

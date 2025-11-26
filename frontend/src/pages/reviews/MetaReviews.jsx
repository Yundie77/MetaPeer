import React, { useEffect, useState } from 'react';
import { getJson, postJson } from '../../api.js';
import {
  panelStyle,
  labelStyle,
  inputStyle,
  buttonStyle,
  errorStyle,
  successStyle,
  listStyle,
  metaCardStyle,
  metaInfoStyle
} from './styles.js';

export default function MetaReviews() {
  const [assignments, setAssignments] = useState([]);
  const [assignmentId, setAssignmentId] = useState('');
  const [mapData, setMapData] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [error, setError] = useState('');
  const [metaInputs, setMetaInputs] = useState({});
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        setLoadingAssignments(true);
        const data = await getJson('/assignments');
        setAssignments(data);
        if (data.length > 0) {
          setAssignmentId(String(data[0].id));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingAssignments(false);
      }
    };
    loadAssignments();
  }, []);

  useEffect(() => {
    if (!assignmentId) {
      setMapData([]);
      return;
    }

    const loadReviews = async () => {
      try {
        setLoadingReviews(true);
        setError('');
        setSuccess('');
        const map = await getJson(`/assignments/${assignmentId}/assignment-map`);
        const pairs = map.pairs || [];

        const reviewDetails = [];
        for (const pair of pairs) {
          for (const submissionId of pair.entregas) {
            const reviews = await getJson(`/reviews?submissionId=${submissionId}`);
            reviewDetails.push(...reviews);
          }
        }
        setMapData(reviewDetails);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingReviews(false);
      }
    };

    loadReviews();
  }, [assignmentId]);

  const handleMetaChange = (reviewId, field, value) => {
    setMetaInputs((prev) => ({
      ...prev,
      [reviewId]: {
        ...(prev[reviewId] || {}),
        [field]: value
      }
    }));
  };

  const handleSubmitMeta = async (reviewId) => {
    const payload = metaInputs[reviewId];
    if (!payload || (!payload.nota && !payload.observacion)) {
      setError('Ingrese al menos una nota u observación para la meta-revisión.');
      return;
    }
    try {
      await postJson(`/reviews/${reviewId}/meta`, {
        nota_calidad: payload.nota ? Number(payload.nota) : null,
        observacion: payload.observacion || ''
      });
      setSuccess('Meta-revisión guardada.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ ...panelStyle, marginTop: '2rem' }}>
      <h3>Meta-evaluación</h3>
      <label style={labelStyle}>
        Tarea
        <select
          style={inputStyle}
          value={assignmentId}
          onChange={(event) => setAssignmentId(event.target.value)}
          disabled={loadingAssignments}
        >
          {assignments.map((assignment) => (
            <option key={assignment.id} value={assignment.id}>
              {assignment.titulo}
            </option>
          ))}
        </select>
      </label>

      {error && <p style={errorStyle}>{error}</p>}
      {success && <p style={successStyle}>{success}</p>}

      {loadingReviews ? (
        <p>Cargando revisiones...</p>
      ) : mapData.length === 0 ? (
        <p>No hay revisiones registradas para esta tarea.</p>
      ) : (
        <ul style={listStyle}>
          {mapData.map((review) => (
            <li key={review.id} style={metaCardStyle}>
              <div>
                <strong>Revisión #{review.id}</strong>
                <div style={metaInfoStyle}>
                  Nota enviada: {review.nota_numerica ?? 'sin nota'} · Guardada el {review.fecha_envio || 'sin fecha'}
                </div>
              </div>
              <div>
                <label style={labelStyle}>
                  Nota de calidad
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.5"
                    value={metaInputs[review.id]?.nota ?? ''}
                    onChange={(event) => handleMetaChange(review.id, 'nota', event.target.value)}
                  />
                </label>
                <label style={labelStyle}>
                  Observación
                  <textarea
                    style={{ ...inputStyle, minHeight: '70px' }}
                    value={metaInputs[review.id]?.observacion ?? ''}
                    onChange={(event) => handleMetaChange(review.id, 'observacion', event.target.value)}
                  />
                </label>
                <button type="button" style={buttonStyle} onClick={() => handleSubmitMeta(review.id)}>
                  Guardar meta-revisión
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { getJson, postJson } from '../api.js';

export default function Professors() {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';

  const [subjects, setSubjects] = useState([]);
  // Flags de carga para mostrar "Cargando..."
  const [subjectsLoading, setSubjectsLoading] = useState(true);

  const [professors, setProfessors] = useState([]);
  const [professorsLoading, setProfessorsLoading] = useState(true);
  const [professorsError, setProfessorsError] = useState('');

  const [profName, setProfName] = useState('');
  const [profEmail, setProfEmail] = useState('');
  const [profPassword, setProfPassword] = useState('');
  const [creatingProfessor, setCreatingProfessor] = useState(false);

  const [selectedProfessorId, setSelectedProfessorId] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState('');

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    const loadSubjects = async () => {
      try {
        setSubjectsLoading(true);
        const data = await getJson('/asignaturas');
        setSubjects(data);
      } catch (err) {
        console.error(err);
      } finally {
        setSubjectsLoading(false);
      }
    };

    const loadProfessors = async () => {
      try {
        setProfessorsLoading(true);
        setProfessorsError('');
        const data = await getJson('/admin/professors');
        setProfessors(data);
        if (data.length > 0) {
          const first = data[0];
          setSelectedProfessorId(String(first.id));
          setSelectedSubjects(first.asignaturas.map((subject) => subject.id));
        } else {
          setSelectedProfessorId('');
          setSelectedSubjects([]);
        }
      } catch (err) {
        setProfessorsError(err.message);
      } finally {
        setProfessorsLoading(false);
      }
    };

    loadSubjects();
    loadProfessors();
  }, [isAdmin]);

  if (!isAdmin) {
    return <p>Solo los administradores pueden gestionar profesores.</p>;
  }

  const handleCreateProfessor = async (event) => {
    event.preventDefault();
    if (!profName.trim() || !profEmail.trim()) {
      setProfessorsError('Nombre y correo son obligatorios.');
      return;
    }
    try {
      setCreatingProfessor(true);
      setProfessorsError('');
      const created = await postJson('/admin/professors', {
        nombre: profName.trim(),
        correo: profEmail.trim(),
        password: profPassword.trim() || undefined
      });
      setProfessors((prev) => [created, ...prev]);
      setProfName('');
      setProfEmail('');
      setProfPassword('');
      setSelectedProfessorId(String(created.id));
      setSelectedSubjects([]);
      setAssignSuccess('');
    } catch (err) {
      setProfessorsError(err.message);
    } finally {
      setCreatingProfessor(false);
    }
  };

  const handleSelectProfessor = (professorId) => {
    setSelectedProfessorId(professorId);
    const professor = professors.find((item) => String(item.id) === professorId);
    if (professor) {
      // Carga las asignaturas que ese profesor ya tiene asignadas.
      setSelectedSubjects(professor.asignaturas.map((subject) => subject.id));
    } else {
      setSelectedSubjects([]);
    }
    setAssignSuccess('');
  };

  // Marcar o desmarcar asignaturas
  const toggleSubjectSelection = (subjectId) => {
    setSelectedSubjects((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]
    );
    setAssignSuccess('');
  };

  // Guardar asignaciones
  const handleSaveAssignments = async () => {
    if (!selectedProfessorId) {
      setProfessorsError('Selecciona un profesor.');
      return;
    }
    try {
      setSavingAssignments(true);
      setProfessorsError('');
      const response = await postJson(`/admin/professors/${selectedProfessorId}/subjects`, {
        subjectIds: selectedSubjects
      });
      setProfessors((prev) =>
        prev.map((professor) =>
          professor.id === response.id ? { ...professor, asignaturas: response.asignaturas } : professor
        )
      );
      setSelectedSubjects(response.asignaturas.map((subject) => subject.id));
      setAssignSuccess('Asignaciones actualizadas.');
    } catch (err) {
      setProfessorsError(err.message);
    } finally {
      setSavingAssignments(false);
    }
  };

  return (
    <section>
      <h2>Profesores</h2>
      <p style={{ color: '#555', fontSize: '0.9rem' }}>
        Crea profesores y asígnalos a las asignaturas donde impartirán clase.
      </p>

      <form onSubmit={handleCreateProfessor} style={profFormStyle}>
        <label style={labelStyle}>
          Nombre
          <input
            style={inputStyle}
            value={profName}
            onChange={(event) => setProfName(event.target.value)}
            disabled={creatingProfessor}
          />
        </label>
        <label style={labelStyle}>
          Correo
          <input
            style={inputStyle}
            type="email"
            value={profEmail}
            onChange={(event) => setProfEmail(event.target.value)}
            disabled={creatingProfessor}
          />
        </label>
        <label style={labelStyle}>
          Contraseña inicial
          <input
            style={inputStyle}
            type="text"
            value={profPassword}
            onChange={(event) => setProfPassword(event.target.value)}
            placeholder="prof123 (por defecto)"
            disabled={creatingProfessor}
          />
        </label>
        <button type="submit" style={buttonStyle} disabled={creatingProfessor}>
          {creatingProfessor ? 'Creando...' : 'Crear profesor'}
        </button>
      </form>

      {professorsError && <p style={errorStyle}>{professorsError}</p>}

      <div style={assignmentLayout}>
        <div style={professorListStyle}>
          {professorsLoading ? (
            <p>Cargando profesores...</p>
          ) : professors.length === 0 ? (
            <p>No hay profesores registrados.</p>
          ) : (
            professors.map((professor) => (
              <button
                key={professor.id}
                type="button"
                onClick={() => handleSelectProfessor(String(professor.id))}
                style={professorButtonStyle(String(professor.id) === selectedProfessorId)}
              >
                <strong>{professor.nombre}</strong>
                <span style={{ fontSize: '0.85rem', color: '#ddd' }}>{professor.correo}</span>
              </button>
            ))
          )}
        </div>

        <div style={assignmentBoxStyle}>
          <h4>Asignaturas asignadas</h4>
          {subjectsLoading ? (
            <p>Cargando asignaturas...</p>
          ) : subjects.length === 0 ? (
            <p>Primero crea asignaturas.</p>
          ) : (
            <ul style={subjectChecklistStyle}>
              {subjects.map((subject) => (
                <li key={subject.id}>
                  <label style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={selectedSubjects.includes(subject.id)}
                      onChange={() => toggleSubjectSelection(subject.id)}
                    />
                    <span>
                      {subject.nombre} <span style={{ color: '#888' }}>({subject.codigo})</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <button type="button" style={buttonStyle} onClick={handleSaveAssignments} disabled={savingAssignments}>
            {savingAssignments ? 'Guardando...' : 'Guardar asignaciones'}
          </button>
          {assignSuccess && <p style={successStyle}>{assignSuccess}</p>}
        </div>
      </div>
    </section>
  );
}

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontWeight: 600
};

const inputStyle = {
  padding: '0.5rem 0.7rem',
  borderRadius: '4px',
  border: '1px solid #ccc'
};

const buttonStyle = {
  padding: '0.6rem 0.9rem',
  background: '#0b74de',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer'
};

const errorStyle = {
  color: 'crimson'
};

const successStyle = {
  color: '#1f7a1f',
  marginTop: '0.75rem'
};

const profFormStyle = {
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  marginTop: '1rem',
  marginBottom: '1rem'
};

const assignmentLayout = {
  display: 'flex',
  gap: '1rem',
  alignItems: 'flex-start',
  flexWrap: 'wrap'
};

const professorListStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  minWidth: '220px'
};

const professorButtonStyle = (active) => ({
  borderRadius: '6px',
  border: active ? '2px solid #0b74de' : '1px solid #ccc',
  padding: '0.6rem 0.8rem',
  textAlign: 'left',
  background: active ? '#eaf2ff' : '#fff',
  cursor: 'pointer'
});

const assignmentBoxStyle = {
  flex: 1,
  minWidth: '260px',
  padding: '1rem',
  borderRadius: '8px',
  border: '1px solid #d0d0d0',
  background: '#fff'
};

const subjectChecklistStyle = {
  listStyle: 'none',
  padding: 0,
  margin: '1rem 0',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem'
};

const checkboxLabelStyle = {
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'center'
};

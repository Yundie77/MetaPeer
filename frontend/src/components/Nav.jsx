import React from "react";

export default function Nav({ onNavigate }) {
  const go = (path) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  return (
    <nav
      style={{
        display: "flex",
        gap: "0.75rem",
        alignItems: "center",
        background: "#20232a",
        padding: "0.75rem 1rem",
        color: "#ffffff",
        borderRadius: "6px"
      }}
    >
      <strong style={{ marginRight: "1rem" }}>Peer Review MVP</strong>
      <button type="button" style={buttonStyle} onClick={() => go('/')}>Asignaciones</button>
      <button type="button" style={buttonStyle} onClick={() => go('/submissions')}>Entregas</button>
      <button type="button" style={buttonStyle} onClick={() => go('/reviews')}>Revisiones</button>
      <button type="button" style={buttonStyle} onClick={() => go('/zip-viewer')}>Visor ZIP</button>
    </nav>
  );
}

const buttonStyle = {
  background: "#61dafb",
  color: "#000",
  border: "none",
  padding: "0.35rem 0.75rem",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: 600
};

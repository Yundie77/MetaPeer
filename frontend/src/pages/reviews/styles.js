export const panelStyle = {
  border: "1px solid #dadada",
  borderRadius: "8px",
  padding: "1rem",
  background: "#fff",
  width: "100%",
  boxSizing: "border-box",
};

export const reviewsLayout = {
  display: "flex",
  gap: "1rem",
  alignItems: "flex-start",
  width: "100%",
  boxSizing: "border-box",
  minWidth: 0,
};

export const taskListStyle = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  width: "100px",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

export const taskButtonStyle = (active) => ({
  width: "100%",
  padding: "0.35rem 0.6rem",
  borderRadius: "6px",
  border: active ? "2px solid #0b74de" : "1px solid #d0d0d0",
  background: active ? "#eaf2ff" : "#f8f8f8",
  cursor: "pointer",
  textAlign: "left",
  fontSize: "0.9rem",
});

export const reviewFormStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  minWidth: 0,
  width: "100%",
};

export const reviewRightColumn = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  minWidth: 0,
  width: "100%",
  boxSizing: "border-box",
};

export const rubricFieldStyle = {
  display: "flex",
  flexDirection: "column",
};

export const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
  fontWeight: 600,
};

export const inputStyle = {
  padding: "0.5rem 0.65rem",
  borderRadius: "4px",
  border: "1px solid #ccc",
};

export const buttonStyle = {
  padding: "0.6rem 0.9rem",
  background: "#0b74de",
  color: "#fff",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: 600,
};

export const errorStyle = {
  color: "crimson",
};

export const successStyle = {
  color: "#1f7a1f",
};

export const listStyle = {
  listStyle: "none",
  padding: 0,
  margin: "1.5rem 0",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

export const metaCardStyle = {
  border: "1px solid #e0e0e0",
  borderRadius: "8px",
  padding: "1rem",
  background: "#fafafa",
  display: "flex",
  gap: "1rem",
  justifyContent: "space-between",
};

export const metaInfoStyle = {
  fontSize: "0.85rem",
  color: "#666",
};

export const viewerCard = {
  border: "1px solid #e0e0e0",
  borderRadius: "8px",
  padding: "0.75rem",
  background: "#fdfdfd",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  width: "100%",
  boxSizing: "border-box",
};

export const viewerHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

export const viewerHeaderLeft = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "0.35rem",
};

export const commentSummaryRow = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  flexWrap: "wrap",
};

export const commentSummaryPill = {
  border: "1px solid #2563eb",
  background: "#eff6ff",
  color: "#1e3a8a",
  borderRadius: "999px",
  padding: "0.2rem 0.6rem",
  fontSize: "0.78rem",
  fontWeight: 700,
  cursor: "pointer",
};

export const commentSummaryPillActive = {
  border: "1px solid #1d4ed8",
  background: "#dbeafe",
  color: "#1e3a8a",
  borderRadius: "999px",
  padding: "0.2rem 0.6rem",
  fontSize: "0.78rem",
  fontWeight: 700,
  cursor: "pointer",
};

export const commentSummaryPanel = {
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  background: "#fff",
  padding: "0.5rem 0.75rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
};

export const commentSummaryList = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
};

export const commentSummaryHint = {
  fontSize: "0.82rem",
  color: "#555",
};

export const viewerGrid = {
  display: "flex",
  gap: "1rem",
  alignItems: "stretch",
  minHeight: "540px",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
};

export const viewerSidebar = {
  border: "1px solid #e5e5e5",
  borderRadius: "6px",
  padding: "0.5rem",
  height: "580px",
  overflowY: "auto",
  overflowX: "auto",
  background: "#fff",
  boxSizing: "border-box",
};

export const viewerContent = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  minWidth: 0,
  minHeight: 0,
  flex: 1,
  width: "100%",
  boxSizing: "border-box",
};

export const anchorBar = {
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap",
  alignItems: "center",
};

export const anchorButton = {
  border: "1px solid #0b74de",
  background: "transparent",
  color: "#0b74de",
  borderRadius: "999px",
  padding: "0.2rem 0.6rem",
  cursor: "pointer",
  fontSize: "0.85rem",
};

export const binaryWarning = {
  padding: "1rem",
  border: "1px dashed #d97706",
  borderRadius: "6px",
  background: "#fff7ed",
  color: "#92400e",
};

export const previewWrapper = {
  border: "1px solid #e5e5e5",
  borderRadius: "8px",
  background: "#fff",
  overflow: "hidden",
  minHeight: "560px",
  width: "100%",
  boxSizing: "border-box",
};

export const previewFrame = {
  border: "none",
  width: "100%",
  height: "560px",
  display: "block",
};

export const linkButton = {
  border: "1px solid #0b74de",
  borderRadius: "4px",
  padding: "0.35rem 0.75rem",
  color: "#0b74de",
  background: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

export const fileCommentPanel = {
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "0.75rem",
  background: "#fff",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  width: "100%",
  boxSizing: "border-box",
};

export const fileCommentHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.75rem",
  flexWrap: "wrap",
};

export const fileCommentActions = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  flexWrap: "wrap",
};

export const fileCommentForm = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.5rem",
  flexWrap: "wrap",
};

export const fileCommentInput = {
  padding: "0.5rem 0.65rem",
  borderRadius: "4px",
  border: "1px solid #ccc",
  fontSize: "0.9rem",
  flex: "1 1 240px",
  minHeight: "44px",
  resize: "vertical",
};

export const fileCommentList = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "0.6rem",
};

export const fileCommentItem = {
  border: "1px solid #fde68a",
  borderRadius: "6px",
  background: "#fffbeb",
  padding: "0.5rem 0.75rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
};

export const fileCommentMeta = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  flexWrap: "wrap",
  fontSize: "0.82rem",
  color: "#555",
};

export const fileCommentMessage = {
  fontSize: "0.92rem",
  color: "#333",
  whiteSpace: "pre-wrap",
};

export const fileCommentEmpty = {
  color: "#555",
  fontSize: "0.9rem",
};

export const splitHandle = {
  width: "10px",
  cursor: "col-resize",
  background:
    "linear-gradient(90deg, transparent 0%, #dcdcdc 50%, transparent 100%)",
  borderRadius: "6px",
  flex: "0 0 auto",
};

export const metaReviewPanel = {
  border: "1px solid #dadada",
  borderRadius: "8px",
  padding: "1rem",
  background: "#fff",
  marginTop: "1rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  width: "100%",
  boxSizing: "border-box",
};

export const miniMeta = {
  fontSize: "0.85rem",
  color: "#555",
};

export const statusList = {
  listStyle: "none",
  padding: 0,
  margin: "0.75rem 0 0",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

export const statusItem = {
  padding: "0.75rem",
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  background: "#fff",
  display: "flex",
  gap: "1rem",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
};

export const statusBadge = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.3rem",
  borderRadius: "999px",
  padding: "0.2rem 0.6rem",
  fontSize: "0.78rem",
  fontWeight: 700,
};

export const statusBadgePending = {
  ...statusBadge,
  background: "#fef3c7",
  color: "#92400e",
  border: "1px solid #f59e0b",
};

export const statusBadgeSubmitted = {
  ...statusBadge,
  background: "#dbeafe",
  color: "#1e40af",
  border: "1px solid #60a5fa",
};

export const statusBadgeGraded = {
  ...statusBadge,
  background: "#dcfce7",
  color: "#166534",
  border: "1px solid #22c55e",
};

export const statusActions = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  flexWrap: "wrap",
};

export const linkPill = {
  background: "#eef2ff",
  color: "#1e3a8a",
  padding: "0.2rem 0.6rem",
  borderRadius: "999px",
  fontSize: "0.8rem",
  border: "1px solid #c7d2fe",
  textDecoration: "none",
  fontWeight: 600,
  cursor: "pointer",
};

export const metaReviewFields = {
  display: "grid",
  gap: "0.75rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  marginTop: "0.75rem",
};

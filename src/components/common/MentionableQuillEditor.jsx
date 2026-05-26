import React, { useRef } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Spinner } from "react-bootstrap";
import { useMentionableQuill } from "../../hooks/useMentionableQuill";
import { getQuillInstance } from "../../utils/quillEditorUtils";

const DEFAULT_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ align: [] }],
    ["blockquote", "link"],
    ["clean"],
  ],
};

const DEFAULT_FORMATS = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "color",
  "background",
  "list",
  "bullet",
  "align",
  "blockquote",
  "link",
];

/**
 * Editor rich text con menciones @usuario (mismo patrón que tareas).
 */
const MentionableQuillEditor = ({
  value,
  onChange,
  usuarios = [],
  placeholder = "Escribe el contenido. Usa @ para mencionar colaboradores...",
  minHeight = 280,
  modules = DEFAULT_MODULES,
  formats = DEFAULT_FORMATS,
  onMentionedIdsChange,
  disabled = false,
}) => {
  const quillEditorRef = useRef(null);

  const {
    quillRef: mentionQuillRef,
    showMentionList,
    mentionList,
    selectedMentionIndex,
    insertMention,
    handleQuillChange,
    handleQuillKeyDown,
    updateSelectedIndex,
  } = useMentionableQuill(usuarios, onMentionedIdsChange);

  const handleChange = (content, delta, source, editor) => {
    const quill =
      getQuillInstance(editor) ?? getQuillInstance(mentionQuillRef.current);
    if (quill) quillEditorRef.current = quill;
    handleQuillChange(content, delta, source, editor);
    onChange?.(content);
  };

  return (
    <div style={{ position: "relative" }}>
      <ReactQuill
        ref={mentionQuillRef}
        theme="snow"
        value={value || ""}
        readOnly={disabled}
        onChange={handleChange}
        onKeyDown={handleQuillKeyDown}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        style={{ backgroundColor: "#fff", minHeight }}
      />

      {showMentionList && !disabled && (
        <div
          className="mention-dropdown"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: "white",
            border: "1px solid #ddd",
            borderRadius: "4px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            zIndex: 1050,
            maxHeight: "250px",
            overflowY: "auto",
            marginTop: "4px",
          }}
        >
          {usuarios.length === 0 ? (
            <div style={{ padding: "12px", textAlign: "center", color: "#666" }}>
              <Spinner size="sm" animation="border" className="me-2" />
              Cargando usuarios...
            </div>
          ) : mentionList.length === 0 ? (
            <div style={{ padding: "12px", textAlign: "center", color: "#666" }}>
              No se encontraron usuarios
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: "6px 12px",
                  fontSize: "0.75rem",
                  color: "#666",
                  backgroundColor: "#f8f9fa",
                  borderBottom: "1px solid #e0e0e0",
                  fontWeight: 500,
                }}
              >
                {mentionList.length}{" "}
                {mentionList.length === 1 ? "usuario" : "usuarios"} encontrado
                {mentionList.length > 1 ? "s" : ""}
              </div>
              {mentionList.map((user, index) => (
                <div
                  key={user.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => insertMention(user)}
                  onMouseEnter={() => updateSelectedIndex?.(index)}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    backgroundColor:
                      index === selectedMentionIndex ? "#e3f2fd" : "transparent",
                    borderBottom:
                      index < mentionList.length - 1
                        ? "1px solid #f0f0f0"
                        : "none",
                  }}
                >
                  <div style={{ fontWeight: 500, color: "#1976d2" }}>
                    {user.name || user.nombre || "Usuario"}
                  </div>
                  {user.email && (
                    <div style={{ fontSize: "0.85rem", color: "#666" }}>
                      {user.email}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MentionableQuillEditor;

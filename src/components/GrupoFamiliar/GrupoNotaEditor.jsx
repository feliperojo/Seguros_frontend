import React, { useCallback, useMemo, useRef } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { useAuth } from "../../context/AuthContext";
import { getQuillInstance } from "../../utils/quillEditorUtils";

const quillModules = {
  toolbar: [
    [{ header: [1, 2, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ align: [] }],
    ["clean"],
  ],
};

const quillFormats = [
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
];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isRichEmpty(html) {
  if (!html) return true;
  const text = String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return !text;
}

/** Notas antiguas en texto plano → HTML legible en Quill. */
export function notaToEditorHtml(raw) {
  if (!raw) return "";
  const s = String(raw);
  if (/<[a-z][\s\S]*>/i.test(s)) return s;
  return s
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
    .join("");
}

function formatStampDate(date = new Date()) {
  try {
    return date.toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return date.toISOString();
  }
}

function buildStampHtml(userName) {
  const nombre = escapeHtml(userName || "Usuario");
  const fecha = escapeHtml(formatStampDate());
  return (
    `<p><strong>${nombre}</strong>` +
    `<span style="color: rgb(108, 117, 125);"> · ${fecha}</span></p>` +
    `<p><br></p>`
  );
}

/**
 * Editor enriquecido para la nota del grupo familiar.
 * Permite color/resaltado e inserta firma (usuario + fecha).
 */
export default function GrupoNotaEditor({
  value = "",
  onChange,
  disabled = false,
  placeholder = "Notas del grupo familiar...",
}) {
  const { user } = useAuth();
  const quillRef = useRef(null);
  const stampOnEmptyRef = useRef(false);

  const userName = useMemo(() => {
    return (
      user?.name ||
      user?.nombre ||
      user?.full_name ||
      user?.email ||
      "Usuario"
    );
  }, [user]);

  const editorValue = useMemo(() => notaToEditorHtml(value), [value]);

  const emitChange = useCallback(
    (html) => {
      onChange?.({
        target: {
          name: "nota",
          value: isRichEmpty(html) ? "" : html,
          type: "text",
        },
      });
    },
    [onChange]
  );

  const insertStamp = useCallback(
    ({ append = true } = {}) => {
      const stamp = buildStampHtml(userName);
      const current = editorValue;

      if (!append || isRichEmpty(current)) {
        emitChange(stamp);
        return;
      }

      emitChange(`${current}${stamp}`);

      // Cursor al final tras el próximo render
      requestAnimationFrame(() => {
        const quill = getQuillInstance(quillRef.current);
        if (!quill) return;
        try {
          const len = quill.getLength();
          quill.setSelection(Math.max(0, len - 1));
          quill.focus();
        } catch {
          /* ignore */
        }
      });
    },
    [editorValue, emitChange, userName]
  );

  const handleFocus = () => {
    if (disabled || stampOnEmptyRef.current) return;
    if (!isRichEmpty(editorValue)) return;
    stampOnEmptyRef.current = true;
    insertStamp({ append: false });
  };

  return (
    <div className="grupo-nota-editor">
      {!disabled && (
        <div className="d-flex justify-content-between align-items-center mb-2 gap-2 flex-wrap">
          <small className="text-muted mb-0">
            Puede resaltar texto y cambiar color. La firma usa su usuario y la fecha actual.
          </small>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => insertStamp({ append: true })}
            title="Agregar una nueva entrada con su nombre y la fecha"
          >
            <i className="fas fa-user-edit me-1"></i>
            Agregar entrada
          </button>
        </div>
      )}

      <div
        className={`grupo-nota-quill ${disabled ? "grupo-nota-quill--readonly" : ""}`}
        onFocusCapture={handleFocus}
      >
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={editorValue}
          onChange={(html) => emitChange(html)}
          modules={quillModules}
          formats={quillFormats}
          readOnly={disabled}
          placeholder={placeholder}
        />
      </div>

      <style>{`
        .grupo-nota-quill .ql-container {
          min-height: 120px;
          font-size: 0.9rem;
          background: #fff;
        }
        .grupo-nota-quill .ql-editor {
          min-height: 120px;
        }
        .grupo-nota-quill--readonly .ql-toolbar {
          display: none;
        }
        .grupo-nota-quill--readonly .ql-container {
          border-top: 1px solid #ccc;
          background: #f8f9fa;
        }
      `}</style>
    </div>
  );
}

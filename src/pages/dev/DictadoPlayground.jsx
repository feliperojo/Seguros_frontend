import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Form, Spinner, Alert } from "react-bootstrap";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const isNoteEmpty = (html) => {
  if (!html) return true;
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;
  const text = tempDiv.textContent || tempDiv.innerText || "";
  return text.trim().length === 0;
};

export default function DictadoPlayground() {
  const quillRef = useRef(null);
  const [reconocimientoDisponible, setReconocimientoDisponible] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [grabando, setGrabando] = useState(false);
  const grabandoRef = useRef(false);

  // Controles para pruebas
  const [lang, setLang] = useState("es-ES");
  const [continuous, setContinuous] = useState(true);
  const [interimResults, setInterimResults] = useState(false);
  const [autoRestart, setAutoRestart] = useState(true);
  const [insertAtCursor, setInsertAtCursor] = useState(true);

  const [html, setHtml] = useState("");
  const [interimText, setInterimText] = useState("");
  const [lastFinal, setLastFinal] = useState("");
  const [error, setError] = useState("");

  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ align: [] }],
        ["blockquote", "code-block"],
        ["link"],
        ["clean"],
      ],
    }),
    []
  );

  const quillFormats = useMemo(
    () => [
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
      "code-block",
      "link",
    ],
    []
  );

  useEffect(() => {
    grabandoRef.current = grabando;
  }, [grabando]);

  // Inicializa SpeechRecognition solo en este playground
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setReconocimientoDisponible(false);
      return;
    }

    setReconocimientoDisponible(true);
    const rec = new SpeechRecognition();
    rec.continuous = continuous;
    rec.interimResults = interimResults;
    rec.lang = lang;

    rec.onresult = (event) => {
      let finalText = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const t = res?.[0]?.transcript || "";
        if (res.isFinal) finalText += t;
        else interim += t;
      }

      if (interimResults) setInterimText(interim.trim());

      const textoFinal = finalText.trim();
      if (!textoFinal) return;
      setLastFinal(textoFinal);

      const q = quillRef.current;
      const quill = q?.getEditor ? q.getEditor() : q;
      if (quill) {
        const length = quill.getLength();
        const range = insertAtCursor ? quill.getSelection(true) : null;
        const insertPos =
          insertAtCursor && range ? range.index : Math.max(length - 1, 0);
        const prevChar =
          insertPos > 0 ? quill.getText(insertPos - 1, 1) : "";
        const prefix = prevChar && !prevChar.endsWith(" ") ? " " : "";
        quill.insertText(insertPos, `${prefix}${textoFinal} `, "user");
        quill.setSelection(insertPos + prefix.length + textoFinal.length + 1);
        setHtml(quill.root.innerHTML);
      } else {
        // Fallback: concatenar como HTML sin formateo (solo para test)
        setHtml((prev) => {
          const p = isNoteEmpty(prev) ? "" : prev;
          const spacer = p && !p.endsWith(" ") ? " " : "";
          return `${p}${spacer}${textoFinal} `;
        });
      }
    };

    rec.onerror = (event) => {
      // no-speech es común; no lo tratamos como fallo duro
      if (event?.error === "no-speech") return;
      if (event?.error === "aborted") return;
      setError(
        `Error del dictado: ${event?.error || "desconocido"}. Verifica permisos del micrófono.`
      );
      setGrabando(false);
      grabandoRef.current = false;
    };

    rec.onend = () => {
      if (!autoRestart) return;
      if (!grabandoRef.current) return;
      // Reinicio suave (evita loops agresivos)
      setTimeout(() => {
        if (!grabandoRef.current) return;
        try {
          rec.start();
        } catch {
          setGrabando(false);
          grabandoRef.current = false;
        }
      }, 150);
    };

    setRecognition(rec);

    return () => {
      try {
        rec.stop();
      } catch {
        // ignore
      }
    };
    // Re-crear recognition cuando cambian parámetros
  }, [lang, continuous, interimResults, autoRestart, insertAtCursor]);

  const iniciar = () => {
    setError("");
    if (!recognition) return;
    try {
      grabandoRef.current = true;
      recognition.start();
      setGrabando(true);
    } catch (e) {
      setError("No se pudo iniciar el dictado. Intenta nuevamente.");
      setGrabando(false);
      grabandoRef.current = false;
    }
  };

  const detener = () => {
    if (!recognition) return;
    grabandoRef.current = false;
    try {
      recognition.stop();
    } catch {
      // ignore
    }
    setGrabando(false);
    setInterimText("");
  };

  const toggle = () => (grabando ? detener() : iniciar());

  return (
    <div className="container-fluid p-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-1">Playground de Dictado</h4>
          <div className="text-muted small">
            Entorno seguro para probar ajustes sin afectar pantallas productivas.
          </div>
        </div>
        <Button
          variant={grabando ? "danger" : "primary"}
          onClick={toggle}
          disabled={!reconocimientoDisponible}
        >
          {grabando ? "Detener" : "Dictar"}
        </Button>
      </div>

      {!reconocimientoDisponible && (
        <Alert variant="warning">
          El dictado por voz no está disponible en este navegador. Usa Chrome,
          Edge o Safari.
        </Alert>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="row g-3 mb-3">
        <div className="col-md-3">
          <Form.Label>Idioma</Form.Label>
          <Form.Select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            disabled={grabando}
          >
            <option value="es-ES">es-ES</option>
            <option value="es-US">es-US</option>
            <option value="en-US">en-US</option>
          </Form.Select>
        </div>
        <div className="col-md-3 d-flex align-items-end">
          <Form.Check
            type="switch"
            id="continuous"
            label="continuous"
            checked={continuous}
            onChange={(e) => setContinuous(e.target.checked)}
            disabled={grabando}
          />
        </div>
        <div className="col-md-3 d-flex align-items-end">
          <Form.Check
            type="switch"
            id="interim"
            label="interimResults"
            checked={interimResults}
            onChange={(e) => setInterimResults(e.target.checked)}
            disabled={grabando}
          />
        </div>
        <div className="col-md-3 d-flex align-items-end">
          <Form.Check
            type="switch"
            id="autoRestart"
            label="autoRestart"
            checked={autoRestart}
            onChange={(e) => setAutoRestart(e.target.checked)}
          />
        </div>
        <div className="col-md-6 d-flex align-items-end">
          <Form.Check
            type="switch"
            id="cursorInsert"
            label="Insertar en el cursor (si está activo); si no, al final"
            checked={insertAtCursor}
            onChange={(e) => setInsertAtCursor(e.target.checked)}
          />
        </div>
      </div>

      {grabando && (
        <div className="alert alert-info d-flex align-items-center gap-2 py-2">
          <Spinner animation="border" size="sm" />
          <div>
            <div className="fw-semibold">Escuchando…</div>
            {interimResults && interimText && (
              <div className="small">
                <span className="text-muted">Interim: </span>
                <span>{interimText}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mb-2 text-muted small">
        Último final: <span className="fw-semibold">{lastFinal || "—"}</span>
      </div>

      <div className="border rounded" style={{ overflow: "hidden" }}>
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={html}
          onChange={(v) => setHtml(v)}
          modules={quillModules}
          formats={quillFormats}
          placeholder="Prueba aquí el dictado…"
          style={{ backgroundColor: "#fff", minHeight: 250 }}
        />
      </div>
    </div>
  );
}


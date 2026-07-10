import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Col,
  Form,
  Row,
  Spinner,
} from "react-bootstrap";
import { FaArrowLeft, FaSave } from "react-icons/fa";
import MentionableQuillEditor from "../../components/common/MentionableQuillEditor";
import { useUsuariosLista } from "../../hooks/useUsuariosLista";
import { actasService, ACTA_ESTADOS } from "../../services/actasService";
import { extractMentionedUserIds, highlightMentions } from "../../utils/mentions";
import "../../styles/Recursos.css";

const isHtmlEmpty = (html) => {
  if (!html) return true;
  const div = document.createElement("div");
  div.innerHTML = html;
  return !(div.textContent || "").trim();
};

const ActaEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "nueva";
  const { usuarios, loading: loadingUsuarios } = useUsuariosLista();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [mentionedUserIds, setMentionedUserIds] = useState([]);
  const [form, setForm] = useState({
    titulo: "",
    fecha_reunion: new Date().toISOString().slice(0, 10),
    lugar: "",
    contenido: "",
    estado: ACTA_ESTADOS.BORRADOR,
    participante_ids: [],
  });

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const acta = await actasService.get(id);
        if (cancelled) return;
        setForm({
          titulo: acta.titulo || acta.title || "",
          fecha_reunion: acta.fecha_reunion || acta.meeting_date || "",
          lugar: acta.lugar || acta.location || "",
          contenido: acta.contenido || acta.content || "",
          estado: acta.estado || ACTA_ESTADOS.BORRADOR,
          participante_ids: (acta.participante_ids || acta.participant_ids || []).map(
            Number
          ),
        });
        setMentionedUserIds(acta.mentioned_user_ids || []);
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "No se pudo cargar el acta");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  const buildPayload = (estadoOverride) => {
    const mentioned = extractMentionedUserIds(form.contenido, usuarios);
    const mergedMentions = [...new Set([...mentioned, ...mentionedUserIds])];
    return {
      titulo: form.titulo.trim(),
      fecha_reunion: form.fecha_reunion,
      lugar: form.lugar?.trim() || null,
      contenido: form.contenido,
      estado: estadoOverride ?? form.estado,
      participante_ids: form.participante_ids,
      mentioned_user_ids: mergedMentions,
    };
  };

  const guardar = async (estadoOverride) => {
    if (!form.titulo.trim()) {
      alert("El título es obligatorio");
      return;
    }
    if (isHtmlEmpty(form.contenido)) {
      alert("El contenido del acta no puede estar vacío");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload(estadoOverride);
      if (isNew) {
        const created = await actasService.create(payload);
        navigate(`/recursos/actas/${created.id}`, { replace: true });
      } else {
        await actasService.update(id, payload);
        if (estadoOverride) {
          setForm((f) => ({ ...f, estado: estadoOverride }));
        }
      }
    } catch (e) {
      const is404 = e?.response?.status === 404;
      setError(
        is404
          ? "Endpoints de actas no configurados en el servidor (recursos/actas)."
          : e?.message || "Error al guardar"
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleParticipante = (userId) => {
    setForm((f) => {
      const ids = f.participante_ids.includes(userId)
        ? f.participante_ids.filter((x) => x !== userId)
        : [...f.participante_ids, userId];
      return { ...f, participante_ids: ids };
    });
  };

  if (loading) {
    return (
      <div className="recursos-page text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <div className="recursos-page">
      <div className="recursos-page-header">
        <div>
          <Button
            as={Link}
            to="/recursos/actas"
            variant="link"
            className="p-0 mb-2 text-decoration-none"
          >
            <FaArrowLeft className="me-1" /> Volver al listado
          </Button>
          <h2 className="mb-0">{isNew ? "Nueva acta de reunión" : "Editar acta"}</h2>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button
            variant="outline-secondary"
            disabled={saving}
            onClick={() => guardar(ACTA_ESTADOS.BORRADOR)}
          >
            Guardar borrador
          </Button>
          <Button
            variant="primary"
            disabled={saving}
            onClick={() => guardar(ACTA_ESTADOS.PUBLICADA)}
          >
            {saving ? <Spinner size="sm" animation="border" /> : <FaSave className="me-1" />}
            Publicar acta
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="acta-editor-card">
        <Row className="g-3 mb-4">
          <Col md={8}>
            <Form.Group>
              <Form.Label>Título de la reunión</Form.Label>
              <Form.Control
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ej. Reunión semanal operaciones — Mayo 2026"
              />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label>Fecha</Form.Label>
              <Form.Control
                type="date"
                value={form.fecha_reunion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fecha_reunion: e.target.value }))
                }
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Lugar / modalidad (opcional)</Form.Label>
              <Form.Control
                value={form.lugar}
                onChange={(e) => setForm((f) => ({ ...f, lugar: e.target.value }))}
                placeholder="Oficina, Teams, etc."
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Label>Estado actual</Form.Label>
            <div>
              <span className="badge bg-secondary text-capitalize">{form.estado}</span>
            </div>
          </Col>
        </Row>

        <Form.Group className="mb-4">
          <Form.Label>Participantes en la reunión</Form.Label>
          {loadingUsuarios ? (
            <Spinner size="sm" animation="border" />
          ) : (
            <div
              className="d-flex flex-wrap gap-2 p-2 border rounded"
              style={{ maxHeight: 160, overflowY: "auto" }}
            >
              {usuarios.map((u) => (
                <Form.Check
                  key={u.id}
                  type="checkbox"
                  id={`part-${u.id}`}
                  label={u.name || u.nombre}
                  checked={form.participante_ids.includes(u.id)}
                  onChange={() => toggleParticipante(u.id)}
                />
              ))}
            </div>
          )}
        </Form.Group>

        <Form.Group className="mb-2">
          <Form.Label>Contenido del acta</Form.Label>
          <p className="small text-muted">
            Redacta lo tratado en la reunión: funciones por colaborador, metas, retos,
            compromisos o menciones (@nombre) para enviar información, etc.
          </p>
          <MentionableQuillEditor
            value={form.contenido}
            onChange={(html) => setForm((f) => ({ ...f, contenido: html }))}
            usuarios={usuarios}
            onMentionedIdsChange={setMentionedUserIds}
            minHeight={320}
          />
        </Form.Group>

        {!isHtmlEmpty(form.contenido) && form.estado === ACTA_ESTADOS.PUBLICADA && (
          <div className="mt-4 p-3 bg-light rounded">
            <Form.Label className="text-muted small">Vista previa (menciones resaltadas)</Form.Label>
            <div
              className="border rounded p-3 bg-white"
              dangerouslySetInnerHTML={{
                __html: highlightMentions(form.contenido),
              }}
            />
          </div>
        )}
      </div>

      <Alert variant="info" className="mt-3">
        <strong>Compromisos y tareas:</strong> desde el acta puedes mencionar colaboradores
        con @. Para convertir un compromiso en tarea operativa, usa el flujo existente de
        tareas en el panel principal o solicita el endpoint{" "}
        <code>POST recursos/actas/:id/compromisos/tarea</code> en backend. Los temas
        personales del colaborador van al{" "}
        <Link to="/recursos/mi-tablero">Mi tablero</Link>.
      </Alert>
    </div>
  );
};

export default ActaEditorPage;

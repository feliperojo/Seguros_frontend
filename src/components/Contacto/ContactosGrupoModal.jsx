// src/components/Contacto/ContactosGrupoModal.jsx
import React, { useEffect, useState } from "react";
import apiRequest from "../../services/api";
import ContactoCard from "./ContactoCard";

const ContactosGrupoModal = ({ show, onHide, grupoFamiliarId, readOnly = true }) => {
  const [contactos, setContactos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!show || !grupoFamiliarId) return;
  
    const fetchContactos = async () => {
      try {
        setLoading(true);
  
        // ⬇️ NUEVA URL usando las rutas que ya tienes
        const resp = await apiRequest(
          `/cliente-contacto?grupo_familiar_id=${grupoFamiliarId}`,
          "GET"
        );
  
        // Soportar array directo o { data: [...] }
        const data = Array.isArray(resp)
          ? resp
          : Array.isArray(resp?.data)
          ? resp.data
          : [];
  
        setContactos(data);
      } catch (error) {
        console.error("Error cargando contactos del grupo:", error);
      } finally {
        setLoading(false);
      }
    };
  
    fetchContactos();
  }, [show, grupoFamiliarId]);
  

  if (!show) return null;

  return (
    <>
      {/* MODAL */}
      <div
        className="modal fade show"
        style={{ display: "block" }}
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Contactos relacionados al grupo familiar</h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onHide}
              ></button>
            </div>

            <div className="modal-body">
              {loading && <p>Cargando contactos...</p>}

              {!loading && contactos.length === 0 && (
                <p className="text-muted mb-0">
                  No hay contactos relacionados a este grupo familiar.
                </p>
              )}

              {!loading &&
                contactos.length > 0 &&
                contactos.map((rel) => (
                  <ContactoCard
                    key={rel.id}
                    contacto={rel.contacto || {}}
                    link={rel}
                    readOnly={readOnly}
                  />
                ))}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onHide}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* BACKDROP */}
      <div className="modal-backdrop fade show"></div>
    </>
  );
};

export default ContactosGrupoModal;

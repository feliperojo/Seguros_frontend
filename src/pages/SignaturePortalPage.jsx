// src/pages/SignaturePortalPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { FaCheckCircle, FaExclamationTriangle, FaDownload } from "react-icons/fa";
import SignatureService from "../services/SignatureService";
import logo from "../assets/tampa.jpg";

const SignaturePortalPage = () => {
  const { token } = useParams();
  const [step, setStep] = useState("dob"); // 'dob', 'signing', 'signed', 'error'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [dob, setDob] = useState("");
  const [signatureData, setSignatureData] = useState(null);
  const [status, setStatus] = useState(null);
  const [docTitle, setDocTitle] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);
  const iframeRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  // Verificar estado al cargar (deep link support)
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const data = await SignatureService.getStatus(token);
        if (data.status === "SIGNED") {
          setStep("signed");
          setStatus("SIGNED");
          setDocTitle(data.doc_title || "Documento");
        } else if (data.status === "PENDING" && data.signing_url) {
          // Ya está validado, cargar directamente el embed
          setStep("signing");
          setSignatureData(data);
          setDocTitle(data.doc_title || "Documento");
          setExpiresAt(data.expires_at);
          startPolling();
        } else {
          // Estado inicial, mostrar formulario DOB
          setStep("dob");
        }
      } catch (err) {
        // Si falla, mostrar formulario DOB
        setStep("dob");
      }
    };

    if (token) {
      checkStatus();
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [token]);

  // Polling de estado cada 12 segundos
  const startPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const data = await SignatureService.getStatus(token);
        setStatus(data.status);

        if (data.status === "SIGNED") {
          setStep("signed");
          setDocTitle(data.doc_title || "Documento");
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
        } else if (data.status === "EXPIRED") {
          setError("La solicitud de firma ha expirado");
          setStep("error");
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
        }
      } catch (err) {
        console.error("Error al verificar estado:", err);
        // Continuar polling aunque falle una vez
      }
    }, 12000); // 12 segundos (entre 10-15s como especificado)
  };

  const handleDobSubmit = async (e) => {
    e.preventDefault();
    
    // Verificar límite de intentos
    if (attempts >= 3) {
      setError("Has excedido el número máximo de intentos. Por favor, contacta al administrador.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await SignatureService.verifyDob(token, dob);
      
      // Si la validación es exitosa
      setSignatureData(data);
      setDocTitle(data.doc_title || "Documento");
      setExpiresAt(data.expires_at);
      setStatus(data.status);
      setStep("signing");
      startPolling();
    } catch (err) {
      // Manejo de errores genérico
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      if (newAttempts >= 3) {
        setError("Has excedido el número máximo de intentos. Por favor, contacta al administrador.");
      } else {
        setError("No fue posible validar los datos");
      }
      
      // Limpiar el campo DOB
      setDob("");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    // Esta función debería descargar el PDF firmado
    // El backend debería proporcionar una URL de descarga
    // Por ahora, redirigimos a una URL que el backend debe implementar
    window.open(`/api/public/signature-requests/${token}/download`, "_blank");
  };

  // Verificar expiración
  useEffect(() => {
    if (expiresAt) {
      const expirationTime = new Date(expiresAt).getTime();
      const checkExpiration = setInterval(() => {
        const now = Date.now();
        if (now >= expirationTime) {
          setError("La solicitud de firma ha expirado");
          setStep("error");
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          clearInterval(checkExpiration);
        }
      }, 1000);

      return () => clearInterval(checkExpiration);
    }
  }, [expiresAt]);

  return (
    <div className="container-fluid d-flex justify-content-center align-items-center min-vh-100 bg-light py-5">
      <div className="container" style={{ maxWidth: "900px" }}>
        {/* Encabezado con branding */}
        <div className="text-center mb-4">
          <img
            src={logo}
            alt="Tampa Seguros"
            className="img-fluid mb-3"
            style={{
              maxWidth: "200px",
              height: "auto",
            }}
          />
          <h2 className="fw-bold mb-2">Firma de Documento</h2>
          {docTitle && (
            <p className="text-muted mb-0">{docTitle}</p>
          )}
          {step === "dob" && (
            <p className="text-muted mt-2 small">
              Por favor, ingresa tu fecha de nacimiento para continuar con el proceso de firma.
            </p>
          )}
        </div>

        {/* Formulario de fecha de nacimiento */}
        {step === "dob" && (
          <div className="card shadow-sm border-0" style={{ borderRadius: "15px" }}>
            <div className="card-body p-4">
              {error && (
                <div className="alert alert-danger text-center py-2 mb-3">
                  {error}
                  {attempts > 0 && (
                    <div className="mt-2 small">
                      Intentos restantes: {Math.max(0, 3 - attempts)}
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleDobSubmit}>
                <div className="mb-4">
                  <label className="form-label fw-bold">
                    Fecha de nacimiento
                  </label>
                  <input
                    type="date"
                    className="form-control form-control-lg rounded-3"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    required
                    style={{ padding: "12px", border: "1px solid #ccc" }}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100 fw-bold py-2"
                  disabled={loading || !dob || attempts >= 3}
                  style={{ borderRadius: "8px" }}
                >
                  {loading ? "Validando..." : attempts >= 3 ? "Intentos agotados" : "Continuar"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Visor embebido de DocuSeal */}
        {step === "signing" && signatureData?.signing_url && (
          <div className="card shadow-sm border-0" style={{ borderRadius: "15px" }}>
            <div className="card-body p-4">
              <div className="mb-3">
                <h5 className="fw-bold mb-2">{docTitle}</h5>
                {expiresAt && (
                  <p className="text-muted small mb-0">
                    Vence: {new Date(expiresAt).toLocaleString("es-ES")}
                  </p>
                )}
              </div>

              <div
                className="border rounded"
                style={{
                  minHeight: "600px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <iframe
                  ref={iframeRef}
                  src={signatureData.signing_url}
                  title="Firma de documento"
                  style={{
                    width: "100%",
                    height: "600px",
                    border: "none",
                  }}
                  allow="clipboard-read; clipboard-write"
                />
              </div>

              <div className="mt-3 text-center">
                <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
                <span className="text-muted small">
                  Procesando firma... Por favor, completa el proceso en el formulario de arriba.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Estado: Documento firmado */}
        {step === "signed" && (
          <div className="card shadow-sm border-0 text-center" style={{ borderRadius: "15px" }}>
            <div className="card-body p-5">
              <div className="mb-4">
                <div className="text-success mb-3" style={{ fontSize: "4rem" }}>
                  <FaCheckCircle />
                </div>
                <h4 className="fw-bold text-success mb-2">Documento firmado</h4>
                <p className="text-muted">
                  El documento ha sido firmado exitosamente.
                </p>
              </div>

              <button
                onClick={handleDownload}
                className="btn btn-primary btn-lg fw-bold px-5"
                style={{ borderRadius: "8px" }}
              >
                <FaDownload className="me-2" />
                Descargar PDF
              </button>
            </div>
          </div>
        )}

        {/* Estado de error */}
        {step === "error" && (
          <div className="card shadow-sm border-0 text-center" style={{ borderRadius: "15px" }}>
            <div className="card-body p-5">
              <div className="mb-4">
                <div className="text-danger mb-3" style={{ fontSize: "4rem" }}>
                  <FaExclamationTriangle />
                </div>
                <h4 className="fw-bold text-danger mb-2">Error</h4>
                <p className="text-muted">
                  {error || "Ha ocurrido un error al procesar la solicitud de firma."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignaturePortalPage;

// FichaClienteLayout.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import apiRequest from "../services/api";
import { FichaClienteContext } from "../context/fichaClienteContext";

// ===== NUEVO: Ruta absoluta a la lista de clientes =====
const LISTA_CLIENTES_PATH = "/Clientes/lista"; // cámbiala a "/clientes/lista" si tu ruta es minúscula

// helpers de fecha
const parseLocalYMD = (s) => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return new Date(s);
  const [_, y, mo, d] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d));
};
const formatDate = (iso) =>
  iso ? (isNaN(parseLocalYMD(iso)) ? iso : parseLocalYMD(iso).toLocaleDateString()) : "—";
const calcEdad = (dateStr) => {
  const birth = parseLocalYMD(dateStr);
  if (!birth || isNaN(birth)) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const normalizeNombre = (r) =>
  r?.nombre_completo ||
  [r?.primer_nombre, r?.segundo_nombre, r?.apellidos, r?.apellido].filter(Boolean).join(" ").trim() ||
  "Sin nombre";

const normalizeCliente = (raw) => {
  if (!raw) return null;
  const gfId =
    raw.grupo_familiar_id ??
    raw?.grupo_familiar?.id ??
    raw?.coberturas?.[0]?.grupo_familiar_id ??
    null;

  const telefono =
    raw.telefono ??
    raw.tel_1 ??
    raw.tel1 ??
    (raw.cod_tel_1 ? `${raw.cod_tel_1} ${raw.tel_1 || ""}`.trim() : null);

  const estado = raw.estado_cliente ?? raw.estado_Cliente ?? raw.estado ?? raw.status ?? null;
  const fecha_nacimiento = raw.fecha_nacimiento ?? raw.fechaNacimiento ?? raw.fecha_nac ?? null;

  return {
    ...raw,
    nombre_completo: normalizeNombre(raw),
    telefono,
    estado,
    fecha_nacimiento,
    edad: raw.edad ?? calcEdad(fecha_nacimiento),
    grupo_familiar_id: gfId,
    coberturas: Array.isArray(raw.coberturas) ? raw.coberturas : [],
    grupo_estados: Array.isArray(raw.grupo_estados) ? raw.grupo_estados : [],
  };
};

const TABS = [
  { id: "",            label: "General" },
  { id: "historial",   label: "Historial" },
  { id: "ringcentral", label: "RingCentral" },
  { id: "mas",         label: "Más" },
  { id: "tareas",      label: "Tareas" },
  { id: "calendario",  label: "Calendario" },
  { id: "comentarios", label: "Comentarios" },
  { id: "clientes",    label: "Clientes" },   // 👈 este lo enviaremos a LISTA_CLIENTES_PATH
  { id: "directorio",  label: "Directorio" },
];

export default function FichaClienteLayout() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState(null);
  const [error, setError] = useState(null);

  const fetchCliente = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(`cliente/with-cobertura?cliente_id=${id}`, "GET");
      const raw = res?.data ?? res;
      const row = Array.isArray(raw) ? raw[0] : raw;
      const norm = normalizeCliente(row);
      if (!norm) throw new Error("Respuesta vacía para el cliente");
      setCliente(norm);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la información del cliente.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchCliente();
  }, [id, fetchCliente]);

  const coberturaPrincipal = useMemo(() => {
    if (!cliente?.coberturas?.length) return null;
    return (
      cliente.coberturas.find((c) => c.grupo_familiar_id === cliente.grupo_familiar_id) ||
      cliente.coberturas[0]
    );
  }, [cliente]);

  const titulo = cliente?.nombre_completo || "Ficha de Cliente";

  const ctxValue = useMemo(
    () => ({
      id,
      cliente,
      loading,
      error,
      refresh: fetchCliente,
      formatDate,
      coberturaPrincipal,
    }),
    [id, cliente, loading, error, fetchCliente, coberturaPrincipal]
  );

  return (
    <FichaClienteContext.Provider value={ctxValue}>
      <div className="container-xxl py-3 px-3 px-md-4 px-lg-5 mx-auto">
        <div className="text-center mb-2">
          <h5 className="mb-0 text-primary fw-semibold">{titulo}</h5>
        </div>

        <div className="d-flex justify-content-center flex-wrap gap-2 pb-2 border-bottom mb-3">
          {TABS.map((t) => {
            const isClientes = t.id === "clientes";
            const to = isClientes ? LISTA_CLIENTES_PATH : (t.id === "" ? "." : t.id);
            return (
              <NavLink
                key={t.id}
                to={to}
                end={t.id === "" && !isClientes} // mantiene end solo para "General"
                className={({ isActive }) =>
                  "btn btn-sm " + (isActive ? "btn-secondary" : "btn-light border")
                }
              >
                {t.label}
              </NavLink>
            );
          })}
        </div>

        {loading && <div className="alert alert-info">Cargando cliente…</div>}
        {error && (
          <div className="alert alert-danger d-flex justify-content-between align-items-center">
            <div>{error}</div>
            <button className="btn btn-sm btn-light" onClick={fetchCliente}>
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && <Outlet />}
      </div>
    </FichaClienteContext.Provider>
  );
}

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FaExternalLinkAlt, FaSearch } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useAuth } from "../../context/AuthContext";
import { leerCambiosSinGuardar } from "../../utils/cambiosSinGuardar";
import useFechaOperacion from "../../hooks/useFechaOperacion";
import apiRequest from "../../services/api";
import {
  SEARCH_DEBOUNCE_MS,
  activarEnlaceNuevaPestana,
  atributosNuevaPestana,
  clienteSearchPath,
  destinoResultado,
  esRutaCreacion,
  grupoSearchPath,
  isLatestRequest,
  mapClientesBusqueda,
  mapGruposBusqueda,
  sectionFromSettled,
  shouldSearch,
} from "./globalSearch";
import "./GlobalSearchBar.css";

const emptySection = { items: [], message: null, showEmpty: true };

function nombreVisible(user) {
  if (user?.name) return String(user.name).trim();
  try {
    const stored = JSON.parse(localStorage.getItem("user") || "null");
    const nombre = stored?.name ? String(stored.name).trim() : "";
    return nombre || "Usuario";
  } catch {
    return "Usuario";
  }
}

function GlobalSearchBar() {
  const { user, isAuthenticated } = useAuth();
  const sessionKey = isAuthenticated ? `user:${user?.id ?? "unknown"}` : "anon";
  return <GlobalSearchSession key={sessionKey} />;
}

function GlobalSearchSession() {
  const { user, isAuthenticated } = useAuth();
  const nombreUsuario = nombreVisible(user);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const abreEnNuevaPestana = esRutaCreacion(pathname);
  const fechaOperacion = useFechaOperacion();
  const uid = useId().replace(/:/g, "");
  const inputId = `vantun-buscar-${uid}`;
  const listId = `vantun-buscar-lista-${uid}`;
  const rootRef = useRef(null);
  const requestGen = useRef(0);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState(emptySection);
  const [grupos, setGrupos] = useState(emptySection);
  const [activeIndex, setActiveIndex] = useState(-1);

  const opciones = useMemo(() => {
    const clientesOpciones = clientes.items.map((item) => ({
      type: "cliente",
      key: `cliente-${item.id}`,
      ...item,
    }));
    const gruposOpciones = grupos.items.map((item) => ({
      type: "grupo",
      key: `grupo-${item.id}-${item.anioPlan ?? "actual"}`,
      ...item,
    }));
    return [...clientesOpciones, ...gruposOpciones];
  }, [clientes.items, grupos.items]);

  useEffect(() => {
    const term = query.trim();
    const requestId = ++requestGen.current;
    let cancelled = false;

    if (!isAuthenticated || !shouldSearch(term)) {
      setLoading(false);
      setClientes(emptySection);
      setGrupos(emptySection);
      setActiveIndex(-1);
      return undefined;
    }

    setLoading(true);
    setClientes(emptySection);
    setGrupos(emptySection);
    setActiveIndex(-1);

    const timer = setTimeout(async () => {
      if (cancelled || !isLatestRequest(requestId, requestGen.current)) return;

      const [clientesRes, gruposRes] = await Promise.allSettled([
        apiRequest(clienteSearchPath(term), "GET"),
        apiRequest(grupoSearchPath(term), "GET"),
      ]);

      if (cancelled || !isLatestRequest(requestId, requestGen.current)) return;

      const clientesSection = sectionFromSettled(clientesRes, mapClientesBusqueda);
      const gruposSection = sectionFromSettled(gruposRes, mapGruposBusqueda);
      setClientes(clientesSection);
      setGrupos(gruposSection);
      setActiveIndex(-1);
      setLoading(false);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, isAuthenticated]);

  const opcionActiva = activeIndex >= 0 ? opciones[activeIndex] : null;

  useEffect(() => {
    if (!opcionActiva) return undefined;
    const node = document.getElementById(`${listId}-${opcionActiva.key}`);
    const panel = node?.closest(".vantun-global-search__panel");
    if (!node || !panel) return undefined;

    const nodeRect = node.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    if (nodeRect.bottom > panelRect.bottom) {
      panel.scrollTop += nodeRect.bottom - panelRect.bottom;
    } else if (nodeRect.top < panelRect.top) {
      panel.scrollTop -= panelRect.top - nodeRect.top;
    }
    return undefined;
  }, [opcionActiva, listId]);

  useEffect(() => {
    if (!open) return undefined;

    const cerrarSiEsFuera = (event) => {
      if (event.target?.closest?.(".swal2-container")) return;
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", cerrarSiEsFuera);
    return () => document.removeEventListener("mousedown", cerrarSiEsFuera);
  }, [open]);

  const termino = query.trim();
  const consultaActiva = shouldSearch(termino);
  const mostrarPanel = open && termino.length > 0;

  const eligiendo = useRef(false);

  const elegir = async (opcion) => {
    if (!opcion || eligiendo.current) return;
    const path = destinoResultado(opcion, fechaOperacion.anio);
    if (!path) return;

    const estado = leerCambiosSinGuardar();
    if (estado.guardando) {
      eligiendo.current = true;
      try {
        await Swal.fire({
          title: "Guardado en curso",
          text: "Espera a que termine el guardado antes de salir.",
          icon: "info",
          confirmButtonText: "Entendido",
          allowEscapeKey: true,
          allowOutsideClick: true,
        });
      } finally {
        eligiendo.current = false;
      }
      return;
    }

    if (estado.pendiente) {
      eligiendo.current = true;
      let salir = false;
      try {
        const resultado = await Swal.fire({
          title: "Cambios sin guardar",
          text: "Tienes cambios sin guardar. Si sales, se perderán.",
          icon: "warning",
          showCancelButton: true,
          focusCancel: true,
          confirmButtonText: "Salir sin guardar",
          cancelButtonText: "Seguir editando",
          reverseButtons: true,
          allowEscapeKey: true,
          allowOutsideClick: true,
        });
        salir = resultado.isConfirmed === true;
      } finally {
        eligiendo.current = false;
      }
      if (!salir || leerCambiosSinGuardar().guardando) return;
    }

    setOpen(false);
    setQuery("");
    navigate(path);
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      if (!open) return;
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === "Tab") {
      setOpen(false);
      return;
    }

    if (!mostrarPanel || !consultaActiva || opciones.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % opciones.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? opciones.length - 1 : current - 1));
      return;
    }

    if (event.key === "Enter" && opcionActiva) {
      event.preventDefault();
      if (abreEnNuevaPestana) {
        activarEnlaceNuevaPestana(document.getElementById(`${listId}-${opcionActiva.key}`));
        return;
      }
      elegir(opcionActiva);
    }
  };

  const anunciarVacio =
    consultaActiva &&
    !loading &&
    opciones.length === 0 &&
    !clientes.message &&
    !grupos.message &&
    (clientes.showEmpty || grupos.showEmpty);
  const estadoLector = loading
    ? "Buscando clientes y grupos familiares."
    : anunciarVacio
      ? "Sin resultados."
      : "";

  const clientesOpciones = opciones.filter((item) => item.type === "cliente");
  const gruposOpciones = opciones.filter((item) => item.type === "grupo");

  return (
    <div className="vantun-global-search" ref={rootRef}>
      <div className="vantun-global-search__field">
        <div className="vantun-global-search__control">
          <FaSearch className="vantun-global-search__icon" aria-hidden="true" />
          <input
            id={inputId}
            className="vantun-global-search__input"
            type="text"
            role="combobox"
            autoComplete="off"
            spellCheck={false}
            placeholder="Buscar clientes o grupos familiares…"
            aria-label="Buscar clientes o grupos familiares"
            aria-autocomplete="list"
            aria-expanded={mostrarPanel}
            aria-controls={listId}
            aria-activedescendant={opcionActiva ? `${listId}-${opcionActiva.key}` : undefined}
            aria-busy={loading}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
        </div>

        <p className="vantun-global-search__sr" aria-live="polite">
          {estadoLector}
        </p>

        {mostrarPanel && (
          <div className="vantun-global-search__panel" id={listId} role="listbox" aria-label="Resultados">
            {!consultaActiva && (
              <p className="vantun-global-search__status">Escribe al menos 3 caracteres.</p>
            )}

            {consultaActiva && loading && (
              <p className="vantun-global-search__status">Buscando…</p>
            )}

            {consultaActiva && !loading && (
              <>
                {renderSeccion({
                  titulo: "Clientes",
                  listId,
                  opciones: clientesOpciones,
                  message: clientes.message,
                  showEmpty: clientes.showEmpty,
                  activeKey: opcionActiva?.key,
                  nuevaPestana: abreEnNuevaPestana,
                  anioOperativo: fechaOperacion.anio,
                  onHighlight: (key) => {
                    const index = opciones.findIndex((item) => item.key === key);
                    if (index >= 0) setActiveIndex(index);
                  },
                  onSelect: elegir,
                  meta: (item) => `ID ${item.id}`,
                })}
                {renderSeccion({
                  titulo: "Grupos familiares",
                  listId,
                  opciones: gruposOpciones,
                  message: grupos.message,
                  showEmpty: grupos.showEmpty,
                  activeKey: opcionActiva?.key,
                  nuevaPestana: abreEnNuevaPestana,
                  anioOperativo: fechaOperacion.anio,
                  onHighlight: (key) => {
                    const index = opciones.findIndex((item) => item.key === key);
                    if (index >= 0) setActiveIndex(index);
                  },
                  onSelect: elegir,
                  meta: (item) =>
                    item.anioPlan ? `ID ${item.id} · Año ${item.anioPlan}` : `ID ${item.id}`,
                })}
              </>
            )}
          </div>
        )}
      </div>
      <span className="vantun-global-search__usuario" title={nombreUsuario}>
        <span className="vantun-global-search__avatar" aria-hidden="true">
          {nombreUsuario.charAt(0).toUpperCase()}
        </span>
        <span className="vantun-global-search__nombre">{nombreUsuario}</span>
      </span>
    </div>
  );
}

function renderSeccion({
  titulo,
  listId,
  opciones,
  message,
  showEmpty = true,
  activeKey,
  nuevaPestana = false,
  anioOperativo,
  onHighlight,
  onSelect,
  meta,
}) {
  return (
    <div className="vantun-global-search__section" role="group" aria-label={titulo}>
      <div className="vantun-global-search__heading" role="presentation">
        {titulo}
      </div>
      {message && (
        <p className="vantun-global-search__status vantun-global-search__status--error">{message}</p>
      )}
      {!message && showEmpty && opciones.length === 0 && (
        <p className="vantun-global-search__status">Sin resultados.</p>
      )}
      {!message &&
        opciones.map((opcion) => {
          const activo = opcion.key === activeKey;
          const enlace = nuevaPestana
            ? atributosNuevaPestana(destinoResultado(opcion, anioOperativo))
            : null;
          const contenido = (
            <>
              <span className="vantun-global-search__name">{opcion.nombre}</span>
              {enlace ? (
                <span className="vantun-global-search__aside">
                  <span className="vantun-global-search__meta">{meta(opcion)}</span>
                  <span className="vantun-global-search__external">
                    <FaExternalLinkAlt aria-hidden="true" />
                    Abrir en otra pestaña
                  </span>
                </span>
              ) : (
                <span className="vantun-global-search__meta">{meta(opcion)}</span>
              )}
            </>
          );

          if (enlace) {
            return (
              <a
                key={opcion.key}
                id={`${listId}-${opcion.key}`}
                role="option"
                aria-selected={activo}
                className={`vantun-global-search__option${activo ? " is-active" : ""}`}
                href={enlace.href}
                target={enlace.target}
                rel={enlace.rel}
                onMouseEnter={() => onHighlight(opcion.key)}
              >
                {contenido}
              </a>
            );
          }

          return (
            <button
              key={opcion.key}
              id={`${listId}-${opcion.key}`}
              type="button"
              role="option"
              aria-selected={activo}
              className={`vantun-global-search__option${activo ? " is-active" : ""}`}
              onMouseEnter={() => onHighlight(opcion.key)}
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(opcion);
              }}
            >
              {contenido}
            </button>
          );
        })}
    </div>
  );
}

export default GlobalSearchBar;

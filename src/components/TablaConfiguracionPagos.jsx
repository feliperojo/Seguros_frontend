import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Table, Form, Spinner, Badge, Row, Col, Button, Alert, Modal, Container, Dropdown } from "react-bootstrap";
import apiRequest from "../services/api";
import { fetchListadoPagosPeriodo, fetchPagosExistForPeriodo, fetchResumenAnual } from "../services/coberturaPagosApi";
import CobrosPeriodoResumen from "./CobrosPeriodoResumen";
import VistaPreviaCobrosModal from "./VistaPreviaCobrosModal";
import RegenerarCobrosModal from "./RegenerarCobrosModal";
import { MESES_COBRO, etiquetaMes } from "../utils/periodoCobros";
import { condicionCobro } from "../utils/condicionCobro";
import {
  alternarSeleccion,
  conservarSeleccionEnFiltro,
  describirAlcance,
  filtrarCobrosParaRegenerar,
  seleccionarPagina,
  seleccionarTodosFiltrados,
} from "../utils/regenerarCobros";
import {
  coberturaEnAlcance,
  describirRevisionProductos,
  prepararGeneracionCobros,
  productosDelAlcance,
} from "../utils/revisionGeneracionCobros";
import { useHasAnyPermission } from "../hooks/useHasPermission";
import { renderClienteLink } from "../pages/ListaClientes";
import "./TablaConfiguracionPagos.css";

const TablaConfiguracionPagos = () => {
  const [loading, setLoading] = useState(false);
  const [polizas, setPolizas] = useState([]);
  const [filtros, setFiltros] = useState({ cliente: "", compania: "", responsable: "" });
  const [mesSeleccionado, setMesSeleccionado] = useState("");
  const [alerta, setAlerta] = useState({ show: false, variant: "", mensaje: "" });
  const [showVistaPrevia, setShowVistaPrevia] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState(null);
  const [errorVista, setErrorVista] = useState("");
  const [detalleLote, setDetalleLote] = useState({});
  const [validandoPagosMes, setValidandoPagosMes] = useState(false);
  const [anioSeleccionado, setAnioSeleccionado] = useState("");
  const [periodoNegocio, setPeriodoNegocio] = useState(null);
  const [resumenAnual, setResumenAnual] = useState(null);
  const [resumenVersion, setResumenVersion] = useState(0);
  const [errorPeriodo, setErrorPeriodo] = useState(false);
  const generandoRef = useRef(false);
  const idsLoteRef = useRef([]);
  const productosLoteRef = useRef([]);
  const puedeEditarProductos = useHasAnyPermission(["settings.edit", "settings.update"]);
  const [catalogoProductos, setCatalogoProductos] = useState([]);
  const [productosHabilitados, setProductosHabilitados] = useState([]);
  const [huellaConfiguracion, setHuellaConfiguracion] = useState("");
  const [modoProductos, setModoProductos] = useState("todos");
  const [productosElegidos, setProductosElegidos] = useState([]);
  const [borradorProductos, setBorradorProductos] = useState([]);
  const [errorProductos, setErrorProductos] = useState("");
  const [guardandoProductos, setGuardandoProductos] = useState(false);
  const [showProductosHabilitados, setShowProductosHabilitados] = useState(false);
  const [versionProductos, setVersionProductos] = useState(0);
  /** Vista previa GET /pagos/existe para el mes+año actual */
  const [infoPagosMes, setInfoPagosMes] = useState({
    loading: false,
    periodo: null,
    exists: null,
    count: null,
  });
  const [cobrosPeriodo, setCobrosPeriodo] = useState([]);
  const [cargandoCobros, setCargandoCobros] = useState(false);
  const [errorCobros, setErrorCobros] = useState(false);
  const [seleccionRegenerar, setSeleccionRegenerar] = useState([]);
  const [idsRevision, setIdsRevision] = useState([]);
  const [paginaRegenerar, setPaginaRegenerar] = useState(1);
  const [showInconsistenciasModal, setShowInconsistenciasModal] = useState(false);
  const [inconsistenciasDetalle, setInconsistenciasDetalle] = useState({
    message: "",
    inconsistencias: [],
  });

  const mostrarAlerta = (mensaje, tipo = "success", duracion = 5000) => {
    setAlerta({ show: true, variant: tipo, mensaje });
    setTimeout(() => {
      setAlerta({ show: false, variant: "", mensaje: "" });
    }, duracion);
  };

  const fetchPolizas = async () => {
    try {
      setLoading(true);
      const response = await apiRequest("cobertura/activas", "GET");
      const normalizado = response.map(p => ({
        ...p,
        precio: p.precio ? Number(p.precio) : 0,
        id: p.id || p.cobertura_id || Math.random(),
      }));
      setPolizas(normalizado);
    } catch (err) {
      console.error("Error al cargar polizas activas:", err);
      mostrarAlerta("Error al cargar las pólizas activas", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolizas();
  }, []);

  const periodoParaMes = (mesDosDigitos, anio) => {
    if (!mesDosDigitos || !anio) return null;
    return `${anio}-${mesDosDigitos}`;
  };

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const resumen = await fetchResumenAnual(anioSeleccionado || undefined);
        if (cancel) return;
        setErrorPeriodo(false);
        setPeriodoNegocio(resumen);
        if (!anioSeleccionado) {
          setAnioSeleccionado(String(resumen.anio_actual));
          return;
        }
        if (String(resumen.anio) === String(anioSeleccionado)) {
          setResumenAnual(resumen);
        }
      } catch (err) {
        console.error("No se pudo cargar el resumen de cobros:", err);
        if (!cancel) setErrorPeriodo(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [anioSeleccionado, resumenVersion]);

  useEffect(() => {
    const periodo = periodoParaMes(mesSeleccionado, anioSeleccionado);
    if (!periodo) {
      setInfoPagosMes({ loading: false, periodo: null, exists: null, count: null });
      return;
    }

    let cancel = false;
    setInfoPagosMes((prev) => ({ ...prev, loading: true, periodo }));

    (async () => {
      try {
        const r = await fetchPagosExistForPeriodo(periodo);
        if (!cancel) {
          setInfoPagosMes({
            loading: false,
            periodo: r.periodo,
            exists: r.exists,
            count: r.count,
          });
        }
      } catch {
        if (!cancel) {
          setInfoPagosMes({
            loading: false,
            periodo,
            exists: null,
            count: null,
          });
        }
      }
    })();

    return () => {
      cancel = true;
    };
  }, [mesSeleccionado, anioSeleccionado]);

  useEffect(() => {
    if (!mesSeleccionado || !anioSeleccionado) {
      setCobrosPeriodo([]);
      setErrorCobros(false);
      return;
    }

    let cancel = false;
    setCargandoCobros(true);
    setErrorCobros(false);
    fetchListadoPagosPeriodo(anioSeleccionado, mesSeleccionado)
      .then((lista) => {
        if (!cancel) setCobrosPeriodo(Array.isArray(lista) ? lista : []);
      })
      .catch(() => {
        if (!cancel) {
          setErrorCobros(true);
          setCobrosPeriodo([]);
        }
      })
      .finally(() => {
        if (!cancel) setCargandoCobros(false);
      });

    return () => {
      cancel = true;
    };
  }, [mesSeleccionado, anioSeleccionado, resumenVersion]);

  useEffect(() => {
    setPaginaRegenerar(1);
    setSeleccionRegenerar([]);
    setIdsRevision([]);
  }, [mesSeleccionado, anioSeleccionado]);

  useEffect(() => {
    idsLoteRef.current = [];
    productosLoteRef.current = [];
    setDetalleLote({});
    setShowVistaPrevia(false);
    setVistaPrevia(null);
    setErrorVista("");
  }, [
    mesSeleccionado,
    anioSeleccionado,
    filtros.cliente,
    filtros.compania,
    filtros.responsable,
    modoProductos,
    productosElegidos,
  ]);

  useEffect(() => {
    const filtrados = filtrarCobrosParaRegenerar(cobrosPeriodo, filtros);
    setSeleccionRegenerar((actual) => conservarSeleccionEnFiltro(actual, filtrados));
  }, [cobrosPeriodo, filtros]);

  useEffect(() => {
    let cancelado = false;
    apiRequest("cobertura/generar-cobros/productos", "GET")
      .then((respuesta) => {
        if (cancelado) return;
        const data = respuesta?.catalogo ? respuesta : respuesta?.data || {};
        const habilitados = Array.isArray(data.habilitados) ? data.habilitados : [];
        setCatalogoProductos(Array.isArray(data.catalogo) ? data.catalogo : []);
        setProductosHabilitados(habilitados);
        setBorradorProductos(habilitados);
        setHuellaConfiguracion(data.huella_configuracion || "");
        setErrorProductos("");
      })
      .catch((err) => {
        if (!cancelado) {
          setErrorProductos(err.message || "No se pudo cargar la configuración de productos.");
        }
      });
    return () => {
      cancelado = true;
    };
  }, [versionProductos]);

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros({ ...filtros, [name]: value });
    setPaginaRegenerar(1);
  };

  const cargarVistaPrevia = async ({ ids: idsForzados, productos: productosForzados } = {}) => {
    if (generandoRef.current) return;
    if (!mesSeleccionado || !anioSeleccionado) {
      mostrarAlerta("Seleccione el mes y el año para generar los cobros", "warning");
      return;
    }

    const revalidar = Array.isArray(idsForzados) && !Array.isArray(productosForzados);
    const productos = Array.isArray(productosForzados)
      ? productosForzados
      : revalidar
        ? productosLoteRef.current
        : productosDelAlcance({
            modo: modoProductos,
            elegidos: productosElegidos,
            habilitados: productosHabilitados,
          });
    const ids = Array.isArray(idsForzados) ? idsForzados : polizasFiltradas.map((p) => p.id);
    if (productos.length === 0) {
      mostrarAlerta("Seleccione al menos un producto habilitado.", "warning");
      return;
    }
    if (ids.length === 0) {
      mostrarAlerta("No hay pólizas válidas para generar cobros", "warning");
      return;
    }

    if (!revalidar) {
      idsLoteRef.current = ids;
      productosLoteRef.current = productos;
      const detalle = {};
      const polizasDelLote = Array.isArray(idsForzados)
        ? polizas.filter((poliza) => ids.includes(poliza.id))
        : polizasFiltradas;
      polizasDelLote.forEach((poliza) => {
        detalle[poliza.id] = {
          cliente_nombre: poliza.cliente?.nombre_completo || "",
          grupo_familiar_id: poliza.grupo_familiar_id,
          producto: catalogoProductos.find((producto) => producto.id === poliza.producto_id)?.etiqueta || "",
          codigo_poliza: poliza.codigo_poliza || "",
        };
      });
      setDetalleLote(detalle);
      setVistaPrevia(null);
    }

    setValidandoPagosMes(true);
    setErrorVista("");
    try {
      const respuesta = await apiRequest("cobertura/generar-cobros/vista-previa", "POST", {
        mes: mesSeleccionado,
        anio: Number(anioSeleccionado),
        cobertura_ids: ids,
        productos,
      });
      const vista = respuesta?.data?.items ? respuesta.data : respuesta;
      setVistaPrevia(vista);
      setShowVistaPrevia(true);
    } catch (err) {
      console.error("No se pudo armar la vista previa:", err);
      setErrorVista(err.message || "No se pudo preparar la revisión de los cobros.");
      setShowVistaPrevia(true);
    } finally {
      setValidandoPagosMes(false);
    }
  };

  const aceptarProductosHabilitados = async () => {
    const firma = (ids) => [...ids].map(String).sort().join("|");
    let habilitados = productosHabilitados;
    if (firma(borradorProductos) !== firma(productosHabilitados)) {
      setGuardandoProductos(true);
      try {
        const respuesta = await apiRequest("cobertura/generar-cobros/productos", "PUT", {
          habilitados: borradorProductos,
        });
        const data = respuesta?.catalogo ? respuesta : respuesta?.data || {};
        habilitados = Array.isArray(data.habilitados) ? data.habilitados : [...borradorProductos];
        setProductosHabilitados(habilitados);
        setBorradorProductos(habilitados);
        setHuellaConfiguracion(data.huella_configuracion || "");
      } catch (err) {
        mostrarAlerta(err.message || "No se pudo guardar la configuración.", "danger");
        return;
      } finally {
        setGuardandoProductos(false);
      }
    }

    const productos = productosDelAlcance({
      modo: modoProductos,
      elegidos: productosElegidos,
      habilitados,
    });
    if (productos.length === 0) {
      mostrarAlerta("Seleccione al menos un producto habilitado.", "warning");
      return;
    }
    const ids = polizasPorFiltros
      .filter((poliza) => coberturaEnAlcance(poliza, productos))
      .map((poliza) => poliza.id);
    setShowProductosHabilitados(false);
    await cargarVistaPrevia({ ids, productos });
  };

  const cerrarVistaPrevia = () => {
    if (generandoRef.current) return;
    setShowVistaPrevia(false);
    setVistaPrevia(null);
    setErrorVista("");
  };

  const handleGenerarCobros = async ({ confirmarDatosPeriodo }) => {
    if (generandoRef.current || !vistaPrevia) return;
    generandoRef.current = true;
    try {
      setLoading(true);
      const preparado = prepararGeneracionCobros({
        idsLote: idsLoteRef.current,
        huella: vistaPrevia.huella,
        confirmarDatosPeriodo,
        productos: productosLoteRef.current,
      });
      if (!preparado) {
        setErrorVista("No hay un alcance válido para generar.");
        return;
      }
      const data = await apiRequest("cobertura/generar-cobros", "POST", {
        mes: mesSeleccionado,
        anio: Number(anioSeleccionado),
        ...preparado,
      });
      const nuevos = Number(data?.nuevos_registros ?? 0);
      const existentes = Number(data?.pagos_existentes ?? 0);
      mostrarAlerta(
        data?.message ||
          `Se crearon ${nuevos} cobros. ${existentes} ya existían y se conservaron.`,
        "success",
        8000
      );
      setShowVistaPrevia(false);
      setVistaPrevia(null);
      setErrorVista("");
      setResumenVersion((version) => version + 1);
      const periodo = periodoParaMes(mesSeleccionado, anioSeleccionado);
      if (periodo) {
        try {
          const r = await fetchPagosExistForPeriodo(periodo);
          setInfoPagosMes({
            loading: false,
            periodo: r.periodo,
            exists: r.exists,
            count: r.count,
          });
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      console.error("Error al generar cobros:", err);
      const status = err.response?.status;
      const data = err.response?.data || {};
      const inconsistencias = Array.isArray(data.inconsistencias)
        ? data.inconsistencias
        : [];

      if (status === 409 && data.code === "REVISION_DESACTUALIZADA") {
        setErrorVista(
          data.message ||
            "Los datos de las coberturas cambiaron durante la revisión. Actualice la vista previa antes de generar."
        );
      } else if (
        status === 422 &&
        (data.code === "COBERTURAS_INCONSISTENTES" || inconsistencias.length > 0)
      ) {
        setShowVistaPrevia(false);
        setInconsistenciasDetalle({
          message:
            data.message ||
            "No se generaron los pagos por inconsistencias en algunas coberturas.",
          inconsistencias,
        });
        setShowInconsistenciasModal(true);
        mostrarAlerta(
          data.message ||
            "No se generaron los pagos: revise las coberturas con inconsistencias.",
          "danger",
          8000
        );
      } else {
        setErrorVista(data.message || err.message || "Ocurrió un error al generar los cobros");
      }
    } finally {
      generandoRef.current = false;
      setLoading(false);
    }
  };

  const productosAlcance = productosDelAlcance({
    modo: modoProductos,
    elegidos: productosElegidos,
    habilitados: productosHabilitados,
  });
  const polizasPorFiltros = polizas.filter((p) => {
    const clienteNombre = p.cliente?.nombre_completo || "";
    const companiaNombre = p.compania?.nombre || "";
    const responsableNombre = p.grupo_familiar?.responsable || "";
    return (
      clienteNombre.toLowerCase().includes(filtros.cliente.toLowerCase()) &&
      companiaNombre.toLowerCase().includes(filtros.compania.toLowerCase()) &&
      responsableNombre.toLowerCase().includes(filtros.responsable.toLowerCase())
    );
  });
  const sinProductoIdentificable = polizasPorFiltros.filter((p) => !p.producto_id).length;
  const polizasFiltradas = polizasPorFiltros
    .filter((p) => coberturaEnAlcance(p, productosAlcance))
    .sort((a, b) => (a.grupo_familiar_id || 0) - (b.grupo_familiar_id || 0));
  const etiquetasAlcance = catalogoProductos
    .filter((producto) => productosAlcance.includes(producto.id))
    .map((producto) => producto.etiqueta);
  const textoAlcance = mesSeleccionado && anioSeleccionado
    ? describirRevisionProductos({
        cantidad: polizasFiltradas.length,
        etiquetas: etiquetasAlcance,
        periodo: `${etiquetaMes(mesSeleccionado).toLocaleLowerCase("es")} de ${anioSeleccionado}`,
        todos: modoProductos === "todos",
      })
    : "";
  const resumenFiltros = [
    textoAlcance,
    filtros.cliente ? `Cliente: ${filtros.cliente}` : "",
    filtros.compania ? `Compañía: ${filtros.compania}` : "",
    filtros.responsable ? `Responsable: ${filtros.responsable}` : "",
  ].filter(Boolean).join(". ");

  const aniosGeneracion = Array.from(
    new Set(
      [
        ...(periodoNegocio?.anios_disponibles || []),
        periodoNegocio?.anio_actual,
      ].filter((year) => Number(year) <= Number(periodoNegocio?.anio_actual))
    )
  )
    .map((year) => Number(year))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => b - a);

  const resumenVisible =
    resumenAnual && String(resumenAnual.anio) === String(anioSeleccionado) ? resumenAnual : null;
  const cobrosRegenerables = filtrarCobrosParaRegenerar(cobrosPeriodo, filtros);
  const totalPaginasRegenerar = Math.max(1, Math.ceil(cobrosRegenerables.length / 10));
  const paginaRegenerarVisible = Math.min(paginaRegenerar, totalPaginasRegenerar);
  const inicioRegenerar = (paginaRegenerarVisible - 1) * 10;
  const cobrosPagina = cobrosRegenerables.slice(inicioRegenerar, inicioRegenerar + 10);
  const alcanceRegenerar = describirAlcance({
    seleccion: seleccionRegenerar,
    pagosFiltrados: cobrosRegenerables,
    pagosPagina: cobrosPagina,
    periodo: mesSeleccionado && anioSeleccionado ? `${etiquetaMes(mesSeleccionado)} ${anioSeleccionado}` : "",
  });

  return (
    <Container fluid className="mt-4 mb-4">
      <div className="pagos-mensuales">
        <div className="pagos-mensuales__header">
          <div className="pagos-mensuales__header-icon" aria-hidden="true">
            <i className="fas fa-file-invoice-dollar" />
          </div>
          <div>
            <h2 className="pagos-mensuales__title">Generación de Pagos Mensuales</h2>
            <p className="pagos-mensuales__subtitle">
              Consulta los parámetros de cobro de las pólizas activas y genera los registros de pago
              del mes seleccionado según el día de cobro de cada cobertura.
            </p>
          </div>
        </div>

        <div className="pagos-mensuales__body">
          <div className="pagos-mensuales__section">
            <div className="pagos-mensuales__section-title">
              <i className="fas fa-filter" aria-hidden="true" />
              Filtros y generación
            </div>
            <Row className="g-3 align-items-end">
              <Col md={4} lg={2}>
                <div className="pagos-mensuales__label">Cliente</div>
                <Form.Control
                  placeholder="Filtrar por cliente"
                  name="cliente"
                  value={filtros.cliente}
                  onChange={handleFiltroChange}
                />
              </Col>
              <Col md={4} lg={2}>
                <div className="pagos-mensuales__label">Compañía</div>
                <Form.Control
                  placeholder="Filtrar por compañía"
                  name="compania"
                  value={filtros.compania}
                  onChange={handleFiltroChange}
                />
              </Col>
              <Col md={4} lg={2}>
                <div className="pagos-mensuales__label">Responsable</div>
                <Form.Control
                  placeholder="Filtrar por responsable"
                  name="responsable"
                  value={filtros.responsable}
                  onChange={handleFiltroChange}
                />
              </Col>
              <Col md={4} lg={2}>
                <div className="pagos-mensuales__label">Mes</div>
                <Form.Select
                  value={mesSeleccionado}
                  onChange={(e) => setMesSeleccionado(e.target.value)}
                  aria-label="Mes del período"
                >
                  <option value="">Seleccionar mes</option>
                  {MESES_COBRO.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.etiqueta}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={4} lg={2}>
                <div className="pagos-mensuales__label">Año</div>
                <Form.Select
                  value={anioSeleccionado}
                  onChange={(e) => setAnioSeleccionado(e.target.value)}
                  aria-label="Año del período"
                  disabled={aniosGeneracion.length === 0}
                >
                  {aniosGeneracion.map((year) => (
                    <option key={year} value={String(year)}>
                      {year}
                      {year === periodoNegocio?.anio_actual ? " (actual)" : ""}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={4} lg={2} className="text-md-end">
                <Button
                  className="pagos-mensuales__btn-primary w-100"
                  onClick={() => {
                    if (puedeEditarProductos) {
                      setBorradorProductos([...productosHabilitados]);
                      setShowProductosHabilitados(true);
                      return;
                    }
                    void cargarVistaPrevia();
                  }}
                  disabled={
                    loading ||
                    validandoPagosMes ||
                    !mesSeleccionado ||
                    !anioSeleccionado ||
                    Boolean(errorProductos) ||
                    productosAlcance.length === 0 ||
                    polizasFiltradas.length === 0
                  }
                >
                  {validandoPagosMes ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Revisando…
                    </>
                  ) : (
                    "Generar faltantes"
                  )}
                </Button>
              </Col>
            </Row>
            <Row className="g-3 align-items-end mt-1">
              <Col md={4} lg={3}>
                <div className="pagos-mensuales__label">Producto</div>
                {errorProductos ? (
                  <Alert variant="warning" className="mb-0 py-2">{errorProductos}</Alert>
                ) : (
                  <Dropdown autoClose="outside">
                    <Dropdown.Toggle
                      variant="outline-secondary"
                      className="w-100 text-start"
                      id="filtro-producto-generacion"
                    >
                      {modoProductos === "todos"
                        ? "Todos los habilitados"
                        : etiquetasAlcance.join(", ") || "Ningún producto"}
                    </Dropdown.Toggle>
                    <Dropdown.Menu className="p-3" style={{ minWidth: "240px" }}>
                      <Form.Check
                        id="productos-todos-habilitados"
                        type="checkbox"
                        label="Todos los habilitados"
                        checked={modoProductos === "todos"}
                        onChange={(event) => {
                          const marcado = event.target.checked;
                          setModoProductos(marcado ? "todos" : "elegidos");
                          setProductosElegidos(marcado ? [...productosHabilitados] : []);
                        }}
                        className="mb-2"
                      />
                      <Dropdown.Divider />
                      {catalogoProductos
                        .filter((producto) => productosHabilitados.includes(producto.id))
                        .map((producto) => (
                          <Form.Check
                            key={producto.id}
                            id={`producto-${producto.id}`}
                            type="checkbox"
                            label={producto.etiqueta}
                            checked={
                              modoProductos === "todos" || productosElegidos.includes(producto.id)
                            }
                            onChange={() => {
                              const base = modoProductos === "todos" ? productosHabilitados : productosElegidos;
                              const siguiente = base.includes(producto.id)
                                ? base.filter((id) => id !== producto.id)
                                : [...base, producto.id];
                              const completo = productosHabilitados.length > 0
                                && productosHabilitados.every((id) => siguiente.includes(id));
                              setModoProductos(completo ? "todos" : "elegidos");
                              setProductosElegidos(siguiente);
                            }}
                            className="mb-2"
                          />
                        ))}
                    </Dropdown.Menu>
                  </Dropdown>
                )}
              </Col>
            </Row>
            {textoAlcance ? <p className="mt-3 mb-1">{textoAlcance}</p> : null}
            {productosAlcance.length === 0 && !errorProductos ? (
              <p className="text-muted mb-1">No hay productos seleccionados. No se puede generar.</p>
            ) : null}
            {sinProductoIdentificable > 0 ? (
              <p className="text-muted mb-0">
                {sinProductoIdentificable}{" "}
                {sinProductoIdentificable === 1 ? "cobertura no tiene" : "coberturas no tienen"}{" "}
                un producto identificable y no entran en este alcance.
              </p>
            ) : null}
          </div>

          <div className="pagos-mensuales__section">
            <div className="pagos-mensuales__section-title">
              <i className="fas fa-calendar-alt" aria-hidden="true" />
              Cobros generados en {anioSeleccionado || "el año"}
            </div>
            {errorPeriodo ? (
              <div className="pagos-mensuales__notice pagos-mensuales__notice--warn">
                <i className="fas fa-exclamation-triangle pagos-mensuales__notice-icon" aria-hidden="true" />
                <span>
                  No fue posible cargar los datos del período.{" "}
                  <Button
                    variant="link"
                    className="p-0 align-baseline"
                    onClick={() => setResumenVersion((version) => version + 1)}
                  >
                    Reintentar
                  </Button>
                </span>
              </div>
            ) : resumenVisible ? (
              <CobrosPeriodoResumen
                anio={resumenVisible.anio}
                meses={resumenVisible.meses}
                mesSeleccionado={mesSeleccionado}
                onSeleccionarMes={setMesSeleccionado}
                limitacion={resumenVisible.limitacion}
                registrosSinPeriodo={resumenVisible.registros_sin_periodo}
              />
            ) : (
              <div className="text-center py-3">
                <Spinner animation="border" size="sm" style={{ color: "#1a365d" }} />
              </div>
            )}
          </div>

          {mesSeleccionado && anioSeleccionado && (
            <>
              {infoPagosMes.loading ? (
                <div className="pagos-mensuales__notice">
                  <i className="fas fa-info-circle pagos-mensuales__notice-icon" aria-hidden="true" />
                  <span>Comprobando cobros del período…</span>
                </div>
              ) : infoPagosMes.exists === true ? (
                <div className="pagos-mensuales__notice pagos-mensuales__notice--warn">
                  <i className="fas fa-exclamation-triangle pagos-mensuales__notice-icon" aria-hidden="true" />
                  <span>
                    Ya hay cobros generados para{" "}
                    <strong>
                      {etiquetaMes(mesSeleccionado)} {anioSeleccionado}
                    </strong>
                    {infoPagosMes.count != null ? (
                      <>
                        {" "}
                        ({infoPagosMes.count} cobro
                        {infoPagosMes.count !== 1 ? "s" : ""})
                      </>
                    ) : null}
                    . Generar creará solo los faltantes y conservará importe, estado y ajustes de
                    los existentes. Esto no significa que el pago haya sido recibido.
                  </span>
                </div>
              ) : infoPagosMes.exists === false ? (
                <div className="pagos-mensuales__notice">
                  <i className="fas fa-info-circle pagos-mensuales__notice-icon" aria-hidden="true" />
                  <span>
                    <strong>
                      {etiquetaMes(mesSeleccionado)} {anioSeleccionado}
                    </strong>
                    : todavía no tiene cobros generados.
                  </span>
                </div>
              ) : null}
            </>
          )}

          {alerta.show && (
            <Alert variant={alerta.variant} className="text-center mb-3">
              {alerta.mensaje}
            </Alert>
          )}

          <div className="pagos-mensuales__section">
            <div className="pagos-mensuales__section-title">
              <i className="fas fa-sync-alt" aria-hidden="true" />
              Regenerar existentes
            </div>
            <p className="pagos-mensuales__regenerar-nota">
              Actualiza cobros ya generados del período y los filtros activos. No crea faltantes ni
              cambia el estado ni la fecha de pago.
            </p>
            {!mesSeleccionado || !anioSeleccionado ? (
              <div className="pagos-mensuales__notice">Seleccione el mes y el año para ver los cobros que se pueden regenerar.</div>
            ) : cargandoCobros ? (
              <div className="text-center py-3">
                <Spinner animation="border" size="sm" style={{ color: "#1a365d" }} />
              </div>
            ) : errorCobros ? (
              <div className="pagos-mensuales__notice pagos-mensuales__notice--warn">
                No fue posible cargar los cobros del período.
              </div>
            ) : cobrosRegenerables.length === 0 ? (
              <div className="pagos-mensuales__notice">
                No hay cobros generados en {etiquetaMes(mesSeleccionado)} {anioSeleccionado} con los filtros activos.
              </div>
            ) : (
              <>
                <div className="pagos-mensuales__seleccion">
                  <Button variant="outline-secondary" size="sm" onClick={() => setSeleccionRegenerar(seleccionarPagina(cobrosPagina))}>
                    Seleccionar página ({cobrosPagina.length})
                  </Button>
                  <Button variant="outline-secondary" size="sm" onClick={() => setSeleccionRegenerar(seleccionarTodosFiltrados(cobrosRegenerables))}>
                    Seleccionar todos ({cobrosRegenerables.length})
                  </Button>
                  <Button variant="outline-secondary" size="sm" onClick={() => setSeleccionRegenerar([])} disabled={seleccionRegenerar.length === 0}>
                    Quitar selección
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => setIdsRevision(seleccionRegenerar)} disabled={seleccionRegenerar.length === 0}>
                    Regenerar seleccionados
                  </Button>
                  <p className="pagos-mensuales__seleccion-alcance">{alcanceRegenerar.texto}</p>
                </div>
                <div className="pagos-mensuales__table-wrap table-responsive">
                  <Table hover responsive="lg" className="pagos-mensuales__table w-100">
                    <thead>
                      <tr>
                        <th className="pagos-mensuales__col-check">
                          <span className="visually-hidden">Selección de la fila</span>
                        </th>
                        <th>Cobro</th>
                        <th>Cliente</th>
                        <th>Compañía</th>
                        <th>Monto</th>
                        <th>Estado</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {cobrosPagina.map((pago) => {
                        const compania = condicionCobro(pago, "compania_nombre");
                        return (
                          <tr key={pago.id}>
                            <td>
                              <Form.Check
                                type="checkbox"
                                checked={seleccionRegenerar.includes(pago.id)}
                                onChange={() => setSeleccionRegenerar((actual) => alternarSeleccion(actual, pago.id))}
                                aria-label={`Seleccionar cobro ${pago.id}`}
                              />
                            </td>
                            <td>{pago.id}</td>
                            <td>{pago.cliente?.nombre_completo || "—"}</td>
                            <td>{compania.texto}</td>
                            <td>${Number(pago.monto).toFixed(2)}</td>
                            <td>{pago.estado || "—"}</td>
                            <td>
                              <Button variant="outline-secondary" size="sm" onClick={() => setIdsRevision([pago.id])}>
                                Regenerar cobro
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
                {totalPaginasRegenerar > 1 ? (
                  <div className="pagos-mensuales__seleccion">
                    <Button variant="outline-secondary" size="sm" disabled={paginaRegenerarVisible <= 1} onClick={() => setPaginaRegenerar((pagina) => Math.max(1, pagina - 1))}>
                      Anterior
                    </Button>
                    <span>
                      Página {paginaRegenerarVisible} de {totalPaginasRegenerar}
                    </span>
                    <Button variant="outline-secondary" size="sm" disabled={paginaRegenerarVisible >= totalPaginasRegenerar} onClick={() => setPaginaRegenerar((pagina) => Math.min(totalPaginasRegenerar, pagina + 1))}>
                      Siguiente
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="pagos-mensuales__section mb-0">
            <div className="pagos-mensuales__section-title">
              <i className="fas fa-list" aria-hidden="true" />
              Pólizas activas
            </div>
            <div className="pagos-mensuales__summary">
              Mostrando <strong>{polizasFiltradas.length}</strong> de{" "}
              <strong>{polizas.length}</strong> coberturas
            </div>

            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" style={{ color: "#1a365d" }} />
              </div>
            ) : (
              <div className="pagos-mensuales__table-wrap table-responsive">
                <Table hover responsive="lg" className="pagos-mensuales__table w-100">
                  <thead className="text-center">
                    <tr>
                      <th>ID GF</th>
                      <th>ID Póliza</th>
                      <th>Producto</th>
                      <th>Cliente</th>
                      <th>Pagador</th>
                      <th>Compañía</th>
                      <th>Precio</th>
                      <th>Día de Pago</th>
                      <th>Tipo de Pago</th>
                      <th>Responsable</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {polizasFiltradas.map((p) => (
                      <tr key={p.id}>
                        <td>
                          {p.grupo_familiar_id ? (
                            <Link
                              to={`/grupo_familiar/${p.grupo_familiar_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="pagos-mensuales__link"
                              title={`Ver grupo familiar #${p.grupo_familiar_id}`}
                            >
                              {p.grupo_familiar_id}
                            </Link>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>{p.codigo_poliza}</td>
                        <td className="pagos-mensuales__producto">
                          {catalogoProductos.find((producto) => producto.id === p.producto_id)?.etiqueta
                            || "Sin producto"}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {renderClienteLink(
                            p.cliente?.id || p.cliente_id,
                            p.cliente?.nombre_completo || "-"
                          )}
                          {p.parentesco === "TOMADOR" && (
                            <Badge className="ms-2 pagos-mensuales__badge-tomador">Tomador</Badge>
                          )}
                        </td>
                        <td>{p.pagador?.nombre_completo || (p.pagador_id == null || p.pagador_id === "" ? "Pagador externo" : "-")}</td>
                        <td>{p.compania?.nombre || "-"}</td>
                        <td>{p.precio ? `$${Number(p.precio).toFixed(2)}` : "-"}</td>
                        <td className="text-center">{p.dia_pago || "-"}</td>
                        <td className="text-center">{p.tipo_pago || "-"}</td>
                        <td>{p.grupo_familiar?.responsable || "-"}</td>
                        <td className="text-center">
                          {p.activo ? (
                            <Badge bg="success" className="pagos-mensuales__badge-estado">
                              Activa
                            </Badge>
                          ) : (
                            <Badge bg="secondary" className="pagos-mensuales__badge-estado">
                              Cancelada
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        show={showInconsistenciasModal}
        onHide={() => setShowInconsistenciasModal(false)}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>Coberturas por corregir</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-1">
            Período: <strong>{etiquetaMes(mesSeleccionado)} {anioSeleccionado}</strong>
          </p>
          <p className="mb-3">
            Hay {inconsistenciasDetalle.inconsistencias.length}{" "}
            {inconsistenciasDetalle.inconsistencias.length === 1
              ? "cobertura que requiere"
              : "coberturas que requieren"}{" "}
            corrección antes de generar los cobros.
          </p>
          <div className="table-responsive" style={{ maxHeight: "50vh" }}>
            <Table bordered hover size="sm" className="mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>ID GF</th>
                  <th>Póliza</th>
                  <th>Cliente</th>
                  <th>Motivos</th>
                </tr>
              </thead>
              <tbody>
                {inconsistenciasDetalle.inconsistencias.map((item, idx) => (
                  <tr key={`${item.cobertura_id}-${idx}`}>
                    <td className="text-nowrap">
                      {item.grupo_familiar_id ? (
                        <>
                          <div>{item.grupo_familiar_id}</div>
                          <Link
                            to={`/grupo_familiar/${item.grupo_familiar_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pagos-mensuales__link"
                          >
                            Ir a corregir
                          </Link>
                        </>
                      ) : (
                        "—"
                      )}
                      {item.grupo_contacto ? (
                        <div className="text-muted small">{item.grupo_contacto}</div>
                      ) : null}
                    </td>
                    <td>
                      <div className="fw-semibold">{item.codigo_poliza || "—"}</div>
                      <div className="text-muted small">
                        Cobertura {item.cobertura_id}
                        {detalleLote[item.cobertura_id]?.producto
                          ? ` · ${detalleLote[item.cobertura_id].producto}`
                          : ""}
                      </div>
                    </td>
                    <td>{item.cliente_nombre || "—"}</td>
                    <td>
                      <ul className="mb-0 ps-3">
                        {(item.motivos || []).map((motivo, mIdx) => (
                          <li key={mIdx}>{motivo}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowInconsistenciasModal(false)}>
            Aceptar
          </Button>
          <Button
            variant="outline-primary"
            onClick={() => {
              setShowInconsistenciasModal(false);
              void cargarVistaPrevia({ ids: idsLoteRef.current });
            }}
          >
            Volver a validar
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showProductosHabilitados}
        onHide={() => {
          if (!guardandoProductos) setShowProductosHabilitados(false);
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Productos habilitados para generar cobros</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {resumenFiltros ? <p>{resumenFiltros}</p> : null}
          <p className="text-muted small">
            Estos productos pueden generar cobros nuevos. Aceptar guarda la selección y continúa la revisión.
          </p>
          {catalogoProductos.map((producto) => (
            <Form.Check
              key={`config-${producto.id}`}
              id={`config-producto-${producto.id}`}
              type="checkbox"
              label={producto.etiqueta}
              className="mb-2"
              checked={borradorProductos.includes(producto.id)}
              disabled={guardandoProductos}
              onChange={() => {
                setBorradorProductos((actual) => (
                  actual.includes(producto.id)
                    ? actual.filter((id) => id !== producto.id)
                    : [...actual, producto.id]
                ));
              }}
            />
          ))}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setShowProductosHabilitados(false)}
            disabled={guardandoProductos}
          >
            Cancelar
          </Button>
          <Button
            className="pagos-mensuales__btn-primary"
            onClick={() => void aceptarProductosHabilitados()}
            disabled={guardandoProductos}
          >
            {guardandoProductos ? "Guardando…" : "Aceptar"}
          </Button>
        </Modal.Footer>
      </Modal>

      <RegenerarCobrosModal
        show={idsRevision.length > 0}
        pagoIds={idsRevision}
        periodo={mesSeleccionado && anioSeleccionado ? `${etiquetaMes(mesSeleccionado)} ${anioSeleccionado}` : ""}
        onCancel={() => setIdsRevision([])}
        onGuardado={(mensaje) => {
          mostrarAlerta(mensaje, "success", 8000);
          setIdsRevision([]);
          setSeleccionRegenerar((actual) => actual.filter((id) => !idsRevision.includes(id)));
          setResumenVersion((version) => version + 1);
        }}
      />

      <VistaPreviaCobrosModal
        show={showVistaPrevia}
        vista={vistaPrevia}
        detallePorCobertura={detalleLote}
        error={errorVista}
        generando={loading}
        validando={validandoPagosMes}
        onCancel={cerrarVistaPrevia}
        alcance={resumenFiltros}
        onActualizar={() => void cargarVistaPrevia({ ids: idsLoteRef.current })}
        onConfirmar={(revision) => void handleGenerarCobros(revision)}
      />
    </Container>
  );
};

export default TablaConfiguracionPagos;
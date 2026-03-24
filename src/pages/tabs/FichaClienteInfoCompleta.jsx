import React, { useMemo } from "react";
import { Card, Row, Col, Badge } from "react-bootstrap";
import { useFichaCliente } from "../../context/fichaClienteContext";

const NotAvailable = ({ children = "—" }) => (
  <span className="text-muted">{children}</span>
);

export default function FichaClienteInfoCompleta() {
  const { cliente, formatDate } = useFichaCliente();

  const telefonosFormateados = useMemo(() => {
    if (!cliente) return [];

    let telefonos = [];

    if (Array.isArray(cliente.telefonos)) {
      telefonos = cliente.telefonos;
    } else if (
      typeof cliente.telefonos === "string" &&
      cliente.telefonos.trim().startsWith("[")
    ) {
      try {
        const parsed = JSON.parse(cliente.telefonos);
        if (Array.isArray(parsed)) telefonos = parsed;
      } catch {
        telefonos = [];
      }
    }

    if (telefonos.length === 0) {
      return cliente.telefono ? [cliente.telefono] : [];
    }

    const ordenados = [...telefonos].sort(
      (a, b) => (b?.principal ? 1 : 0) - (a?.principal ? 1 : 0)
    );

    return ordenados.map((t) => {
      const indicativo = t?.indicativo ? `+${t.indicativo} ` : "";
      const numero = t?.numero || "";
      const tipo = t?.tipo ? ` (${t.tipo})` : "";
      const principal = t?.principal ? " [Principal]" : "";
      return `${indicativo}${numero}${tipo}${principal}`.trim();
    });
  }, [cliente]);

  const edad = useMemo(() => {
    if (!cliente?.fecha_nacimiento) return null;
    try {
      const birth = new Date(cliente.fecha_nacimiento);
      const today = new Date();
      let years = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        years--;
      }
      return years;
    } catch {
      return null;
    }
  }, [cliente?.fecha_nacimiento]);

  if (!cliente) {
    return (
      <div className="alert alert-warning mb-0">
        No se pudo cargar la información del cliente.
      </div>
    );
  }

  return (
    <div className="mt-3">
      {/* Datos Principales */}
      <Row className="g-3 mb-3">
        <Col>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-light">
              <h6 className="mb-0 text-primary">Datos Principales</h6>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <dl className="row mb-0">
                    <dt className="col-sm-4">ID Cliente</dt>
                    <dd className="col-sm-8">
                      {cliente.id ?? <NotAvailable />}
                    </dd>

                    <dt className="col-sm-4">Nombre Completo</dt>
                    <dd className="col-sm-8">
                      {cliente.nombre_completo || <NotAvailable />}
                    </dd>

                    <dt className="col-sm-4">Tipo Documento</dt>
                    <dd className="col-sm-8">
                      {cliente.tipo_documento || <NotAvailable />}
                    </dd>

                    <dt className="col-sm-4">Número Documento</dt>
                    <dd className="col-sm-8">
                      {cliente.numero_documento || <NotAvailable />}
                    </dd>
                  </dl>
                </Col>
                <Col md={6}>
                  <dl className="row mb-0">
                    <dt className="col-sm-4">Fecha Nacimiento</dt>
                    <dd className="col-sm-8">
                      {cliente.fecha_nacimiento
                        ? formatDate?.(cliente.fecha_nacimiento) ??
                          cliente.fecha_nacimiento
                        : <NotAvailable />}
                    </dd>

                    <dt className="col-sm-4">Edad</dt>
                    <dd className="col-sm-8">
                      {edad != null ? `${edad} años` : <NotAvailable />}
                    </dd>

                    <dt className="col-sm-4">Estado Cliente</dt>
                    <dd className="col-sm-8">
                      {cliente.estado ? (
                        <Badge bg="success">{cliente.estado}</Badge>
                      ) : (
                        <NotAvailable />
                      )}
                    </dd>

                    <dt className="col-sm-4">Estado Civil</dt>
                    <dd className="col-sm-8">
                      {cliente.estado_civil || <NotAvailable />}
                    </dd>
                  </dl>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Estatus migratorio */}
      <Row className="g-3 mb-3">
        <Col>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-light">
              <h6 className="mb-0 text-primary">Estatus migratorio</h6>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <dl className="row mb-0">
                    <dt className="col-sm-4">Status</dt>
                    <dd className="col-sm-8">
                      {cliente.status || <NotAvailable />}
                    </dd>

                    <dt className="col-sm-4">Social</dt>
                    <dd className="col-sm-8">
                      {cliente.social || <NotAvailable />}
                    </dd>

                    <dt className="col-sm-4">A/USCIS</dt>
                    <dd className="col-sm-8">
                      {cliente.auscis || <NotAvailable />}
                    </dd>
                  </dl>
                </Col>
                <Col md={6}>
                  <dl className="row mb-0">
                    <dt className="col-sm-4">Tarjeta #</dt>
                    <dd className="col-sm-8">
                      {cliente.tarjeta_numero || <NotAvailable />}
                    </dd>

                    <dt className="col-sm-4">Fecha Emisión</dt>
                    <dd className="col-sm-8">
                      {cliente.fecha_emision
                        ? formatDate?.(cliente.fecha_emision) ??
                          cliente.fecha_emision
                        : <NotAvailable />}
                    </dd>

                    <dt className="col-sm-4">Fecha Expedición</dt>
                    <dd className="col-sm-8">
                      {cliente.fecha_expedicion
                        ? formatDate?.(cliente.fecha_expedicion) ??
                          cliente.fecha_expedicion
                        : <NotAvailable />}
                    </dd>
                  </dl>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Datos de Contacto */}
      <Row className="g-3 mb-3">
        <Col>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-light">
              <h6 className="mb-0 text-primary">Datos de Contacto</h6>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <dl className="row mb-0">
                    <dt className="col-sm-4">Teléfonos</dt>
                    <dd className="col-sm-8">
                      {telefonosFormateados.length ? (
                        <ul className="list-unstyled mb-0">
                          {telefonosFormateados.map((t, idx) => (
                            <li key={idx}>{t}</li>
                          ))}
                        </ul>
                      ) : cliente.telefono ? (
                        cliente.telefono
                      ) : (
                        <NotAvailable />
                      )}
                    </dd>

                    <dt className="col-sm-4">Correo</dt>
                    <dd className="col-sm-8">
                      {cliente.email || <NotAvailable />}
                    </dd>
                  </dl>
                </Col>
                <Col md={6}>
                  <dl className="row mb-0">
                    <dt className="col-sm-4">Idioma</dt>
                    <dd className="col-sm-8">
                      {cliente.idioma || <NotAvailable />}
                    </dd>

                    <dt className="col-sm-4">Género</dt>
                    <dd className="col-sm-8">
                      {cliente.genero || <NotAvailable />}
                    </dd>

                    <dt className="col-sm-4">Medio de Contacto</dt>
                    <dd className="col-sm-8">
                      {cliente.medio_contacto || <NotAvailable />}
                    </dd>
                  </dl>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Dirección */}
      <Row className="g-3 mb-3">
        <Col>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-light">
              <h6 className="mb-0 text-primary">Dirección</h6>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <dl className="row mb-0">
                    <dt className="col-sm-4">Dirección</dt>
                    <dd className="col-sm-8">
                      {cliente.direccion || <NotAvailable />}
                    </dd>

                    <dt className="col-sm-4">Ciudad</dt>
                    <dd className="col-sm-8">
                      {cliente.ciudad || <NotAvailable />}
                    </dd>

                    <dt className="col-sm-4">Estado / Provincia</dt>
                    <dd className="col-sm-8">
                      {cliente.estado_residencia || cliente.estado || <NotAvailable />}
                    </dd>
                  </dl>
                </Col>
                <Col md={6}>
                  <dl className="row mb-0">
                    <dt className="col-sm-4">Código Postal</dt>
                    <dd className="col-sm-8">
                      {cliente.codigo_postal || <NotAvailable />}
                    </dd>

                    <dt className="col-sm-4">Condado</dt>
                    <dd className="col-sm-8">
                      {cliente.condado || <NotAvailable />}
                    </dd>

                    <dt className="col-sm-4">Dir. Correspondencia</dt>
                    <dd className="col-sm-8">
                      {cliente.dir_correspondencia || <NotAvailable />}
                    </dd>
                  </dl>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Datos de Empleo e Ingreso */}
      <Row className="g-3 mb-3">
        <Col>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-light">
              <h6 className="mb-0 text-primary">Datos de Empleo e Ingreso</h6>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <dl className="row mb-0">
                    <dt className="col-sm-4">Tipo de Ingreso</dt>
                    <dd className="col-sm-8">
                      {cliente.tipo_ingreso || <NotAvailable />}
                    </dd>

                    <dt className="col-sm-4">Actividad Económica</dt>
                    <dd className="col-sm-8">
                      {cliente.actividad_economica || <NotAvailable />}
                    </dd>

                    <dt className="col-sm-4">Empleador</dt>
                    <dd className="col-sm-8">
                      {cliente.empleador || <NotAvailable />}
                    </dd>

                    <dt className="col-sm-4">Teléfono Empleador</dt>
                    <dd className="col-sm-8">
                      {cliente.telefono_empleador || <NotAvailable />}
                    </dd>
                  </dl>
                </Col>
                <Col md={6}>
                  <dl className="row mb-0">
                    <dt className="col-sm-5">Período de Ingreso</dt>
                    <dd className="col-sm-7">
                      {cliente.periodo_ingreso ? (
                        <Badge bg="secondary">{cliente.periodo_ingreso}</Badge>
                      ) : (
                        <NotAvailable />
                      )}
                    </dd>

                    <dt className="col-sm-5">Ingreso por Período</dt>
                    <dd className="col-sm-7">
                      {cliente.ingreso_por_periodo != null
                        ? `$${Number(cliente.ingreso_por_periodo).toLocaleString()}`
                        : <NotAvailable />}
                    </dd>

                    <dt className="col-sm-5">Ingreso Anual</dt>
                    <dd className="col-sm-7">
                      {cliente.ingreso_anual != null
                        ? `$${Number(cliente.ingreso_anual).toLocaleString()}`
                        : <NotAvailable />}
                    </dd>
                  </dl>
                </Col>
              </Row>

              {(cliente.periodo_ingreso_ocasional ||
                cliente.ingreso_por_periodo_ocasional ||
                cliente.nota_ingreso_ocasional) && (
                <div className="mt-4">
                  <h6 className="border-bottom pb-2 small text-uppercase text-muted">
                    Otro Ingreso
                  </h6>
                  <Row>
                    <Col md={12}>
                      <dl className="row mb-0">
                        <dt className="col-sm-2">Período</dt>
                        <dd className="col-sm-4">
                          {cliente.periodo_ingreso_ocasional ? (
                            <Badge bg="secondary">
                              {cliente.periodo_ingreso_ocasional}
                            </Badge>
                          ) : (
                            <NotAvailable />
                          )}
                        </dd>

                        <dt className="col-sm-2">Monto</dt>
                        <dd className="col-sm-4">
                          {cliente.ingreso_por_periodo_ocasional != null
                            ? `$${Number(
                                cliente.ingreso_por_periodo_ocasional
                              ).toLocaleString()}`
                            : <NotAvailable />}
                        </dd>
                      </dl>

                      {cliente.nota_ingreso_ocasional && (
                        <div className="mt-3">
                          <small className="text-muted">Nota:</small>
                          <p className="mb-0 small">
                            {cliente.nota_ingreso_ocasional}
                          </p>
                        </div>
                      )}
                    </Col>
                  </Row>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

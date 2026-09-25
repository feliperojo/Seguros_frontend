import { useEffect, useMemo, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { FaArrowDown, FaArrowUp, FaColumns, FaSearch } from "react-icons/fa";
import {
  COLUMNAS_DIRECTORIO,
  COLUMNAS_PREDETERMINADAS,
  GRUPOS_COLUMNAS,
} from "../../pages/directorioGruposColumnas";

const DirectorioGruposColumnasModal = ({ show, seleccion, onHide, onAplicar }) => {
  const [borrador, setBorrador] = useState(seleccion);
  const [busqueda, setBusqueda] = useState("");
  const [arrastrando, setArrastrando] = useState(null);

  useEffect(() => {
    if (show) {
      setBorrador(seleccion);
      setBusqueda("");
    }
  }, [show, seleccion]);

  const consulta = busqueda.trim().toLowerCase();

  const gruposVisibles = useMemo(() => {
    return GRUPOS_COLUMNAS.map((grupo) => ({
      ...grupo,
      columnas: COLUMNAS_DIRECTORIO.filter((columna) => {
        if (columna.grupo !== grupo.id) return false;
        if (!consulta) return true;
        return (
          columna.label.toLowerCase().includes(consulta) ||
          columna.hint.toLowerCase().includes(consulta)
        );
      }),
    })).filter((grupo) => grupo.columnas.length > 0);
  }, [consulta]);

  const alternar = (clave) => {
    setBorrador((prev) => {
      if (prev.includes(clave)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== clave);
      }
      return [...prev, clave];
    });
  };

  const mover = (desde, hacia) => {
    setBorrador((prev) => {
      if (hacia < 0 || hacia >= prev.length || desde === hacia) return prev;
      const next = [...prev];
      const [item] = next.splice(desde, 1);
      next.splice(hacia, 0, item);
      return next;
    });
  };

  const columnasOrden = borrador
    .map((clave) => COLUMNAS_DIRECTORIO.find((columna) => columna.key === clave))
    .filter(Boolean);

  const alternarGrupo = (columnas) => {
    const claves = columnas.map((columna) => columna.key);
    setBorrador((prev) => {
      const todas = claves.every((clave) => prev.includes(clave));
      if (!todas) return [...new Set([...prev, ...claves])];
      const restantes = prev.filter((clave) => !claves.includes(clave));
      return restantes.length ? restantes : [claves[0]];
    });
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="xl"
      centered
      scrollable
      className="ccr-columnas-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center gap-2">
          <FaColumns aria-hidden="true" />
          Columnas del directorio
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="ccr-columnas-intro">
          Elige qué datos quieres ver y en qué orden. Arrastra una columna o usa las flechas. La
          tabla y el Excel salen en ese mismo orden.
        </p>
        <div className="ccr-columnas-orden" aria-label="Orden de las columnas">
          {columnasOrden.map((columna, indice) => (
            <div
              key={columna.key}
              className={`ccr-columnas-orden__item${arrastrando === indice ? " is-dragging" : ""}`}
              draggable
              onDragStart={() => setArrastrando(indice)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (arrastrando !== null) mover(arrastrando, indice);
                setArrastrando(null);
              }}
              onDragEnd={() => setArrastrando(null)}
            >
              <span className="ccr-columnas-orden__puesto">{indice + 1}</span>
              <span className="ccr-columnas-orden__nombre">{columna.label}</span>
              <button
                type="button"
                aria-label={`Subir ${columna.label}`}
                disabled={indice === 0}
                onClick={() => mover(indice, indice - 1)}
              >
                <FaArrowUp />
              </button>
              <button
                type="button"
                aria-label={`Bajar ${columna.label}`}
                disabled={indice === columnasOrden.length - 1}
                onClick={() => mover(indice, indice + 1)}
              >
                <FaArrowDown />
              </button>
            </div>
          ))}
        </div>
        <div className="ccr-columnas-buscar">
          <FaSearch aria-hidden="true" />
          <Form.Control
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar una columna"
            aria-label="Buscar una columna"
          />
        </div>

        {gruposVisibles.length === 0 ? (
          <p className="ccr-columnas-vacio">No hay columnas con ese nombre.</p>
        ) : (
          gruposVisibles.map((grupo) => {
            const marcadas = grupo.columnas.filter((columna) =>
              borrador.includes(columna.key)
            ).length;
            const todas = marcadas === grupo.columnas.length;
            return (
              <section key={grupo.id} className="ccr-columnas-grupo">
                <div className="ccr-columnas-grupo__head">
                  <div>
                    <h2>{grupo.titulo}</h2>
                    <p>{grupo.descripcion}</p>
                  </div>
                  <button
                    type="button"
                    className="ccr-columnas-grupo__accion"
                    onClick={() => alternarGrupo(grupo.columnas)}
                  >
                    {todas ? "Quitar estas" : "Marcar estas"}
                    <span>
                      {marcadas}/{grupo.columnas.length}
                    </span>
                  </button>
                </div>
                <div className="ccr-columnas-grid">
                  {grupo.columnas.map((columna) => {
                    const activa = borrador.includes(columna.key);
                    const esLaUltima = activa && borrador.length === 1;
                    return (
                      <label
                        key={columna.key}
                        className={`ccr-columna-opcion${activa ? " is-on" : ""}`}
                      >
                        <Form.Check
                          type="checkbox"
                          checked={activa}
                          disabled={esLaUltima}
                          onChange={() => alternar(columna.key)}
                          aria-label={columna.label}
                        />
                        <span>
                          <strong>{columna.label}</strong>
                          <small>{columna.hint}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </Modal.Body>
      <Modal.Footer>
        <span className="ccr-columnas-resumen me-auto">
          {borrador.length} de {COLUMNAS_DIRECTORIO.length} columnas
        </span>
        <Button
          variant="link"
          className="ccr-columnas-restaurar"
          onClick={() => setBorrador([...COLUMNAS_PREDETERMINADAS])}
        >
          Vista inicial
        </Button>
        <Button variant="outline-secondary" onClick={onHide}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={() => onAplicar(borrador)}>
          Aplicar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DirectorioGruposColumnasModal;

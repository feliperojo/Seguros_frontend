function ExistingClientPickerModal({
    open,
    onClose,
    onConfirm,         // (selected, extras) => void
    ownerClientId,     // model.id (cliente dueño)
  }) {
    const [term, setTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [selected, setSelected] = useState(null);
  
    // extras de vínculo
    const [relacion, setRelacion] = useState('');
    const [pertenece, setPertenece] = useState(false);
    const [nota, setNota] = useState('');
  
    useEffect(() => {
      if (!open) return;
      setTerm('');
      setResults([]);
      setSelected(null);
      setRelacion('');
      setPertenece(false);
      setNota('');
    }, [open]);
  
    useEffect(() => {
      if (!open) return;
      const id = setTimeout(async () => {
        const q = term.trim();
        if (q.length < 2) { setResults([]); return; }
        setLoading(true);
        try {
          const res = await apiRequest(`/cliente/buscar?nombre=${encodeURIComponent(q)}`, "GET");
          const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
          // evita que aparezca el dueño como candidato a sí mismo
          setResults(list.filter(x => x.id !== ownerClientId));
        } catch (e) {
          console.error(e);
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 300);
      return () => clearTimeout(id);
    }, [term, open, ownerClientId]);
  
    if (!open) return null;
  
    return (
      <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,.35)' }}>
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h6 className="modal-title">Asociar cliente existente como contacto</h6>
              <button className="btn-close" onClick={onClose}></button>
            </div>
  
            <div className="modal-body">
              <div className="mb-2">
                <input
                  className="form-control form-control-sm"
                  placeholder="Buscar por nombre…"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                />
              </div>
  
              <div className="table-responsive" style={{ maxHeight: 260 }}>
                <table className="table table-sm align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Nombre</th>
                      <th>Idioma</th>
                      <th>Teléfono</th>
                      <th style={{width: 90}}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={4} className="text-center text-muted py-3">Buscando…</td></tr>
                    ) : results.length === 0 ? (
                      <tr><td colSpan={4} className="text-center text-muted py-3">Sin resultados.</td></tr>
                    ) : results.map(r => {
                        const tel = r.telefono || (Array.isArray(r.telefonos) && r.telefonos[0]?.numero) || '—';
                        const isSel = selected?.id === r.id;
                        return (
                          <tr key={r.id} className={isSel ? 'table-primary' : ''}>
                            <td className="fw-semibold">{r.nombre_completo}</td>
                            <td>{r.tipo_cliente || '—'}</td>
                            <td>{tel}</td>
                            <td className="text-end">
                              <button
                                className={`btn btn-sm ${isSel ? 'btn-secondary' : 'btn-outline-primary'}`}
                                onClick={() => setSelected(isSel ? null : r)}
                              >
                                {isSel ? 'Quitar' : 'Seleccionar'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
  
              <hr className="my-3" />
  
              <div className="row g-2">
                <div className="col-md-4">
                  <label className="form-label small">Relación</label>
                  <select className="form-select form-select-sm" value={relacion} onChange={e=>setRelacion(e.target.value)}>
                    <option value="">Seleccione…</option>
                    <option>Tomador</option>
                    <option>Apoderado</option>
                    <option>Familiar</option>
                    <option>Contacto</option>
                    <option>Otro</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small">¿Pertenece al Grupo Familiar?</label>
                  <select className="form-select form-select-sm" value={pertenece ? '1':'0'} onChange={e=>setPertenece(e.target.value==='1')}>
                    <option value="0">No</option>
                    <option value="1">Sí</option>
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label small">Nota</label>
                  <input className="form-control form-control-sm" value={nota} onChange={e=>setNota(e.target.value)} />
                </div>
              </div>
  
            </div>
  
            <div className="modal-footer">
              <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>Cerrar</button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!selected || !relacion}
                onClick={() => onConfirm(selected, { relacion, pertenece: !!pertenece, nota })}
              >
                Asociar contacto
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
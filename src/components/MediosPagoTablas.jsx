import React, { useState, useEffect } from 'react';
import { Button } from 'react-bootstrap';
import { FaEye, FaEdit, FaTrashAlt, FaLock, FaUnlock } from 'react-icons/fa';
import PasswordUnlockModal from './PasswordUnlockModal';

const MediosPagoTablas = ({ mediosPago, onView, onEdit, onDelete, showActions = true }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [unlockExpiry, setUnlockExpiry] = useState(null);

  const inferFormaPago = (medio) => {
    const fp = medio?.forma_pago;
    if (fp) return fp;
    // Fallback: si backend no envía forma_pago, inferir por campos
    if (medio?.cuenta_numero || medio?.banco || medio?.ruta) return "cuenta_bancaria";
    if (medio?.numero_tarjeta || medio?.tipo_tarjeta || medio?.cvv) return "tarjeta";
    return null;
  };

  // Verificar si el desbloqueo sigue vigente
  useEffect(() => {
    if (unlockExpiry && new Date() > unlockExpiry) {
      setIsUnlocked(false);
      setUnlockExpiry(null);
    }
  }, [unlockExpiry]);

  // Función para enmascarar número de tarjeta (mostrar solo últimos 4 dígitos)
  const maskCardNumber = (cardNumber) => {
    if (!cardNumber) return '-';
    const cleaned = cardNumber.replace(/\s/g, '');
    if (cleaned.length <= 4) return '****';
    const last4 = cleaned.slice(-4);
    // Determinar cuántos grupos de 4 caracteres hay (normalmente 3 o 4 para tarjetas)
    const totalGroups = Math.ceil(cleaned.length / 4);
    const groupsToMask = totalGroups - 1; // Todos menos el último grupo
    const maskedGroups = Array(groupsToMask).fill('****').join(' ');
    return `${maskedGroups} ${last4}`;
  };

  // Función para enmascarar CVV
  const maskCVV = () => {
    return '***';
  };

  const handleUnlock = () => {
    setShowPasswordModal(true);
  };

  const handleUnlockSuccess = () => {
    setIsUnlocked(true);
    // Desbloquear por 5 minutos
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 5);
    setUnlockExpiry(expiry);
  };

  const handleLock = () => {
    setIsUnlocked(false);
    setUnlockExpiry(null);
  };
  const tarjetas = mediosPago.filter((m) => {
    const fp = inferFormaPago(m);
    return fp === "tarjeta" || fp === "tarjeta_credito" || fp === "tarjeta_debito";
  });
  const cuentasBancarias = mediosPago.filter((m) => inferFormaPago(m) === "cuenta_bancaria");
  
  // Verificar si hay datos sensibles que necesiten protección
  const hasSensitiveData = tarjetas.length > 0 || cuentasBancarias.length > 0;
  
  // Función auxiliar para determinar el tipo de pago (Crédito/Débito)
  const getTipoPago = (medio) => {
    const fp = inferFormaPago(medio);
    if (fp === 'tarjeta_debito' || medio.tipo_tarjeta_pago === 'debito') {
      return 'Débito';
    }
    if (fp === 'tarjeta_credito' || medio.tipo_tarjeta_pago === 'credito') {
      return 'Crédito';
    }
    // Si viene como 'tarjeta' genérico, intentar determinar por tipo_tarjeta_pago
    if (fp === 'tarjeta') {
      return medio.tipo_tarjeta_pago === 'debito' ? 'Débito' : 'Crédito';
    }
    return 'N/A';
  };

  const renderPrincipal = (medio) => {
    const isPrincipal =
      medio?.es_principal === true || medio?.es_principal === 1 || medio?.es_principal === "1";
    return isPrincipal ? (
      <span className="badge bg-primary">Principal</span>
    ) : (
      <span className="text-muted">—</span>
    );
  };

  const formatVencimiento = (value) => {
    if (!value) return "-";
    const raw = String(value).trim();
    if (!raw) return "-";

    // Si ya viene como MM/AAAA, respetarlo
    const mmYyyy = raw.match(/^(0[1-9]|1[0-2])\/(\d{4})$/);
    if (mmYyyy) return raw;

    // Si viene como YYYY-MM o YYYY-MM-DD (o ISO con hora)
    const iso = raw.match(/^(\d{4})-(\d{2})/);
    if (iso) {
      const [, yyyy, mm] = iso;
      return `${mm}/${yyyy}`;
    }

    // Último intento: Date parseable
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = String(d.getFullYear());
      return `${mm}/${yyyy}`;
    }

    // Fallback: devolver tal cual si no se pudo inferir
    return raw;
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Tarjetas de Crédito/Débito</h5>
        {hasSensitiveData && (
          !isUnlocked ? (
            <Button
              variant="outline-primary"
              size="sm"
              onClick={handleUnlock}
              className="d-flex align-items-center gap-2"
            >
              <FaLock />
              Desbloquear Datos Sensibles
            </Button>
          ) : (
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handleLock}
              className="d-flex align-items-center gap-2"
            >
              <FaUnlock />
              Bloquear Datos
            </Button>
          )
        )}
      </div>
      {tarjetas.length === 0 ? (
        <p>No hay tarjetas registradas.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-bordered table-sm">
             <thead>
                <tr>
                    <th>Principal</th>
                    <th>Tipo de Pago</th>
                    <th>Tipo</th>
                    <th>Quien paga</th>
                    <th>Titular</th>
                    <th>Direccion</th>
                    <th>Número</th>
                    <th>Vencimiento</th>
                    <th>CVV</th>
                    {showActions && <th>Acciones</th>}
                </tr>
                </thead>

          <tbody>
            {tarjetas.map((medio, index) => (
                    <tr key={medio.id}>
                        <td>{renderPrincipal(medio)}</td>
                        <td>{getTipoPago(medio)}</td>
                        <td>{medio.tipo_tarjeta}</td>
                        <td>{medio.quien_paga}</td>
                        <td>{medio.titular}</td>
                        <td>{medio.direccion}</td>
                        <td>
                          {isUnlocked ? medio.numero_tarjeta : maskCardNumber(medio.numero_tarjeta)}
                        </td>
                        <td>{formatVencimiento(medio.fecha_expiracion)}</td>
                        <td>
                          {isUnlocked ? (medio.cvv || '-') : maskCVV()}
                        </td>
                        {showActions && (
                        <td>
                            <div className="d-flex gap-2">
                            <button className="btn btn-sm btn-outline-success" onClick={() => onEdit(medio, index)}>
                                <FaEdit />
                            </button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(medio, index)}>
                                <FaTrashAlt />
                            </button>
                            </div>
                        </td>
                        )}
                    </tr>
                    ))}

          </tbody>
        </table>
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-3 mt-4">
        <h5 className="mb-0">Cuentas Bancarias</h5>
      </div>
      {cuentasBancarias.length === 0 ? (
        <p>No hay cuentas bancarias registradas.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-bordered table-sm">
          <thead>
                <tr>
                    <th>Principal</th>
                    <th>Banco</th>
                    <th>Quien paga</th>
                    <th>Titular</th>
                    <th>Dirección</th>
                    <th>Ruta/Código de Banco</th>
                    <th>Número de Cuenta</th>
                    {showActions && <th>Acciones</th>}
                </tr>
                </thead>

          <tbody>
          {cuentasBancarias.map((medio, index) => (
                    <tr key={medio.id}>
                        <td>{renderPrincipal(medio)}</td>
                        <td>{medio.banco}</td>
                        <td>{medio.quien_paga}</td>
                        <td>{medio.titular}</td>
                        <td>{medio.direccion}</td>
                        <td>{medio.ruta}</td>
                        <td>
                          {isUnlocked ? medio.cuenta_numero : maskCardNumber(medio.cuenta_numero)}
                        </td>
                        {showActions && (
                        <td>
                            <div className="d-flex gap-2">
                            <button className="btn btn-sm btn-outline-success" onClick={() => onEdit(medio, index)}>
                                <FaEdit />
                            </button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(medio, index)}>
                                <FaTrashAlt />
                            </button>
                            </div>
                        </td>
                        )}
                    </tr>
                    ))}

          </tbody>
        </table>
        </div>
      )}

      <PasswordUnlockModal
        show={showPasswordModal}
        onHide={() => setShowPasswordModal(false)}
        onSuccess={handleUnlockSuccess}
      />
    </>
  );
};

export default MediosPagoTablas;

/**
 * Componente de configuración para ingresar y guardar credenciales de RingCentral
 * Permite configurar Client ID, Client Secret, entorno y autenticación
 */

import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Button, 
  Form, 
  Alert, 
  Card, 
  Badge, 
  Spinner,
  InputGroup 
} from 'react-bootstrap';
import ringCentralService from '../../services/ringCentralService';
import { STORAGE_KEYS } from '../../utils/constants';
import RealtimeConnectionStatus from './RealtimeConnectionStatus';

const RingCentralConfig = ({ show, onClose, onAuthenticated }) => {
  const [step, setStep] = useState(1); // 1: Credenciales, 2: Autenticación
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Formulario de credenciales
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [environment, setEnvironment] = useState('sandbox');

  // Formulario de autenticación
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [extension, setExtension] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Cargar credenciales guardadas al abrir el modal
  useEffect(() => {
    if (show) {
      const savedClientId = localStorage.getItem(STORAGE_KEYS.RC_CLIENT_ID);
      const savedClientSecret = localStorage.getItem(STORAGE_KEYS.RC_CLIENT_SECRET);
      const savedEnvironment = localStorage.getItem(STORAGE_KEYS.RC_ENVIRONMENT) || 'sandbox';

      if (savedClientId) setClientId(savedClientId);
      if (savedClientSecret) setClientSecret(savedClientSecret);
      if (savedEnvironment) setEnvironment(savedEnvironment);

      // Verificar si ya está autenticado
      ringCentralService.initialize();
      if (ringCentralService.isAuthenticated()) {
        setStep(2);
        setSuccess('Ya estás autenticado con RingCentral');
      }
    }
  }, [show]);

  // Guardar credenciales
  const handleSaveCredentials = () => {
    if (!clientId || !clientSecret) {
      setError('Por favor, completa todos los campos');
      return;
    }

    try {
      ringCentralService.saveCredentials(clientId, clientSecret, environment);
      setSuccess('Credenciales guardadas correctamente');
      setError(null);
      setStep(2);
    } catch (error) {
      setError('Error al guardar las credenciales: ' + error.message);
      setSuccess(null);
    }
  };

  // Autenticar
  const handleAuthenticate = async () => {
    if (!username || !password) {
      setError('Por favor, ingresa tu usuario y contraseña');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await ringCentralService.authenticate(username, password, extension);
      setSuccess('Autenticación exitosa');
      
      // Llamar al callback si existe
      if (onAuthenticated) {
        setTimeout(() => {
          onAuthenticated();
          onClose();
        }, 1500);
      }
    } catch (error) {
      setError(error.message || 'Error al autenticar con RingCentral');
      setSuccess(null);
    } finally {
      setLoading(false);
    }
  };

  // Cerrar sesión
  const handleLogout = async () => {
    setLoading(true);
    try {
      await ringCentralService.logout();
      setSuccess('Sesión cerrada correctamente');
      setStep(1);
      setUsername('');
      setPassword('');
      setExtension('');
    } catch (error) {
      setError('Error al cerrar sesión: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Resetear formulario al cerrar
  const handleClose = () => {
    setStep(1);
    setError(null);
    setSuccess(null);
    setLoading(false);
    onClose();
  };

  const isAuthenticated = ringCentralService.isAuthenticated();

  return (
    <Modal show={show} onHide={handleClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-gear-fill"></i> Configuración de RingCentral
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <div className="mb-3">
          <RealtimeConnectionStatus minutes={60} />
        </div>

        {/* Indicador de pasos */}
        <div className="d-flex justify-content-center mb-4">
          <div className="d-flex align-items-center">
            <Badge bg={step >= 1 ? 'primary' : 'secondary'} className="px-3 py-2">
              1. Credenciales
            </Badge>
            <div className="mx-2" style={{ width: '50px', height: '2px', backgroundColor: step >= 2 ? '#0d6efd' : '#6c757d' }}></div>
            <Badge bg={step >= 2 ? 'primary' : 'secondary'} className="px-3 py-2">
              2. Autenticación
            </Badge>
          </div>
        </div>

        {/* Mensajes de error/éxito */}
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            <i className="bi bi-exclamation-triangle-fill"></i> {error}
          </Alert>
        )}

        {success && (
          <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
            <i className="bi bi-check-circle-fill"></i> {success}
          </Alert>
        )}

        {/* Paso 1: Credenciales */}
        {step === 1 && (
          <Card>
            <Card.Header>
              <h5 className="mb-0">Credenciales de la Aplicación</h5>
            </Card.Header>
            <Card.Body>
              <p className="text-muted">
                Ingresa las credenciales de tu aplicación RingCentral. 
                Puedes obtenerlas desde el{' '}
                <a href="https://developer.ringcentral.com" target="_blank" rel="noopener noreferrer">
                  Developer Portal
                </a>
              </p>

              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>
                    Client ID <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Ingresa tu Client ID"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>
                    Client Secret <span className="text-danger">*</span>
                  </Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Ingresa tu Client Secret"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                    />
                    <Button
                      variant="outline-secondary"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <i className={`bi bi-eye${showPassword ? '-slash' : ''}-fill`}></i>
                    </Button>
                  </InputGroup>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Entorno</Form.Label>
                  <Form.Select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                  >
                    <option value="sandbox">Sandbox (Desarrollo/Pruebas)</option>
                    <option value="production">Production (Producción)</option>
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Usa Sandbox para pruebas y Production para el entorno real
                  </Form.Text>
                </Form.Group>

                <div className="d-flex justify-content-end">
                  <Button
                    variant="primary"
                    onClick={handleSaveCredentials}
                    disabled={loading || !clientId || !clientSecret}
                  >
                    {loading ? (
                      <>
                        <Spinner size="sm" className="me-2" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-save"></i> Guardar y Continuar
                      </>
                    )}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        )}

        {/* Paso 2: Autenticación */}
        {step === 2 && (
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Autenticación</h5>
              {isAuthenticated && (
                <Badge bg="success">
                  <i className="bi bi-check-circle"></i> Autenticado
                </Badge>
              )}
            </Card.Header>
            <Card.Body>
              {isAuthenticated ? (
                <div>
                  <Alert variant="info">
                    <i className="bi bi-info-circle-fill"></i> Ya estás autenticado con RingCentral.
                    Puedes cerrar sesión si deseas cambiar de cuenta.
                  </Alert>
                  <Button variant="danger" onClick={handleLogout} disabled={loading}>
                    {loading ? (
                      <>
                        <Spinner size="sm" className="me-2" />
                        Cerrando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-box-arrow-right"></i> Cerrar Sesión
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-muted">
                    Ingresa tus credenciales de RingCentral para autenticarte.
                  </p>

                  <Form>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        Usuario / Email <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="usuario@ejemplo.com"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>
                        Contraseña <span className="text-danger">*</span>
                      </Form.Label>
                      <InputGroup>
                        <Form.Control
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Ingresa tu contraseña"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <Button
                          variant="outline-secondary"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          <i className={`bi bi-eye${showPassword ? '-slash' : ''}-fill`}></i>
                        </Button>
                      </InputGroup>
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Extensión (Opcional)</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Deja vacío si no tienes extensión"
                        value={extension}
                        onChange={(e) => setExtension(e.target.value)}
                      />
                      <Form.Text className="text-muted">
                        Solo necesario si tu cuenta requiere extensión
                      </Form.Text>
                    </Form.Group>

                    <div className="d-flex justify-content-between">
                      <Button variant="secondary" onClick={() => setStep(1)}>
                        <i className="bi bi-arrow-left"></i> Volver
                      </Button>
                      <Button
                        variant="primary"
                        onClick={handleAuthenticate}
                        disabled={loading || !username || !password}
                      >
                        {loading ? (
                          <>
                            <Spinner size="sm" className="me-2" />
                            Autenticando...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-key-fill"></i> Autenticar
                          </>
                        )}
                      </Button>
                    </div>
                  </Form>
                </>
              )}
            </Card.Body>
          </Card>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RingCentralConfig;


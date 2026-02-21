// src/hooks/useIncomingCalls.js
// Hook global para escuchar eventos incoming_call desde WebSocket (Laravel Echo)
// Escucha múltiples canales y evita eventos duplicados entre pestañas

import { useState, useEffect, useRef } from 'react';
import { buscarCliente } from '../services/apiService';
import { usersService } from '../services/adminApi';

// Importaciones dinámicas para Laravel Echo
let Echo = null;
let Pusher = null;

const loadEchoDependencies = async () => {
  if (Echo && Pusher) {
    return { Echo, Pusher };
  }

  try {
    const echoModule = await import('laravel-echo');
    const pusherModule = await import('pusher-js');
    Echo = echoModule.default || echoModule;
    Pusher = pusherModule.default || pusherModule;
    return { Echo, Pusher };
  } catch (error) {
    console.warn('⚠️ Laravel Echo no está disponible:', error.message);
    return null;
  }
};

// Configuración desde variables de entorno (Pusher Cloud / Reverb / self-host)
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '') || API_BASE_URL.replace(/\/api\/?$/, '') || API_BASE_URL;
// Prioridad: VITE_BROADCAST_DRIVER explícito (para Pusher Cloud en prod). Si no está definido, fallback reverb/pusher.
const rawDriver = import.meta.env.VITE_BROADCAST_DRIVER;
const BROADCAST_DRIVER = (typeof rawDriver === 'string' && rawDriver.trim() !== '')
  ? rawDriver.trim().toLowerCase()
  : (import.meta.env.VITE_REVERB_APP_KEY ? 'reverb' : 'pusher');
const isPusherCloud = BROADCAST_DRIVER === 'pusher';
const PUSHER_APP_KEY = import.meta.env.VITE_PUSHER_APP_KEY || import.meta.env.VITE_REVERB_APP_KEY || '';
const PUSHER_APP_CLUSTER = import.meta.env.VITE_PUSHER_APP_CLUSTER || 'us2';
const PUSHER_APP_HOST = import.meta.env.VITE_PUSHER_APP_HOST || import.meta.env.VITE_PUSHER_HOST || import.meta.env.VITE_REVERB_HOST || '';
const PUSHER_APP_PORT = import.meta.env.VITE_PUSHER_APP_PORT || import.meta.env.VITE_PUSHER_PORT || import.meta.env.VITE_REVERB_PORT || '8080';
const PUSHER_APP_USE_TLS = (import.meta.env.VITE_PUSHER_APP_USE_TLS === 'true') ||
  ((import.meta.env.VITE_PUSHER_SCHEME || import.meta.env.VITE_REVERB_SCHEME || 'https') === 'https');

// BroadcastChannel para evitar eventos duplicados entre pestañas
const broadcastChannel = typeof BroadcastChannel !== 'undefined' 
  ? new BroadcastChannel('incoming_calls')
  : null;

// Clave en localStorage para los IDs de extensiones asignadas al usuario (fácil de leer al llegar las llamadas)
const STORAGE_KEY_EXTENSION_IDS = 'ringcentral_extension_ids';

/** Normaliza a array de strings (IDs de extensión) para comparar siempre igual */
function normalizeExtensionIds(ids) {
  if (!ids) return [];
  const arr = Array.isArray(ids) ? ids : [ids];
  return arr.map((id) => String(id).trim()).filter(Boolean);
}

/** Lee las extensiones asignadas al usuario desde localStorage (clave dedicada o user) */
function getStoredExtensionIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EXTENSION_IDS);
    if (raw) {
      const parsed = JSON.parse(raw);
      const ids = normalizeExtensionIds(parsed);
      if (ids.length > 0) return ids;
    }
  } catch (_) {}
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const ids = normalizeExtensionIds(user.ringcentral_extension_ids);
    if (ids.length > 0) return ids;
  } catch (_) {}
  return [];
}

/** Guarda las extensiones asignadas en localStorage (clave dedicada y en user) para tenerlas listas al comparar */
function setStoredExtensionIds(ids) {
  const normalized = normalizeExtensionIds(ids);
  try {
    localStorage.setItem(STORAGE_KEY_EXTENSION_IDS, JSON.stringify(normalized));
  } catch (_) {}
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    localStorage.setItem('user', JSON.stringify({ ...user, ringcentral_extension_ids: normalized }));
  } catch (_) {}
}

const useIncomingCalls = () => {
  const [incomingCall, setIncomingCall] = useState(null);
  const [clienteData, setClienteData] = useState(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedChannels, setConnectedChannels] = useState([]);
  const echoRef = useRef(null);
  const channelsRef = useRef([]);
  const ultimoCallIdRef = useRef(null);
  const processedCallIdsRef = useRef(new Set());
  const userExtensionIdsRef = useRef([]); // Extensiones asignadas al usuario (para filtrar qué llamadas mostrar)
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelayRef = useRef(1000);

  // Log de diagnóstico
  const logDiagnostic = (message, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 🔍 ${message}`, data || '');
  };

  // Precargar extensiones del usuario al montar y guardarlas siempre en la clave dedicada de localStorage
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    let ids = getStoredExtensionIds();
    if (ids.length > 0) {
      userExtensionIdsRef.current = ids;
      setStoredExtensionIds(ids); // Escribir en clave dedicada por si vinieron solo de user (para que queden cargadas)
      logDiagnostic('Extensiones del usuario precargadas y guardadas en localStorage', { count: ids.length, ids });
      return;
    }
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id || user.user_id;
    if (!userId) return;
    usersService.get(userId).then((fullUser) => {
      const fromApi = normalizeExtensionIds(fullUser?.ringcentral_extension_ids);
      userExtensionIdsRef.current = fromApi;
      if (fromApi.length > 0) {
        setStoredExtensionIds(fromApi);
        logDiagnostic('Extensiones del usuario cargadas desde API y guardadas en localStorage', { count: fromApi.length, ids: fromApi });
      }
    }).catch(() => {});
  }, []);

  // Inicializar Echo
  const initializeEcho = async () => {
    try {
      logDiagnostic('Inicializando Laravel Echo...');

      if (!PUSHER_APP_KEY) {
        console.warn('⚠️ Laravel Echo: falta VITE_PUSHER_APP_KEY (o VITE_REVERB_APP_KEY).');
        return false;
      }
      if (!isPusherCloud && !PUSHER_APP_HOST) {
        console.warn('⚠️ Laravel Echo: con Reverb/self-host faltan VITE_PUSHER_HOST o VITE_REVERB_HOST.');
        return false;
      }

      const deps = await loadEchoDependencies();
      if (!deps) {
        return false;
      }

      const { Echo: EchoClass, Pusher: PusherClass } = deps;
      window.Pusher = PusherClass;

      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.warn('⚠️ No hay token de autenticación');
        return false;
      }

      let wsPort = PUSHER_APP_PORT || '8080';
      // Laravel suele exponer POST /broadcasting/auth en la raíz del backend (no bajo /api). Prioridad: variable explícita > BACKEND_URL > API_BASE_URL
      const authBase = import.meta.env.VITE_BROADCASTING_AUTH_URL || (BACKEND_URL ? `${BACKEND_URL}/broadcasting/auth` : `${API_BASE_URL}/broadcasting/auth`);
      const authEndpoint = authBase.startsWith('http') ? authBase : `${window.location.origin}${authBase.startsWith('/') ? '' : '/'}${authBase}`;
      const echoConfig = {
        broadcaster: BROADCAST_DRIVER,
        key: PUSHER_APP_KEY,
        cluster: PUSHER_APP_CLUSTER,
        encrypted: PUSHER_APP_USE_TLS,
        forceTLS: PUSHER_APP_USE_TLS,
        disableStats: true,
        enabledTransports: ['ws', 'wss'],
        authEndpoint: authEndpoint,
        auth: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      };

      // Pusher Cloud (wss://ws-{cluster}.pusher.com): no setear host ni puertos
      if (!isPusherCloud && PUSHER_APP_HOST) {
        echoConfig.wsHost = PUSHER_APP_HOST;
        echoConfig.wsPort = wsPort;
        echoConfig.wssPort = wsPort;
      }

      echoRef.current = new EchoClass(echoConfig);

      // Manejar eventos de conexión
      echoRef.current.connector.pusher.connection.bind('connected', () => {
        logDiagnostic('✅ Conectado a Laravel Echo (WebSocket)');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        reconnectDelayRef.current = 1000;
      });

      echoRef.current.connector.pusher.connection.bind('disconnected', () => {
        logDiagnostic('⚠️ Desconectado de Laravel Echo');
        setIsConnected(false);
        attemptReconnect();
      });

      echoRef.current.connector.pusher.connection.bind('error', (error) => {
        logDiagnostic('❌ Error en conexión Echo', error);
        setIsConnected(false);
      });

      logDiagnostic('✅ Laravel Echo inicializado correctamente');
      return true;
    } catch (error) {
      logDiagnostic('❌ Error al inicializar Laravel Echo', error);
      return false;
    }
  };

  // Intentar reconexión
  const attemptReconnect = () => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      logDiagnostic('❌ Máximo de intentos de reconexión alcanzado');
      return;
    }

    reconnectAttemptsRef.current++;
    const delay = reconnectDelayRef.current;
    
    logDiagnostic(`🔄 Intentando reconexión ${reconnectAttemptsRef.current}/${maxReconnectAttempts} en ${delay}ms`);

    setTimeout(() => {
      reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30000); // Backoff exponencial
      connectToChannels();
    }, delay);
  };

  // Buscar cliente por teléfono
  const buscarClientePorTelefono = async (telefono) => {
    if (!telefono) return null;

    try {
      setBuscandoCliente(true);
      logDiagnostic('Buscando cliente por teléfono', { telefono });
      const resultado = await buscarCliente(telefono);
      
      if (resultado.encontrado && resultado.cliente) {
        logDiagnostic('✅ Cliente encontrado', { id: resultado.cliente.id, nombre: resultado.cliente.nombre_completo });
        return resultado.cliente;
      }
      logDiagnostic('⚠️ Cliente no encontrado');
      return null;
    } catch (err) {
      logDiagnostic('❌ Error al buscar cliente', err);
      return null;
    } finally {
      setBuscandoCliente(false);
    }
  };

  // Verificar si el evento ya fue procesado (evitar duplicados)
  const isEventProcessed = (callId) => {
    if (processedCallIdsRef.current.has(callId)) {
      return true;
    }
    processedCallIdsRef.current.add(callId);
    // Limpiar IDs antiguos después de 5 minutos
    setTimeout(() => {
      processedCallIdsRef.current.delete(callId);
    }, 5 * 60 * 1000);
    return false;
  };

  // Manejar evento incoming_call (payload backend: call_id, phone_number, extension_id, extension_number, cliente, direction, status, timestamp)
  // Criterio único: el backend envía extension_id (extensión donde suena la llamada). Solo mostramos el modal si ese extension_id está en las extensiones asignadas al usuario (guardadas en localStorage).
  const handleIncomingCall = async (data, channelDisplayName = '') => {
    try {
      logDiagnostic('📞 Evento incoming_call recibido', data);

      // extension_id: siempre lo envía el backend para la extensión que recibe/suena la llamada (incl. rechazadas/ignoradas en otras)
      const eventExtensionId = data.extension_id != null && data.extension_id !== '' ? String(data.extension_id).trim() : null;

      // Leer extensiones asignadas al usuario desde localStorage (rápido y disponible cuando entra la llamada)
      let myExtensionIds = getStoredExtensionIds();
      if (myExtensionIds.length === 0) {
        myExtensionIds = userExtensionIdsRef.current || [];
      }
      if (myExtensionIds.length === 0) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const userId = user.id || user.user_id;
        if (userId) {
          try {
            const fullUser = await usersService.get(userId);
            myExtensionIds = normalizeExtensionIds(fullUser?.ringcentral_extension_ids);
            userExtensionIdsRef.current = myExtensionIds;
            if (myExtensionIds.length > 0) setStoredExtensionIds(myExtensionIds);
          } catch (_) {}
        }
      } else {
        userExtensionIdsRef.current = myExtensionIds;
      }

      // Mostrar modal solo si extension_id del evento está en las extensiones asignadas al usuario
      if (!eventExtensionId) {
        logDiagnostic('⏭️ Evento sin extension_id, no mostrar modal', data);
        return;
      }
      if (myExtensionIds.length === 0) {
        logDiagnostic('⏭️ Usuario sin extensiones asignadas, no mostrar modal', { eventExtensionId });
        return;
      }
      if (!myExtensionIds.includes(eventExtensionId)) {
        logDiagnostic('⏭️ Llamada en otra extensión (rechazada/ignorada/otro usuario), no mostrar modal', { eventExtensionId, asignadas: myExtensionIds });
        return;
      }

      logDiagnostic('✅ extension_id del evento coincide con extensiones del usuario → mostrar modal', { eventExtensionId, asignadas: myExtensionIds });

      // call_id es el ID de sesión de la llamada (payload estándar del backend)
      const callId = data.call_id || data.session_id || data.id || `${(data.phone_number || data.telefono || data.numero || data.phone || '')}-${Date.now()}`;

      if (isEventProcessed(callId)) {
        logDiagnostic('⚠️ Evento duplicado ignorado', { callId });
        return;
      }

      if (broadcastChannel) {
        broadcastChannel.postMessage({ type: 'call_processed', callId });
      }

      ultimoCallIdRef.current = callId;

      // Payload backend: phone_number, extension_id, extension_number, cliente, direction, status (Ringing | CallConnected), timestamp
      const telefono = data.phone_number || data.telefono || data.numero || data.phone;
      const extensionId = data.extension_id ?? null;
      const extensionNumber = data.extension_number || data.extension || 'N/A';
      const extension = extensionId != null ? String(extensionId) : (data.extension || data.extension_name || 'N/A');
      const estado = data.status || data.estado || 'Ringing';

      const callData = {
        id: callId,
        call_id: data.call_id,
        telefono: telefono,
        extension: extension,
        extension_id: extensionId,
        extensionNumber: extensionNumber,
        direccion: data.direction || data.direccion || 'Inbound',
        estado: estado,
        timestamp: data.timestamp || new Date().toISOString(),
        raw: data
      };

      logDiagnostic('🔄 Abriendo popup de llamada entrante', callData);
      setIncomingCall(callData);
      setError(null);

      // Si el backend envía cliente identificado, usarlo; si no, buscar por teléfono
      if (data.cliente && typeof data.cliente === 'object') {
        setClienteData(data.cliente);
      } else if (telefono) {
        const cliente = await buscarClientePorTelefono(telefono);
        setClienteData(cliente);
      } else {
        setClienteData(null);
      }
    } catch (err) {
      logDiagnostic('❌ Error al manejar llamada entrante', err);
      setError(err.message || 'Error al procesar la llamada');
    }
  };

  // Escuchar mensajes de otras pestañas
  useEffect(() => {
    if (!broadcastChannel) return;

    const handleMessage = (event) => {
      if (event.data.type === 'call_processed') {
        const callId = event.data.callId;
        if (!isEventProcessed(callId)) {
          processedCallIdsRef.current.add(callId);
        }
      }
    };

    broadcastChannel.addEventListener('message', handleMessage);
    return () => {
      broadcastChannel.removeEventListener('message', handleMessage);
    };
  }, []);

  // Conectar a múltiples canales
  const connectToChannels = async () => {
    try {
      if (!echoRef.current) {
        const initialized = await initializeEcho();
        if (!initialized) {
          logDiagnostic('⚠️ No se pudo inicializar Echo');
          return;
        }
      }

      const token = localStorage.getItem('auth_token');
      if (!token) {
        logDiagnostic('⚠️ No hay token de autenticación');
        return;
      }

      // Extensiones asignadas: primero localStorage (clave dedicada o user), luego API; siempre persistir en la clave
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = user.id || user.user_id;
      let extensionIds = getStoredExtensionIds();
      if (extensionIds.length === 0 && userId) {
        try {
          const fullUser = await usersService.get(userId);
          extensionIds = normalizeExtensionIds(fullUser?.ringcentral_extension_ids);
          if (extensionIds.length > 0) setStoredExtensionIds(extensionIds);
        } catch (_) {}
      } else if (extensionIds.length > 0) {
        setStoredExtensionIds(extensionIds); // Asegurar que la clave dedicada quede escrita
      }
      userExtensionIdsRef.current = extensionIds;
      const extensionId = extensionIds.length > 0 ? extensionIds[0] : undefined;

      logDiagnostic('Conectando a canales', { userId, extensionId, extensionIds });

      const channelsToConnect = [];

      // Nombres sin prefijo "private-": Echo.private() añade el prefijo al suscribir
      // 1. Canales por extensión(es) de RingCentral (una o varias)
      const idsToSubscribe = extensionIds.length > 0 ? extensionIds : (extensionId ? [extensionId] : []);
      idsToSubscribe.forEach((extId) => {
        const id = String(extId);
        channelsToConnect.push({
          name: `ringcentral.extension.${id}`,
          displayName: `private-ringcentral.extension.${id}`,
          type: 'private',
          priority: 1
        });
      });

      // 2. Canal por usuario (múltiples formatos)
      if (userId) {
        channelsToConnect.push(
          { name: `App.Models.User.${userId}`, displayName: `private-App.Models.User.${userId}`, type: 'private', priority: 2 },
          { name: `user.${userId}`, displayName: `private-user.${userId}`, type: 'private', priority: 3 }
        );
      }

      // 3. Canal general de llamadas
      channelsToConnect.push({
        name: 'ringcentral.calls',
        displayName: 'private-ringcentral.calls',
        type: 'private',
        priority: 4
      });

      // 4. Canal público como fallback
      channelsToConnect.push({
        name: 'llamadas',
        type: 'public',
        priority: 5
      });

      const connectedChannelsList = [];

      // Intentar conectar a cada canal
      for (const channelConfig of channelsToConnect) {
        const displayName = channelConfig.displayName ?? channelConfig.name;
        try {
          let channel;
          if (channelConfig.type === 'private') {
            channel = echoRef.current.private(channelConfig.name);
          } else {
            channel = echoRef.current.channel(channelConfig.name);
          }

          channel.listen('.incoming_call', (data) => {
            logDiagnostic(`📞 Evento incoming_call recibido en canal: ${displayName}`, data);
            handleIncomingCall(data, displayName);
          });

          channelsRef.current.push(channel);
          connectedChannelsList.push(displayName);
          logDiagnostic(`✅ Suscrito al canal: ${displayName} (${channelConfig.type})`);
        } catch (error) {
          logDiagnostic(`⚠️ No se pudo conectar al canal ${displayName}`, error.message);
        }
      }

      if (connectedChannelsList.length > 0) {
        setConnectedChannels(connectedChannelsList);
        logDiagnostic('✅ Conexión completada', { canales: connectedChannelsList });
      } else {
        logDiagnostic('❌ No se pudo conectar a ningún canal');
        setError('No se pudo conectar a ningún canal de WebSocket');
      }
    } catch (error) {
      logDiagnostic('❌ Error al conectar a canales', error);
      setError('Error al conectar con el servidor de WebSocket');
    }
  };

  // Efecto para conectar cuando el usuario está autenticado (delay corto para no perder la primera llamada)
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      return;
    }

    const timer = setTimeout(() => {
      connectToChannels();
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      // Limpiar canales (nombre completo ej. private-ringcentral.extension.123)
      channelsRef.current.forEach(channel => {
        try {
          const name = channel?.name ?? channel;
          if (name && echoRef.current) echoRef.current.leave(name);
        } catch (error) {
          console.error('Error al dejar el canal:', error);
        }
      });
      channelsRef.current = [];

      // Desconectar Echo
      if (echoRef.current) {
        try {
          echoRef.current.disconnect();
          logDiagnostic('✅ Echo desconectado');
        } catch (error) {
          console.error('Error al desconectar Echo:', error);
        }
        echoRef.current = null;
      }
    };
  }, []);

  // Función para cerrar el modal
  const cerrarModal = () => {
    logDiagnostic('🔄 Cerrando modal de llamada');
    setIncomingCall(null);
    setClienteData(null);
    ultimoCallIdRef.current = null;
  };

  return {
    incomingCall,
    clienteData,
    buscandoCliente,
    error,
    isConnected,
    connectedChannels,
    cerrarModal,
  };
};

export default useIncomingCalls;

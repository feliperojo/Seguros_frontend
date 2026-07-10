# Flujo de Actualización de Preferencias del Dashboard

## 📋 Resumen
Este documento explica **cuándo se actualizan los estados** de las preferencias de visualización y **cómo el backend sabe de los informes**.

---

## 🔄 Flujo de Actualización de Estados

### 1. **Carga Inicial (Al Montar el Componente)**

**Momento:** Cuando el usuario entra al Dashboard por primera vez.

**Proceso:**
1. Se ejecuta `cargarPreferencias()` que hace una petición `GET /api/users/{userId}/preferences`
2. Si el backend retorna preferencias → se cargan en el estado `preferenciasVisualizacion`
3. Si el backend no tiene preferencias → se intenta cargar desde `localStorage`
4. Si no hay nada en `localStorage` → se usan valores por defecto (todos en `true`)

**Código:**
```javascript
useEffect(() => {
  cargarPreferencias();
}, [cargarPreferencias]);
```

---

### 2. **Actualización al Cambiar una Preferencia**

**Momento:** Cuando el usuario hace clic en un checkbox (toggle) para activar/desactivar un informe.

**Proceso:**
1. Usuario hace clic en un checkbox → se ejecuta `togglePreferencia(key)`
2. `togglePreferencia` actualiza el estado local inmediatamente:
   ```javascript
   setPreferenciasVisualizacion(prev => ({
     ...prev,
     [key]: !prev[key]
   }));
   ```
3. El cambio en `preferenciasVisualizacion` dispara un `useEffect` que:
   - Guarda en `localStorage` (respaldo inmediato)
   - Envía petición `PUT /api/users/{userId}/preferences` al backend
   - Si el backend falla, al menos tenemos `localStorage`

**Código:**
```javascript
const togglePreferencia = (key) => {
  setPreferenciasVisualizacion(prev => ({
    ...prev,
    [key]: !prev[key]
  }));
};

useEffect(() => {
  if (cargandoPreferencias) return; // No guardar durante carga inicial
  
  const guardarPreferencias = async () => {
    // 1. Guardar en localStorage (respaldo inmediato)
    localStorage.setItem(storageKey, JSON.stringify(preferenciasVisualizacion));
    
    // 2. Guardar en backend (persistencia entre dispositivos)
    await apiRequest(`users/${userId}/preferences`, 'PUT', {
      dashboard_preferences: preferenciasVisualizacion
    });
  };
  
  guardarPreferencias();
}, [preferenciasVisualizacion, currentUser?.id, cargandoPreferencias]);
```

---

### 3. **Carga de Datos de Informes**

**Momento:** Después de que las preferencias se cargan, y cada vez que cambian.

**Proceso:**
- **Cumpleaños:** Se carga cuando `preferenciasVisualizacion.mostrarCumpleanos === true`
- **Pagos Pendientes:** Se carga cuando `preferenciasVisualizacion.mostrarPagosPendientes === true`
- **Documentos Solicitados:** Se carga cuando `preferenciasVisualizacion.mostrarDocumentosSolicitados === true`

**Código:**
```javascript
// Ejemplo para cumpleaños
useEffect(() => {
  if (!cargandoPreferencias && preferenciasVisualizacion?.mostrarCumpleanos) {
    cargarCumpleanos(); // Hace petición al backend
  } else {
    setCumpleanosMes([]); // Limpia datos si está desactivado
  }
}, [preferenciasVisualizacion?.mostrarCumpleanos, cargarCumpleanos, cargandoPreferencias]);
```

---

## 🔌 Cómo el Backend Sabe de los Informes

### Endpoints del Backend

#### 1. **Obtener Preferencias**
```
GET /api/users/{userId}/preferences
```

**Respuesta esperada:**
```json
{
  "dashboard_preferences": {
    "mostrarCumpleanos": true,
    "mostrarPagosPendientes": true,
    "mostrarDocumentosSolicitados": true
  }
}
```

**Cuándo se llama:**
- Al montar el Dashboard (carga inicial)
- El frontend espera esta respuesta para saber qué informes mostrar

---

#### 2. **Guardar Preferencias**
```
PUT /api/users/{userId}/preferences
```

**Body enviado:**
```json
{
  "dashboard_preferences": {
    "mostrarCumpleanos": true,
    "mostrarPagosPendientes": false,
    "mostrarDocumentosSolicitados": true
  }
}
```

**Cuándo se llama:**
- Cada vez que el usuario cambia un checkbox (toggle)
- Inmediatamente después de actualizar el estado local
- Se guarda también en `localStorage` como respaldo

---

### Flujo Completo Backend ↔ Frontend

```
┌─────────────────────────────────────────────────────────────┐
│                    USUARIO EN DASHBOARD                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Carga Inicial                                           │
│     GET /api/users/{userId}/preferences                      │
│     ↓                                                        │
│     Backend retorna: { dashboard_preferences: {...} }       │
│     ↓                                                        │
│     Frontend actualiza estado                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Usuario cambia checkbox                                 │
│     togglePreferencia('mostrarCumpleanos')                  │
│     ↓                                                        │
│     Estado local actualizado inmediatamente                 │
│     ↓                                                        │
│     PUT /api/users/{userId}/preferences                     │
│     Body: { dashboard_preferences: {...} }                 │
│     ↓                                                        │
│     Backend guarda preferencias                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Carga de Datos de Informes                             │
│     Si mostrarCumpleanos === true:                          │
│       GET /api/cliente/cumpleanos?mes=X&año=Y               │
│                                                              │
│     Si mostrarPagosPendientes === true:                    │
│       GET /api/cobertura/pagos/listado                      │
│                                                              │
│     Si mostrarDocumentosSolicitados === true:              │
│       GET /api/documentos/proximos-vencer?dias=X            │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Estructura de Datos

### Estado en Frontend
```javascript
preferenciasVisualizacion = {
  mostrarCumpleanos: boolean,
  mostrarPagosPendientes: boolean,
  mostrarDocumentosSolicitados: boolean
}
```

### Estructura en Backend
```json
{
  "dashboard_preferences": {
    "mostrarCumpleanos": true,
    "mostrarPagosPendientes": true,
    "mostrarDocumentosSolicitados": true
  }
}
```

---

## 🔄 Resumen de Actualizaciones

| Evento | Estado Actualizado | Backend Notificado | Momento |
|--------|-------------------|-------------------|---------|
| Carga inicial | `preferenciasVisualizacion` | No (solo lectura) | Al montar Dashboard |
| Usuario cambia checkbox | `preferenciasVisualizacion` | Sí (`PUT`) | Inmediatamente |
| Preferencia activada | Datos del informe | Sí (carga datos) | Después de activar |
| Preferencia desactivada | Datos limpiados | No | Inmediatamente |

---

## 🛡️ Manejo de Errores

1. **Si el backend no responde al cargar preferencias:**
   - Se usa `localStorage` como fallback
   - Se muestran valores por defecto (todos `true`)

2. **Si el backend falla al guardar preferencias:**
   - Se guarda en `localStorage` como respaldo
   - Se muestra un warning en consola
   - El usuario puede seguir usando la aplicación

3. **Si no hay usuario autenticado:**
   - Se usan valores por defecto
   - No se intenta guardar en backend

---

## ✅ Ventajas de este Enfoque

1. **Persistencia entre dispositivos:** Las preferencias se guardan en el backend
2. **Respaldo local:** `localStorage` actúa como respaldo si el backend falla
3. **Actualización inmediata:** El estado local se actualiza al instante
4. **Sincronización:** El backend siempre sabe qué informes quiere ver el usuario
5. **Extensible:** Fácil agregar nuevos informes sin cambiar la estructura base

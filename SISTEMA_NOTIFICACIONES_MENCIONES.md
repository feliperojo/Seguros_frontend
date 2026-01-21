# 📢 Sistema de Notificaciones y Visualización de Menciones

## 🎯 Objetivo

Cuando un usuario es mencionado (`@usuario`) en un comentario de una tarea, necesita:
1. **Saber que fue mencionado** (notificación)
2. **Ver dónde fue mencionado** (visualización)
3. **Acceder fácilmente** a la tarea/comentario donde fue mencionado

---

## 📊 Situación Actual

### ✅ **Lo que YA funciona:**
1. **Menciones en comentarios** - Los usuarios pueden ser mencionados con `@nombre`
2. **Formato profesional** - Se muestra solo `@Nombre` en azul y negrita
3. **Filtro en calendario** - Botón `@` para ver tareas donde fuiste mencionado
4. **Extracción de IDs** - El sistema extrae los IDs de usuarios mencionados

### ❌ **Lo que NO funciona aún:**
1. **Notificaciones automáticas** - El usuario mencionado NO recibe notificación
2. **Badge visual** - No hay indicador visual en tareas que tienen menciones
3. **Panel de notificaciones** - No hay forma de ver todas tus menciones en un lugar
4. **Alertas visuales** - No hay indicador de menciones no leídas

### 🔍 **Cómo se visualiza actualmente:**
- El usuario mencionado **NO sabe** que fue mencionado automáticamente
- Solo puede verlo si:
  - Va al calendario y activa el filtro `@`
  - Ve la tarea directamente y revisa los comentarios
  - Busca manualmente en sus tareas

---

## 🔧 Implementación Propuesta

### **1. Backend - Crear Notificaciones (Requerido)**

Cuando se crea un comentario con menciones, el backend debe:

```javascript
// Al crear comentario con mentioned_user_ids
POST /tareas_operativas/{tarea_id}/comentarios
Body: {
  comment: "...",
  mentioned_user_ids: [123, 456]
}

// Backend debe crear notificaciones automáticamente:
// 1. Para cada usuario en mentioned_user_ids, crear registro en tabla "notifications"
// 2. Campos sugeridos:
//    - id
//    - user_id (usuario mencionado)
//    - type: "mention"
//    - title: "Fuiste mencionado en una tarea"
//    - message: "Juan Pérez te mencionó en un comentario"
//    - task_id
//    - comment_id
//    - created_at
//    - read_at (null si no leída)
//    - link: "/Herramientas/operaciones?task_id=123"
```

**Endpoints necesarios:**
```javascript
// Obtener notificaciones del usuario actual
GET /notifications?unread_only=true
Response: {
  data: [
    {
      id: 1,
      type: "mention",
      title: "Fuiste mencionado en una tarea",
      message: "Juan Pérez te mencionó en un comentario",
      task_id: 123,
      comment_id: 456,
      created_at: "2024-01-15T10:30:00Z",
      read_at: null,
      link: "/Herramientas/operaciones?task_id=123"
    }
  ],
  unread_count: 5
}

// Marcar notificación como leída
PATCH /notifications/{id}/read

// Marcar todas como leídas
PATCH /notifications/read-all
```

---

### **2. Frontend - Sistema de Notificaciones**

#### **A. Icono de Notificaciones en MainLayout**

**Ubicación:** `src/layout/MainLayout.jsx`

**Funcionalidad:**
- Icono de campana junto al icono de tareas pendientes
- Badge con contador de notificaciones no leídas
- Dropdown al hacer clic mostrando:
  - Lista de notificaciones recientes
  - Tipo: "Menciones" y "Tareas"
  - Enlace a la tarea correspondiente
  - Botón "Marcar todas como leídas"

**Diseño:**
```
[🔔 3] [📋 5]  ← Badges separados para menciones y tareas
```

#### **B. Panel de Menciones en Calendario**

**Ubicación:** `src/components/Tareas/CalendarioTareas.jsx`

**Funcionalidad:**
- Ya existe filtro `@` para ver tareas donde fuiste mencionado
- **Mejora:** Agregar badge visual en tareas que tienen menciones al usuario actual
- **Mejora:** Indicador visual cuando una tarea tiene menciones no leídas

#### **C. Panel de Tareas Pendientes**

**Ubicación:** `src/components/fase2/TareasPendientesPanel.jsx`

**Mejoras:**
- Badge en tareas donde el usuario fue mencionado
- Filtro para mostrar solo tareas con menciones
- Icono `@` visible en tareas con menciones

#### **D. Visualización en Comentarios**

**Ubicación:** `src/components/Tareas/ResponderTareaModal.jsx`

**Funcionalidad:**
- Las menciones ya se muestran resaltadas en azul
- **Mejora:** Agregar tooltip al hover mostrando "Te mencionaron aquí"
- **Mejora:** Resaltar comentarios donde el usuario fue mencionado

---

## 🎨 Diseño Visual

### **1. Icono de Notificaciones**

```jsx
<div className="notification-bell">
  <i className="bi bi-bell-fill"></i>
  {unreadCount > 0 && (
    <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
  )}
</div>
```

### **2. Dropdown de Notificaciones**

```
┌─────────────────────────────────────┐
│ Notificaciones (5)                  │
├─────────────────────────────────────┤
│ 🔵 @Juan Pérez te mencionó          │
│    en una tarea                     │
│    2 minutos atrás                  │
├─────────────────────────────────────┤
│ 🔵 @María te mencionó en un         │
│    comentario                       │
│    15 minutos atrás                 │
├─────────────────────────────────────┤
│ [Marcar todas como leídas]          │
└─────────────────────────────────────┘
```

### **3. Badge en Tareas**

```
┌─────────────────────────────────────┐
│ Tarea: Revisar documento            │
│ 👤 Asignado: Carlos                 │
│ @ Mencionado: Tú                    │  ← Badge azul
│ 📅 Vence: 20 Ene                    │
└─────────────────────────────────────┘
```

---

## 📋 Plan de Implementación

### **Fase 1: Frontend - Visualización (Sin Backend)**

1. ✅ **Calendario con filtro de menciones** (YA HECHO)
2. ⬜ **Badge visual en tareas con menciones** (PENDIENTE)
3. ⬜ **Panel de notificaciones básico** (Simular con datos locales)

### **Fase 2: Frontend - Notificaciones Completo (Con Backend)**

4. ⬜ **Icono de notificaciones en MainLayout**
5. ⬜ **Dropdown de notificaciones**
6. ⬜ **Marcar como leídas**
7. ⬜ **Navegación a tareas desde notificaciones**

### **Fase 3: Backend - Integración**

8. ⬜ **Crear endpoint de notificaciones**
9. ⬜ **Crear notificaciones automáticamente al mencionar**
10. ⬜ **WebSocket/Polling para notificaciones en tiempo real** (Opcional)

---

## 🚀 Implementación Inmediata (Frontend)

Mientras el backend se implementa, podemos crear:

1. **Hook de notificaciones** (`useNotifications.js`)
   - Obtener notificaciones (simulado o real)
   - Marcar como leídas
   - Contador de no leídas

2. **Componente de Notificaciones** (`NotificationsDropdown.jsx`)
   - Dropdown con lista de notificaciones
   - Estilos profesionales

3. **Actualizar MainLayout**
   - Agregar icono de notificaciones
   - Integrar dropdown

4. **Mejoras visuales**
   - Badge en tareas con menciones
   - Tooltips informativos

---

## ✅ Estado Actual

- ✅ **Menciones funcionan** - Los usuarios pueden ser mencionados
- ✅ **Formato profesional** - Se muestra solo `@Nombre`
- ✅ **Filtro en calendario** - Botón `@` para ver menciones
- ❌ **Notificaciones** - No implementado aún
- ❌ **Badges visuales** - No implementado aún
- ❌ **Panel de notificaciones** - No implementado aún

---

*Documento de referencia para implementación completa del sistema*


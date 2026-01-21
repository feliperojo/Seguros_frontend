# 📋 Respuesta: Sistema de Notificaciones y Visualización de Menciones

## 🔍 Situación Actual

**Pregunta del usuario:** "Cuando se menciona un usuario en un comentario, ¿qué notificación le llega? ¿Cómo sabe el usuario que fue mencionado? ¿De qué manera lo visualiza?"

**Respuesta:**

### ❌ **Actualmente NO hay notificaciones automáticas**

Cuando alguien menciona a un usuario (`@nombre`) en un comentario:

1. **NO hay notificación** - El usuario mencionado no recibe alerta automática
2. **NO hay badge** - No aparece un indicador visual de que fue mencionado
3. **NO hay email** - No se envía correo electrónico
4. **NO hay panel de notificaciones** - No hay un lugar centralizado para ver menciones

### ✅ **Cómo puede verlo actualmente:**

El usuario mencionado **solo puede descubrir** que fue mencionado si:

1. **Calendario con filtro `@`** (YA IMPLEMENTADO)
   - Va a `/Herramientas/operaciones`
   - Selecciona su usuario
   - Hace clic en el botón `@`
   - Ve tareas donde fue mencionado

2. **Revisando tareas manualmente**
   - Abre la tarea
   - Ve los comentarios
   - Nota que su nombre aparece en azul (si está resaltado)

---

## 🚀 Solución Propuesta (Requiere Backend)

Para que las notificaciones funcionen completamente, necesitamos:

### **1. Backend - Crear Notificaciones Automáticas**

Cuando se crea un comentario con menciones:

```javascript
POST /tareas_operativas/{tarea_id}/comentarios
Body: {
  comment: "Hola @Juan, necesito tu ayuda",
  mentioned_user_ids: [123]  // ← Esto ya se envía
}

// ⬇️ BACKEND DEBE HACER ESTO AUTOMÁTICAMENTE:

// Para cada usuario en mentioned_user_ids:
// 1. Crear notificación en tabla "notifications"
INSERT INTO notifications (
  user_id,           // Usuario mencionado (123)
  type,              // "mention"
  title,             // "Fuiste mencionado en una tarea"
  message,           // "Carlos Pérez te mencionó en un comentario"
  task_id,           // ID de la tarea
  comment_id,        // ID del comentario
  created_at,
  read_at            // NULL (no leída)
)
```

### **2. Endpoint de Notificaciones**

```javascript
// Obtener notificaciones del usuario actual
GET /notifications?unread_only=true
Response: {
  data: [
    {
      id: 1,
      type: "mention",
      title: "Fuiste mencionado en una tarea",
      message: "Carlos Pérez te mencionó en un comentario",
      task_id: 123,
      comment_id: 456,
      created_at: "2024-01-15T10:30:00Z",
      read_at: null,
      link: "/Herramientas/operaciones?task_id=123"
    }
  ],
  unread_count: 5
}
```

---

## 🎨 Visualización Propuesta

### **1. Icono de Notificaciones en MainLayout**

Junto al icono de tareas pendientes:

```
[🔔 3] [📋 5]
 ↑       ↑
Menciones Tareas
```

**Al hacer clic:**
```
┌─────────────────────────────────────┐
│ Notificaciones (3)                  │
├─────────────────────────────────────┤
│ 🔵 @Carlos Pérez te mencionó        │
│    en una tarea                     │
│    2 minutos atrás                  │
│    [Ver tarea →]                    │
├─────────────────────────────────────┤
│ 🔵 @María te mencionó en un         │
│    comentario                       │
│    15 minutos atrás                 │
│    [Ver tarea →]                    │
├─────────────────────────────────────┤
│ [Marcar todas como leídas]          │
└─────────────────────────────────────┘
```

### **2. Badge Visual en Tareas**

En el panel de tareas pendientes:

```
┌─────────────────────────────────────┐
│ 📋 Revisar documento                │
│ 👤 Asignado: Carlos                 │
│ @ Mencionado: Tú  ← Badge azul     │
│ 📅 Vence: 20 Ene                    │
└─────────────────────────────────────┘
```

### **3. Resaltado en Comentarios**

En los comentarios de la tarea:

```
┌─────────────────────────────────────┐
│ Juan Pérez - Hace 2 horas           │
│ ┌─────────────────────────────────┐ │
│ │ Hola @Carlos, necesito ayuda   │ │  ← Resaltado en azul
│ │ con este documento.             │ │
│ └─────────────────────────────────┘ │
│ 🔵 Te mencionaron aquí              │  ← Tooltip/info
└─────────────────────────────────────┘
```

---

## 📝 Plan de Implementación

### **Fase 1: Frontend - Visualización (Sin Backend)**

Mientras se implementa el backend, podemos agregar:

1. ✅ **Badge visual** en tareas donde el usuario fue mencionado
   - Detectar menciones en comentarios
   - Mostrar badge `@` en el panel de tareas

2. ✅ **Resaltado mejorado** en comentarios
   - Tooltip al hover: "Te mencionaron aquí"
   - Fondo ligeramente diferente en comentarios con menciones

3. ✅ **Panel de "Menciones"** en calendario (YA EXISTE)
   - Mejorar visibilidad
   - Agregar contador

### **Fase 2: Frontend - Notificaciones (Con Backend)**

Una vez el backend esté listo:

4. ⬜ **Icono de notificaciones** en MainLayout
5. ⬜ **Dropdown de notificaciones**
6. ⬜ **Marcar como leídas**
7. ⬜ **Navegación a tareas** desde notificaciones

### **Fase 3: Backend - Automatización**

8. ⬜ **Crear notificaciones automáticamente** al mencionar
9. ⬜ **Endpoint de notificaciones**
10. ⬜ **WebSocket/Polling** para notificaciones en tiempo real (Opcional)

---

## ✅ Recomendación Inmediata

**Para mejorar la experiencia AHORA (sin backend):**

1. Agregar **badge visual** `@` en tareas donde el usuario fue mencionado
2. Mejorar **resaltado** en comentarios con menciones
3. Agregar **contador** de menciones en el calendario
4. Crear **panel dedicado** "Mis Menciones" en el centro de operaciones

Esto mejorará significativamente la visibilidad sin depender del backend.

---

**¿Quieres que implemente las mejoras visuales ahora mientras se desarrolla el backend?**


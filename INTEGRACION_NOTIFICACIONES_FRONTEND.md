# 📋 Integración de Notificaciones de Menciones - Frontend

Este documento describe cómo está implementada la integración con el sistema de notificaciones de menciones en el frontend, basado en la documentación del backend.

---

## ✅ Estado Actual de la Implementación

### **1. Envío de Menciones**

#### **Crear Comentario con Menciones** ✅
**Ubicación:** `src/components/Tareas/ResponderTareaModal.jsx`

**Implementación actual:**
```javascript
// Línea 613-621
const mentionedIds = extractMentionedUserIds(responseNote || "", usuarios);

const data = await apiRequest(
  `tareas_operativas/${tarea.id}/comentarios`,
  "POST",
  { 
    comment: responseNote || " ",
    mentioned_user_ids: mentionedIds // Array de IDs de usuarios
  }
);
```

**Estado:** ✅ Correcto - Usa JSON directamente, `mentioned_user_ids` como array

---

#### **Crear Tarea con Menciones** ✅
**Ubicación:** `src/components/Tareas/NuevaTareaModal.jsx`

**Implementación actual:**
```javascript
// Línea 695-704
const mentionedIds = extractMentionedUserIds(formData.note || "", usuarios);

const payload = {
  ...formData,
  action_type: "tarea",
  tipo: "tarea",
  mentioned_user_ids: mentionedIds, // Array de IDs de usuarios
};

const response = await apiRequest("bitacora_operativa/create", "POST", payload);
```

**Estado:** ✅ Correcto - Usa JSON directamente, `mentioned_user_ids` como array

---

### **2. Consumir Notificaciones**

#### **Hook useNotifications** ✅
**Ubicación:** `src/hooks/useNotifications.js`

**Implementación actual:**
- ✅ Obtener notificaciones: `GET /api/notifications?unread_only=true&per_page=50`
- ✅ Marcar como leída: `PATCH /api/notifications/{id}/read`
- ✅ Marcar todas como leídas: `PATCH /api/notifications/read-all`
- ✅ Auto-refresh cada 30 segundos
- ✅ Manejo de errores cuando el endpoint no existe aún (retrocompatibilidad)

**Estado:** ✅ Correcto - Implementación completa y robusta

---

### **3. Componente de Notificaciones**

#### **NotificationsDropdown** ✅
**Ubicación:** `src/components/Tareas/NotificationsDropdown.jsx`

**Características:**
- ✅ Muestra notificaciones del backend
- ✅ Muestra tareas pendientes como fallback
- ✅ Badge con contador de no leídas
- ✅ Click en notificación abre modal de respuesta o navega al calendario
- ✅ Marcar como leída al hacer click
- ✅ Botón "Marcar todas como leídas"

**Estado:** ✅ Correcto - Implementación completa

---

## 🔧 Utilidades de Menciones

### **extractMentionedUserIds**
**Ubicación:** `src/utils/mentions.js`

**Funcionalidad:**
- Extrae IDs de usuarios mencionados del texto HTML
- Soporta formato `@[Nombre](id)` (Quill mention)
- Soporta formato `@Nombre` (simple)
- Requiere array de usuarios para resolver IDs

**Uso:**
```javascript
import { extractMentionedUserIds } from '../../utils/mentions';

const mentionedIds = extractMentionedUserIds(comentarioHtml, usuarios);
// Retorna: [123, 456] // Array de IDs
```

**Estado:** ✅ Correcto

---

## 📝 Notas Importantes

### **Formato de mentioned_user_ids:**
- ✅ Actualmente usamos JSON directo: `{ mentioned_user_ids: [123, 456] }`
- ⚠️ Si en el futuro necesitamos usar FormData, debemos enviar como JSON stringificado:
  ```javascript
  formData.append('mentioned_user_ids', JSON.stringify([123, 456]));
  ```

### **Retrocompatibilidad:**
- ✅ Si no se envían menciones, el comentario/tarea se crea normalmente
- ✅ Si el endpoint de notificaciones no existe, no rompe la funcionalidad
- ✅ Los errores se manejan silenciosamente para no afectar la experiencia del usuario

### **Seguridad:**
- ✅ Solo se muestran notificaciones del usuario actual
- ✅ El backend valida automáticamente los IDs de usuarios mencionados
- ✅ Auto-mención (mencionarse a sí mismo) no crea notificación (validado en backend)

---

## 🧪 Testing Manual

### **1. Crear comentario con mención:**
1. Abrir una tarea en `ResponderTareaModal`
2. Escribir un comentario con `@NombreUsuario`
3. Seleccionar usuario del dropdown de menciones
4. Enviar comentario
5. Verificar que se envía `mentioned_user_ids` en la petición (DevTools Network)

### **2. Verificar notificaciones:**
1. Usuario mencionado debe recibir notificación
2. Abrir dropdown de notificaciones (campanita)
3. Verificar que aparece la notificación
4. Click en notificación debe abrir modal de respuesta o navegar al calendario

### **3. Marcar como leída:**
1. Click en notificación no leída
2. Verificar que el badge disminuye
3. Verificar que la notificación aparece como leída

---

## 📞 Soporte

Si hay problemas:
1. Verificar que el backend tenga la migración ejecutada
2. Revisar logs del backend en `storage/logs/laravel.log`
3. Verificar en DevTools Network que las peticiones incluyen `mentioned_user_ids`
4. Verificar que los tokens de autenticación sean válidos

---

**Última actualización:** 2026-01-20
**Versión Frontend:** 1.0


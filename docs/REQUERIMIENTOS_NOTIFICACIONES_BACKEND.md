# 📋 Requerimientos de Backend para Notificaciones

## Problema Actual

Las notificaciones que llegan del backend a veces no incluyen los campos necesarios (`task_id` o `audit_task_id`), lo que impide que el frontend pueda abrir el modal correspondiente.

## Endpoint Actual

```
GET /api/notifications?unread_only=true&per_page=50
GET /api/notifications?per_page=50
```

## Estructura Requerida de Notificaciones

### Para Notificaciones de Tareas Operativas

```json
{
  "id": 1,
  "type": "mention" | "task_assigned" | "task_pending" | "task",
  "title": "Fuiste mencionado en una tarea",
  "message": "Usuario X te mencionó en un comentario",
  "task_id": 123,  // ✅ REQUERIDO para tareas operativas
  "comment_id": 456,  // Opcional, si es una mención en comentario
  "read_at": null,
  "created_at": "2026-01-30T20:00:00Z",
  "user_id": 3,
  // Opcional: objeto completo de la tarea
  "task": {
    "id": 123,
    "status": "pending",
    "log": { ... }
  }
}
```

### Para Notificaciones de Tareas de Auditoría

```json
{
  "id": 2,
  "type": "mention",  // ✅ El backend usa 'mention' para ambos tipos
  "title": "Fuiste mencionado en una tarea de auditoría",
  "message": "Usuario X te mencionó en un comentario de auditoría",
  "auditoria_task_id": 789,  // ✅ REQUERIDO para tareas de auditoría (nombre correcto del backend)
  "auditoria_comment_id": 101,  // ✅ Opcional, si es una mención en comentario
  "task_id": null,  // Debe ser null para tareas de auditoría
  "comment_id": null,  // Debe ser null para tareas de auditoría
  "read_at": null,
  "created_at": "2026-01-30T20:00:00Z",
  "link": "/Herramientas/auditorias?task_id=789"  // ✅ Opcional: link para navegación
}
```

**Nota:** El backend usa `auditoria_task_id` y `auditoria_comment_id` (no `audit_task_id`).

## Campos Alternativos (Si no se puede usar task_id/audit_task_id directamente)

Si por alguna razón no se puede incluir `task_id` o `audit_task_id` en el nivel raíz, se pueden incluir en:

```json
{
  "id": 3,
  "type": "mention",
  "data": {
    "task_id": 123,  // ✅ Alternativa 1
    "audit_task_id": 789,  // ✅ Alternativa 1
    "task_type": "operativa" | "auditoria"  // Para distinguir tipo
  },
  "metadata": {
    "task_id": 123,  // ✅ Alternativa 2
    "audit_task_id": 789  // ✅ Alternativa 2
  },
  "related_id": 123  // ✅ Alternativa 3 (si solo hay un ID relacionado)
}
```

## Tipos de Notificación Recomendados

### Tareas Operativas
- `mention` - Mención en comentario de tarea operativa
- `task_assigned` - Tarea asignada
- `task_pending` - Tarea pendiente
- `task` - Notificación genérica de tarea

### Tareas de Auditoría
- `audit_mention` - Mención en comentario de tarea de auditoría
- `audit_task_assigned` - Tarea de auditoría asignada
- `audit_task_pending` - Tarea de auditoría pendiente
- `audit_task` - Notificación genérica de tarea de auditoría

## Validaciones que Hace el Frontend

El frontend verifica en este orden:

1. **Nivel raíz (PRIORITARIO):**
   - `notification.task_id` (para tareas operativas)
   - `notification.auditoria_task_id` (para tareas de auditoría) ✅ **Nombre correcto del backend**
   - `notification.audit_task_id` (compatibilidad hacia atrás)

2. **Campos de comentarios:**
   - `notification.comment_id` (para tareas operativas)
   - `notification.auditoria_comment_id` (para tareas de auditoría) ✅ **Nombre correcto del backend**

3. **Campo link (extracción de task_id):**
   - `notification.link` - El frontend extrae `task_id` del query string si existe
   - Ejemplo: `/Herramientas/auditorias?task_id=4` → extrae `task_id=4`

4. **Objeto task/audit_task:**
   - `notification.task.id`
   - `notification.audit_task.id`

5. **Campo data:**
   - `notification.data.task_id`
   - `notification.data.auditoria_task_id`
   - `notification.data.audit_task_id`

6. **Campo metadata:**
   - `notification.metadata.task_id`
   - `notification.metadata.auditoria_task_id`
   - `notification.metadata.audit_task_id`

7. **Campo related_id:**
   - `notification.related_id`

8. **Búsqueda por comment_id:**
   - Si hay `comment_id` o `auditoria_comment_id` pero no `task_id`, el frontend intenta buscar la tarea asociada al comentario

## Ejemplo de Notificación Completa (Estructura Real del Backend)

### Notificación de Auditoría:
```json
{
  "id": 3,
  "type": "mention",
  "title": "Fuiste mencionado en una tarea de auditoría",
  "message": "Administrador te mencionó en un comentario",
  "task_id": null,
  "comment_id": null,
  "auditoria_task_id": 4,  // ✅ Campo correcto del backend
  "auditoria_comment_id": 7,  // ✅ Campo correcto del backend
  "created_at": "2026-02-02T16:02:00+00:00",
  "read_at": "2026-02-02T16:03:03+00:00",
  "link": "/Herramientas/auditorias?task_id=4"  // ✅ Útil para navegación
}
```

### Notificación de Tarea Operativa:
```json
{
  "id": 1,
  "type": "mention",
  "title": "Fuiste mencionado en una tarea",
  "message": "Administrador te mencionó en un comentario",
  "task_id": 4,  // ✅ Campo para tareas operativas
  "comment_id": 10,  // ✅ Campo para comentarios de tareas operativas
  "auditoria_task_id": null,
  "auditoria_comment_id": null,
  "created_at": "2026-01-20T21:14:15+00:00",
  "read_at": "2026-01-20T21:26:11+00:00",
  "link": "/Herramientas/operaciones?task_id=4"  // ✅ Útil para navegación
}
```

## Notas Importantes

1. **Siempre incluir task_id o auditoria_task_id:** Sin estos campos, el frontend no puede abrir el modal correspondiente.

2. **Nombres de campos correctos:**
   - ✅ `auditoria_task_id` (no `audit_task_id`) - Para tareas de auditoría
   - ✅ `auditoria_comment_id` (no `audit_comment_id`) - Para comentarios de auditoría
   - ✅ `task_id` - Para tareas operativas
   - ✅ `comment_id` - Para comentarios de tareas operativas

3. **Distinguir entre tipos:** 
   - Si `auditoria_task_id` está presente → Es notificación de auditoría
   - Si `task_id` está presente → Es notificación de tarea operativa
   - El campo `type` puede ser `"mention"` para ambos tipos

4. **Campo link:** El frontend puede extraer `task_id` del campo `link` si está presente (ej: `/Herramientas/auditorias?task_id=4`).

5. **Si no hay tarea asociada:** Si la notificación no está relacionada con una tarea específica (ej: notificación general), no incluir `task_id` ni `auditoria_task_id`, pero el frontend mostrará un mensaje informativo.

6. **Compatibilidad:** El frontend mantiene compatibilidad con `audit_task_id` (sin la 'i'), pero el backend debe usar `auditoria_task_id`.

## Endpoints Relacionados

- `GET /api/notifications` - Obtener notificaciones
- `PATCH /api/notifications/{id}/read` - Marcar como leída
- `PATCH /api/notifications/read-all` - Marcar todas como leídas


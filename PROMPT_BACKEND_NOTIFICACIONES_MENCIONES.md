# 📋 Especificaciones Técnicas: Sistema de Notificaciones de Menciones

## 🎯 Objetivo

Implementar sistema de notificaciones automáticas cuando un usuario es mencionado (`@usuario`) en comentarios de tareas, **sin afectar la funcionalidad existente** y utilizando los datos que ya se envían.

---

## ✅ Lo que YA funciona en el Frontend

### **1. Creación de Comentarios con Menciones**

El frontend **YA ENVÍA** `mentioned_user_ids` cuando se crea un comentario:

```javascript
// Endpoint existente:
POST /tareas_operativas/{tarea_id}/comentarios

// Body que YA se envía:
{
  "comment": "<p>Hola @Carlos, necesito tu ayuda</p>",
  "mentioned_user_ids": [123, 456]  // ← YA SE ENVÍA ESTO
}
```

**Estado actual:** El backend probablemente ya recibe este campo, solo necesita procesarlo.

### **2. Creación de Tareas con Menciones**

El frontend **YA ENVÍA** `mentioned_user_ids` al crear tareas:

```javascript
// Endpoint existente:
POST /bitacora_operativa/create

// Body que YA se envía:
{
  "note": "<p>@Juan, revisa esto</p>",
  "mentioned_user_ids": [123],  // ← YA SE ENVÍA ESTO
  // ... otros campos
}
```

---

## 🔧 Implementación Backend Requerida

### **Opción 1: Extender Endpoints Existentes (Recomendado)**

**Sin crear endpoints nuevos**, solo procesar el campo que ya se recibe:

#### **A. Procesar `mentioned_user_ids` en comentarios existentes**

```php
// En el endpoint existente: POST /tareas_operativas/{tarea_id}/comentarios

// DESPUÉS de crear el comentario exitosamente:

if (isset($request->mentioned_user_ids) && is_array($request->mentioned_user_ids)) {
    $commentId = $comment->id;
    $taskId = $tarea_id;
    $mentionedBy = auth()->user()->id;
    $mentionedByName = auth()->user()->name;
    
    foreach ($request->mentioned_user_ids as $mentionedUserId) {
        // Validar que el usuario existe
        $mentionedUser = User::find($mentionedUserId);
        if (!$mentionedUser) continue;
        
        // Crear notificación SOLO si no es el mismo usuario
        if ($mentionedUserId != $mentionedBy) {
            Notification::create([
                'user_id' => $mentionedUserId,
                'type' => 'mention',
                'title' => 'Fuiste mencionado en una tarea',
                'message' => "{$mentionedByName} te mencionó en un comentario",
                'task_id' => $taskId,
                'comment_id' => $commentId,
                'created_at' => now(),
                'read_at' => null,
            ]);
        }
    }
}
```

#### **B. Procesar `mentioned_user_ids` en creación de tareas**

```php
// En el endpoint existente: POST /bitacora_operativa/create

// DESPUÉS de crear la tarea exitosamente:

if (isset($request->mentioned_user_ids) && is_array($request->mentioned_user_ids)) {
    $taskId = $bitacora->id;
    $mentionedBy = auth()->user()->id;
    $mentionedByName = auth()->user()->name;
    
    foreach ($request->mentioned_user_ids as $mentionedUserId) {
        $mentionedUser = User::find($mentionedUserId);
        if (!$mentionedUser) continue;
        
        if ($mentionedUserId != $mentionedBy) {
            Notification::create([
                'user_id' => $mentionedUserId,
                'type' => 'mention',
                'title' => 'Fuiste mencionado en una nueva tarea',
                'message' => "{$mentionedByName} te mencionó al crear una tarea",
                'task_id' => $taskId,
                'comment_id' => null, // Es una mención en la tarea, no en comentario
                'created_at' => now(),
                'read_at' => null,
            ]);
        }
    }
}
```

---

### **Opción 2: Nuevos Endpoints (Si se prefiere separar)**

Si prefieren endpoints dedicados, estos son opcionales:

#### **A. Obtener Notificaciones**

```http
GET /notifications?unread_only=true&per_page=50

Response 200:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "mention",
      "title": "Fuiste mencionado en una tarea",
      "message": "Carlos Pérez te mencionó en un comentario",
      "task_id": 123,
      "comment_id": 456,
      "created_at": "2024-01-15T10:30:00Z",
      "read_at": null,
      "link": "/Herramientas/operaciones?task_id=123"
    }
  ],
  "unread_count": 5,
  "total": 12
}
```

#### **B. Marcar Notificación como Leída**

```http
PATCH /notifications/{id}/read

Response 200:
{
  "success": true,
  "message": "Notificación marcada como leída",
  "data": {
    "id": 1,
    "read_at": "2024-01-15T11:00:00Z"
  }
}
```

#### **C. Marcar Todas como Leídas**

```http
PATCH /notifications/read-all

Response 200:
{
  "success": true,
  "message": "Todas las notificaciones fueron marcadas como leídas",
  "data": {
    "updated_count": 5
  }
}
```

---

## 📊 Estructura de Base de Datos Sugerida

### **Tabla: `notifications`**

```sql
CREATE TABLE notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'mention', -- 'mention', 'task_assigned', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT,
    task_id BIGINT UNSIGNED NULL,
    comment_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_read_at (read_at),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES bitacora_operativa(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES tareas_comentarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Nota:** Si la tabla ya existe o tiene otro nombre, adaptar según esquema existente.

---

## 🔄 Integración sin Romper Funcionalidad

### **Principios de Implementación:**

1. **Backward Compatible:** Si `mentioned_user_ids` no existe o está vacío, NO hacer nada (comportamiento actual)

2. **No bloquear:** Si hay error al crear notificaciones, NO fallar la creación del comentario/tarea

3. **Validación silenciosa:** Si un `mentioned_user_id` no existe, simplemente saltarlo

4. **Performance:** Usar transacciones y procesar en background si hay muchos usuarios mencionados

### **Ejemplo de Implementación Segura:**

```php
// Pseudocódigo seguro
try {
    // 1. Crear comentario/tarea (proceso existente)
    $comment = $this->createComment($data);
    
    // 2. Si mentioned_user_ids existe, procesar notificaciones
    if (isset($data['mentioned_user_ids']) && 
        is_array($data['mentioned_user_ids']) && 
        count($data['mentioned_user_ids']) > 0) {
        
        // Procesar en background o asíncrono para no bloquear
        dispatch(new CreateMentionNotifications($comment, $data['mentioned_user_ids']));
        // O procesar síncrono pero sin fallar si hay error
        try {
            $this->createMentionNotifications($comment, $data['mentioned_user_ids']);
        } catch (\Exception $e) {
            // Log error pero no fallar el comentario
            \Log::warning('Error creating mention notifications', [
                'comment_id' => $comment->id,
                'error' => $e->getMessage()
            ]);
        }
    }
    
    return response()->json(['success' => true, 'data' => $comment]);
    
} catch (\Exception $e) {
    // Manejo de errores existente
    return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
}
```

---

## 📝 Casos de Uso

### **Caso 1: Usuario menciona a otro en comentario**

```javascript
// Frontend envía:
POST /tareas_operativas/123/comentarios
{
  "comment": "<p>@Carlos, necesito tu ayuda</p>",
  "mentioned_user_ids": [456]
}

// Backend:
// 1. Crea comentario normalmente ✅
// 2. Crea notificación para usuario ID 456 ✅
// 3. Retorna comentario creado ✅
```

### **Caso 2: Usuario se menciona a sí mismo**

```javascript
// Frontend envía:
POST /tareas_operativas/123/comentarios
{
  "comment": "<p>Nota para mí: @Yo</p>",
  "mentioned_user_ids": [123] // ← Mismo usuario
}

// Backend:
// 1. Crea comentario normalmente ✅
// 2. NO crea notificación (validación: user_id == mentioned_user_id) ✅
// 3. Retorna comentario creado ✅
```

### **Caso 3: Mencionar múltiples usuarios**

```javascript
// Frontend envía:
POST /tareas_operativas/123/comentarios
{
  "comment": "<p>@Carlos, @María, @Juan revisen esto</p>",
  "mentioned_user_ids": [456, 789, 101]
}

// Backend:
// 1. Crea comentario normalmente ✅
// 2. Crea 3 notificaciones (una por usuario mencionado) ✅
// 3. Retorna comentario creado ✅
```

### **Caso 4: Campo mentioned_user_ids no existe (retrocompatibilidad)**

```javascript
// Frontend viejo envía:
POST /tareas_operativas/123/comentarios
{
  "comment": "<p>Comentario sin menciones</p>
  // ← No envía mentioned_user_ids
}

// Backend:
// 1. Crea comentario normalmente ✅
// 2. NO procesa notificaciones (campo no existe) ✅
// 3. Retorna comentario creado ✅
// **Comportamiento actual, NO SE ROMPE NADA**
```

---

## 🎯 Prioridad de Implementación

### **Fase 1: Básico (Mínimo viable)**
1. ✅ Procesar `mentioned_user_ids` en creación de comentarios
2. ✅ Crear notificaciones en base de datos
3. ✅ NO romper funcionalidad existente

### **Fase 2: Completo**
4. ⬜ Endpoint GET /notifications
5. ⬜ Endpoint PATCH /notifications/{id}/read
6. ⬜ Endpoint PATCH /notifications/read-all

### **Fase 3: Optimización (Opcional)**
7. ⬜ Procesar notificaciones en background (queue)
8. ⬜ WebSocket para notificaciones en tiempo real
9. ⬜ Email notifications (opcional)

---

## ⚠️ Consideraciones Importantes

### **1. No Romper Funcionalidad Existente**
- ✅ Si `mentioned_user_ids` no existe → comportarse como ahora
- ✅ Si `mentioned_user_ids` es array vacío → no crear notificaciones
- ✅ Si falla creación de notificaciones → NO fallar creación del comentario

### **2. Validaciones Necesarias**
- Validar que `mentioned_user_ids` es un array
- Validar que cada ID existe en tabla `users`
- No crear notificación si el usuario se menciona a sí mismo
- No crear notificaciones duplicadas para el mismo comentario/tarea

### **3. Performance**
- Si hay 100 usuarios mencionados, considerar procesar en background
- Usar índices en base de datos para consultas rápidas
- Limpiar notificaciones antiguas periódicamente (opcional)

---

## 📋 Checklist de Implementación

- [ ] **Tabla `notifications` creada** (o verificar si ya existe)
- [ ] **Procesar `mentioned_user_ids` en POST comentarios** sin romper funcionalidad
- [ ] **Procesar `mentioned_user_ids` en POST crear tarea** sin romper funcionalidad
- [ ] **Validaciones implementadas** (usuario existe, no auto-mención, etc.)
- [ ] **Manejo de errores** (no fallar comentario si falla notificación)
- [ ] **Endpoint GET /notifications** (opcional, Fase 2)
- [ ] **Endpoint PATCH /notifications/{id}/read** (opcional, Fase 2)
- [ ] **Endpoint PATCH /notifications/read-all** (opcional, Fase 2)
- [ ] **Testing:** Verificar que comentarios sin menciones siguen funcionando
- [ ] **Testing:** Verificar que comentarios con menciones crean notificaciones

---

## 🔗 Referencias

### **Endpoints Actuales que Necesitan Modificación:**

1. `POST /tareas_operativas/{id}/comentarios` - Agregar procesamiento de `mentioned_user_ids`
2. `POST /bitacora_operativa/create` - Agregar procesamiento de `mentioned_user_ids`

### **Endpoints Nuevos (Opcionales):**

1. `GET /notifications` - Listar notificaciones del usuario actual
2. `PATCH /notifications/{id}/read` - Marcar notificación como leída
3. `PATCH /notifications/read-all` - Marcar todas como leídas

---

## 📞 Preguntas o Dudas

Si necesitan clarificación sobre:
- Estructura de datos actual
- Formato de respuestas
- Integración con sistema existente
- Consideraciones de seguridad

**Contactar al equipo de frontend con esta documentación.**

---

**Última actualización:** [Fecha]
**Versión:** 1.0
**Estado:** Listo para implementación


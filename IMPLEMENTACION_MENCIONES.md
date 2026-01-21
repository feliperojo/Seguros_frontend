# 📋 Implementación de Menciones (@usuario) en Tareas

## ✅ Funcionalidad Implementada

Se ha agregado la capacidad de mencionar usuarios en tareas y comentarios sin romper la funcionalidad existente.

---

## 🎯 Decisiones de Diseño

### **1. Responsabilidad de la Tarea**

**DECISIÓN CRÍTICA:** La tarea **SIGUE SIENDO RESPONSABILIDAD** del usuario asignado originalmente (`assign_to_user_id`).

**¿Por qué?**
- Mantiene la estructura existente intacta
- No cambia la lógica de asignación actual
- La mención es una **notificación/visibilidad adicional**, no una transferencia de responsabilidad

**Comportamiento:**
- El usuario mencionado **PUEDE VER** la tarea en su calendario (si usa el filtro)
- El usuario mencionado **PUEDE COMENTAR** en la tarea
- El usuario mencionado **NO ES RESPONSABLE** de completarla (eso sigue siendo del `assign_to_user_id`)

---

### **2. Dónde Aparece la Tarea para el Usuario Mencionado**

#### A. **Calendario** (`CalendarioTareas.jsx`)
- ✅ **Nuevo botón @** junto al selector de usuario
- Al activarlo, muestra **solo tareas donde el usuario fue mencionado**
- El filtro es alternativo: o ves tus tareas asignadas, o ves las tareas donde fuiste mencionado

#### B. **Panel de Tareas Pendientes** (Por implementar)
- Se puede agregar una sección separada: "Tareas donde fui mencionado"
- Por ahora, el calendario con el filtro @ es suficiente

---

### **3. Formato de Menciones**

**Formato en la base de datos y API:**
```json
{
  "comment": "<p>Hola @[Juan Pérez](123), necesito tu ayuda</p>",
  "mentioned_user_ids": [123]
}
```

**Formato visual en el editor:**
- Al escribir `@` aparece un dropdown con usuarios
- Al seleccionar, se inserta: `@[Nombre Usuario](id)`
- Visualmente se muestra como un badge azul: `@Nombre Usuario`

---

## 🔧 Componentes Modificados

### **1. Utilidades** (`src/utils/mentions.js`)
- `extractMentions(htmlText)` - Extrae menciones de un texto HTML
- `extractMentionedUserIds(htmlText)` - Obtiene solo los IDs
- `highlightMentions(htmlText)` - Resalta menciones con estilos
- `isUserMentioned(htmlText, userId)` - Verifica si un usuario fue mencionado

### **2. Hook Personalizado** (`src/hooks/useMentionableQuill.js`)
- Maneja autocompletado de menciones en ReactQuill
- Detecta cuando se escribe `@`
- Muestra dropdown con usuarios filtrados
- Navegación con teclado (↑↓ Enter Tab Escape)

### **3. ResponderTareaModal** (`src/components/Tareas/ResponderTareaModal.jsx`)
- ✅ Autocompletado de menciones en comentarios
- ✅ Envío de `mentioned_user_ids` al crear comentario
- ✅ Visualización de menciones destacadas en comentarios existentes
- ✅ Funciona tanto para agregar comentarios como para completar tareas

### **4. NuevaTareaModal** (`src/components/Tareas/NuevaTareaModal.jsx`)
- ✅ Autocompletado de menciones en descripción de tarea
- ✅ Envío de `mentioned_user_ids` al crear tarea
- ✅ Visualización destacada de menciones

### **5. CalendarioTareas** (`src/components/Tareas/CalendarioTareas.jsx`)
- ✅ Botón `@` para filtrar tareas donde el usuario fue mencionado
- ✅ Endpoint: `tareas_operativas?mentioned_user_id=${userId}`
- ✅ Fallback: filtrado local si el backend no soporta aún el endpoint

---

## 📡 API - Cambios Necesarios en Backend

### **Endpoints a Implementar/Actualizar:**

#### **1. Crear Comentario** (Ya soporta `mentioned_user_ids`)
```
POST /tareas_operativas/{id}/comentarios
Body: {
  "comment": "<p>@[Usuario](123)</p>",
  "mentioned_user_ids": [123]  // ← NUEVO
}
```

#### **2. Crear Tarea** (Ya soporta `mentioned_user_ids`)
```
POST /bitacora_operativa/create
Body: {
  "note": "<p>@[Usuario](123)</p>",
  "mentioned_user_ids": [123],  // ← NUEVO
  ...otros campos
}
```

#### **3. Obtener Tareas por Menciones** (NUEVO - Recomendado)
```
GET /tareas_operativas?mentioned_user_id={userId}
```

**Respuesta esperada:**
```json
{
  "data": [
    {
      "id": 1,
      "log": {...},
      "comments": [
        {
          "id": 10,
          "comment": "<p>@[Juan](123)</p>",
          "mentioned_user_ids": [123]  // ← NUEVO
        }
      ]
    }
  ]
}
```

---

## 🎨 Experiencia de Usuario

### **Para Mencionar a Alguien:**

1. **En un comentario o descripción:**
   - Escribe `@`
   - Aparece dropdown con usuarios
   - Puedes escribir para filtrar (ej: `@juan`)
   - Selecciona con mouse o Enter/Tab
   - La mención aparece como badge azul

2. **Navegación por teclado:**
   - `@` - Abre dropdown
   - `↑↓` - Navegar lista
   - `Enter` o `Tab` - Insertar mención
   - `Escape` - Cerrar dropdown

### **Para Ver Tareas Donde Fuiste Mencionado:**

1. **En el Calendario:**
   - Selecciona tu usuario
   - Haz clic en el botón `@` (se pone azul)
   - Ahora solo ves tareas donde fuiste mencionado

---

## 🔍 Cómo Funciona la Detección

### **Al Crear/Editar Comentario:**

1. Usuario escribe `@` en el editor
2. Hook detecta y muestra dropdown
3. Usuario selecciona persona
4. Se inserta: `@[Nombre](id)` en el HTML
5. Al guardar, se extraen los IDs con `extractMentionedUserIds()`
6. Se envía `mentioned_user_ids: [123, 456]` al backend

### **Al Mostrar Comentarios:**

1. Se obtiene HTML del comentario
2. Se procesa con `highlightMentions()`
3. Las menciones se convierten en badges azules
4. HTML resultante se renderiza con `dangerouslySetInnerHTML`

---

## ⚠️ Compatibilidad Retroactiva

### **Comentarios Antiguos (Sin Menciones):**
- ✅ Se renderizan normalmente
- ✅ No hay errores si no tienen formato de mención
- ✅ Funcionan igual que antes

### **Si el Backend No Soporta `mentioned_user_ids`:**
- ✅ El frontend sigue funcionando
- ✅ Las menciones se guardan en el HTML del comentario
- ✅ Se pueden extraer después si el backend se actualiza

---

## 🚀 Próximos Pasos (Opcional)

### **Mejoras Futuras:**
1. **Notificaciones**: Enviar notificación cuando alguien te menciona
2. **Panel Dedicado**: Sección "Menciones" en sidebar
3. **Badge de Contador**: Mostrar número de menciones no leídas
4. **Email Digest**: Resumen diario de menciones
5. **Permisos**: Controlar quién puede mencionar a quién

---

## 🧪 Testing

### **Casos a Probar:**

1. ✅ Mencionar usuario en comentario nuevo
2. ✅ Mencionar usuario en descripción de tarea nueva
3. ✅ Múltiples menciones en un mismo comentario
4. ✅ Ver menciones destacadas en comentarios existentes
5. ✅ Filtrar calendario por menciones (botón @)
6. ✅ Navegación por teclado en dropdown
7. ✅ Retrocompatibilidad con comentarios antiguos

---

## 📝 Notas Técnicas

### **Seguridad:**
- Los IDs de usuarios mencionados se validan en el frontend
- El backend debe validar que los IDs existan y el usuario tenga permisos
- Las menciones no otorgan permisos adicionales automáticamente

### **Rendimiento:**
- El dropdown se carga solo cuando se escribe `@`
- La lista de usuarios se cachea durante la sesión
- La extracción de menciones es eficiente (regex)

### **Accesibilidad:**
- Navegación completa por teclado
- Dropdown con aria-labels (se puede mejorar)
- Contraste adecuado en badges de menciones

---

## ✅ Resumen

**Lo que se agregó:**
- ✅ Sistema completo de menciones sin romper funcionalidad existente
- ✅ Autocompletado inteligente en Quill
- ✅ Visualización destacada de menciones
- ✅ Filtro en calendario para ver tareas con menciones
- ✅ Compatibilidad retroactiva

**Lo que NO cambió:**
- ✅ La responsabilidad de tareas (`assign_to_user_id`)
- ✅ El flujo existente de creación/edición
- ✅ Los componentes existentes (solo se extendieron)

**Responsabilidad:**
- 🎯 **Asignado original** (`assign_to_user_id`) = Responsable de completar
- 📢 **Mencionados** (`mentioned_user_ids`) = Notificados, pueden ver y comentar

---

*Implementación completa y lista para usar* ✨


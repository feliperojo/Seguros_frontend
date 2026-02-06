# Guía de Prueba Manual - Firma de Documentos con DocuSeal

## Objetivo
Verificar que el flujo completo de generación de PDF y envío a firma funcione correctamente.

## Prerequisitos
- Usuario autenticado en el ERP
- Grupo familiar con al menos un tomador
- Datos del tomador completos (email, nombre)

## Flujo de Prueba

### 1. Generar Autorización

1. **Navegar a Grupo Familiar**
   - Ir a la sección de grupos familiares
   - Seleccionar un grupo familiar existente o crear uno nuevo
   - Asegurarse de que hay un tomador en el grupo

2. **Generar PDF de Autorización**
   - En la lista de miembros, buscar el miembro con parentesco "TOMADOR"
   - Hacer clic en el menú de acciones (tres puntos o dropdown)
   - Seleccionar "Descargar Autorización"
   - **Resultado esperado**: Se genera el PDF y se abre un modal con dos opciones:
     - Botón "Descargar" (azul)
     - Botón "Enviar a firmar" (primario)

### 2. Probar Descarga Directa

1. En el modal "Documento Generado", hacer clic en "Descargar"
2. **Resultado esperado**: 
   - El PDF se descarga automáticamente
   - El modal se cierra
   - El archivo se puede abrir y verificar

### 3. Probar Envío a Firma

1. **Abrir formulario de firma**
   - En el modal "Documento Generado", hacer clic en "Enviar a firmar"
   - **Resultado esperado**: Se muestra un formulario con:
     - Campo para agregar firmantes (email y nombre)
     - Email del tomador prellenado (si está disponible)
     - Campos opcionales: Asunto del email, Mensaje del email

2. **Completar formulario**
   - Verificar que el email del firmante esté completo
   - Opcionalmente agregar más firmantes (botón "Agregar firmante")
   - Opcionalmente completar asunto y mensaje del email
   - Hacer clic en "Enviar a firmar"

3. **Verificar envío**
   - **Resultado esperado**: 
     - Se muestra un spinner de carga
     - Se envía el PDF al backend como multipart/form-data
     - Si el backend responde correctamente:
       - Se muestra un toast de éxito
       - Se abre un nuevo modal "Firma del Documento" con un iframe
       - El iframe carga la URL de firma de DocuSeal (https://firma.vantun.com/s/<slug>)
     - Si hay error:
       - Se muestra un mensaje de error claro
       - El modal de generación permanece abierto

### 4. Probar Firma Embebida

1. **En el modal de firma**:
   - Verificar que el iframe se carga correctamente
   - El iframe debe mostrar la interfaz de DocuSeal para firmar
   - **Nota**: El cliente externo NO está logueado, la firma ocurre en DocuSeal

2. **Probar botón "Verificar estado"** (opcional):
   - Hacer clic en "Verificar estado"
   - **Resultado esperado**:
     - Se muestra un spinner
     - Se consulta el backend: `GET /api/signatures/submissions/{submission_id}`
     - Se muestra el estado actual de la firma
     - Si está completado, se muestra un mensaje de éxito

3. **Cerrar modal**:
   - Hacer clic en "Cerrar"
   - **Resultado esperado**: Se cierra el modal de firma y el modal de generación

### 5. Probar Generación de Confirmación

1. **Navegar a detalle del grupo familiar**
   - Abrir el modal de detalle de un grupo familiar
   - Buscar el botón "Confirmación de Datos"

2. **Generar PDF de Confirmación**
   - Hacer clic en "Confirmación de Datos"
   - **Resultado esperado**: Mismo flujo que autorización:
     - Se genera el PDF
     - Se abre modal con opciones Descargar/Enviar a firmar
     - El tipo de documento es "CONFIRMACION"

### 6. Verificar Datos Enviados al Backend

Al enviar a firma, el backend debe recibir:

**Endpoint**: `POST /api/signatures/submissions`

**Form-Data**:
- `file`: Archivo PDF (Blob/File)
- `filename`: "Autorizacion_[nombre].pdf" o "Confirmacion_[nombre].pdf"
- `document_type`: "AUTORIZACION" o "CONFIRMACION"
- `signers`: JSON string con array de firmantes
  ```json
  [
    {
      "email": "cliente@ejemplo.com",
      "name": "Nombre Completo",
      "order": 1
    }
  ]
  ```
- `metadata`: JSON string con metadatos
  ```json
  {
    "cliente_id": 123,
    "grupo_familiar_id": 45
  }
  ```
- `email_subject`: (opcional) Asunto del email
- `email_body`: (opcional) Mensaje del email

**Respuesta esperada del backend**:
```json
{
  "success": true,
  "submission_id": "abc123",
  "embed_src": "https://firma.vantun.com/s/abc123"
}
```

### 7. Manejo de Errores

**Probar escenarios de error**:

1. **Error de red**:
   - Desconectar internet
   - Intentar enviar a firma
   - **Resultado esperado**: Mensaje de error claro

2. **Error del backend**:
   - Si el backend responde con `success: false`
   - **Resultado esperado**: Se muestra el mensaje del backend (`response.message`)

3. **Email inválido**:
   - Intentar enviar con email inválido
   - **Resultado esperado**: Validación en frontend antes de enviar

4. **Sin firmantes**:
   - Intentar enviar sin agregar firmantes
   - **Resultado esperado**: Validación en frontend

## Checklist de Verificación

- [ ] Modal "Documento Generado" se muestra correctamente
- [ ] Botón "Descargar" funciona y descarga el PDF
- [ ] Botón "Enviar a firmar" abre el formulario
- [ ] Formulario valida emails correctamente
- [ ] Se pueden agregar múltiples firmantes
- [ ] El PDF se envía al backend correctamente
- [ ] El backend responde con `embed_src` y `submission_id`
- [ ] Modal de firma se abre con iframe
- [ ] El iframe carga la URL de DocuSeal correctamente
- [ ] Botón "Verificar estado" funciona (si está implementado en backend)
- [ ] Los errores se muestran claramente
- [ ] El flujo funciona tanto para AUTORIZACION como CONFIRMACION

## Notas Técnicas

- El frontend NO maneja tokens de DocuSeal
- Solo consume la API del ERP (`/api/signatures/submissions`)
- El cliente externo firma en DocuSeal (no dentro del ERP autenticado)
- Si `embed_src` viene con IP, se normaliza a `https://firma.vantun.com/s/<slug>`


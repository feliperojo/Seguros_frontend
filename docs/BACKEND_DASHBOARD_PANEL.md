# Ajustes recomendados en backend para el panel principal (dashboard)

Documento de referencia alineado con la optimización del frontend (`Dashboard.jsx`). Objetivo: **menos peticiones, menos datos y respuestas predecibles** sin cambiar el contrato actual hasta que se implemente lo nuevo.

---

## 1. Formato de respuesta consistente (prioridad alta)

Hoy el frontend ya **normaliza** listas (`[]`, `{ data: [] }`, etc.), pero mantener un estándar reduce trabajo y bugs.

**Recomendación**

- Listas: `200 OK` con cuerpo `[]` o `{ "data": [] }` cuando no hay registros. **Evitar 404** solo por lista vacía.
- Paginación: si aplica, incluir siempre `meta.total` o `pagination.total` cuando el front pide `per_page` para KPIs.

Endpoints a revisar con este criterio:

- `GET cliente/recientes`
- `GET cobertura/proximas-vencer`
- `GET cobertura/canceladas`
- `GET coberturas/historial-renovaciones`
- `GET documentos/proximos-vencer?dias=`
- `GET tareas_operativas` (array en `data` o raíz, documentado)

---

## 2. Endpoint agregado “snapshot” del dashboard (prioridad media, mayor ahorro)

**Propuesta:** `GET /api/dashboard/summary` o `GET /api/me/dashboard`

**Query opcional (o body no recomendado en GET):** flags según preferencias del usuario, por ejemplo:

`?include=stats,recent_clients,documents,upcoming,cancelled_events,birthdays,pending_payments,overdue_tasks`

**Respuesta sugerida (ejemplo esquemático)**

```json
{
  "stats": {
    "totalClientes": 0,
    "totalGruposFamiliares": 0,
    "polizasActivas": 0,
    "polizasCanceladas": 0,
    "polizasRetiradas": 0
  },
  "clientes_recientes": [],
  "documentos_proximos_vencer": [],
  "coberturas_proximas_vencer": [],
  "eventos_cancelacion_retiro": [],
  "cumpleanos_hoy": [],
  "pagos_pendientes_mes": [],
  "tareas_calendario": [],
  "tareas_vencidas_resumen": []
}
```

**Beneficio:** una sola ronda HTTP + una estrategia de caché (Redis 30–60 s) si aplica; menos carga en TLS y menos serialización repetida.

**Nota:** El frontend puede migrar por fases: primero consumir el agregado para bloques pesados; mantener rutas legacy hasta deprecar.

---

## 3. Cumpleaños del día sin listar todos los clientes (prioridad alta en costo)

**Problema actual:** si falla `cliente/with-cobertura`, el cliente puede pedir `cliente?per_page=1000` y filtrar en front.

**Propuesta backend**

- `GET /api/cliente/cumpleanos-hoy`  
  O `GET /api/cliente?cumple_mes=MM&cumple_dia=DD&per_page=500&fields=...` con índice por mes/día de nacimiento.

**Campos mínimos:** `id`, `nombre_completo`, `fecha_nacimiento`, `telefono`, `email`.

**Beneficio:** acota filas en BD y tamaño de JSON.

---

## 4. Tareas operativas: un contrato claro y paginación

El panel usa:

- calendario: `tareas_operativas?per_page=100`
- tareas vencidas (usuario): `tareas_operativas?assigned_user_id=…&per_page=200`

**Recomendaciones**

- Documentar forma única de la lista (`data` array vs raíz).
- Soporte de cursor o `page` para no depender de límites fijos altos.
- Filtros de servidor: `status`, `due_before`, `assigned_user_id` para que “vencidas” pueda resolverse en BD con índice en `due_date` / `scheduled_date`.

**Opcional:** endpoint `GET tareas_operativas/dashboard?user_id=` que devuelva en una respuesta las dos vistas necesarias (calendario + vencidas) para reducir a una petición.

---

## 5. Coberturas canceladas / historial

Mantener `Promise.allSettled` en el front implica que uno de los dos endpoints puede fallar y el otro no.

**Backend**

- Garantizar que ambos devuelvan listas vacías en casos normales sin datos.
- Si en el futuro hay un solo origen de verdad, exponer un endpoint unificado (p. ej. `coberturas/eventos`) con tipo `cancelacion` | `retiro`.

---

## 6. Documentos próximos a vencer

- Parámetro `dias` validado (15, 30, 60, 90 o rango permitido).
- Respuesta siempre lista o `data` acotada a columnas que muestra el panel (cliente, póliza, parentesco, documento, estado, fechas).

---

## 7. Observabilidad

- Métricas p95 por ruta usada en dashboard.
- Tamaño medio de payload gzip.
- Conteo de queries SQL por request en el snapshot (objetivo: acotar con joins/vistas materializadas si crece).

---

## Priorización sugerida para el equipo backend

1. Respuestas vacías en **200** y forma de lista estable (#1).  
2. **Cumpleaños** sin escaneo masivo (#3).  
3. **Snapshot** o unificación parcial de tareas (#2 y #4).  
4. Refinamiento de índices y campos mínimos en listados (#6).

---

*Este documento es la contraparte de los cambios de robustez y paralelización aplicados en `src/pages/Dashboard.jsx`.*

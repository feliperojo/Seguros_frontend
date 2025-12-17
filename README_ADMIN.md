# Módulo de Administración de Usuarios, Roles y Permisos

## 📋 Rutas Disponibles

| Ruta | Descripción | Permiso Requerido |
|------|-------------|-------------------|
| `/admin/users` | Lista de usuarios | `users.view` |
| `/admin/roles` | Lista de roles | `roles.view` |
| `/admin/roles/:id/permissions` | Gestionar permisos de un rol | `roles.assign_permissions` |
| `/admin/permissions` | Lista de permisos | `permissions.view` |
| `/admin/audit-logs` | Logs de auditoría | `users.view` |

## 🔐 Permisos del Sistema

### Permisos Nuevos (Convención: module.action)

#### Usuarios
- `users.view` - Ver lista de usuarios
- `users.create` - Crear usuarios
- `users.edit` - Editar usuarios
- `users.disable` - Activar/desactivar usuarios
- `users.assign_roles` - Asignar roles a usuarios

#### Roles
- `roles.view` - Ver lista de roles
- `roles.create` - Crear roles
- `roles.edit` - Editar roles
- `roles.delete` - Eliminar roles
- `roles.assign_permissions` - Gestionar permisos de roles

#### Permisos
- `permissions.view` - Ver lista de permisos
- `permissions.manage` - Gestionar permisos

#### Tareas
- `tasks.view` - Ver tareas
- `tasks.create` - Crear tareas
- `tasks.edit` - Editar tareas
- `tasks.delete` - Eliminar tareas

#### Reportes
- `reports.view` - Ver reportes

### 🔄 Compatibilidad Legacy

El sistema mantiene compatibilidad con permisos legacy en lenguaje natural. Los siguientes permisos legacy habilitan automáticamente los permisos nuevos correspondientes:

- **`manage users`** → Habilita todos los permisos de usuarios, roles y permisos
- **`view tasks`** → Habilita `tasks.view`
- **`create tasks`** → Habilita `tasks.create`
- **`edit tasks`** → Habilita `tasks.edit`
- **`delete tasks`** → Habilita `tasks.delete`
- **`view reports`** → Habilita `reports.view`

**Nota:** El permiso legacy `manage users` es especialmente potente, ya que habilita acceso completo al módulo de administración (usuarios, roles y permisos).

## 🌍 Variables de Entorno

Configura en tu archivo `.env`:

```env
VITE_API_BASE_URL=https://api.tudominio.com
```

O si usas proxy:

```env
VITE_API_BASE_URL=/api
```

## 🚀 Cómo Usar

1. **Iniciar sesión**: Ve a `/login` e ingresa tus credenciales
2. **Acceder al módulo admin**: Navega a `/admin/users` (o cualquier ruta del módulo)
3. **Gestionar usuarios**: Crea, edita, activa/desactiva usuarios según tus permisos
4. **Gestionar roles**: Crea roles y asigna permisos desde `/admin/roles`
5. **Ver auditoría**: Revisa los logs en `/admin/audit-logs`

## 📝 Notas

- El módulo está completamente integrado con el sistema de autenticación existente
- Los permisos se verifican automáticamente en cada ruta
- Los botones se ocultan si no tienes los permisos necesarios
- Los errores se muestran con mensajes claros del backend


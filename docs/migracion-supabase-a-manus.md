# Migración de Supabase a Manus

## Respaldo previo

El 27 de agosto de 2026 se realizó un respaldo no destructivo de Supabase antes de sustituir la infraestructura. El archivo se guardó en el almacenamiento privado administrado de Manus con la clave `asternal-migration-backups/supabase-snapshot-2026-08-27T22-23-33-513Z.json`. Contiene 5 355 787 bytes de datos serializados y no se expone desde la interfaz pública.

| Fuente respaldada | Registros encontrados |
| --- | ---: |
| Usuarios de autenticación | 19 |
| Perfiles | 19 |
| Publicaciones | 18 |
| Proyectos de usuario | 360 |
| Mensajes de chat | 71 |
| Notificaciones | 62 |
| Reacciones | 39 |
| Transacciones de orbes | 45 |
| Reproducciones de juegos | 19 |
| Otras tablas presentes | 60 |

Las tablas `chat_polls`, `event_participants` y `games` devolvieron 404 porque no existen en el esquema remoto. Se registran como fuentes ausentes, no como datos eliminados. Ningún registro ni archivo de Supabase fue modificado durante este respaldo.

## Dirección de migración

La nueva base utiliza la autenticación integrada de Manus, la base de datos del proyecto y el almacenamiento administrado de Manus. La aplicación no fijará credenciales de servicios externos en el cliente. Los cambios de configuración legítimos se realizan desde las configuraciones seguras del proyecto; no se guardan claves en el código fuente ni en almacenamiento del navegador.

Antes de borrar el contenido de prueba de Supabase se implementará y comprobará la lectura/escritura de los equivalentes de Manus. El borrado físico del origen se ejecutará solo después de una confirmación final, pues los datos externos no son recuperables mediante la base de datos del proyecto.

## Modelo de datos limpio de Manus

La migración comenzará como una base limpia, sin copiar las publicaciones, chats, perfiles de prueba ni configuraciones de Supabase al almacenamiento operativo. El respaldo anterior se mantiene separado. La aplicación usará el identificador `openId` emitido por la autenticación de Manus como propietario único y no aceptará identificadores de usuario enviados por el navegador como autoridad.

| Recurso de Asternal | Destino administrado por Manus | Propiedad y uso |
| --- | --- | --- |
| Cuenta y sesión | Tabla `users` integrada + OAuth oficial | `openId` es la identidad estable. El cliente no crea contraseñas locales ni sesiones de Supabase. |
| Perfiles, publicaciones, comentarios, reacciones, foros, chats, proyectos y notificaciones | Tabla interna `asternal_records` con colección, propietario, payload JSON y fechas | Proporciona una base limpia y extensible sin multiplicar tablas de prueba. Las rutas del servidor imponen la propiedad de cada escritura. |
| Imágenes, adjuntos, exportaciones y versiones de código | Almacenamiento privado de Manus | Los bytes no se guardan en la base. Las referencias se vinculan a un registro propietario. |
| Índices de proyectos y juego publicado | Registros `project` y `published-game` | Al publicar se almacena una instantánea del proyecto, sus referencias de assets y, posteriormente, la versión local de código. |
| Scripts manuales | Registros `source-version` / `source-proposal` y almacenamiento privado | Quedan suspendidos durante la migración y se retomarán sobre esta identidad Manus. |

La tabla de registros preserva los nombres de colección que la interfaz actual conoce (`profiles`, `posts`, `comments`, `user_projects`, entre otros) para que la fachada de cliente se pueda sustituir de forma gradual sin reescribir cada pantalla a la vez. La diferencia fundamental es que sus operaciones pasan por rutas internas autenticadas de Asternal y no hacia Supabase desde el navegador.

## Configuración y acceso

La configuración operativa se mantendrá fuera del repositorio. Los valores administrados de autenticación, base de datos y almacenamiento de Manus ya se inyectan en el servidor; cualquier secreto opcional se actualiza por la configuración segura del proyecto, no con valores almacenados en localStorage ni claves predeterminadas en el cliente. El acceso «Continuar con Google» será sustituido por el inicio de sesión oficial de Manus, que conserva una sesión única de Manus y no intenta crear una segunda cuenta en Supabase.

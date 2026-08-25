# 03 — Arquitectura, datos y flujos

## Capas de la aplicación

| Capa | Ubicación | Responsabilidad |
| --- | --- | --- |
| Entrada y rutas | `src/routes` | Composición de páginas y navegación con TanStack Router. |
| Componentes | `src/components` | Editor, runtime, comunidad, chat, tarjetas, paneles y UI reutilizable. |
| Dominio del motor | `src/lib/engine` | Tipos de proyecto, física, scripts, animación, imágenes, sonido, almacenamiento y sincronización. |
| Dominio social | `src/lib/social` | Feed, publicaciones, perfiles, reacciones, juegos, historial, Orbes, eventos y operaciones de comunidad. |
| IA cliente | `src/lib/ai` | Preparación de mensajes, revisión y chat de Orión; las claves no deben vivir aquí. |
| Integraciones | `src/integrations` | Cliente Supabase y configuración de servicios externos. |
| Servidor | `server` | Endpoints Express, autenticación de solicitudes, integración LLM y revisión segura. |
| Persistencia remota | Supabase | Usuarios, contenido social, juegos, reacciones, chat, transacciones y metadatos. |
| Persistencia local | `localStorage`/`sessionStorage` | Proyectos, borradores, sesiones de juego, preferencias y estados auxiliares. |

## Rutas principales

Las rutas de autenticación cubren `/auth`, registro, inicio de sesión y recuperación de contraseña. `/editor` monta el editor de juegos. `/` monta la experiencia principal con juegos, feed, galería, perfil, chat, eventos, notificaciones y paneles. `/feed` ofrece una vista independiente de publicaciones. `/history` muestra el historial del usuario; `/orbes` muestra saldo y movimientos; `/plus` gestiona personalizaciones; `/profile/$userId` presenta perfiles; `/game/$gameId` muestra un juego; `/gallery`, `/events`, `/settings`, `/help` y `/admin` cubren sus superficies respectivas.

## Datos remotos

La aplicación consulta y muta tablas de Supabase que incluyen `profiles`, `posts`, `games`, `user_projects`, `reactions`, `reposts`, `comments`, `post_tags`, `tags`, `post_polls`, `post_poll_votes`, `game_plays`, `game_purchases`, `notifications`, `chats`, `chat_members`, `chat_messages`, `chat_polls`, `forum_categories`, `forum_posts`, `forum_threads`, `forum_votes`, `forum_thread_votes`, `stickers`, `events`, `banned_emails`, `blocks`, `reports`, `user_roles` y tablas relacionadas. Los nombres y accesos se concentran principalmente en `src/lib/social/api.ts` y en los componentes de cada dominio.

Supabase es la autoridad para contenido publicado, perfiles, reacciones, compras, chat y configuración comunitaria cuando el servicio está disponible. La interfaz debe tratar errores remotos explícitamente y nunca inventar una fila de respaldo para simular éxito.

## Datos locales

`storage.ts` mantiene proyectos y metadatos locales. Los borradores de publicaciones viven en una clave local específica. El historial de juego usa `play_history`; cada sesión registra juego, título, portada, inicio, fin y duración. El tiempo del historial es tiempo jugando juegos, no tiempo total en la plataforma. `sessionStorage` se utiliza para compartir contenido hacia el chat y `localStorage` también conserva preferencias de interfaz, portfolio, último estado del chat y datos locales de compatibilidad.

Los datos locales pueden quedar obsoletos frente a Supabase. Por eso el historial valida sesiones, descarta fechas imposibles y elimina sesiones cuyos juegos ya no están publicados antes de mostrar estadísticas.

## Autenticación

El cliente usa el cliente Supabase para obtener sesión y usuario. Algunas rutas toleran un modo local o degradado cuando Supabase no está disponible, pero este modo no debe convertirse en una fuente de datos ficticia. Las acciones protegidas deben verificar sesión antes de mutar publicaciones, juegos, perfiles, reacciones, chat, compras u operaciones administrativas.

## Publicación y moderación

`PostComposer` publica publicaciones sociales. `PublishGameDialog` publica o actualiza juegos. Los flujos preparan payloads limitados, llaman al endpoint de revisión de Orión y exigen `allowed === true` antes de persistir. El servidor obtiene las reglas de «Acerca de nosotros», acepta una configuración enviada como respaldo en modo local y llama a Manus LLM Models con salida JSON estructurada. Un rechazo debe incluir motivo; un error de transporte debe presentarse como error técnico, no como rechazo editorial.

El orden del feed es independiente de la moderación. Las publicaciones se ordenan mediante `orderFeedPosts`: `created_at` descendente, `updated_at` como desempate y `id` para estabilidad. «Siguiendo» filtra autores seguidos antes de ordenar; «Para ti», «Explorar» y categorías priorizan novedad.

## Chat e IA

`ChatSection` gestiona conversaciones grupales, mensajes directos, grupos, encuestas, archivos y presencia según las tablas disponibles. `OrionPanel` y la capa de IA de Orión gestionan asistencia conversacional. Las llamadas LLM ocurren en servidor mediante `invokeLLM`, usando las credenciales inyectadas por Manus. El cliente prepara historial y muestra la respuesta, pero no debe exponer claves ni llamar directamente al proveedor.

## Ejecución de datos y errores

La aplicación tiene dos clases de ejecución. El desarrollo usa Vite para el frontend; la compilación produce los activos y un bundle de Express para endpoints y producción. La prueba debe separar fallos del entorno, dependencias históricas no declaradas y fallos funcionales reales. El warning de chunks grandes de Vite no equivale a un fallo de compilación.

## Flujo resumido

```text
Usuario → Ruta React → Componente de dominio → API/servicio
                                     ├→ localStorage para proyectos, borradores y sesiones
                                     ├→ Supabase para contenido persistente y social
                                     └→ Express → Manus LLM Models para revisión y asistencia

Editor → Project → Scene/Entity/Script/UI → GameRuntime → Sesión local de juego
Juego publicado → Revisión → Supabase → Feed/Galería/Juegos → Runtime
```

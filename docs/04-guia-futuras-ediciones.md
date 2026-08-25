# 04 — Guía para futuras ediciones

## Regla principal

Antes de editar, identificar si el cambio pertenece al motor, al runtime, al almacenamiento, a la publicación, a la comunidad, al chat o a la infraestructura. No debe resolverse un problema de una capa modificando otra por conveniencia. Una modificación de orden del feed, por ejemplo, debe permanecer en el dominio social y no tocar `core.ts` ni el runtime.

## Mapa de puntos de extensión

| Necesidad | Punto recomendado | No modificar primero |
| --- | --- | --- |
| Añadir una propiedad de entidad | `src/lib/engine/core.ts`, inspector y runtime relacionado | Tablas sociales o publicación. |
| Añadir un bloque de scripting | `src/lib/engine/scripts.ts`, `ScriptEditor`, runner y pruebas | Código de autenticación. |
| Cambiar render o física | `GameRuntime`, `core.ts` y funciones de runtime | Feed o historial. |
| Cambiar almacenamiento local | `src/lib/engine/storage.ts` y migraciones de compatibilidad | Componentes sociales no relacionados. |
| Cambiar publicación | `PostComposer`, `PublishGameDialog`, `src/lib/social/api.ts` y endpoints de revisión | Ordenamiento del feed. |
| Cambiar feed | `src/lib/social/feed-order.ts`, rutas de feed y pruebas | Orión, moderación o runtime. |
| Cambiar historial | `HistorySection`, `history.ts`, `history-validation.ts` y pruebas | Crear métricas ficticias en UI. |
| Cambiar chat | `ChatSection`, `WorkChatPanel`, `OrionPanel` y tablas de chat | Datos del editor. |
| Cambiar IA | `src/lib/ai`, `server/community-ai.ts`, `server/orion.ts`, `server/_core/llm.ts` | Exponer credenciales en cliente. |
| Cambiar Supabase | `src/integrations/supabase`, API social y configuración | Copiar datos remotos a datos simulados. |

## Contratos que deben preservarse

Un `Project` debe seguir siendo serializable y compatible con proyectos anteriores. Las escenas deben conservar `id`, dimensiones, entidades, configuración y escena activa. Las entidades deben mantener sus propiedades de runtime y los scripts deben seguir usando los tipos de eventos y bloques existentes.

Una revisión de publicación debe devolver `allowed`, `reason` y `summary`. `allowed === false` detiene la publicación; `allowed === true` permite continuar. Un error de red o proveedor no debe convertirse silenciosamente en un rechazo editorial ni en una aprobación inventada.

Una sesión de historial solo es válida con juego, título, inicio, fin y duración coherentes. El historial no debe afirmar «horas usando la plataforma» mientras no exista un rastreador persistente de navegación, edición, chat y demás superficies. Las métricas deben mostrar siempre su alcance exacto.

## Protocolo para futuras modificaciones

Primero describir la intención y el flujo afectado. Después localizar la fuente de verdad y leer sus tipos, consumidores y pruebas. Añadir una tarea pendiente en `todo.md` antes de editar. Diseñar el cambio más pequeño que respete el contrato existente. Si se modifica una estructura persistida, definir compatibilidad con datos anteriores antes de escribir código.

Después ejecutar pruebas unitarias y compilación. Para cambios de UI, revisar el preview en la ruta afectada. Para cambios de publicación o IA, probar respuesta aprobada, rechazo válido, error de proveedor y payload grande. Para cambios de almacenamiento o historial, probar datos ausentes, corruptos, obsoletos y coherentes. Revisar el diff para excluir archivos ajenos al alcance y marcar `todo.md` solo después de verificar resultados.

## Riesgos conocidos

El historial local depende del navegador y no es una analítica global. Los proyectos y algunos estados pueden vivir en `localStorage`, que puede borrarse o manipularse localmente. Las URLs de medios pueden requerir firma y caducar. Los juegos publicados y el feed dependen de Supabase y de sus permisos. El bundle del frontend es grande y Vite puede advertir sobre chunks sin que la compilación falle.

La aplicación contiene rutas sociales complejas y componentes grandes, especialmente chat, perfil y administración. Deben preferirse cambios localizados y pruebas de regresión. No se deben introducir datos de demostración, reseñas, ratings, testimonios, publicaciones ficticias ni estadísticas inventadas.

## Checklist previo al cierre

| Control | Resultado requerido |
| --- | --- |
| Alcance | Solo cambian los módulos relacionados con la solicitud. |
| Datos | Cada número mostrado tiene una fuente real identificable. |
| Persistencia | No se destruyen datos remotos sin migración explícita y reversible. |
| Autenticación | Las acciones protegidas mantienen sus verificaciones. |
| IA | Las claves permanecen en servidor y las respuestas se validan. |
| Editor | El modelo `Project` y la compatibilidad de guardados se conservan. |
| Runtime | Física, scripts, render, audio y controles siguen funcionando. |
| Pruebas | Existen pruebas para el caso feliz, errores y bordes relevantes. |
| Entrega | `todo.md` está actualizado y existe checkpoint revisable. |

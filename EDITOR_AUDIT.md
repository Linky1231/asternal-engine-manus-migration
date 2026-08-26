# Auditoría inicial del editor de Asternal Engine

## Alcance

La primera tarea extensa solicita ocho ampliaciones coordinadas: sincronización por cuenta, movimiento y animación de la píldora azul, audio en scripts, revisión de bloques, organización jerárquica, gestión central de proyectos, niveles por tiles y coexistencia con 9-slicing.

## Arquitectura encontrada

El editor está implementado como una aplicación React con TanStack Router. La ruta `/editor` monta el editor principal, mientras que `src/components/engine/AsternalEditor.tsx` coordina selección de escena, edición de entidades, scripts, animaciones, UI, publicación y guardado. `SceneEditor.tsx`, `ScriptEditor.tsx`, `AnimationEditor.tsx`, `UIEditor.tsx` y `PaintEditor.tsx` son superficies especializadas existentes. `GameRuntime.tsx` ejecuta la vista jugable y `src/lib/engine/core.ts` contiene el modelo de proyecto, escenas, entidades, física y ciclo de simulación.

| Área | Contrato actual | Observación para la ampliación |
|---|---|---|
| Proyecto | `Project { name, scenes, activeSceneId, assets, settings }` | Es el contrato central que debe versionarse y asociarse a usuario. |
| Escena | `Scene { width, height, entities, layers, ui, variables }` | Ya existe soporte de capas; falta un modelo explícito de grid/tilemap. |
| Entidad | `Entity` con transformaciones, física, scripts, animaciones, textura y variables | Puede conservarse para actores; tiles deben ser datos de nivel separados o una extensión compatible. |
| Persistencia | `localStorage` con índice global `asternal:projects:index` y elementos `asternal:projects:item:*` | El índice actual no está aislado por cuenta; es la principal causa de cruces entre sesiones. |
| Nube | `cloud-sync.ts` usa `user_projects` y `cloudId` | Ya existe sincronización básica, pero debe reforzarse con namespace por usuario, versionado y resolución de conflictos. |
| Scripts | `src/lib/engine/scripts.ts` con eventos, condiciones, acciones y `createScriptRunner()` | Se debe auditar cada bloque y añadir una acción de sonido con contexto de assets. |
| Audio | `src/lib/engine/sfx.ts` ofrece WebAudio para presets y música por URL | El runtime necesita exponer un hook de audio al runner y resolver archivos de proyecto. |
| Proyectos | `ProjectManager.tsx` y almacenamiento local ya permiten listar/crear/duplicar/renombrar/eliminar | La entrada desde Crear juego debe abrir este panel antes del editor. |
| Niveles | `SceneEditor.tsx` trabaja con entidades y superficies visuales existentes | Se añadirá un modo tilemap sin eliminar 9-slicing ni romper escenas legacy. |

## Riesgos principales

El riesgo más importante es la identidad de persistencia. `storage.ts` usa claves locales globales, por lo que cambiar de cuenta en el mismo navegador puede mostrar proyectos anteriores. La solución debe determinar un namespace estable de Supabase, migrar solo los datos legacy de forma explícita y evitar que una cuenta vea o suba datos de otra.

El segundo riesgo es la compatibilidad del formato. El proyecto ya contiene escenas, capas, scripts, animaciones y assets; el tilemap debe ser opcional y normalizable para que los proyectos existentes sigan cargando. El modelo debe conservar `entities` y el sistema de 9-slicing actual, incorporando el grid como otra representación de nivel.

El tercer riesgo es el runtime de scripts. Los sonidos deben ejecutarse en el mismo ciclo que las demás acciones, pero sin crear AudioContext repetidos, bloquear el juego o depender de una URL local que no exista en otro dispositivo. Los archivos deberán persistirse como referencias válidas de almacenamiento, no como bytes dentro de la base de datos.

## Orden de implementación

Primero se estabilizará el contrato y el aislamiento de persistencia. Después se implementará la sincronización bidireccional con versionado y pruebas. Luego se abordarán runtime y scripts, incluyendo movimiento de la píldora y audio. Finalmente se reorganizará la interfaz, se añadirá el gestor central de proyectos y se construirá el modo tilemap compatible con 9-slicing.

## Criterios de aceptación iniciales

Un usuario autenticado debe ver únicamente sus proyectos, tanto en el mismo navegador como en otro dispositivo. Un proyecto existente debe cargar sin pérdida de escenas, entidades, scripts, animaciones o assets. Un bloque de sonido debe reproducir un preset o un archivo de proyecto durante el juego. Los niveles legacy deben seguir funcionando, mientras que una escena nueva debe poder editarse mediante una cuadrícula de tiles y conservar elementos 9-slicing cuando se requiera. Cada sistema deberá tener pruebas automatizadas y validación visual responsive antes de publicar.

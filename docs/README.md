# Documentación de Asternal Engine

Esta carpeta describe la aplicación que se está editando, no una plantilla genérica. La documentación fue contrastada con el código fuente del proyecto y está pensada como referencia antes de realizar futuras modificaciones.

## Documentos

| Documento | Propósito |
| --- | --- |
| [01 — Visión y alcance](./01-vision-y-alcance.md) | Define qué es Asternal Engine, quién lo usa y cuáles son sus flujos funcionales. |
| [02 — Editor y motor](./02-editor-y-motor.md) | Explica exactamente qué edita el editor, el modelo de proyecto y la ejecución de juegos. |
| [03 — Arquitectura y datos](./03-arquitectura-y-datos.md) | Mapea frontend, rutas, Supabase, almacenamiento local, servidor e integraciones. |
| [04 — Guía para futuras ediciones](./04-guia-futuras-ediciones.md) | Establece límites, puntos de extensión, pruebas obligatorias y riesgos de modificación. |
| [05 — Auditoría funcional previa](./application-audit.md) | Resume la auditoría utilizada para depurar el historial y sus fuentes reales. |

## Regla de lectura

Antes de modificar el editor, debe leerse primero el documento 02. Antes de modificar publicaciones, comunidad, autenticación o persistencia, debe leerse el documento 03. Antes de tocar una funcionalidad existente, debe aplicarse el documento 04 y comprobar que la modificación corresponde al flujo correcto.

> Asternal Engine no es únicamente un editor visual: es un editor de juegos conectado a una plataforma social de publicación, descubrimiento, interacción y ejecución de creaciones.

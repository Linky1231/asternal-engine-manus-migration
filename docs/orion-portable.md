# Orión fuera de Manus

Orión puede ejecutarse en cualquier servidor Node.js que tenga acceso a un endpoint compatible con la API **Chat Completions** de OpenAI. La clave se usa exclusivamente en el servidor; nunca debe llevar el prefijo `VITE_`, incluirse en el cliente ni subirse al repositorio.

| Variable | Uso | Ejemplo de formato |
|---|---|---|
| `ORION_AI_BASE_URL` | Base del API compatible, incluida la versión. | `https://api.openai.com/v1` |
| `ORION_AI_API_KEY` | Clave privada del proveedor. | `…` |
| `ORION_AI_MODEL` | Identificador del modelo habilitado por el proveedor. | `gpt-4o-mini` |

> Las tres variables son obligatorias juntas. Si falta alguna, Orión se detiene con un error de configuración claro en lugar de fingir que la IA está disponible.

## Despliegue externo

En tu plataforma de alojamiento, añade las tres variables anteriores a los **secretos del servidor** y vuelve a desplegar. El backend usa `fetch`, por lo que requiere Node.js 18 o superior. Configura `ORION_AI_BASE_URL` con una URL que acepte `POST /chat/completions` y autenticación `Bearer`.

El adaptador no envía estas variables al navegador. Moderación, recomendaciones y revisión de juegos o artes siguen llamando al mismo backend autenticado de Asternal Engine.

## Migración gradual

Mientras esta aplicación se ejecute dentro de Manus y no existan variables `ORION_AI_*`, conserva temporalmente la integración actual. En cualquier despliegue externo, define las tres variables: así se usará el proveedor seleccionado y no habrá dependencia de Manus.

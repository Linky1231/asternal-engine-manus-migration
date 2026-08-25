# 02 — Editor y motor de juegos

## Qué se está editando

El editor de Asternal Engine es una aplicación de autoría de juegos 2D que corre en el navegador. No edita directamente una base de datos de escenas ni un archivo de código fuente del juego. Edita un objeto `Project` serializable, compuesto por configuración, escenas y recursos de sprites. La interfaz modifica ese objeto inmutablemente por parches y lo guarda en almacenamiento local o lo sincroniza con la nube.

La entrada principal es la ruta `/editor`, que monta `AsternalEditor`. El editor se apoya en `ProjectManager`, `SceneEditor`, `EntityInspector`, `ScriptEditor`, `SpriteEditor`, `UIEditor`, `GameRuntime` y paneles auxiliares de proyecto, assets y publicación.

## Modelo de datos del proyecto

| Objeto | Contenido | Uso |
| --- | --- | --- |
| `Project` | `name`, `scenes`, `activeSceneId`, `assets`, `settings` | Documento completo que se guarda y publica. |
| `Scene` | Nombre, fondo, tamaño, gravedad, entidades, variables, límite de tiempo, capas y UI | Nivel o pantalla jugable. |
| `Entity` | Posición, tamaño, velocidad, color, flags de comportamiento, textura, animaciones, scripts y propiedades avanzadas | Objeto interactivo o decorativo de una escena. |
| `SceneLayer` | Nombre, profundidad `z`, visibilidad, bloqueo y opacidad | Organización visual y orden de render. |
| `UIElement` | Tipo, posición anclada, tamaño, texto, colores, imagen, acción y binding | HUD y controles superpuestos al juego. |
| `SpriteAsset` | Dimensiones, FPS, loop y frames | Recurso animado creado en el editor de píxeles. |
| `ProjectSettings` | FPS, HUD, grid, snapping, audio, controles táctiles, pausa, hitboxes, idioma y rendimiento | Comportamiento global del runtime. |

## Escenas

Cada escena tiene un lienzo con ancho, alto, color o imagen de fondo y gravedad. Puede contener capas, variables compartidas, límite de tiempo, vidas iniciales y una colección de entidades. `ensureSceneLayers` garantiza una capa principal para proyectos antiguos que no tenían capas explícitas. `sortedForRender` ordena por profundidad de capa y luego por `z` de entidad; esta función es de render, no de orden social.

El proyecto comienza con una escena predeterminada de 1200 × 700, plataformas, monedas, un enemigo, un objetivo y un jugador. Ese contenido solo es una plantilla inicial de creación; no debe confundirse con datos de uso, historial o actividad de usuarios.

## Entidades y comportamiento

Las entidades admiten los tipos `player`, `platform`, `enemy`, `coin`, `goal` y `decor`. Además de posición, dimensiones y color, pueden ser sólidas, afectadas por gravedad, controlables, coleccionables, peligrosas u objetivos. Las capacidades avanzadas incluyen movimiento, plataformas que se desmoronan, resortes, patrulla, checkpoints, superficies resbaladizas o pegajosas, power-ups, interruptores, puertas, emisores de partículas, rotación, escalado visual, capas y diálogos.

La colisión usa cajas AABB, con hitboxes opcionales relativas a la entidad. El jugador puede saltar, usar coyote time y jump buffer; el estado de runtime contiene puntuación, vidas, cámara, temporizadores, invulnerabilidad, switches, partículas, checkpoints y diálogo.

## Scripts visuales

`ScriptEditor` manipula scripts formados por bloques. Los eventos incluyen inicio de escena, actualización, entrada, colisión, recogida, daño, victoria, muerte, interacción, temporizador y diálogo. Los bloques permiten cambiar propiedades genéricas, mover, esperar, reproducir sonido, modificar variables, mostrar diálogos, generar entidades, cambiar escena, controlar visibilidad, emitir partículas, añadir vidas o puntuación y actuar sobre otros objetivos.

`createScriptRunner` ejecuta esos bloques mediante hooks del runtime. Al editar scripts no se debe cambiar directamente la física ni el render si el objetivo es modificar comportamiento autoral; el punto correcto es el tipo de bloque, el runner o los hooks documentados.

## UI del juego

`UIEditor` crea botones, etiquetas, imágenes, paneles, barras y joysticks. Cada elemento usa anclajes de nueve posiciones, dimensiones y estilos propios. Puede ejecutar acciones de control, reiniciar, salir o disparar un evento, y puede enlazarse a puntuación, vidas o tiempo. La UI del juego es distinta de la UI social de la plataforma.

## Runtime

`GameRuntime` dibuja escenas en canvas y ejecuta el bucle de juego. `stepScene` actualiza física, controles, colisiones, scripts, objetivos, enemigos, coleccionables, diálogos, partículas, cámara y temporizadores. `newRuntimeState` crea el estado inicial a partir de la escena. El sistema de imágenes precarga y dibuja recursos; `sfx.ts` gestiona volumen, mute, música y sonidos de eventos.

## Recursos y almacenamiento

Los sprites contienen frames y capas con PNGs serializados como data URLs. Los fondos, texturas y música también pueden ser data URLs o URLs externas/CDN. `storage.ts` guarda proyectos y metadatos en `localStorage`, mantiene el proyecto actual, permite crear, duplicar, renombrar, eliminar y guardar por id, y conserva asociaciones de proyecto local con id de nube.

La sincronización con nube ocurre mediante `cloud-sync.ts` y las funciones sociales/API correspondientes. Antes de modificar el formato de `Project`, deben considerarse proyectos antiguos, migraciones de compatibilidad y el tamaño de los datos serializados.

## Publicación desde el editor

El editor prepara una síntesis segura del proyecto para revisión previa, genera una previsualización, ejecuta la revisión de Orión con las reglas de «Acerca de nosotros» y solo después llama al flujo de publicación. El editor y el runtime son responsables de producir el contenido; la comunidad es responsable de almacenarlo, mostrarlo y permitir jugarlo.

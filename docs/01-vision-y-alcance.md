# 01 — Visión y alcance de Asternal Engine

## Qué es

Asternal Engine es un entorno web para convertir ideas de juegos en experiencias jugables y publicables. Combina un editor visual de juegos, un runtime propio, almacenamiento de proyectos, publicación en una comunidad, descubrimiento de contenido, interacción social y servicios complementarios. La unidad central no es una página de marketing ni un simple gestor de publicaciones: es el ciclo completo **crear → guardar → ejecutar → revisar → publicar → descubrir → jugar → interactuar**.

## Qué problema resuelve

La aplicación reduce la distancia entre imaginar un juego y ponerlo a disposición de otras personas. Una persona puede construir escenas y comportamientos desde el navegador, probarlos en el runtime, guardar el proyecto, publicar una versión jugable y recibir interacción de la comunidad. La plataforma también ofrece un espacio para ideas, obras de galería, juegos, grupos de chat, perfiles y actividades comunitarias.

## Usuarios y superficies principales

| Superficie | Usuario principal | Función real |
| --- | --- | --- |
| Autenticación | Cualquier visitante | Registro, inicio de sesión, recuperación de contraseña y sesión persistente. |
| Editor | Creador de juegos | Crear proyectos, escenas, entidades, sprites, scripts visuales, UI y configuración de runtime. |
| Runtime | Creador o jugador | Ejecutar escenas con física, controles, colisiones, objetivos, diálogos, partículas, sonido y HUD. |
| Feed y Para ti | Comunidad | Leer y crear publicaciones; descubrir contenido reciente y filtrar por apartado. |
| Juegos | Jugadores y creadores | Ver, comprar si aplica, ejecutar, remezclar y publicar juegos. |
| Galería | Artistas y comunidad | Publicar y consultar obras visuales. |
| Historial | Usuario autenticado | Consultar sesiones reales de juegos, tiempo jugando, juegos y likes. |
| Chat | Comunidad | Conversaciones grupales, mensajes directos, grupos, encuestas y archivos según el flujo existente. |
| Orbes, tienda y eventos | Comunidad | Gestionar saldo/transacciones, compras, recursos, eventos y premios. |
| Perfil y Plus | Usuario | Ver identidad, publicaciones, juegos, portafolio, estadísticas y personalización. |
| Administración | Moderadores y administradores | Gestionar usuarios, reportes, categorías, eventos y controles de comunidad. |

## Flujos de extremo a extremo

### Creación y edición

El usuario entra al editor, crea o abre un proyecto local, selecciona una escena y modifica elementos mediante paneles especializados. Los cambios se guardan en el almacenamiento del navegador y, cuando corresponde, se sincronizan con proyectos de nube. El editor mantiene un identificador de proyecto actual para distinguir varios proyectos locales.

### Prueba y ejecución

El runtime recibe una escena y un estado inicial. Procesa entrada de teclado o controles táctiles, física AABB, gravedad, colisiones, objetivos, enemigos, coleccionables, scripts visuales, diálogos, partículas, cámara, sonido y UI. Al ejecutar un juego publicado, el componente de tarjeta registra una sesión local cuando la partida dura al menos tres segundos.

### Publicación

Los formularios de publicación preparan una representación segura del juego, obra o publicación, ejecutan la revisión previa de Orión con las reglas de «Acerca de nosotros» y solo continúan si la decisión es aprobatoria. Después escriben el contenido en las fuentes remotas existentes. El orden del feed no depende de Orión: se determina por novedad.

### Comunidad

Las publicaciones se almacenan en Supabase y se enriquecen con perfiles, etiquetas, medios, reacciones, comentarios, reposts y juegos fijados. El feed principal separa «Para ti», «Siguiendo» y «Explorar». «Para ti» y «Explorar» priorizan lo más reciente; «Siguiendo» restringe primero a autores seguidos y luego ordena por fecha.

## Qué no es

Asternal Engine no es un IDE general para cualquier lenguaje, no es un motor 3D completo, no es una analítica global de la actividad del navegador y no debe presentar como uso real una métrica que la aplicación no registra. El historial actual mide principalmente tiempo de juego registrado en el cliente; no mide de forma completa el tiempo navegando, editando, chateando o leyendo.

## Definición operativa para futuras conversaciones

Cuando una futura edición diga «editor», debe entenderse el conjunto formado por `AsternalEditor`, sus paneles de proyecto, escenas, entidades, scripts, sprites, UI, runtime y almacenamiento. Cuando diga «plataforma», debe incluir además comunidad, publicación, feed, perfiles, chat, galería, juegos, Orbes, eventos, notificaciones y administración. Esta distinción evita modificar una superficie social cuando el cambio corresponde al motor, o modificar el runtime cuando el cambio corresponde a publicación.

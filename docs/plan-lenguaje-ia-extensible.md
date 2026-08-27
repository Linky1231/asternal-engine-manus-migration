# Plan técnico: lenguaje de Asternal ampliable por IA

## Objetivo

Asternal debe evolucionar desde el sistema actual de **scripts por bloques**, que interpreta eventos y acciones predefinidos por entidad, hacia una arquitectura con dos niveles. El primer nivel permitirá que una IA cree lógica de juego específica mediante módulos y una API de gameplay. El segundo permitirá que Orión proponga cambios al código compartido del motor cuando el juego necesite una capacidad que la API todavía no exponga.

> La IA no debe editar el código compartido directamente en la instancia publicada. Debe preparar un cambio versionado, comprobarlo y aplicarlo en una rama aislada antes de integrarlo. Así se conserva la capacidad de crear mecánicas nuevas sin que un experimento de un juego rompa los demás.

## Inventario de partida

| Área actual | Estado | Implicación para el nuevo sistema |
| --- | --- | --- |
| `core.ts` | Contiene entidades, escenas, UI, física AABB, cámara y estado de runtime. | Se convierte en el núcleo estable y en la interfaz pública del motor. |
| `scripts.ts` | Interpreta eventos, bloques, condiciones, variables y acciones predefinidas. | Sirve como catálogo inicial de comportamiento; no debe ser la única forma de extender el juego. |
| `GameRuntime.tsx` | Ejecuta el ciclo de Play, input, audio, UI y dibujo Canvas 2D. | Debe cargar módulos de juego autorizados, emitir eventos y aislar los fallos por juego. |
| `storage.ts` | Normaliza proyectos existentes y conserva compatibilidad. | Debe versionar el manifiesto de módulos y migrar proyectos gradualmente. |
| GitHub | Repositorio `Linky1231/asternal-engine-complete`, rama de trabajo `orion-engineering`. | Proporciona persistencia, diff, historial, revisión y restauración del código compartido. |

## Arquitectura objetivo

| Capa | Responsabilidad | Puede modificarla Orión | Ejemplo |
| --- | --- | --- | --- |
| Núcleo estable | Render, física base, ECS, almacenamiento, autenticación y contrato de plugins. | Solo mediante una propuesta de cambio versionada y validada. | Añadir un nuevo sistema de navegación o capacidad de red. |
| SDK de gameplay | API TypeScript delimitada para eventos, entidades, UI de juego, variables, audio y datos. | Sí, mediante módulos de juego. | Crear una misión, inventario, combate por turnos o puzzle. |
| Módulo por juego | Código de gameplay generado para un proyecto concreto, con manifiesto y permisos declarados. | Sí, tras generar diff, pruebas y aprobación. | Ranking del juego, tienda interna, diálogos ramificados. |
| Datos del juego | Esquema y registros aislados por `projectId`/juego. | Sí, mediante migraciones declaradas revisables. | Tabla `leaderboard_entries` de un único juego. |
| Interfaz del editor | Herramientas de autoría, inspector y gestor de proyectos. | No, salvo una solicitud explícita de cambio del propio editor. | No se altera al crear un ranking. |

## El nuevo lenguaje

El lenguaje no debe ser JavaScript libre almacenado dentro de una escena. Debe consistir en una representación intermedia tipada llamada **Asternal Game Module**. Orión traduce la instrucción del creador a archivos TypeScript del módulo y a un manifiesto verificable. El runtime solo expone una API limitada; un módulo no recibe acceso directo al DOM, al sistema de archivos, secretos, tokens ni componentes del editor.

```ts
export interface AsternalGameModule {
  id: string;
  version: string;
  permissions: ("scene" | "ui" | "audio" | "storage" | "network")[];
  register(api: GameAPI): void;
}

api.on("ui:button", "ranking:open", () => api.ui.show("ranking-panel"));
api.on("game:win", async () => api.ranking.submit({ score: api.state.score }));
```

La primera versión del `GameAPI` debe aportar eventos de escena, input, colisión, UI, audio, variables y persistencia de partida. Los módulos no pueden importar `AsternalEditor`, router, componentes React del editor ni los helpers de administración.

## Flujo de Orión para cambios de código

1. El creador explica la función, por ejemplo: “crea un ranking semanal con un botón de tabla de posiciones”.
2. Orión clasifica la petición: **módulo de juego** si cabe en el SDK, o **extensión de motor** si requiere una capacidad nueva.
3. Orión genera un plan, lista los archivos afectados, permisos, cambios de datos, pruebas y un diff completo.
4. El sistema crea una rama derivada de `orion-engineering`, aplica el diff y ejecuta `pnpm test`, `pnpm build` y pruebas específicas del módulo.
5. Solo si las comprobaciones pasan, el creador puede aprobar la integración. La publicación se realiza mediante una nueva versión y toda modificación tiene referencia de commit, resumen y rollback.

## Ejemplo: ranking de juego

El ranking no se resolvería con bloques existentes. Orión generaría un módulo `ranking` que escucha `game:win`, valida puntuación y tiempo, guarda una entrada bajo el identificador del juego y muestra un panel UI de juego con la tabla. Si el backend aún no incluye rankings, Orión propondría además una migración de tabla aislada por juego, rutas servidor y pruebas de autorización. No modificaría la navegación, temas ni paneles del editor.

## Fases de implementación

| Fase | Entrega | Criterios de aceptación |
| --- | --- | --- |
| 1. Contrato de módulos | Tipos `GameAPI`, manifiesto, permisos y cargador de módulo vacío. | Un módulo de ejemplo se registra sin tocar el editor. |
| 2. Runtime extensible | Bus de eventos, aislamiento de errores y API de entidades/UI/audio/estado. | Un botón de juego activa una regla TypeScript del módulo en Play. |
| 3. Persistencia | Metadatos y versiones de módulos por proyecto, migración desde `scripts`. | Proyectos antiguos cargan sin pérdida y pueden seguir usando la ruta heredada durante la migración. |
| 4. Orión Engineering | Plan estructurado, contexto de código, diff, pruebas y resumen de impacto. | La IA puede proponer un módulo completo para un caso nuevo. |
| 5. GitHub y publicación | Ramas, commits, pull request opcional, resultado de CI y rollback. | Ningún cambio llega a `main` sin pruebas superadas y aprobación explícita. |
| 6. Capacidades avanzadas | Datos de juego, rankings, multijugador asincrónico, inventarios y plugins. | Cada capacidad declara permisos, migración y pruebas antes de integrarse. |

## Decisiones necesarias antes de construir

La próxima implementación debe resolver si los módulos se compilan en cada publicación o si usan un conjunto de extensiones precompiladas; para Asternal se recomienda compilación por versión publicada. También debe definirse si los cambios generados por Orión se integran mediante pull request obligatorio o con aprobación dentro del editor. La primera entrega debe limitar permisos de red y datos, y no incluir ejecución de paquetes, comandos de sistema ni escritura libre de archivos.

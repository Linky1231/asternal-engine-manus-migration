# Plan de producto: Scripts manuales y código por cuenta

## Propósito

Asternal debe permitir que cada creador describa una mecánica, un mapa, un sistema de juego o una mejora de la herramienta desde **Inspección**. El apartado se denomina **Scripts manuales**. No se presenta como inteligencia artificial ni como una nueva sección de la navegación. El creador expresa lo que necesita y recibe una modificación concreta, revisable y ejecutable dentro de su propia versión de Asternal.

> Ejemplos de petición: «crea un mapa con tres zonas y una puerta que se abra al recoger cinco monedas», «añade un ranking semanal a mi juego» o «agrega al inspector un control para configurar equipos».

La ambición no es limitar los cambios a los bloques disponibles hoy. Si una petición requiere una capacidad inexistente, Scripts manuales podrá modificar los archivos fuente reales del motor, runtime o editor que correspondan a esa cuenta. El resto de usuarios seguirá usando su propia versión sin recibir esos cambios.

## Experiencia visible

Scripts manuales permanecerá únicamente en **Inspección**. Su contenido se adapta al contexto seleccionado para que la petición tenga un alcance entendible, pero mantiene un único flujo de trabajo.

| Contexto de Inspección | Nombre visible | Alcance de la petición | Resultado esperado |
| --- | --- | --- | --- |
| Sin objeto seleccionado | **Scripts manuales del proyecto** | Mapas, escenas, sistemas completos, datos de juego y cambios de editor solicitados para ese proyecto. | Cambios directos de escena, archivos fuente y/o interfaz propia de ese proyecto. |
| Objeto seleccionado | **Scripts manuales del objeto** | Comportamiento, colisiones, controles, apariencia o UI vinculada a la entidad. | Cambios directos al código de la versión aislada, con el objeto seleccionado como contexto. |
| Elemento de UI seleccionado | **Scripts manuales de interfaz** | Interacciones, flujos de pantalla y controles del juego o del editor del creador. | Cambios de componentes y runtime en la versión aislada del editor. |

La primera vista contiene solo un campo de descripción y el historial de resultados. Tras enviar la descripción, el sistema muestra una propuesta clara: qué se construyó, qué archivos cambia, qué pruebas realizó y si quedó activa. En vez de pedir al creador que comprenda la infraestructura, presenta acciones legibles: **Ver cambios**, **Probar**, **Usar esta versión** y **Restaurar versión anterior**.

## Código fuente visible y editable

Dentro del mismo apartado de Inspección habrá un subpanel **Código del proyecto**. Este muestra el árbol de archivos de la versión del creador, el contenido de un archivo, las modificaciones pendientes y el historial de versiones. El creador puede escribir cambios directamente; Scripts manuales puede hacerlo a partir de su descripción. Ambos caminos se someten al mismo control de versiones y a las mismas pruebas.

La vista no será un nuevo espacio global ni una copia visible del repositorio compartido. Mostrará la versión aislada que pertenece al creador y al proyecto seleccionado. Los archivos de motor, runtime y editor estarán disponibles cuando formen parte de dicha versión, por lo que una petición explícita como «cambia la interfaz del inspector para mi proyecto» tendrá el alcance requerido sin alterar la interfaz de otra cuenta.

## Flujo solicitado

1. El creador abre **Inspección**, selecciona el proyecto, una escena, un objeto o una interfaz y describe lo que necesita.
2. Scripts manuales identifica los archivos fuente reales que necesita modificar en esa versión aislada de Asternal.
3. El sistema crea una propuesta de cambio de código, guarda una versión aislada candidata y ejecuta sus comprobaciones.
4. Si la comprobación termina correctamente, el creador puede probar de inmediato su versión; si no, verá los errores y conservará intacta la versión anterior.
5. Cada resultado sigue siendo editable: el creador puede editar los archivos o describir una modificación adicional.
6. Cuando una versión deja de servir, **Restaurar versión anterior** vuelve al último estado confirmado de ese mismo proyecto sin afectar a otras cuentas.

## Límites de producto que permanecen claros

El sistema debe transformar la descripción en resultados útiles, pero no ocultará qué se cambió. Por cada operación conserva el resumen, la lista de archivos afectados, los resultados de pruebas y una versión restaurable. La edición directa se limita a la versión propiedad del creador; no permite que un usuario lea, modifique ni publique el código o los datos de otro.

El cambio queda activo automáticamente únicamente después de que las pruebas requeridas terminen correctamente. Si fallan, no sustituye la versión que el creador estaba utilizando. Esta propuesta deberá confirmarse antes de la implementación, junto con los límites concretos de archivos y consumo por cuenta.

## Inventario de código fuente real

El sistema trabajará sobre archivos fuente reales de Asternal; no sobre una representación simulada del editor. El árbol de la versión de cada creador conservará la misma organización que el motor actual. La tabla separa los archivos que resuelven cada tipo de petición y el nivel de acceso inicial que requiere el sistema.

| Área | Archivos actuales | Función real | Edición en la versión del creador |
| --- | --- | --- | --- |
| Modelo y simulación | `src/lib/engine/core.ts` | Define `Project`, `Scene`, `Entity`, físicas AABB, cámara, capas, jerarquía y el paso de escena. | **Permitida**, con migración y pruebas de compatibilidad obligatorias. |
| Sustitución de scripts | `src/lib/engine/scripts.ts`, `src/lib/engine/manual-scripts.ts` | Implementan los bloques y el intérprete que se retirarán. | **Se eliminan** al migrar al flujo de cambios directos de código. |
| Ejecución del juego | `src/components/engine/GameRuntime.tsx`, `src/lib/engine/sfx.ts`, `src/lib/engine/images.ts`, `src/lib/engine/animations.ts` | Ejecuta Play, render Canvas 2D, entrada, audio, animaciones y UI de juego. | **Permitida**, con prueba en Play y compilación requerida. |
| Interfaz de autoría | `src/components/engine/AsternalEditor.tsx`, `SceneEditor.tsx`, `UIEditor.tsx`, `AnimationEditor.tsx`, `PaintEditor.tsx`, `TilemapEditor.tsx`, `ProjectManager.tsx` | Implementa Construir, Inspección, UI, Escenas, Assets y Ajustes. | **Permitida** cuando el creador solicite un cambio de su editor. |
| Recursos y persistencia de proyecto | `src/lib/engine/storage.ts`, `cloud-sync.ts`, `tilemap.ts` | Normaliza proyectos, conserva ID/escenas/scripts, separa claves locales por cuenta y sincroniza proyectos. | **Permitida con revisión reforzada**; debe preservar los formatos existentes. |
| Servicios específicos de Asternal | `server/manual-scripts.ts`, `server/orion.ts`, `server/community-ai.ts` | Resuelve la lógica del servidor propia del producto y las solicitudes que crean cambios. | **Permitida** si no modifica infraestructura, secretos ni autenticación base. |
| Entrada de producción y desarrollo | `server/_core/index.ts`, `vite.config.ts` | Registra rutas propias del producto, sirve el bundle y habilita las rutas equivalentes en desarrollo. | **Permitida solo mediante plantillas controladas** para añadir rutas de producto ya autorizadas. |
| Plataforma y secretos | `server/_core/llm.ts`, `server/_core/oauth.ts`, `server/_core/sdk.ts`, `.env`, claves del entorno | Protege autenticación, credenciales y servicios administrados. | **Solo lectura**. Ningún script manual puede ver secretos ni modificarlos. |
| Dependencias y herramientas | `package.json`, `pnpm-lock.yaml`, `tsconfig*.json` | Define el conjunto de dependencias y el proceso de compilación. | **Lectura y propuesta** en el MVP; instalar, actualizar o eliminar dependencias exige una aprobación separada. |
| Verificación | `server/*.test.ts`, `pnpm test`, `pnpm build` | Protege comportamiento existente y comprueba cada versión. | **Permitida** para añadir pruebas relacionadas con el cambio; obligatoria antes de activar la versión. |

Los cambios que afectan motor, runtime o interfaz no se restringen por naturaleza: forman parte del alcance explícito del creador. La restricción está en el **límite de la versión**: cada modificación se escribe en la copia aislada de esa cuenta y nunca en el árbol de código que utilizan los demás.

## Punto de integración en el editor

La ubicación ya implementada de Scripts manuales en `InspectorPanel` de `AsternalEditor.tsx` es el punto visible correcto. La implementación futura ampliará ese punto, no agregará una pestaña nueva a la barra lateral ni al menú móvil. En concreto, el panel incorporará la selección de alcance **Objeto**, **Escena**, **Proyecto** o **Editor de este proyecto** antes de mostrar el árbol de código correspondiente.

El proyecto conservará el comportamiento de los archivos actuales. La versión aislada solo sustituirá qué árbol fuente usa una cuenta concreta cuando entra a su proyecto. Por ello, `core.ts`, `GameRuntime.tsx`, `UIEditor.tsx` y `AsternalEditor.tsx` son partes del código que se pueden modificar para ese creador, mientras que los datos de escenas y objetos se siguen normalizando por `storage.ts` para no perder identificadores ni guardados existentes.

## Aislamiento por cuenta y proyecto

La unidad de aislamiento no será una copia mutable del despliegue público. Será un **fork de fuente versionado** que hereda una revisión conocida del motor y conserva sus propias modificaciones. El editor público funciona como plano de control: identifica al creador, presenta sus versiones y abre el artefacto exacto que corresponde a su cuenta. Los archivos modificados nunca se escriben en `main` ni se reutilizan como archivos activos de otra cuenta.

Cada cuenta dispone de un fork de motor base y cada proyecto puede disponer de una rama sobre ese fork. Esta combinación permite que la petición «cambia mi inspector» afecte al editor que usa esa cuenta, mientras que «agrega un ranking a este juego» se limite a ese proyecto.

| Nivel | Clave de propiedad | Qué contiene | Cuándo se utiliza |
| --- | --- | --- | --- |
| Revisión canónica | `baseEngineRevision` | El código fuente de Asternal revisado y una referencia de commit inmutable. | Punto de partida de todos los forks; nunca se edita desde Scripts manuales. |
| Fork de cuenta | `ownerId` | Diferencias de motor, runtime y editor exclusivas de una cuenta. | Preferido para cambios de interfaz o capacidades que deben acompañar todos los proyectos de ese creador. |
| Rama de proyecto | `ownerId + projectId` | Diferencias de escenas, juego, módulos, datos y cambios de fuente solo necesarios en un juego. | Predeterminado para mapas, mecánicas, rankings y sistemas de un juego. |
| Versión de fuente | `forkId + version` | Manifiesto inmutable de archivos, hashes, diff, resultados de pruebas y artefacto. | Cada resultado de Scripts manuales y cada edición directa. |
| Artefacto ejecutable | `forkVersionId + buildHash` | Paquete compilado de editor y/o runtime, con URL inmutable y autorizada. | La versión que abre la cuenta durante edición, prueba o Play. |

La estructura de datos propuesta mantiene en la base de datos únicamente los metadatos consultables y las referencias de contenido. El texto de cada archivo fuente, logs grandes, parches completos y artefactos compilados se guardan como objetos versionados en almacenamiento; la base conserva sus claves, hashes y controles de acceso. Esto evita que el crecimiento del código por cuenta se convierta en tablas difíciles de consultar o migrar.

| Registro | Campos principales | Regla de aislamiento |
| --- | --- | --- |
| `source_forks` | `id`, `ownerId`, `scope`, `projectId?`, `baseRevision`, `activeVersionId`, `createdAt` | Toda lectura o escritura exige que `ownerId` coincida con la sesión autenticada. |
| `source_versions` | `id`, `forkId`, `parentVersionId`, `number`, `status`, `manifestKey`, `treeHash`, `artifactKey?`, `createdAt` | Una versión es inmutable una vez construida; activar o restaurar actualiza solo el puntero del fork dueño. |
| `source_files` | `versionId`, `path`, `contentKey`, `sha256`, `editable`, `category` | Solo se resuelven rutas incluidas en el manifiesto y visibles para el dueño de la versión. |
| `source_changes` | `id`, `versionId`, `requestText`, `scope`, `diffKey`, `summary`, `affectedPaths` | Vincula la descripción, el diff y el resultado sin exponer una versión ajena. |
| `source_builds` | `id`, `versionId`, `status`, `testLogKey`, `buildLogKey`, `artifactKey`, `startedAt`, `finishedAt` | Los logs y artefactos se entregan mediante autorización del dueño, no por ruta pública adivinable. |

## Cómo se ejecuta una versión aislada

El entorno publicado actual no puede convertirse en un checkout persistente y compilable por cada petición: sus procesos son efímeros y el despliegue normal construye una sola versión compartida. Por ello, el cambio de fuente debe producir un artefacto inmutable fuera del proceso que atiende la interfaz, y el plano de control debe servir solamente el artefacto validado del fork correspondiente.

La propuesta recomendada usa un flujo de compilación aislado por versión. La rama de una versión se construye en un entorno desechable sin secretos de la aplicación ni permisos de escritura en el repositorio. El resultado incluye los logs de `pnpm test` y `pnpm build`, además del bundle compilado. Los artefactos de flujo existen precisamente para conservar resultados de build y pruebas después de terminar un trabajo [1]. El workflow se declara reutilizable y centralizado para que todas las versiones utilicen la misma comprobación y no se duplique la configuración [3].

El artefacto se publica bajo una clave inmutable, por ejemplo `source-forks/{forkId}/versions/{version}/build/{treeHash}/`. Al abrir un proyecto, el plano de control verifica el dueño y entrega la URL del manifiesto y del bundle de esa versión. El navegador carga solo ese bundle; no recompila TypeScript arbitrario dentro del proceso principal de Asternal.

| Alternativa | Ventaja | Motivo para no elegirla como base |
| --- | --- | --- |
| Recompilar dentro del servidor publicado para cada petición | Parece directa porque mantiene todo dentro de la aplicación. | Mezcla código de usuarios con el proceso de producto, no conserva checkouts y no ofrece un límite seguro para builds concurrentes. |
| Aplicar cambios al bundle compartido | No requiere seleccionar artefactos por cuenta. | Rompe el requisito fundamental: un cambio de un usuario altera a todos. |
| Interpretar TypeScript sin compilación en el navegador | Evita un servicio de build. | No sirve para cambiar de forma fiable componentes React, el runtime o dependencias del editor existente. |
| **Build aislado + artefacto inmutable** | Separa la compilación, conserva evidencia y permite ejecutar una versión exacta por cuenta. | Requiere implementar una cola y un almacenamiento de artefactos; es el coste necesario para aislamiento real. |

## Marco de recuperación inmutable

Permitir que una cuenta modifique la interfaz del editor exige conservar una salida de recuperación fuera de la versión modificable. El editor de la cuenta puede cambiar por completo, pero un marco mínimo de control permanece canónico: identifica la versión activa, abre versiones previas y permite restaurar una que haya pasado las comprobaciones. No es un editor alternativo ni limita el código que se muestra; es el mecanismo que impide que un error en la interfaz del fork deje al creador sin forma de volver atrás.

La restauración no recompila ni modifica otros forks. Simplemente apunta `activeVersionId` de la cuenta o el proyecto a una versión anterior cuyo artefacto ya fue comprobado. De este modo, incluso una modificación amplia de `AsternalEditor.tsx` o `UIEditor.tsx` conserva un camino de recuperación predecible.

## Permisos técnicos del proceso de build

El trabajo de build necesita únicamente leer la revisión de fuente, ejecutar pruebas y cargar el artefacto de resultado. No necesita secretos del producto, acceso a bases de datos de otros usuarios ni permiso para escribir en la rama canónica. Si se utiliza GitHub Actions, el flujo debe declarar permisos mínimos para su token; GitHub recomienda limitar explícitamente el acceso al mínimo necesario [2]. Las operaciones de crear ramas, commits o pull requests las realiza el plano de control con una credencial separada y limitada, nunca el código que se está compilando.

## Ciclo de Scripts manuales para cambios de código real

El creador no necesita escoger entre «script», «motor» o «interfaz» antes de describir su idea. El apartado de Inspección recibe la solicitud, conoce el contexto seleccionado y decide el alcance técnico. La clasificación queda registrada, pero su presentación continúa siendo simple: un cambio creado, sus archivos y el resultado de la prueba.

| Etapa | Acción interna | Información que ve el creador | Garantía |
| --- | --- | --- | --- |
| 1. Descripción | Se recibe el texto, el contexto de Inspección, el proyecto y la versión activa. | Campo «Describe lo que necesitas». | No se modifica código todavía. |
| 2. Análisis | Se clasifica el alcance como objeto, escena, proyecto o editor de este proyecto y se prepara el contexto exacto de archivos. | Resumen de lo que se va a crear. | El contexto pertenece exclusivamente a esa cuenta. |
| 3. Propuesta de cambio | Se genera un plan estructurado y un parche con rutas, preimagen hash y contenido nuevo. | Lista de archivos afectados y explicación en lenguaje normal. | Solo se aceptan rutas permitidas del manifiesto. |
| 4. Versión candidata | Se clona la versión activa hacia una nueva versión de fuente; el parche se aplica en un workspace desechable. | Estado «Creando versión». | La versión activa todavía no cambia. |
| 5. Comprobaciones | Se valida el árbol, se ejecutan pruebas pertinentes y se compila. | Resultado de cada comprobación y acceso a los detalles. | Un fallo no puede reemplazar la versión utilizable. |
| 6. Artefacto | Se guarda el bundle, manifiesto, diff, logs y hashes de la versión aprobada. | Estado «Listo para probar». | El artefacto es inmutable y está ligado a esa versión. |
| 7. Activación | Si todo pasa, el puntero del fork se actualiza al nuevo artefacto. | «Esta versión está activa» y botón Restaurar. | Solo cambia la cuenta y el proyecto dueño. |
| 8. Restauración | Se apunta de nuevo a una versión previamente aprobada. | Historial y «Restaurar esta versión». | Es instantánea, reversible y no cambia otras cuentas. |

### Clasificación de alcance

La clasificación no reduce la libertad para cambiar el editor; define qué copia se modifica. Por ejemplo, un ranking no necesita que la interfaz de todos los editores cambie, mientras que «agrega un control de equipos a mi inspector» sí requiere modificar la copia de `AsternalEditor.tsx` de ese creador.

| Petición del creador | Alcance que se crea | Archivos probables | Efecto en otras cuentas |
| --- | --- | --- | --- |
| «Cuando consiga una moneda, suma puntos» | Objeto | Código de comportamiento del proyecto y, si hace falta, runtime de su versión. | Ninguno. |
| «Crea un mapa de tres zonas con llaves y puertas» | Escena/proyecto | Escenas, entidades, código de comportamiento y, si falta una capacidad, runtime del proyecto. | Ninguno. |
| «Añade un ranking semanal para mi juego» | Proyecto | Lógica de runtime, servicios de datos propios del juego, UI de juego y pruebas. | Ninguno. |
| «Quiero un selector de equipos en el inspector» | Fork de cuenta | `AsternalEditor.tsx`, modelos, persistencia y pruebas de esa cuenta. | Ninguno. |
| «Modifica cómo se dibujan las plataformas de mi editor» | Fork de cuenta o proyecto, según se indique | Renderizador de entidades, runtime y/o editor. | Ninguno. |

### Formato de propuesta y de parche

El generador debe devolver un objeto estructurado, no texto libre que se escriba directamente en archivos. El contrato mínimo de la propuesta será el siguiente:

```ts
type SourceChangeProposal = {
  summary: string;
  scope: "object" | "scene" | "project" | "account-editor";
  baseVersionId: string;
  affectedFiles: Array<{
    path: string;
    beforeSha256: string | null;
    operation: "create" | "update" | "delete";
    patch: string;
  }>;
  tests: Array<{ name: string; command: "pnpm test" | "pnpm build" | "targeted" }>;
  dataChanges: Array<{ kind: "none" | "migration"; description: string }>;
  warnings: string[];
};
```

Antes de aplicar el parche, el servicio verifica que `baseVersionId` sea la versión que el usuario tenía abierta, que cada `beforeSha256` coincida con el archivo original, que la operación corresponda al manifiesto y que ninguna ruta alcance secretos, archivos internos de plataforma, dependencias instaladas o datos de otra cuenta. Los archivos nuevos se permiten solo en directorios declarados del fork, por ejemplo `src/extensions/`, `src/components/` y `server/features/`.

Este control no convierte el código en una maqueta: los cambios se aplican sobre los archivos TypeScript y TSX reales de la versión aislada. Evita únicamente que un parche obsoleto o mal dirigido modifique un archivo distinto al que fue analizado.

### Comprobaciones obligatorias

Cada versión candidata atraviesa las siguientes capas antes de activarse. Como Scripts manuales siempre modifica código fuente interno, no existen excepciones de objeto declarativas ni rutas alternativas de ejecución: toda petición ejecuta la secuencia completa.

| Capa | Comprobación | Aplica a | Resultado de fallo |
| --- | --- | --- | --- |
| Propiedad | `ownerId`, `forkId`, `projectId` y manifiesto autorizados. | Todas las solicitudes. | Se rechaza antes de leer o escribir archivos. |
| Integridad | Hashes previos, tamaño de diff, rutas permitidas y búsqueda de patrones de secretos. | Todas las modificaciones de fuente. | Se descarta la versión candidata. |
| Tipos y pruebas | `pnpm test` y pruebas específicas creadas/actualizadas por el cambio. | Motor, runtime, editor y servicios. | Se conservan logs; no hay activación. |
| Bundle | `pnpm build` en un workspace limpio. | Todo cambio de fuente ejecutable. | No se almacena un artefacto activo. |
| Prueba contextual | Arranque del editor, escena objetivo y Play del proyecto afectado. | Cambios de UI, input, render o gameplay. | La versión queda como fallida y restaurable solo para inspección. |
| Revisión de artefacto | Manifest de archivos, hash de bundle y logs asociados. | Versiones aprobadas. | No se actualiza `activeVersionId`. |

El resultado automático se considera activable solo después de superar estas capas. El creador puede continuar editando el resultado o volver a una versión anterior en cualquier momento. La primera pantalla nunca sustituye el editor compartido ni obliga a otros usuarios a probar la nueva capacidad.

### Trabajo de fuente y GitHub

La aplicación no necesita exponer una API pública de edición. Necesita operaciones internas autenticadas: crear un snapshot, aplicar un parche, lanzar una comprobación, leer los logs del dueño y activar/restaurar una versión. Esas operaciones las consume el propio apartado Scripts manuales; no se documentan como un producto para terceros ni entregan credenciales al navegador.

Al implementar la capa Git, la fuente se deriva de la revisión canónica de `orion-engineering`. Cada versión candidata se crea desde la versión activa del fork y se refleja en una rama de servicio con un nombre no adivinable, por ejemplo `internal/forks/{forkId}/v{number}`. Nunca se escribe directamente en `main`. Para mantener la separación entre cuentas dentro de la aplicación, el acceso Git lo usa únicamente el servicio de Asternal; el árbol y los diffs se entregan a cada usuario mediante autorización por `ownerId`.

El token que cree ramas o commits se solicitará solamente al comenzar la implementación y debe tener permisos mínimos de lectura/escritura de contenido en un repositorio privado de servicio. La aplicación publicada no hereda el cliente `gh` configurado en el entorno de desarrollo, por lo que esa credencial se gestionará del lado del servidor y nunca se incluirá en código de cliente, logs ni parches.

## Hoja de ruta de implementación

La primera versión debe demostrar la modificación real de código fuente y el aislamiento por cuenta con un alcance gradual. No sustituirá el editor actual de golpe ni migrará proyectos antiguos sin conservar su formato. Cada fase deja una versión comprobable y restaurable antes de ampliar el tipo de archivos que se pueden modificar.

| Fase | Entrega | Cambios principales | Criterio de aceptación |
| --- | --- | --- | --- |
| 1. Registro de forks | Tablas, manifiesto, control de propiedad y versión base. | Se crean `source_forks`, `source_versions` y metadatos de archivos/artefactos; la sesión impone `ownerId`. | Dos cuentas no pueden listar, leer ni activar versiones entre sí. |
| 2. Visor de código en Inspección | Árbol de archivos, lector, diff, historial y restauración. | Se integra en Scripts manuales del proyecto o editor de este proyecto; usa la versión fuente de su dueño. | Un creador ve su árbol real, sus versiones y puede restaurar una anterior. |
| 3. Edición manual de fuente | Editor de texto, guardado como versión candidata y validación de hashes. | Permite modificar archivos permitidos de motor, runtime e interfaz dentro del fork. | Un cambio manual no activa una versión si sus pruebas/build fallan y nunca afecta a otra cuenta. |
| 4. Build aislado | Workspace desechable, tests, bundle, logs y artefacto inmutable. | Se incorpora el runner que parte de una versión exacta, ejecuta la comprobación y guarda los resultados. | `pnpm test` y `pnpm build` se ejecutan fuera del servidor público; la versión activa solo apunta a bundles aprobados. |
| 5. Cambios desde una descripción | Propuesta estructurada, diff, creación de archivo y modificación de fuente. | Scripts manuales usa el contexto mínimo de proyecto/código y propone/aplica exclusivamente un parche en su fork. | Una petición de mapa, sistema o cambio de interfaz genera cambios internos, un diff revisable, pruebas y una versión aislada. |
| 6. Capacidades complejas | Cambios de datos, UI de editor, runtime y nuevas extensiones. | Se habilitan patrones de ranking, inventario, nuevas herramientas de inspección y sistemas de juego. | Cada capacidad define sus archivos, datos, pruebas, permiso y ruta de restauración. |

La primera entrega no instalará paquetes, no ejecutará comandos elegidos por el usuario y no permitirá modificaciones del código de plataforma. Esas decisiones pueden reconsiderarse después, pero solo mediante una aprobación concreta por dependencia o nueva capacidad de infraestructura. El alcance sí incluye los archivos fuente reales de Asternal que implementan el motor, el runtime y el editor de la versión del creador.

## Límites iniciales y protección de recursos

Un fork completo por cuenta requiere límites operativos explícitos para que una petición no agote el servicio ni retrase a otros creadores. Estos límites se implementan como reglas del plano de control, no como restricciones del lenguaje del juego.

| Recurso | Regla inicial propuesta | Razón |
| --- | --- | --- |
| Tamaño de fuente por versión | Manifiesto con límite configurable y deduplicación por hash. | Conserva copias reales sin almacenar el mismo archivo en cada versión. |
| Cambios por propuesta | Límite de archivos y de líneas modificadas; los cambios mayores se dividen en versiones encadenadas. | Mantiene diffs revisables y errores localizables. |
| Builds simultáneos | Una compilación activa por fork y una cola global limitada. | Evita competir por recursos y garantiza un orden claro de versiones. |
| Tiempo de build | Límite estricto por versión; al excederse, se registra fallo y no se activa. | Impide trabajos que bloqueen la cola. |
| Dependencias | Solo lectura/propuesta al inicio. | Evita que una edición arbitraria cambie la cadena de suministro o el tamaño del bundle. |
| Datos y secretos | Contexto de proyecto reducido; sin secretos, tokens, credenciales ni datos de cuentas distintas. | Evita que el código generado o manual obtenga información privada. |
| Retención | Versiones activas y restaurables conservadas; candidatas fallidas con retención limitada. | Permite recuperar trabajo sin crecimiento ilimitado. |

## Criterios de aceptación globales

La implementación se considerará correcta únicamente cuando todos estos resultados se comprueben con pruebas automatizadas y validación de interfaz.

1. **Código real por cuenta.** El creador puede ver y editar los archivos fuente de su versión de Asternal dentro de Inspección, incluidos motor, runtime e interfaz cuando el alcance sea proyecto o editor de ese creador.
2. **Aislamiento verificable.** Las pruebas demuestran que una cuenta no puede leer, modificar, compilar, activar ni restaurar el fork de otra cuenta, incluso manipulando identificadores de URL o solicitudes.
3. **Compatibilidad de proyectos.** Un proyecto existente conserva sus identificadores, escenas, dimensiones, entidades y guardados tras asociarse a una versión de fuente; sus bloques anteriores se archivan únicamente dentro de una versión histórica recuperable y no se ejecutan en la arquitectura nueva.
4. **Cambio desde descripción.** Una petición de mapa, mecánica, ranking o herramienta del editor produce una propuesta con resumen, archivos afectados, diff y pruebas asociadas.
5. **Cambio de interfaz por cuenta.** Una modificación de `AsternalEditor.tsx` o `UIEditor.tsx` en el fork de una cuenta es visible para esa cuenta y no altera el editor de las demás.
6. **No activar ante fallos.** Un error de validación, pruebas, build o ejecución contextual mantiene activa la versión previa y muestra detalles del fallo solo a su propietario.
7. **Restauración segura.** El creador puede restaurar una versión aprobada previamente sin recompilar, sin pérdida del historial y sin modificar otros forks.
8. **Sin acceso a secretos.** Las pruebas de propuestas, parches y workspaces confirman que las rutas y variables de infraestructura permanecen fuera del alcance de Scripts manuales.

## Decisión requerida antes de comenzar

La recomendación es implementar las seis fases en orden, con **build aislado y artefactos inmutables por versión**. Este diseño cumple la intención de editar directamente el código de Asternal, incluso su interfaz, sin convertir cambios experimentales de una cuenta en cambios globales.

Para iniciar la fase 1 de implementación harán falta dos decisiones prácticas: autorizar el almacenamiento interno de artefactos y proporcionar una credencial de servidor con permisos mínimos para el repositorio de servicio o confirmar que los forks se mantendrán solo en almacenamiento privado hasta una fase posterior. No se solicitará ninguna credencial durante esta etapa de planificación.

## Cambio estructural solicitado: sin scripts por bloques

La solicitud actual sustituye por completo el modelo anterior. **Scripts manuales no debe crear, mostrar ni ejecutar scripts de bloques.** Una descripción como «haz un sistema de ranking» o «construye este mapa» deberá producir siempre una modificación del código interno real de la versión aislada del creador. Los cambios pueden alcanzar el motor, el runtime, el editor o sus servicios propios, según lo exija la petición.

### Inventario de retirada

| Dependencia actual | Responsabilidad del sistema anterior | Acción de sustitución |
| --- | --- | --- |
| `src/lib/engine/core.ts` | Declara `Entity.scripts?: Script[]` y conecta las entidades con el lenguaje de bloques. | Retirar el campo y su importación después de migrar los proyectos existentes al formato de versiones de fuente. |
| `src/lib/engine/scripts.ts` | Contiene eventos, bloques, etiquetas, intérprete y `createScriptRunner`. | Eliminar el archivo y sus pruebas de comportamiento tras reemplazarlo por el cargador de versión de código aislada. |
| `src/components/engine/GameRuntime.tsx` | Crea el runner de bloques y lo invoca en el ciclo de Play. | Cargar y ejecutar el runtime compilado de la versión activa del proyecto; dejar de invocar `createScriptRunner`. |
| `src/components/engine/ScriptEditor.tsx` | Muestra eventos, bloques, controles de edición y scripts vacíos. | Reemplazarlo por el panel de descripción, árbol de código, diff, resultados de build e historial de versiones. |
| `src/lib/engine/manual-scripts.ts` | Envía una descripción para recibir un borrador de bloques. | Reemplazarlo por una solicitud estructurada de cambio de archivos y una lectura de resultados por versión. |
| `server/manual-scripts.ts` | Traduce una descripción a eventos y bloques permitidos. | Sustituirlo por un servicio que genera un `SourceChangeProposal`, con parche, hashes, pruebas y alcance de fork. |
| `server/_core/index.ts` y `vite.config.ts` | Registran la ruta de creación de scripts de bloque en producción y desarrollo. | Cambiar la ruta interna para crear, consultar, probar y restaurar versiones de fuente. |
| `server/engine-scripts.test.ts`, `server/manual-scripts.test.ts`, `server/manual-scripts-ui.test.ts` | Garantizan el intérprete, borradores de bloques y su interfaz. | Retirar o reescribir como pruebas de aislamiento, propuestas de archivos, versiones, builds y restauración. |
| `src/lib/engine/storage.ts` y sincronización de proyectos | Conservan los datos `scripts` serializados dentro de entidades. | Aplicar una migración que retire los scripts activos y conserve una copia histórica sólo dentro de la versión anterior recuperable. |

El único contenido visible de Scripts manuales después de la sustitución será: descripción de la necesidad, alcance escogido o detectado, archivos afectados, diff, estado de pruebas/build, historial y restauración. No habrá editor de bloques, selector de eventos, lista de acciones, scripts vacíos ni intérprete asociado en el runtime.

La retirada se realizará como una migración de versiones, no como un borrado inmediato de datos en los proyectos. Antes de remover `Entity.scripts`, cada proyecto recibirá una versión base compatible de fuente y un snapshot restaurable de su estado previo. Al abrir la nueva versión, los arreglos de bloques dejan de ejecutarse y se eliminan del proyecto normalizado; si un creador necesita recuperar una lógica anterior durante la transición, puede restaurar la versión previa del proyecto, pero esa versión no se mezcla con la nueva arquitectura.

### Contrato de cambio interno de código

El servicio que hoy produce un objeto `ManualScriptDraft` dejará de devolver eventos o bloques. Recibirá el contexto real que el creador abrió en Inspección y devolverá siempre un `SourceChangeProposal`. Un objeto seleccionado no cambia este principio: aporta identificadores, propiedades y escena al contexto del cambio, pero el resultado sigue siendo un parche de archivos fuente.

```ts
type SourceChangeRequest = {
  ownerId: string;
  forkId: string;
  baseVersionId: string;
  target: {
    kind: "project" | "scene" | "entity" | "game-ui" | "editor-ui";
    projectId: string;
    sceneId?: string;
    entityId?: string;
    uiElementId?: string;
  };
  description: string;
};

type SourceChangeProposal = {
  summary: string;
  scope: "project" | "account-editor";
  affectedFiles: Array<{
    path: string;
    beforeSha256: string | null;
    operation: "create" | "update" | "delete";
    patch: string;
  }>;
  requiredTests: Array<"pnpm test" | "pnpm build" | "play-context">;
  warnings: string[];
};
```

Las siguientes reglas son obligatorias para el reemplazo:

| Regla | Consecuencia técnica |
| --- | --- |
| Cada petición modifica código | La propuesta debe incluir al menos un archivo TypeScript, TSX o un archivo fuente permitido. Una propuesta sin archivos se rechaza. |
| No se generan bloques | El contrato no contiene `event`, `blocks`, `BlockKind`, `Script` ni objetos equivalentes. |
| El código es el comportamiento | El runtime de la versión activa se construye desde los archivos del fork; no consulta `Entity.scripts` ni inicializa un intérprete paralelo. |
| El creador puede inspeccionarlo | Cada archivo propuesto se muestra con su diff antes y después de aplicar; el creador puede editar el mismo archivo directamente. |
| La versión previa sigue disponible | Ningún parche modifica la versión activa. Cada parche crea una versión candidata inmutable y restaurable. |
| El cambio se aísla | El servicio exige que `ownerId`, `forkId` y `baseVersionId` pertenezcan a la misma cuenta antes de obtener el árbol fuente. |

Así, una petición de ranking creará o modificará por ejemplo un servicio de puntuaciones, el runtime del juego y la interfaz correspondiente dentro del fork. Una petición de mapa modificará el código que materializa su mapa y las reglas de la escena dentro de esa misma versión. La aplicación no intentará traducir ninguna de esas peticiones a las acciones limitadas del intérprete que se retira.

### Migración de proyectos sin bloques activos

La retirada de los bloques debe ser compatible con los proyectos existentes, pero esa compatibilidad no significa seguir ejecutándolos. La migración preserva el proyecto y su contexto en una versión histórica sellada, crea una versión de fuente aislada para el nuevo sistema y elimina todos los scripts activos de la representación que abre el nuevo editor.

| Paso | Acción de migración | Conserva | No conserva como funcional |
| --- | --- | --- | --- |
| 1. Detectar | Se identifica un proyecto que no tenga una vinculación de fuente (`sourceBinding`). | ID de proyecto, `ownerId`, escenas, entidades, dimensiones, UI, assets, variables, capas, grupos y configuración. | Ninguna ejecución nueva. |
| 2. Sellar historial | Se guarda un snapshot completo del proyecto anterior y se vincula a la revisión canónica que lo originó. | El JSON original, incluidos sus antiguos datos `scripts`, para recuperación administrativa/versionada. | El snapshot no se carga en el runtime nuevo. |
| 3. Crear base de fuente | Se crea el fork de proyecto desde la revisión canónica o desde el fork de cuenta ya activo. | El árbol real del motor, runtime y editor que utilizará el creador. | Ninguna referencia al intérprete de bloques. |
| 4. Normalizar | Se crea la versión de datos actual eliminando `Entity.scripts` y cualquier metadato exclusivo de bloques. | Todos los demás campos y relaciones de cada entidad/escena. | Eventos, bloques y scripts vacíos. |
| 5. Reemplazar interfaz y runtime | El proyecto abre el nuevo panel de Scripts manuales y carga el bundle de su versión de fuente. | Inspección, Construir, UI, Escenas, Assets, Ajustes y Play. | `ScriptEditor`, selector de eventos y `createScriptRunner`. |
| 6. Validar y activar | Se comparan los identificadores y conteos antes/después, se compila la versión y se activa el fork. | Compatibilidad de datos y una ruta para restaurar una versión aprobada. | Posibilidad de reactivar bloques dentro de la arquitectura nueva. |

La normalización deberá ser idempotente. Si un proyecto ya tiene `sourceBinding` y una versión activa válida, no vuelve a crear una segunda copia ni cambia sus identificadores. La prueba de migración usa proyectos con escenas múltiples, jerarquías, UI, cámaras, variables tipadas, assets y entidades que contengan scripts previos; debe demostrar que el resultado conserva todo salvo las propiedades exclusivas del modelo retirado.

El orden técnico de retirada será el siguiente:

1. Crear el almacenamiento de snapshots y las vinculaciones de fuente por cuenta/proyecto.
2. Ejecutar y comprobar la migración de datos de proyecto en modo no destructivo.
3. Sustituir `ScriptEditor.tsx` y `manual-scripts.ts` por el panel de código, propuesta y versiones.
4. Reemplazar `server/manual-scripts.ts` y sus rutas por el servicio de cambios de fuente.
5. Modificar `GameRuntime.tsx` para cargar el runtime compilado de la versión activa y retirar `createScriptRunner`.
6. Retirar el campo `scripts` de `Entity`, las importaciones de tipos y `src/lib/engine/scripts.ts`.
7. Reescribir las pruebas de bloques como pruebas de migración, aislamiento, propuestas, builds y restauración.

El rollback de un fork nuevo apunta a su versión anterior de fuente y datos aprobados; nunca reactiva fragmentos de bloques dentro del runtime nuevo. El respaldo sellado anterior sólo protege la recuperación controlada durante la migración y permite comprobar que ninguna escena o entidad se perdió al retirar el sistema.

## Aprobación de implementación solicitada

La especificación queda actualizada con esta decisión estructural: **se elimina el sistema de scripts por bloques en su totalidad**. Scripts manuales conservará su nombre y su ubicación exclusiva en Inspección, pero su única salida será una modificación interna de código fuente perteneciente a la versión aislada del creador.

Al autorizar la implementación, el trabajo comenzará por el registro de forks y snapshots, continuará con la retirada del intérprete, tipos, panel y rutas de bloques, y terminará con el visor de código, diffs, build aislado y restauración. El sistema no volverá a traducir solicitudes a eventos o bloques. Una petición válida deberá crear cambios de archivos de motor, runtime, editor o servicios del proyecto dentro de su fork.

Antes de la fase de commits/build externo se solicitará la credencial de servidor que corresponda. Hasta entonces no se modificarán la versión compartida de Asternal, los proyectos existentes ni el sistema de bloques actualmente publicado.

## Referencias

[1]: https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts "GitHub Docs — Workflow artifacts"
[2]: https://docs.github.com/actions/reference/authentication-in-a-workflow "GitHub Docs — Use GITHUB_TOKEN for authentication in workflows"
[3]: https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows "GitHub Docs — Reuse workflows"

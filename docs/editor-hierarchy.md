# Jerarquía editable del editor

**Autor:** Manus AI  
**Alcance:** organización de escenas, grupos y objetos para Asternal Engine.

La jerarquía reside en cada escena y es una estructura de autoría. No modifica las dimensiones, IDs, físicas, scripts, capas de renderizado ni las colisiones de los objetos. De esta forma, un proyecto ya guardado conserva su comportamiento al incorporar una organización explícita.

| Elemento | Campos persistentes | Uso en el editor |
|---|---|---|
| Escena | `id`, `name`, `entities`, `hierarchy` | Contenedor raíz de los nodos autorales |
| Grupo | `id`, `name`, `parentId`, `order`, `collapsed` | Carpeta renombrable y anidable para ordenar objetos |
| Objeto | `id`, `name`, `kind`, `parentGroupId`, `hierarchyOrder` | Nodo seleccionable, reasignable y reordenable |

## Flujo de edición

La pestaña **Escenas** presenta el árbol de la escena activa. Se pueden crear grupos, cambiar sus nombres, contraerlos, asignarles un grupo padre y eliminarlos. Al borrar un grupo, sus subgrupos y objetos se reasignan de manera segura al padre inmediato o a la raíz. Cada objeto conserva un identificador estable, puede seleccionarse para abrir sus propiedades, puede moverse de grupo y puede reordenarse entre objetos del mismo nivel.

El panel de persistencia normaliza las escenas antiguas con una raíz vacía y objetos no agrupados. Los enlaces hacia grupos inexistentes se devuelven a la raíz, y los órdenes ausentes reciben valores estables. Esto conserva la carga de proyectos creados antes de la jerarquía.

## Preparación para programación asistida

La estructura ofrece referencias semánticas y estables para una futura herramienta de programación asistida: una instrucción podrá dirigirse a una escena por su ID, encontrar objetos por nombre, etiquetas o tipo y colocarlos en grupos previsibles. La jerarquía se limita deliberadamente a organización y configuración; no se integra ninguna IA ni se habilita ejecución automática en esta entrega.

## Tiles en Configuraciones

**Tiles** ya no es una sección de primer nivel. El editor de cuadrícula se conserva completo bajo **Configuraciones → Tiles**, junto a las decisiones de ejecución, audio y controles. El tilemap sigue siendo independiente de las entidades, las capas y el 9-slicing.

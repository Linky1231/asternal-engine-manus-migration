# Scripting AI de Asternal

**Autor:** Manus AI  
**Estado:** asistente de autoría de escenas con planes revisables.

La antigua interfaz e intérprete de scripts por bloques fue retirada. En su lugar, el inspector de cualquier objeto abre **Scripting AI**, una conversación que recibe instrucciones en lenguaje natural y analiza la escena activa antes de proponer cambios. El modelo opera en el servidor, por lo que sus credenciales no se exponen en el navegador. En móvil se presenta como una vista aislada por encima de todo el editor, con zonas de conversación, plan y entrada separadas para evitar solapamientos.

## Flujo controlado

Scripting AI recibe una representación acotada de la escena: sus dimensiones, cámara, grupos y objetos con sus IDs, nombres, tipos, posiciones, dimensiones, etiquetas y flags. A partir de ello, devuelve un plan JSON con un resumen, supuestos y operaciones. El cliente valida y muestra esas operaciones; los cambios solo se aplican tras pulsar **Aplicar plan**. Cada aplicación conserva una instantánea para **Deshacer último cambio**.

> Scripting AI no ejecuta JavaScript, HTML, código arbitrario ni instrucciones del modelo directamente. Solo puede proponer operaciones declarativas incluidas en el contrato del motor.

| Área | Operaciones disponibles |
|---|---|
| Objetos | Crear, actualizar, eliminar y mover entidades entre grupos |
| Transformación y aspecto | Posición, tamaño, color, escala, opacidad, rotación y profundidad |
| Física y colisión | Tipo de cuerpo, masa, fricción, rebote, forma, capas y trigger |
| Lógica de juego | Plataforma móvil, derrumbe, resorte, patrulla, power-up, interruptor y puerta |
| Escena | Nombre, fondo, gravedad, dimensiones y cámara |
| Jerarquía | Crear, renombrar, reubicar y eliminar grupos |

## Compatibilidad y migración

Los proyectos que contenían el campo legado `scripts` se normalizan al cargarse: dicho campo se descarta, pero escenas, entidades, propiedades, IDs, dimensiones, físicos, colisiones, UI y assets permanecen. El runtime ya no crea ni ejecuta un intérprete de bloques. Los comportamientos declarativos existentes permanecen operativos y pueden configurarse desde el inspector o la IA.

## Ejemplos de instrucciones

Puedes pedir: “Crea tres plataformas móviles debajo del grupo Entorno”, “Haz que este enemigo patrulle 240 píxeles”, “Añade una meta al extremo derecho”, “Convierte estas monedas en coleccionables” o “Configura una cámara fija al inicio de la escena”. La IA explica el plan y deja visibles sus supuestos antes de modificar el entorno.

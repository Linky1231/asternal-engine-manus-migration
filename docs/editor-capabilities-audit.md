# Auditoría de capacidades del editor

**Autor:** Manus AI  
**Alcance:** ampliación retrocompatible del editor Canvas 2D de Asternal Engine.

Esta revisión compara las diez áreas solicitadas con el comportamiento real del editor y del modo Play. Las funciones ya existentes se conservaron; las brechas detectadas se incorporaron sobre el modelo `Entity`, `Scene`, `ProjectSettings`, la normalización de almacenamiento y el runtime compartido.

| Área | Cobertura final | Implementación principal |
|---|---|---|
| Objeto | Nombre, tipo y etiquetas editables | Inspector de entidad y `Entity.name` / `Entity.tags` |
| Transformación | Posición, rotación, escala X/Y y tamaño | Inspector, render compartido y bounds de colisión escalados |
| Apariencia | Textura/recurso, animación, visibilidad y orden | Funciones preexistentes conservadas: textura, clips, opacidad, `z` y capas |
| Física | Cuerpo, masa, gravedad, fricción y rebote | `bodyType`, `mass`, `friction`, `restitution` y `stepScene` |
| Colisión | Hitbox, rectángulo/círculo, tamaño, capa, máscara y trigger | `aabb`, `intersects`, `collidesByLayer` e inspector |
| Variables | Nombre, tipo y valor inicial | `variables`, `variableTypes` y panel reutilizable para escena/entidad |
| Input | Acciones, botones, joystick, teclado, gamepad y touch | `inputMap`, editor de ajustes y runtime de teclado/gamepad/touch |
| Audio | Sonidos, música, volumen y loop | Biblioteca de audio, configuración global y volumen/loop por recurso |
| UI | Texto, imagen, botón, barra, posición, tamaño y valor inicial | UI existente más `initialValue` real para barras |
| Escena | Objetos, cámara, fondo y estado inicial | Lista de entidades, fondos existentes, cámara fija/seguimiento y variables/vidas iniciales |

## Compatibilidad

Los proyectos existentes siguen cargando sin migración manual. `normalizeProject` infiere un nombre seguro, escala `1`, cuerpo dinámico o estático coherente con los flags antiguos, masa `1`, fricción `0.8`, rebote `0`, colisión rectangular de capa `1` con máscara `15`, variables tipadas por su valor y cámara en seguimiento. Las escenas antiguas conservan sus dimensiones, IDs, flags, capas, scripts y hitboxes.

## Comportamiento efectivo

La fricción de la superficie modifica la desaceleración del jugador sobre el suelo. El rebote invierte una parte de la velocidad al contacto. La masa ajusta los impulsos de daño. Las capas y máscaras filtran contactos de forma simétrica. Un objeto marcado como trigger sigue siendo detectable para interacción, pero se excluye de la resolución física de sólidos.

Las formas circulares se usan para la detección de solapamiento y se muestran como tales en el editor. La resolución de penetración conserva el algoritmo AABB existente de Asternal para evitar regresiones de estabilidad en plataformas y joystick; la rotación continúa siendo visual y no cambia las colisiones AABB, tal como ocurría antes de esta ampliación.

## Límites actuales deliberados

El mapeo de gamepad autoriza botones configurables; no introduce un sistema nuevo de ejes analógicos. Los botones y joystick táctiles existentes continúan controlando las mismas acciones `left`, `right` y `jump`, ahora respetando el mapeo `touch` de cada acción. Los loops de sonidos se reproducen desde un recurso habilitado para loop; no existe todavía un bloque separado para detener una instancia concreta de sonido. Estos límites evitan cambiar el formato de scripts y los flujos de juego ya guardados.

## Validación

La validación añadió `server/editor-capabilities.test.ts`, con cobertura de migración de saves, valores por defecto, variables tipadas, escala, contacto circular, máscaras de capa, triggers y mapeos predeterminados. La suite completa pasó con **32 archivos y 103 pruebas**. La compilación de producción pasó. Se revisaron en navegador las propiedades de escena, cámara, variables y el inspector de una plataforma, y las entradas de `/editor` en escritorio y móvil no presentaron desbordes.

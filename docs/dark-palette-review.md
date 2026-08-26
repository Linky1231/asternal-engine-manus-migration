# Revisión de migración a paleta oscura

## Referencia visual

La imagen del usuario define un entorno navy/carbón muy oscuro, superficies en capas ligeramente más claras, bordes gris azulados y un acento degradado periwinkle–azul eléctrico–aqua. La legibilidad se apoya en texto casi blanco, metadatos gris azulado y estados semánticos luminosos.

## Hallazgos iniciales

La primera captura después de cambiar solo `styles.css` mostró una tarjeta de autenticación gris clara y textos con contraste insuficiente. La causa era `src/glass-intensity.css`, que imponía fondos blancos translúcidos sobre `.glass-surface`, `.glass-control`, `.app-header`, menús, resultados y Plus.

Después de migrar también `glass-intensity.css`, la pantalla de autenticación en escritorio y móvil muestra un fondo navy, tarjeta oscura, bordes azul grisáceos, inputs oscuros y CTA con degradado periwinkle–aqua. El hero de la bombilla conserva legibilidad y el layout móvil no presenta overflow en el viewport revisado de 390×844.

## Próxima revisión

Queda revisar visualmente las rutas autenticadas y sus paneles compartidos: Inicio/Feed, Perfil, Buscar, Historial, Orbes, Plus, Notificaciones, Orión, editor, administración, reset-password y estados de diálogos. Deben verificarse superficies directas `bg-white`, colores directos de estados y contrastes de texto dentro de tarjetas, menús y overlays.

## Revisión de rutas

Las capturas de `/search`, `/editor`, `/paint`, `/reset-password` y `/about` muestran una base navy consistente, controles con borde azul grisáceo y CTA periwinkle–aqua. El editor hereda correctamente el lienzo oscuro y la cuadrícula azul, mientras que Paint conserva intencionalmente su lienzo de dibujo blanco/transparente como superficie de trabajo, no como tema de interfaz. Las rutas protegidas sin sesión redirigen a `/auth`, por lo que sus estados autenticados requieren una sesión real para una inspección de contenido completa; sus componentes siguen usando los tokens globales y la capa de compatibilidad para estados directos.

El panel de búsqueda aparece muy oscuro y con el texto de estado algo tenue en el centro; se debe revisar el contraste de `text-muted-foreground` en estados vacíos. El resto de las pantallas capturadas no presenta superficies blancas accidentales ni desbordamiento visible en escritorio.

## Segunda revisión móvil

En 390×844, el editor de pintura ya presenta barra superior, dock, controles de color y capas en navy oscuro; el lienzo de trabajo permanece claro/transparente de forma intencional para que el dibujo conserve su función. Los controles son legibles y el CTA de guardado mantiene el degradado de marca.

La búsqueda mejoró su estado vacío, pero la quinta pestaña todavía aparece parcialmente recortada en el extremo derecho. Se cambiará el contenedor móvil a varias filas compactas para eliminar ese recorte y dejar todas las categorías visibles sin depender de desplazamiento horizontal.

## Validación

La prueba específica `server/dark-palette.test.ts` pasó con 4 pruebas, y la compilación de producción terminó correctamente. La suite completa ejecutó 61 pruebas exitosas; la única suite fallida es `server/auth.logout.test.ts`, que no puede importar `@trpc/server` desde el repositorio heredado. No está relacionada con la migración visual y no se añadió la dependencia para preservar el alcance de la transferencia.

La captura final de `/search` en móvil confirma que las cinco categorías ahora se muestran en dos filas compactas, sin recorte horizontal. Se conserva la legibilidad del estado vacío y el estilo navy de la referencia.

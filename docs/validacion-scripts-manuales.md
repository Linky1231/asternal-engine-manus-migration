# Validación visual — Scripts manuales

## Navegación inicial

La revisión del 27 de agosto de 2026 confirmó que el editor abre desde el gestor de proyectos y que la navegación principal contiene las secciones Construir, Inspección, UI, Assets, Escenas y Ajustes. No hay ningún acceso a Scripts manuales fuera de Inspección en esa navegación.

Al entrar en Inspección sin una entidad seleccionada se muestran únicamente las propiedades de escena, capas y la lista de entidades. El acceso a los scripts requiere seleccionar una entidad, manteniendo la ubicación solicitada dentro del inspector.

Al seleccionar Jugador, el control se muestra en la sección Apariencia como «Scripts manuales · 0 guardados». El resto de las secciones principales del editor no incorpora un acceso adicional a esa función.

El compositor se abrió correctamente y recibió una descripción en español. La primera solicitud de creación devolvió el mensaje genérico «No se pudo crear el script», por lo que queda pendiente revisar la respuesta del servidor antes de considerar la creación automática validada.

La causa fue que el servidor de desarrollo de Vite solo tenía registrada la ruta de chat general. Se registró la ruta equivalente de Scripts manuales y se reinició el entorno. Una solicitud directa posterior devolvió una propuesta válida: evento de colisión, acción de sumar 10 puntos y resumen en español.

Tras el reinicio, el gestor y la navegación de Inspección volvieron a abrir correctamente. La lista de entidades permanece disponible al final de Inspección, desde donde se selecciona cada objeto antes de abrir sus Scripts manuales.

La segunda comprobación volvió a seleccionar Jugador y abrió Scripts manuales desde el control de Apariencia. El compositor conserva el título, la descripción guiada, el campo de texto y el botón de creación, sin nuevos accesos fuera de Inspección.

En la segunda solicitud se introdujo la descripción de colisión con moneda. La interfaz mostró el estado «Creando script…», confirmó que el botón queda deshabilitado durante el procesamiento y evitó un segundo envío accidental.

La creación finalizó correctamente. El contador del acceso se actualizó a «1 guardados» y el resultado quedó abierto y editable dentro del mismo panel: evento «On Collide» con objetivo moneda, bloque de sumar 10 puntos y bloque de reproducir sonido de moneda. El resumen se presentó en español y el creador mantiene el control de cada bloque generado.

## Validación automatizada

La suite de Vitest terminó correctamente con 35 archivos y 111 pruebas. Se añadieron pruebas específicas para validar el saneamiento de propuestas y que la presentación mantenga Scripts manuales dentro de Inspección, sin las etiquetas de presentación anteriores. La compilación de producción también terminó correctamente.

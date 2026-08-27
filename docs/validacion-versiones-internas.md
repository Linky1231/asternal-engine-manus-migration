# Validación de versiones internas

Fecha de verificación: 27 de agosto de 2026.

La revisión visual confirmó que **Scripts manuales** se abre únicamente desde la entidad seleccionada dentro de **Inspección**. El panel muestra la descripción de la necesidad, la acción «Crear cambio de código», el árbol de archivos y el visor de fuente; no presenta el selector ni el editor de bloques anterior.

La sesión de verificación no estaba autenticada en Supabase. En ese estado el panel muestra «Inicia sesión para usar Scripts manuales» y no entrega archivos ni propuestas, lo que confirma la barrera de acceso antes de consultar versiones privadas. La creación real de la primera versión, la edición y la propuesta avanzada requieren iniciar sesión con una cuenta Supabase; esos pasos quedan cubiertos por los endpoints autenticados y las pruebas automatizadas de rutas y validación.

Las validaciones automatizadas completadas en esta iteración son `pnpm test` con 34 archivos y 111 pruebas, y `pnpm build` con salida de producción correcta. El único aviso de build existente es el tamaño del chunk principal de la aplicación; no bloquea la compilación.

# Validación visual intermedia

- La ruta `/editor` abre el panel central de Proyectos antes de entrar al editor.
- La pantalla de autenticación conserva el botón «Continuar con Google» y la paleta oscura esperada.
- El panel de proyectos muestra el proyecto local y acciones de editar, duplicar, exportar y eliminar.
- El estado visual del panel indica correctamente que el proyecto local todavía no se sincroniza sin iniciar sesión.
- Pendiente: verificar el tab Tiles y la navegación responsive en viewport móvil, además de ejecutar la suite completa y registrar cualquier advertencia heredada.

En viewport móvil de 375 px, el gestor central conserva el encabezado, las acciones del proyecto y los botones inferiores sin desbordamiento horizontal. La portada mantiene legibilidad y el formulario de acceso se apila correctamente; el botón de Google permanece disponible al continuar el desplazamiento vertical. El tab Tiles aún requiere validación manual de interacción porque la captura de `/editor` inicia deliberadamente en el gestor.

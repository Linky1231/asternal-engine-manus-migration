# Validación de migración a Manus

## Comprobación visual inicial

El 27 de agosto de 2026 se reinició el servidor de desarrollo después de trasladar eventos, mercado, foro, notificaciones y ajustes comunitarios a rutas de Manus. La pantalla de acceso conserva el botón visible **Continuar con Google** y declara que el acceso se administra de forma segura mediante Manus.

Las rutas comunitarias que requieren sesión redirigen a la pantalla de acceso en una sesión anónima, comportamiento esperado para proteger los registros personales. La ruta `/editor` mostró la pantalla de error de la aplicación durante esta comprobación; se requiere inspeccionar la consola y los registros antes de marcar la verificación visual como completada.

La portada queda sin contenido editorial porque el entorno de Manus está limpio y no se han creado datos de demostración, de acuerdo con la retirada de contenido de prueba solicitada. No se eliminó ningún dato remoto heredado.

## Comprobación de rutas y producción

Se construyó el artefacto de producción y se inició temporalmente el servidor Node generado. Las rutas públicas `/api/manus/community/settings` y `/api/manus/events` devolvieron `200` con un estado limpio (`null` y `[]`, respectivamente). Una mutación de compra sin sesión fue rechazada con respuesta no exitosa. La suite de Vitest finalizó con **36 archivos y 123 pruebas correctas** y la compilación de producción fue satisfactoria.

Las capturas en móvil mantienen el acceso oficial y su botón **Continuar con Google**, que abre el portal oficial de Manus. La portada sin sesión muestra contenedores vacíos por diseño: no se recrearon publicaciones ni otros datos de prueba.

# Revisión del encabezado de Notificaciones

`NotificationBell` se inserta en `src/routes/index.tsx` entre el contador de Orbes y el botón Menú. La entrada de Notificaciones y el panel duplicado se retiraron del menú de tres rayitas. El componente conserva la consulta real de no leídas, refresco periódico, realtime y apertura de `NotificationsPanel`.

El badge muestra valores de 1 a 99 y `+99` cuando el contador supera 99. También expone el valor en `title` y `aria-label`. La captura automatizada sin sesión redirige `/` a Auth, por lo que la posición del encabezado autenticado debe confirmarse con una cuenta activa.

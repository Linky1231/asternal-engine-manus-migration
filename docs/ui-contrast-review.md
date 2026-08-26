# Revisión de correcciones de contraste y consistencia

La captura móvil de `/search` confirma que las categorías caben en dos filas y que el estado vacío mantiene una jerarquía legible. La ruta `/plus` sin sesión redirige a `/auth`, por lo que el apartado Plus se validará adicionalmente por inspección de componentes y pruebas estáticas; la captura del usuario confirma el fallo original en sus inputs sociales.

El botón Jugar quedó extraído a `src/components/social/PlayButton.tsx` y se usa tanto en `GamesHome` como en `GameCard`. La excepción blanca del banner fue retirada para que ambas superficies sean idénticas.

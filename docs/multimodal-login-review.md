# Login multimodal y lectura de Notificaciones

Al abrir Notificaciones, el cliente limpia inmediatamente el badge visible y el panel ejecuta `markNotificationsRead()` antes de recargar los eventos. El evento `asternal-notifications:changed` actualiza la campana con el estado real; por eso desaparecen tanto el contador como los indicadores de «sin leer».

El botón `Login multimodal` inicia el OAuth existente de Manus con nonce y cookie host-only. El callback conserva la protección CSRF, consume la intención de vinculación y vuelve a Perfil. Un endpoint protegido por la sesión Manus crea o recupera la identidad Supabase mediante una credencial interna aleatoria generada solo en servidor, guarda el `manus_open_id` en metadata, sincroniza el perfil y devuelve únicamente la sesión Supabase. Nunca se usa ni se transporta una contraseña de Manus.

La prueba read-only de `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_URL` pasó. Las pruebas específicas pasaron (73 tests); la suite completa mantiene únicamente el fallo histórico de `auth.logout` por la dependencia heredada `@trpc/server` no declarada. La compilación de producción pasó.

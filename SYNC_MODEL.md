# Modelo de sincronización de proyectos

## Identidad y aislamiento

Cada copia local del editor se guarda bajo un namespace derivado del `id` de usuario de Supabase. El namespace anónimo se reserva para trabajo sin sesión. Las claves antiguas globales se migran una sola vez al namespace activo durante la primera inicialización; después no se vuelven a leer como fuente de datos. Al cerrar sesión, la cuenta siguiente recibe un namespace distinto y no reutiliza el índice anterior.

La autorización de nube continúa dependiendo de la sesión de Supabase y de las políticas RLS de `user_projects`. El cliente nunca decide el `user_id` de la fila: las operaciones de lectura, inserción, actualización y eliminación se filtran por la sesión vigente y el servidor Supabase aplica la propiedad de la fila.

## Contrato de sincronización

| Campo | Fuente | Uso |
|---|---|---|
| `localId` | Índice local | Identifica la copia en un dispositivo. |
| `cloudId` | `user_projects.id` | Vincula una copia local con la fila de la cuenta. |
| `updatedAt` | Guardado local | Marca temporal del último cambio local. |
| `updated_at` | Supabase | Marca temporal del último cambio remoto. |
| `data` | Proyecto serializado | Contiene escenas, entidades, scripts, assets, tilemaps y ajustes. |

La estrategia inicial es **last-write-wins con protección por timestamp** al abrir el editor o actualizar el gestor. Si la copia remota es más nueva, se importa sobre la copia local; si la copia local es más nueva, se sube sobre la fila vinculada. Las diferencias menores a un segundo se consideran simultáneas y se conserva la copia local durante el guardado explícito. Las copias sin `cloudId` se suben como nuevas filas una sola vez.

## Compatibilidad

El modelo `Project` se amplía solo con propiedades opcionales. Las escenas existentes mantienen `entities`, `layers`, `ui` y todos los campos de 9-slicing actuales. El tilemap se agregará como una propiedad opcional de `Scene`; la normalización asignará una cuadrícula vacía únicamente cuando el modo de edición la necesite.

Los assets binarios no se guardan en columnas nuevas ni se transfieren mediante contraseñas o credenciales. Las referencias de audio, imágenes y sprites pueden ser data URLs heredadas o URLs persistentes de almacenamiento. La migración no elimina datos locales ni remotos.

## Flujos aceptados

En un dispositivo nuevo, la cuenta inicia sesión, se descarga su lista, se importan los proyectos faltantes y se activa el proyecto más reciente si el proyecto local es el predeterminado vacío. En un dispositivo que ya tiene trabajo local, se conservan los proyectos locales, se respaldan los que no tienen vínculo remoto y se descargan los restantes. En el mismo navegador, cambiar de cuenta cambia el namespace inmediatamente y dispara una recarga del gestor/editor.

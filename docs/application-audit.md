# Auditoría funcional de Asternal Engine

## Definición de la aplicación

Asternal Engine es una plataforma web de creación y distribución de juegos. Permite autenticarse, crear y editar proyectos con escenas, entidades, scripts y elementos de interfaz; guardar proyectos localmente y sincronizarlos con la nube; ejecutar juegos publicados; publicar juegos, obras y publicaciones sociales; descubrir contenido en el feed; interactuar mediante likes, comentarios, favoritos, reposts y compras con Orbes; participar en chat y grupos; consultar perfiles, galería, tienda, eventos y notificaciones; y administrar contenido y usuarios mediante un área administrativa.

## Arquitectura observada

La interfaz está construida con React, TypeScript, Vite, TanStack Router, Framer Motion, Tailwind y componentes propios. Las rutas principales cubren autenticación, inicio/feed, publicaciones, juegos, galería, perfiles, historial, Orbes, chat, eventos, configuración, ayuda, administración y herramientas del editor. El servidor Express expone endpoints de IA para Orión y sirve la aplicación compilada. Supabase es la fuente remota de autenticación, perfiles, publicaciones, juegos, reacciones, comentarios, notificaciones, eventos, transacciones y canales en tiempo real. El navegador mantiene además borradores, proyectos locales, preferencias de chat y el historial local de sesiones de juego.

## Fuentes de actividad verificables

Las sesiones de juego se crean en `GameCard` cuando una persona abre un juego publicado y se cierran al salir o desmontar el componente. Solo se guardan sesiones de al menos tres segundos en `localStorage` bajo `play_history`, con `gameId`, título, inicio, fin y duración. Las métricas de tiempo, sesiones, juegos únicos, días activos, racha y juego más jugado son derivaciones de esos registros; no representan actividad general de la plataforma.

Los likes se consultan desde `reactions` unido a publicaciones reales de `posts`. Las publicaciones, juegos y perfiles se leen desde Supabase. Los proyectos locales y algunos estados auxiliares viven en `localStorage`, por lo que no deben presentarse como analítica global o como actividad que no esté registrada.

## Hallazgo del historial

El historial actual mezcla datos legítimos de `play_history` con una afirmación amplia de actividad de la plataforma. Además, las sesiones antiguas pueden conservar referencias a juegos que ya no aparecen entre los juegos publicados. No existe un rastreador real de tiempo dedicado a navegar, publicar, chatear o editar; por tanto, la aplicación no puede mostrar honestamente horas totales de uso de la plataforma sin crear una nueva fuente de sesiones de actividad.

## Criterio de implementación

El historial debe mostrar únicamente tiempo jugando juegos publicado y sesiones que correspondan a juegos actualmente verificables. Las nuevas tarjetas deben expresar su alcance con precisión, por ejemplo «Tiempo jugando» en lugar de «Uso de la plataforma». Los contadores de juegos, sesiones, juegos únicos y likes deben proceder de sus fuentes existentes. Cualquier métrica sin fuente persistente real debe desaparecer, no rellenarse con valores estimados, muestras, copias ni datos inventados.

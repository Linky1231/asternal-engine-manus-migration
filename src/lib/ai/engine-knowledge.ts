// Contexto portable del motor para Orión. Se mantiene como TypeScript para que el
// mismo asistente funcione tanto en Vite como en el servidor de Manus.
export const ENGINE_KNOWLEDGE = `
Asternal es un motor de videojuegos social. El motor organiza proyectos en
entidades y escenas, y ofrece física, renderizado, un bucle de juego y una API
de creación. Sus sistemas incluyen scripting declarativo para comportamientos,
guardado y carga de proyectos, animaciones por estados y sprites, efectos de
sonido, utilidades de imagen y sincronización de proyectos entre dispositivos.
Cuando expliques una función, distingue entre el editor visual, la lógica de
juego y la capa social; no inventes APIs que no aparezcan en el proyecto.
`.trim();

export const ENGINE_MODULE_SUMMARY = {
  core: "Motor principal: tipos de entidades, escenas, física, renderizado, bucle del juego y API de creación.",
  scripts: "Scripting: sistema de comportamientos y lógica de juego declarativa (scripts de entidades).",
  storage: "Persistencia: guardado/carga de proyectos en almacenamiento local y nube.",
  animations: "Clips de animación: estados, sprites y reproducción frame a frame.",
  sfx: "Efectos de sonido: audio procedural y reproducción.",
  images: "Utilidades de imagen: generación y procesado de sprites.",
  cloudSync: "Sincronización con la nube: subir/descargar proyectos entre dispositivos.",
};

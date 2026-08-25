/**
 * Comportamiento común para las filas de contenido explorables en pantallas
 * táctiles. No añade controles artificiales: el desplazamiento es nativo y
 * mantiene una detención suave por tarjeta cuando el usuario termina el gesto.
 */
export const mobileCarouselScrollClassName =
  "flex gap-3 overflow-x-auto no-scrollbar -mx-3 scroll-px-3 px-3 pb-1 snap-x snap-proximity overscroll-x-contain [&>*]:snap-start md:flex-wrap md:overflow-visible md:justify-start md:snap-none";

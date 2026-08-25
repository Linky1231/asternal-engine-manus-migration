import type { PostWithMeta } from "@/lib/social/api";

export type FeedSection = "forYou" | "following" | "explore" | "all" | "game" | "artwork";

function timestamp(value: string | null | undefined): number {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function newestFirst(a: PostWithMeta, b: PostWithMeta): number {
  const createdDifference = timestamp(b.created_at) - timestamp(a.created_at);
  if (createdDifference !== 0) return createdDifference;

  const updatedDifference = timestamp(b.updated_at) - timestamp(a.updated_at);
  if (updatedDifference !== 0) return updatedDifference;

  return a.id.localeCompare(b.id);
}

/**
 * Orden determinista de publicaciones. Todos los apartados priorizan novedad:
 * «Para ti», «Explorar» y las categorías muestran el contenido más reciente;
 * «Siguiendo» aplica primero el conjunto seguido y después la misma prioridad.
 * Nunca filtra publicaciones salvo que el apartado sea «Siguiendo».
 */
export function orderFeedPosts(
  posts: PostWithMeta[],
  section: FeedSection,
  followingAuthorIds: string[] = [],
): PostWithMeta[] {
  const source = section === "following"
    ? posts.filter(post => followingAuthorIds.includes(post.author_id))
    : posts;
  return [...source].sort(newestFirst);
}

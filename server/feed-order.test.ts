import { describe, expect, it } from "vitest";
import { orderFeedPosts } from "../src/lib/social/feed-order";

type TestPost = { id: string; author_id: string; created_at: string; updated_at: string };

const post = (id: string, author_id: string, created_at: string, updated_at = created_at): TestPost => ({ id, author_id, created_at, updated_at });

describe("orden determinista del feed", () => {
  it("pone lo más nuevo primero en Para ti y conserva todos los posts", () => {
    const posts = [
      post("old", "a", "2026-01-01T00:00:00.000Z"),
      post("new", "b", "2026-08-25T00:00:00.000Z"),
      post("middle", "c", "2026-06-01T00:00:00.000Z"),
    ];
    expect(orderFeedPosts(posts as never[], "forYou").map(item => item.id)).toEqual(["new", "middle", "old"]);
  });

  it("filtra Siguiendo y después ordena por novedad", () => {
    const posts = [
      post("followed-old", "a", "2026-01-01T00:00:00.000Z"),
      post("not-followed-new", "c", "2026-08-25T00:00:00.000Z"),
      post("followed-new", "b", "2026-08-20T00:00:00.000Z"),
    ];
    expect(orderFeedPosts(posts as never[], "following", ["a", "b"]).map(item => item.id)).toEqual(["followed-new", "followed-old"]);
  });

  it("usa updated_at y luego id como desempates estables", () => {
    const posts = [
      post("z", "a", "2026-08-25T00:00:00.000Z", "2026-08-25T01:00:00.000Z"),
      post("a", "b", "2026-08-25T00:00:00.000Z", "2026-08-25T01:00:00.000Z"),
      post("m", "c", "2026-08-25T00:00:00.000Z", "2026-08-25T02:00:00.000Z"),
    ];
    expect(orderFeedPosts(posts as never[], "explore").map(item => item.id)).toEqual(["m", "a", "z"]);
  });
});

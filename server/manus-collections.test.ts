import { describe, expect, it } from "vitest";
import { getManusCollection, isPublicManusCollection, normalizeManusRecordPayload } from "./manus-collections";

describe("contratos de colecciones de Manus", () => {
  it("solo habilita colecciones declaradas y reconoce su visibilidad", () => {
    expect(getManusCollection("posts")?.name).toBe("posts");
    expect(getManusCollection("user_projects")?.name).toBe("user_projects");
    expect(isPublicManusCollection("posts")).toBe(true);
    expect(isPublicManusCollection("notifications")).toBe(false);
    expect(isPublicManusCollection("user_projects")).toBe(false);
  });

  it("atribuye siempre las publicaciones a la cuenta Manus autenticada", () => {
    const payload = normalizeManusRecordPayload("posts", "post_1", "manus-user-a", {
      author_id: "manus-user-a",
      content: "Mi juego",
    });

    expect(payload).toMatchObject({ author_id: "manus-user-a", content: "Mi juego" });
    expect(payload).not.toHaveProperty("id");
  });

  it("impide suplantar la identidad incluida en registros comunitarios", () => {
    expect(() => normalizeManusRecordPayload("comments", "comment_1", "manus-user-a", {
      author_id: "manus-user-b",
      content: "Intento de suplantación",
    })).toThrow("no puede atribuirse a otra cuenta");
  });

  it("reserva el identificador del perfil para la identidad Manus activa", () => {
    const profile = normalizeManusRecordPayload("profiles", "manus-user-a", "manus-user-a", {
      username: "creador",
      ownerOpenId: "otro-usuario",
    });
    expect(profile).toEqual({ username: "creador" });
    expect(() => normalizeManusRecordPayload("profiles", "otro-usuario", "manus-user-a", {
      username: "suplantado",
    })).toThrow("perfil solo se puede guardar");
  });
});

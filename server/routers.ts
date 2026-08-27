import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { createManusRecord, deleteOwnManusRecord, getOwnManusRecord, getVisibleManusRecord, listOwnManusRecords, listPublicManusRecords, updateOwnManusRecord } from "./manus-records";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getManusCollection, isPublicManusCollection, normalizeManusRecordPayload } from "./manus-collections";

function requireManusCollection(value: string) {
  const selected = getManusCollection(value);
  if (!selected) throw new TRPCError({ code: "BAD_REQUEST", message: "Colección no disponible." });
  return selected;
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  records: router({
    mine: protectedProcedure.input(z.object({ collection: z.string().min(1).max(64) })).query(({ ctx, input }) => {
      const selected = requireManusCollection(input.collection);
      return listOwnManusRecords(ctx.user.openId, selected.name);
    }),
    public: publicProcedure.input(z.object({ collection: z.string().min(1).max(64) })).query(({ input }) => {
      const selected = requireManusCollection(input.collection);
      if (!isPublicManusCollection(selected.name)) throw new TRPCError({ code: "FORBIDDEN", message: "Esta colección no es pública." });
      return listPublicManusRecords(selected.name);
    }),
    visible: publicProcedure.input(z.object({ id: z.string().min(1).max(64) })).query(({ ctx, input }) => getVisibleManusRecord(ctx.user?.openId ?? null, input.id)),
    create: protectedProcedure.input(z.object({ collection: z.string().min(1).max(64), data: z.record(z.string(), z.unknown()) })).mutation(({ ctx, input }) => {
      const selected = requireManusCollection(input.collection);
      const id = selected.config.idMustEqualOwner ? ctx.user.openId : randomUUID();
      const data = normalizeManusRecordPayload(selected.name, id, ctx.user.openId, input.data);
      return createManusRecord({ id, collection: selected.name, ownerOpenId: ctx.user.openId, data, visibility: selected.config.visibility });
    }),
    update: protectedProcedure.input(z.object({ id: z.string().min(1).max(64), data: z.record(z.string(), z.unknown()) })).mutation(async ({ ctx, input }) => {
      const record = await getOwnManusRecord(ctx.user.openId, input.id);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "El registro no pertenece a esta cuenta." });
      const selected = requireManusCollection(record.collection);
      const data = normalizeManusRecordPayload(selected.name, record.id, ctx.user.openId, input.data);
      return updateOwnManusRecord({ id: record.id, ownerOpenId: ctx.user.openId, data, visibility: selected.config.visibility });
    }),
    remove: protectedProcedure.input(z.object({ id: z.string().min(1).max(64) })).mutation(async ({ ctx, input }) => {
      const record = await getOwnManusRecord(ctx.user.openId, input.id);
      if (!record || !getManusCollection(record.collection)) throw new TRPCError({ code: "NOT_FOUND", message: "El registro no pertenece a esta cuenta." });
      await deleteOwnManusRecord(ctx.user.openId, input.id);
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;

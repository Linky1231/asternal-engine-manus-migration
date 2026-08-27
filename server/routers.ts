import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { createManusRecord, deleteOwnManusRecord, getVisibleManusRecord, listOwnManusRecords, listPublicManusRecords, updateOwnManusRecord } from "./manus-records";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { randomUUID } from "node:crypto";
import { z } from "zod";

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
    mine: protectedProcedure.input(z.object({ collection: z.string().min(1).max(64).optional() })).query(({ ctx, input }) => listOwnManusRecords(ctx.user.openId, input.collection)),
    public: publicProcedure.input(z.object({ collection: z.string().min(1).max(64) })).query(({ input }) => listPublicManusRecords(input.collection)),
    visible: publicProcedure.input(z.object({ id: z.string().min(1).max(64) })).query(({ ctx, input }) => getVisibleManusRecord(ctx.user?.openId ?? null, input.id)),
    create: protectedProcedure.input(z.object({ collection: z.string().min(1).max(64), data: z.record(z.unknown()), visibility: z.enum(["private", "public"]).optional() })).mutation(({ ctx, input }) => createManusRecord({ ...input, id: randomUUID(), ownerOpenId: ctx.user.openId })),
    update: protectedProcedure.input(z.object({ id: z.string().min(1).max(64), data: z.record(z.unknown()).optional(), visibility: z.enum(["private", "public"]).optional() })).mutation(({ ctx, input }) => updateOwnManusRecord({ ...input, ownerOpenId: ctx.user.openId })),
    remove: protectedProcedure.input(z.object({ id: z.string().min(1).max(64) })).mutation(async ({ ctx, input }) => { await deleteOwnManusRecord(ctx.user.openId, input.id); return { success: true }; }),
  }),
});

export type AppRouter = typeof appRouter;

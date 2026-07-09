import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getUserId } from "~/server/user";

export const conversationRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) => {
    return ctx.db.conversation.findMany({
      where: { userId: getUserId() },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, updatedAt: true },
    });
  }),

  create: publicProcedure.mutation(({ ctx }) => {
    return ctx.db.conversation.create({
      data: { userId: getUserId() },
      select: { id: true },
    });
  }),

  rename: publicProcedure
    .input(z.object({ id: z.string().cuid(), title: z.string().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.db.conversation.updateMany({
        where: { id: input.id, userId: getUserId() },
        data: { title: input.title },
      });
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.db.conversation.deleteMany({
        where: { id: input.id, userId: getUserId() },
      });
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });
    }),
});

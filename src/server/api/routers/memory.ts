import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getUserId } from "~/server/user";

export const memoryRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) => {
    return ctx.db.memory.findMany({
      where: { userId: getUserId() },
      orderBy: { createdAt: "desc" },
      select: { id: true, content: true, category: true, createdAt: true },
    });
  }),

  delete: publicProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.db.memory.deleteMany({
        where: { id: input.id, userId: getUserId() },
      });
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });
    }),
});

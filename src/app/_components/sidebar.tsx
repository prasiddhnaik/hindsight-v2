"use client";

import { usePathname, useRouter } from "next/navigation";

import { SidebarView } from "~/app/_components/sidebar-view";
import { api } from "~/trpc/react";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const utils = api.useUtils();
  const conversations = api.conversation.list.useQuery();

  const deleteConversation = api.conversation.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.conversation.list.invalidate();
      if (pathname === `/chat/${variables.id}`) router.push("/");
    },
  });

  const renameConversation = api.conversation.rename.useMutation({
    onSuccess: () => void utils.conversation.list.invalidate(),
  });

  return (
    <SidebarView
      items={conversations.data ?? []}
      pathname={pathname}
      isLoading={conversations.isLoading}
      isError={conversations.isError}
      onRetry={() => void conversations.refetch()}
      onRename={(id, title) => renameConversation.mutate({ id, title })}
      onDelete={(id) => deleteConversation.mutate({ id })}
      renamePending={renameConversation.isPending}
      renameError={
        renameConversation.error ? "Rename failed. Try again." : null
      }
      deletePending={deleteConversation.isPending}
      deleteError={
        deleteConversation.error ? "Delete failed. Try again." : null
      }
      onNavigate={onNavigate}
    />
  );
}

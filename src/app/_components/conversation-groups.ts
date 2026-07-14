export interface ConversationListItem {
  id: string;
  title: string;
  updatedAt: Date;
}

export type ConversationGroupLabel = "Today" | "Yesterday" | "Earlier";

export function groupConversations(
  items: ConversationListItem[],
  now: Date,
): Array<{
  label: ConversationGroupLabel;
  items: ConversationListItem[];
}> {
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const yesterdayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  ).getTime();
  const groups: Record<ConversationGroupLabel, ConversationListItem[]> = {
    Today: [],
    Yesterday: [],
    Earlier: [],
  };

  for (const item of items) {
    const updatedAt = item.updatedAt.getTime();
    const label =
      updatedAt >= todayStart
        ? "Today"
        : updatedAt >= yesterdayStart
          ? "Yesterday"
          : "Earlier";
    groups[label].push(item);
  }

  return (["Today", "Yesterday", "Earlier"] as const)
    .filter((label) => groups[label].length > 0)
    .map((label) => ({ label, items: groups[label] }));
}

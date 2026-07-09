import { Chat } from "~/app/_components/chat";

export default function HomePage() {
  // A conversation row is only created when the first message is sent.
  return <Chat conversationId={null} initialMessages={[]} />;
}

import { redirect } from "next/navigation";
import { nanoid } from "nanoid";

export default function ChatPage() {
  const newChatId = `chat-${nanoid()}`;

  // Redirect immediately to the new chat ID
  redirect(`/chat/${newChatId}`);
}

import { useParams } from "@tanstack/react-router";

export function ChatPage() {
  const { patientId } = useParams({ from: "/chat/$patientId" });

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b bg-background p-4">
        <p className="text-sm">Chat with Patient {patientId}</p>
      </header>
      <main className="flex-1">
        <p className="p-4 text-muted-foreground">Chat interface coming soon...</p>
      </main>
    </div>
  );
}

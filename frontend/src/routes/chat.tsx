import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function ChatPage() {
  const { patientId } = useParams({ from: "/chat/$patientId" });
  const navigate = useNavigate();

  const handleBack = () => {
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-2"
            >
              <ArrowLeft className="size-4" />
              Back to Dashboard
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-muted-foreground" />
            <span className="font-medium text-sm">Patient Chat</span>
            <Badge variant="secondary">Patient #{patientId}</Badge>
          </div>
        </div>
      </header>
      <Separator />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-4">
          <p className="text-muted-foreground">Chat interface coming soon...</p>
        </div>
      </main>
    </div>
  );
}

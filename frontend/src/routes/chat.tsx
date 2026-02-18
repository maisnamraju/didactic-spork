import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createChat, listPatientChats } from "@/lib/api/chat";
import { getErrorMessage } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function ChatPage() {
  const { patientId } = useParams({ from: "/chat/$patientId" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State
  const [draft, setDraft] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const nextTempIdRef = useRef(-1);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const patientIdNum = Number(patientId);

  // Fetch chat history
  const historyQuery = useInfiniteQuery({
    queryKey: ["patient-chat-history", patientIdNum],
    queryFn: ({ pageParam }) =>
      listPatientChats({
        patientId: patientIdNum,
        limit: 20,
        cursor: pageParam,
      }),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  // Remote messages from API
  const remoteMessages = useMemo(
    () => historyQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [historyQuery.data],
  );

  // Merge remote and local messages
  const mergedMessages = useMemo(() => {
    const seenIds = new Set<number>();
    const combined = [...remoteMessages, ...localMessages];
    const unique: ChatMessage[] = [];

    for (const message of combined) {
      if (message.id > 0) {
        if (seenIds.has(message.id)) {
          continue;
        }
        seenIds.add(message.id);
      }
      unique.push(message);
    }

    return unique.sort((left, right) => {
      return (
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      );
    });
  }, [localMessages, remoteMessages]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: createChat,
    onSuccess: (reply, variables) => {
      const userMessage: ChatMessage = {
        id: nextTempIdRef.current--,
        patientId: patientIdNum,
        role: "user",
        message: variables.message,
        provider: "mock",
        createdAt: new Date().toISOString(),
      };

      const assistantMessage: ChatMessage = {
        id: reply.messageId,
        patientId: patientIdNum,
        role: "assistant",
        message: reply.aiResponse,
        provider: reply.provider,
        createdAt: new Date().toISOString(),
      };

      setLocalMessages((previous) => [...previous, userMessage, assistantMessage]);
      setDraft("");
      setInlineError(null);
      void queryClient.invalidateQueries({
        queryKey: ["patient-chat-history", patientIdNum],
      });
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setInlineError(message);
      toast.error(message);
    },
  });

  const handleSend = () => {
    const message = draft.trim();
    if (!message || sendMutation.isPending) {
      return;
    }

    setInlineError(null);
    sendMutation.mutate({
      patientId: patientIdNum,
      message,
    });
  };

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

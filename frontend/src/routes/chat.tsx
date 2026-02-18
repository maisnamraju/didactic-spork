import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Loader2, MessageSquare, SendHorizontal } from "lucide-react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createChat, listPatientChats } from "@/lib/api/chat";
import { getErrorMessage } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!viewportRef.current) {
      return;
    }
    viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }, [mergedMessages.length, historyQuery.hasNextPage, historyQuery.isFetchingNextPage]);

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
      <main ref={viewportRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-3 p-4">
          {historyQuery.isPending ? (
            <div className="space-y-3">
              <div className="h-12 w-[70%] animate-pulse rounded-xl bg-muted" />
              <div className="ml-auto h-12 w-[62%] animate-pulse rounded-xl bg-muted" />
              <div className="h-12 w-[58%] animate-pulse rounded-xl bg-muted" />
            </div>
          ) : null}

          {historyQuery.isError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {getErrorMessage(historyQuery.error, "Unable to load chat history.")}
            </div>
          ) : null}

          {!historyQuery.isPending && !historyQuery.isError && historyQuery.hasNextPage ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void historyQuery.fetchNextPage()}
                disabled={historyQuery.isFetchingNextPage}
              >
                {historyQuery.isFetchingNextPage ? "Loading..." : "Load more messages"}
              </Button>
            </div>
          ) : null}

          {!historyQuery.isPending &&
          !historyQuery.isError &&
          mergedMessages.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground text-sm">
              No messages yet. Start the conversation.
            </p>
          ) : null}

          {mergedMessages.map((message) => (
            <article
              key={`${message.id}-${message.createdAt}`}
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                message.role === "assistant"
                  ? "mr-auto bg-muted text-foreground"
                  : "ml-auto bg-primary text-primary-foreground",
              )}
            >
              <p className="whitespace-pre-wrap">{message.message}</p>
              <p
                className={cn(
                  "mt-2 text-[11px]",
                  message.role === "assistant"
                    ? "text-muted-foreground"
                    : "text-primary-foreground/80",
                )}
              >
                {new Date(message.createdAt).toLocaleString()}
              </p>
            </article>
          ))}
        </div>
      </main>

      <Separator />

      <footer className="border-t bg-background">
        <div className="mx-auto max-w-3xl space-y-3 p-4">
          {inlineError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {inlineError}
            </div>
          ) : null}

          <div className="flex gap-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about this patient's care context..."
              rows={3}
              disabled={sendMutation.isPending}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              type="button"
              onClick={handleSend}
              disabled={sendMutation.isPending || draft.trim().length === 0}
              className="self-end"
            >
              {sendMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <SendHorizontal className="size-4" />
              )}
            </Button>
          </div>

          {sendMutation.isPending ? (
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Loader2 className="size-3 animate-spin" />
              Waiting for AI response...
            </div>
          ) : null}
        </div>
      </footer>
    </div>
  );
}

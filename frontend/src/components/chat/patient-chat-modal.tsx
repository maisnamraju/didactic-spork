import { AssistantModalPrimitive } from "@assistant-ui/react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, SendHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { createChat, listPatientChats } from "@/lib/api/chat";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { ChatMessage, Patient } from "@/lib/types/api";

interface PatientChatModalProps {
  patient: Patient;
}

const CHAT_LIMIT = 20;

export function PatientChatModal({ patient }: PatientChatModalProps) {
  const [draft, setDraft] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const nextTempIdRef = useRef(-1);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();

  const historyQuery = useInfiniteQuery({
    queryKey: ["patient-chat-history", patient.id],
    queryFn: ({ pageParam }) =>
      listPatientChats({
        patientId: patient.id,
        limit: CHAT_LIMIT,
        cursor: pageParam,
      }),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isOpen,
  });

  const remoteMessages = useMemo(
    () => historyQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [historyQuery.data],
  );

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

  useEffect(() => {
    if (!isOpen || !viewportRef.current) {
      return;
    }

    viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }, [isOpen, mergedMessages.length, historyQuery.hasNextPage, historyQuery.isFetchingNextPage]);

  const sendMutation = useMutation({
    mutationFn: createChat,
    onSuccess: (reply, variables) => {
      const userMessage: ChatMessage = {
        id: nextTempIdRef.current--,
        patientId: patient.id,
        role: "user",
        message: variables.message,
        provider: "local",
        createdAt: new Date().toISOString(),
      };

      const assistantMessage: ChatMessage = {
        id: reply.messageId,
        patientId: patient.id,
        role: "assistant",
        message: reply.aiResponse,
        provider: reply.provider,
        createdAt: new Date().toISOString(),
      };

      setLocalMessages((previous) => [...previous, userMessage, assistantMessage]);
      setDraft("");
      setInlineError(null);
      void queryClient.invalidateQueries({
        queryKey: ["patient-chat-history", patient.id],
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
      patientId: patient.id,
      message,
    });
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);

    if (!open) {
      setInlineError(null);
      setDraft("");
      setLocalMessages([]);
      nextTempIdRef.current = -1;
      return;
    }

    setInlineError(null);
  };

  return (
    <AssistantModalPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
      <AssistantModalPrimitive.Trigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <MessageSquare className="size-4" />
          Chat
        </Button>
      </AssistantModalPrimitive.Trigger>
      <AssistantModalPrimitive.Content
        sideOffset={10}
        className="z-50 w-[min(92vw,700px)] overflow-hidden rounded-xl border bg-popover p-0 shadow-xl"
      >
        <div className="flex h-[min(80vh,620px)] flex-col">
          <header className="flex items-center justify-between gap-3 p-4">
            <div>
              <h3 className="font-semibold text-base">Patient chat</h3>
              <p className="text-muted-foreground text-sm">{patient.name}</p>
            </div>
            <Badge variant="secondary">Patient #{patient.id}</Badge>
          </header>

          <Separator />

          <div ref={viewportRef} className="flex-1 space-y-3 overflow-y-auto p-4">
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

          <Separator />

          <footer className="space-y-3 p-4">
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
          </footer>
        </div>
      </AssistantModalPrimitive.Content>
    </AssistantModalPrimitive.Root>
  );
}

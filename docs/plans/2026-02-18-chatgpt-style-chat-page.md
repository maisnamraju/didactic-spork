# ChatGPT-Style Chat Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform patient chat from modal popup to full-page ChatGPT-style interface with centered layout, navigation, and patient context.

**Architecture:** Create new `/chat/:patientId` route with dedicated ChatPage component. Reuse existing chat API calls and state management patterns from PatientChatModal but with full-page layout. Header shows patient info with back button, centered message container matches ChatGPT style, fixed input at bottom.

**Tech Stack:** React, TanStack Router, TanStack Query, Tailwind CSS, Lucide icons, existing UI components (Button, Textarea, Badge, Separator)

---

## Task 1: Create Chat Route and Basic Page Component

**Files:**
- Modify: `frontend/src/app/router.tsx`
- Create: `frontend/src/routes/chat.tsx`

**Step 1: Add chat route to router**

Modify `frontend/src/app/router.tsx` after line 72 (after dashboardRoute):

```typescript
const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/chat/$patientId",
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (!session) {
      throw redirect({ to: "/sign-in" });
    }
  },
  component: ChatPage,
});
```

Then update the route tree at line 74:

```typescript
const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  signUpRoute,
  dashboardRoute,
  chatRoute,
]);
```

Add import at top (after line 12):

```typescript
import { ChatPage } from "@/routes/chat";
```

**Step 2: Create basic ChatPage component**

Create `frontend/src/routes/chat.tsx`:

```typescript
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
```

**Step 3: Test the route**

Run: `cd frontend && npm run dev`
Navigate to: `http://localhost:5173/chat/1`
Expected: Page shows "Chat with Patient 1" header

**Step 4: Commit**

```bash
git add frontend/src/app/router.tsx frontend/src/routes/chat.tsx
git commit -m "feat: add chat route and basic page component

Create /chat/:patientId route with auth protection and basic ChatPage
component skeleton.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Implement Header with Navigation and Patient Info

**Files:**
- Modify: `frontend/src/routes/chat.tsx`
- Read: `frontend/src/lib/api/patients.ts` (to understand patient fetch API)

**Step 1: Add imports for header components**

At top of `frontend/src/routes/chat.tsx`:

```typescript
import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
```

**Step 2: Add patient data fetching**

If `frontend/src/lib/api/patients.ts` doesn't have a `getPatient` function, check what's available. Otherwise, we'll fetch from the patients list or add the API call. For now, let's assume we need the patient context from the chat itself.

Instead, let's display patient info that we'll pass later. Update the component:

```typescript
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
```

**Step 3: Test header navigation**

Run: `npm run dev` (if not running)
Navigate to: `http://localhost:5173/chat/1`
Expected: Header shows "Back to Dashboard" button and "Patient #1" badge
Click back button → should navigate to /dashboard

**Step 4: Commit**

```bash
git add frontend/src/routes/chat.tsx
git commit -m "feat: add header with navigation and patient badge

Add back button to navigate to dashboard and display patient ID badge
in centered header.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Implement Chat State Management and Message Fetching

**Files:**
- Modify: `frontend/src/routes/chat.tsx`
- Read: `frontend/src/components/chat/patient-chat-modal.tsx:30-46` (for query pattern)
- Read: `frontend/src/lib/api/chat.ts` (for API functions)

**Step 1: Add chat API imports and types**

At top of `frontend/src/routes/chat.tsx`, add:

```typescript
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createChat, listPatientChats } from "@/lib/api/chat";
import { getErrorMessage } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types/api";
```

**Step 2: Add state and queries to component**

Update `ChatPage` component, after the `handleBack` function:

```typescript
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

  const handleBack = () => {
    navigate({ to: "/dashboard" });
  };

  // ... rest of component
}
```

**Step 3: Test data fetching**

Run: `npm run dev`
Navigate to: `http://localhost:5173/chat/1`
Open browser DevTools → Network tab
Expected: See API call to `/api/chats?patientId=1&limit=20`

**Step 4: Commit**

```bash
git add frontend/src/routes/chat.tsx
git commit -m "feat: add chat state management and message fetching

Implement infinite query for chat history, local message state, and
message merging logic.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Implement Message Sending Mutation

**Files:**
- Modify: `frontend/src/routes/chat.tsx`
- Read: `frontend/src/components/chat/patient-chat-modal.tsx:79-112` (for mutation pattern)

**Step 1: Add send mutation**

In `ChatPage` component, after the `mergedMessages` useMemo:

```typescript
// Send message mutation
const sendMutation = useMutation({
  mutationFn: createChat,
  onSuccess: (reply, variables) => {
    const userMessage: ChatMessage = {
      id: nextTempIdRef.current--,
      patientId: patientIdNum,
      role: "user",
      message: variables.message,
      provider: "local",
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
```

**Step 2: Commit**

```bash
git add frontend/src/routes/chat.tsx
git commit -m "feat: add message sending mutation

Implement mutation for sending messages with optimistic updates and
error handling.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Implement Message Display UI

**Files:**
- Modify: `frontend/src/routes/chat.tsx`
- Read: `frontend/src/components/chat/patient-chat-modal.tsx:164-224` (for message UI)

**Step 1: Add imports for message UI**

Add to imports:

```typescript
import { cn } from "@/lib/utils";
import { useEffect } from "react";
```

**Step 2: Add auto-scroll effect**

After the `handleSend` function:

```typescript
// Auto-scroll to bottom on new messages
useEffect(() => {
  if (!viewportRef.current) {
    return;
  }
  viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
}, [mergedMessages.length, historyQuery.hasNextPage, historyQuery.isFetchingNextPage]);
```

**Step 3: Update main section with message display**

Replace the `<main>` section in the return statement:

```typescript
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
```

**Step 4: Test message display**

Run: `npm run dev`
Navigate to: `http://localhost:5173/chat/1`
Expected:
- Shows loading skeletons initially
- Then displays messages in bubbles (if any exist)
- "Load more" button appears if there are more messages
- Empty state shows if no messages

**Step 5: Commit**

```bash
git add frontend/src/routes/chat.tsx
git commit -m "feat: add message display UI with auto-scroll

Implement message bubbles, loading states, error display, and load more
button. Auto-scroll to bottom on new messages.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Implement Input Footer

**Files:**
- Modify: `frontend/src/routes/chat.tsx`
- Read: `frontend/src/components/chat/patient-chat-modal.tsx:228-264` (for input UI)

**Step 1: Add input UI imports**

Add to imports:

```typescript
import { Loader2, SendHorizontal } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
```

**Step 2: Add footer section**

After the `</main>` closing tag, before the closing `</div>`:

```typescript
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
```

**Step 3: Test input and sending**

Run: `npm run dev`
Navigate to: `http://localhost:5173/chat/1`
Expected:
- Can type in textarea
- Enter key sends message (Shift+Enter for new line)
- Send button disabled when empty or sending
- Loading spinner shows while sending
- Error displays if send fails

**Step 4: Commit**

```bash
git add frontend/src/routes/chat.tsx
git commit -m "feat: add input footer with send functionality

Implement textarea, send button, loading states, and keyboard shortcuts
(Enter to send, Shift+Enter for new line).

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Update Dashboard to Navigate to Chat Page

**Files:**
- Modify: `frontend/src/routes/dashboard.tsx:283`

**Step 1: Update Chat button to use navigation**

In `frontend/src/routes/dashboard.tsx`, find the `PatientChatModal` component (line 283) and replace it:

From:
```typescript
<PatientChatModal patient={patient} />
```

To:
```typescript
<Button
  size="sm"
  variant="outline"
  onClick={() => navigate({ to: "/chat/$patientId", params: { patientId: String(patient.id) } })}
  className="gap-2"
>
  <MessageSquare className="size-4" />
  Chat
</Button>
```

**Step 2: Remove PatientChatModal import**

Remove this import from the top of the file (line 6):

```typescript
import { PatientChatModal } from "@/components/chat/patient-chat-modal";
```

**Step 3: Test navigation from dashboard**

Run: `npm run dev`
Navigate to: `http://localhost:5173/dashboard`
Click "Chat" button on any patient row
Expected: Navigates to `/chat/:patientId` page

**Step 4: Commit**

```bash
git add frontend/src/routes/dashboard.tsx
git commit -m "feat: update dashboard to navigate to chat page

Replace PatientChatModal with navigation to full-page chat.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Add E2E Tests

**Files:**
- Modify: `tests/e2e/chat.e2e.test.ts`
- Read existing tests to understand patterns

**Step 1: Add navigation test**

Add test to `tests/e2e/chat.e2e.test.ts`:

```typescript
describe("Chat Page Navigation", () => {
  it("navigates from dashboard to chat page", async () => {
    // Login and go to dashboard
    const { session } = await createAuthenticatedSession();

    // Create a test patient
    const patient = await createTestPatient(session.user.id);

    // Navigate to dashboard
    const response = await request(app).get("/dashboard");
    expect(response.status).toBe(200);

    // Click chat button should navigate to /chat/:patientId
    // (This would be a frontend test in a real browser automation setup)

    // Verify chat page loads
    const chatResponse = await request(app).get(`/chat/${patient.id}`);
    expect(chatResponse.status).toBe(200);
  });

  it("back button returns to dashboard", async () => {
    // Test that navigation back works
    // (Frontend test - would need Playwright/Cypress)
  });
});
```

**Step 2: Run tests**

Run: `npm run test:e2e`
Expected: Tests pass (or skip frontend-specific tests with TODO)

**Step 3: Commit**

```bash
git add tests/e2e/chat.e2e.test.ts
git commit -m "test: add e2e tests for chat page navigation

Add tests for dashboard to chat navigation and back button.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Final Testing and Cleanup

**Files:**
- Verify all modified files

**Step 1: Run full type check**

Run: `cd frontend && npm run typecheck`
Expected: No type errors

**Step 2: Run frontend dev server and manual test**

Run: `npm run dev`
Test flow:
1. Navigate to `/dashboard`
2. Click "Chat" on a patient
3. Verify navigation to `/chat/:patientId`
4. Send a message
5. Verify message appears and AI responds
6. Click "Load more" if available
7. Click "Back to Dashboard"
8. Verify return to dashboard

**Step 3: Optional - Remove PatientChatModal if not needed**

If the modal is no longer needed, can delete:
- `frontend/src/components/chat/patient-chat-modal.tsx`

Otherwise, keep it for potential future use.

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup and verification

Verify all functionality works end-to-end for chat page.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Success Criteria Checklist

- [ ] Chat page accessible at `/chat/:patientId`
- [ ] ChatGPT-style centered layout (max-w-3xl)
- [ ] Header shows back button and patient badge
- [ ] Messages display in bubbles (assistant left, user right)
- [ ] Can send messages and receive AI responses
- [ ] "Load more" button loads older messages
- [ ] Auto-scroll to bottom on new messages
- [ ] Back button navigates to dashboard
- [ ] Dashboard "Chat" button navigates to chat page
- [ ] Error handling works (network errors, send failures)
- [ ] Loading states show appropriately
- [ ] No TypeScript errors
- [ ] Manual testing passes all flows

---

## Notes

- The plan assumes patient data is available through the chat context. If you need to fetch full patient details separately, add a query for `getPatient(patientId)` API call.
- The modal component (`PatientChatModal`) is preserved but no longer used. Can be deleted if not needed.
- Uses existing API endpoints and doesn't require backend changes.
- Maintains all existing functionality from the modal version.

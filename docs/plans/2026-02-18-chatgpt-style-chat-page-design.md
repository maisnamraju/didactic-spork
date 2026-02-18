# ChatGPT-Style Full-Page Patient Chat

**Date:** 2026-02-18
**Status:** Approved
**Author:** Design Session

## Overview

Transform the patient chat experience from a modal popup to a full-page ChatGPT-style interface. Users will navigate to a dedicated chat page when clicking the "Chat" button, providing a focused, immersive conversation experience.

## Goals

- Create a single-page chat interface similar to ChatGPT
- Provide a focused, distraction-free chat experience
- Maintain all existing chat functionality (message history, pagination, AI responses)
- Enable easy navigation back to the dashboard
- Display patient context prominently

## User Requirements

1. Chat opens in the same browser tab (navigate away from dashboard)
2. Include back button/header with navigation to dashboard
3. Show patient name and key details in the header
4. URL structure: `/chat/:patientId`
5. ChatGPT-style minimal, centered layout with max-width container
6. Keep "Load more messages" button for pagination

## Architecture & Routing

### New Route

Add a new route to the router configuration:

```
/chat/:patientId → ChatPage component
```

### Route Configuration

- **Path:** `/chat/:patientId`
- **Component:** `ChatPage`
- **Authentication:** Required (redirect to `/sign-in` if not authenticated)
- **Parent:** Root route (same level as dashboard)

### Files Modified

- `frontend/src/app/router.tsx` - Add chat route with auth protection
- `frontend/src/routes/dashboard.tsx` - Update "Chat" button to navigate instead of opening modal
- `frontend/src/routes/chat.tsx` - New chat page component (to be created)

## Component Structure

### New Components

**ChatPage** (`frontend/src/routes/chat.tsx`)
- Main chat page component
- Handles route params, patient data loading
- Manages chat state and message flow

### Component Hierarchy

```
ChatPage
├── Header
│   ├── Back Button (navigate to /dashboard)
│   ├── Patient Info (name, ID)
│   └── Badge (Patient #)
├── Messages Container (scrollable)
│   ├── Load More Button (conditional)
│   ├── Loading Skeleton (initial load)
│   ├── Error Display (if query fails)
│   └── Message Bubbles (user + assistant)
└── Input Footer (fixed bottom)
    ├── Error Display (inline)
    ├── Textarea
    ├── Send Button
    └── Loading Indicator
```

### Reused Logic from Modal

The following patterns will be reused from `PatientChatModal`:

- React Query infinite query for chat history
- Mutation for sending messages
- Message merging (local + remote)
- Auto-scroll behavior
- Error handling and loading states
- Optimistic UI updates

### What Changes

- Remove `AssistantModalPrimitive` wrappers (modal-specific)
- No `isOpen` state or modal lifecycle
- Full viewport layout instead of fixed modal dimensions
- Add header with navigation
- Patient data from route params instead of props

## UI Layout

### Visual Structure

```
┌─────────────────────────────────────────┐
│ Header (full width, bg-background)     │
│ ← Back to Dashboard                    │
│ Patient Name          Badge: Patient # │
├─────────────────────────────────────────┤
│                                         │
│     ┌─────────────────────┐            │
│     │  Centered Container │            │
│     │  (max-w-3xl)        │            │
│     │                     │            │
│     │  [Load more...]     │            │
│     │                     │            │
│     │  ┌──────────────┐   │            │
│     │  │ AI Message   │   │            │
│     │  └──────────────┘   │            │
│     │     ┌──────────────┐│            │
│     │     │ User Message ││            │
│     │     └──────────────┘│            │
│     │                     │            │
│     └─────────────────────┘            │
│                                         │
├─────────────────────────────────────────┤
│ Input Area (centered, max-w-3xl)       │
│ ┌─────────────────────┬─────┐          │
│ │ Textarea            │ Send│          │
│ └─────────────────────┴─────┘          │
│ Fixed bottom                            │
└─────────────────────────────────────────┘
```

### Layout Specifications

- **Container:** Full viewport height (`h-screen`)
- **Max Width:** `max-w-3xl` (centered, ChatGPT-style)
- **Header:** Fixed at top, full width, shows patient context
- **Messages:** Scrollable area between header and input
- **Input:** Fixed at bottom, centered with same max-width
- **Background:** Use existing gradient background from root layout

### Styling

- Reuse existing message bubble styles (assistant: left/muted, user: right/primary)
- Maintain current component library (Button, Textarea, Badge, Separator)
- Preserve accessibility and responsive design
- Clean, minimal aesthetic matching ChatGPT

## State Management

### Component State

```typescript
const [draft, setDraft] = useState("");
const [inlineError, setInlineError] = useState<string | null>(null);
const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
const nextTempIdRef = useRef(-1);
const viewportRef = useRef<HTMLDivElement | null>(null);
```

### React Query

**Chat History (Infinite Query):**
```typescript
useInfiniteQuery({
  queryKey: ["patient-chat-history", patientId],
  queryFn: ({ pageParam }) => listPatientChats({
    patientId,
    limit: 20,
    cursor: pageParam,
  }),
  initialPageParam: null,
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
})
```

**Send Message (Mutation):**
```typescript
useMutation({
  mutationFn: createChat,
  onSuccess: (reply, variables) => {
    // Add user message + AI response to localMessages
    // Invalidate history query
  },
  onError: (error) => {
    // Show inline error + toast
  },
})
```

### Message Merging

1. Fetch remote messages from API (paginated)
2. Merge with local optimistic messages
3. Deduplicate by ID
4. Sort by `createdAt` timestamp ascending
5. Display in chronological order

### Auto-Scroll Behavior

- Scroll to bottom on initial load
- Scroll to bottom on new messages
- Preserve scroll position when loading more history (via "Load more" button)

## Data Flow

### Page Load Flow

1. User navigates to `/chat/:patientId`
2. Route `beforeLoad` hook checks authentication
3. Chat page mounts, extracts `patientId` from params
4. Trigger chat history query (first 20 messages)
5. Display messages or loading skeleton
6. Auto-focus textarea

### Sending Message Flow

1. User types message and clicks send
2. Validate message is not empty
3. Create mutation triggers with `patientId` and `message`
4. Optimistically add user message to `localMessages`
5. API responds with AI message
6. Add AI message to `localMessages`
7. Invalidate history query (refetch in background)
8. Auto-scroll to bottom
9. Clear textarea

### Loading More History Flow

1. User clicks "Load more messages" button
2. Trigger `fetchNextPage()` on infinite query
3. Show loading state in button
4. API returns next page of messages
5. Merge new messages into display
6. Maintain scroll position (don't auto-scroll)

## Navigation Flow

### Entering Chat

**From Dashboard:**
```tsx
// Update Chat button in dashboard.tsx (line 283)
<Button
  size="sm"
  variant="outline"
  onClick={() => navigate({ to: '/chat/$patientId', params: { patientId: patient.id } })}
  className="gap-2"
>
  <MessageSquare className="size-4" />
  Chat
</Button>
```

### Exiting Chat

**Back Button in Header:**
- Click back button → `navigate({ to: '/dashboard' })`
- Browser back button also works (natural navigation)

### State Persistence

- React Query cache preserves messages when navigating away
- Returning to same chat uses cached data (instant load)
- Background refetch ensures fresh data

## Error Handling

### Error Scenarios

| Scenario | Handling |
|----------|----------|
| Patient not found | Show error message with back button |
| Chat history load failure | Display inline error, offer retry |
| Message send failure | Show inline error + toast notification |
| Network errors | Standard error UI with retry options |
| Unauthorized access | Redirect to sign-in |

### Loading States

- **Initial load:** Skeleton loaders for messages (3 bubbles)
- **Sending message:** Disable input, show spinner in button
- **Loading more:** Show "Loading..." text in button

## Testing

### Test Coverage

Extend existing e2e tests in `tests/e2e/chat.e2e.test.ts`:

1. **Navigation:**
   - Click "Chat" on dashboard → navigates to `/chat/:patientId`
   - Back button → returns to `/dashboard`
   - Browser back button works

2. **Message Flow:**
   - Send message → appears in chat
   - AI response → appears after user message
   - Messages persist after navigation

3. **Pagination:**
   - "Load more" button appears when `hasNextPage`
   - Clicking loads older messages
   - Scroll position preserved

4. **Error Handling:**
   - Invalid patient ID → shows error
   - Network failure → shows retry option

### Accessibility

- Keyboard navigation (tab through controls)
- ARIA labels on buttons and inputs
- Focus management (auto-focus textarea)
- Screen reader support for new messages

## Implementation Approach

We selected **Approach 1: New dedicated chat page component** for the following reasons:

**Advantages:**
- Clean separation of concerns
- Optimized for full-page ChatGPT-style experience
- Easy to maintain and iterate independently
- Reuses API layer and state patterns
- Preserves modal option if needed later

**What's Shared:**
- API functions (`createChat`, `listPatientChats`)
- Type definitions (`ChatMessage`, `Patient`)
- State management patterns (React Query)
- Error handling utilities

**What's New:**
- ChatGPT-style centered layout
- Header with navigation
- Full-page routing
- Simplified lifecycle (no modal open/close)

## Future Considerations

- **Optional:** Remove `PatientChatModal` component if modal is no longer needed
- **Enhancement:** Add keyboard shortcuts (Cmd/Ctrl+Enter to send)
- **Enhancement:** Export chat history feature
- **Enhancement:** Search within chat history
- **Mobile:** Ensure responsive design works well on small screens

## Success Criteria

✅ Chat opens in full-page view at `/chat/:patientId`
✅ ChatGPT-style centered layout with max-width container
✅ Back button navigates to dashboard
✅ Patient info visible in header
✅ All existing chat functionality works (send, receive, pagination)
✅ Messages persist across navigation
✅ Auto-scroll on new messages
✅ Error handling matches current behavior
✅ Tests pass for navigation and chat flow

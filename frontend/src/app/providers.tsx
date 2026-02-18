import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { Toaster } from "@/components/ui/sonner";
import { createAppRouter } from "@/app/router";
import { isApiClientError, setUnauthorizedHandler } from "@/lib/api/client";
import { sessionQueryKey } from "@/lib/queries/auth";

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (isApiClientError(error) && error.status === 401) {
            return false;
          }

          return failureCount < 1;
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function AppProviders() {
  const [queryClient] = useState(() => createQueryClient());
  const [router] = useState(() => createAppRouter(queryClient));

  useEffect(() => {
    return setUnauthorizedHandler(() => {
      queryClient.setQueryData(sessionQueryKey, null);
      const pathname = router.state.location.pathname;

      if (pathname !== "/sign-in" && pathname !== "/sign-up") {
        void router.navigate({ to: "/sign-in" });
      }
    });
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
      {import.meta.env.DEV ? (
        <>
          <ReactQueryDevtools initialIsOpen={false} />
          <TanStackRouterDevtools router={router} />
        </>
      ) : null}
    </QueryClientProvider>
  );
}

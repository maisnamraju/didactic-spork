import { QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { sessionQueryOptions } from "@/lib/queries/auth";
import { ChatPage } from "@/routes/chat";
import { DashboardPage } from "@/routes/dashboard";
import { EmailVerifiedPage } from "@/routes/email-verified";
import { SignInPage } from "@/routes/sign-in";
import { SignUpPage } from "@/routes/sign-up";

interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions);
    throw redirect({
      to: session ? "/dashboard" : "/sign-in",
    });
  },
  component: () => null,
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: SignInPage,
});

const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-up",
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: SignUpPage,
});

const emailVerifiedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/email-verified",
  component: EmailVerifiedPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  beforeLoad: async ({ context }) => {
    console.log("[Dashboard] beforeLoad: Checking session");
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions);
    console.log("[Dashboard] beforeLoad: Session data:", session);
    if (!session) {
      console.log("[Dashboard] beforeLoad: No session, redirecting to sign-in");
      throw redirect({ to: "/sign-in" });
    }
    console.log("[Dashboard] beforeLoad: Session valid, allowing access");
  },
  component: DashboardPage,
});

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

const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  signUpRoute,
  emailVerifiedRoute,
  dashboardRoute,
  chatRoute,
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });
}

function RootLayout() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(204_100%_97%),_transparent_40%),linear-gradient(180deg,_hsl(0_0%_100%),_hsl(210_20%_98%))]">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </div>
    </div>
  );
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/errors";
import { sessionQueryKey } from "@/lib/queries/auth";

const signInSchema = z.object({
  email: z.string().trim().email("Email must be valid"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignInFormValues = z.infer<typeof signInSchema>;

export function SignInPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signInMutation = useMutation({
    mutationFn: signIn,
    onSuccess: async () => {
      console.log("[SignIn] Sign-in successful, invalidating session queries");
      setServerError(null);
      await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      console.log("[SignIn] Session invalidated, navigating to dashboard");
      console.log("[SignIn] Navigate function type:", typeof navigate);
      try {
        const result = await navigate({ to: "/dashboard" });
        console.log("[SignIn] Navigation completed, result:", result);
        console.log("[SignIn] Current window.location:", window.location.pathname);
      } catch (error) {
        console.error("[SignIn] Navigation error:", error);
      }
    },
    onError: (error) => {
      console.error("[SignIn] Sign-in error:", error);
      setServerError(getErrorMessage(error));
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    await signInMutation.mutateAsync(values);
  });

  return (
    <main className="flex min-h-[80vh] items-center justify-center">
      <Card className="w-full max-w-md border-border/70 bg-card/95 shadow-lg backdrop-blur">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Access your patient dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {serverError ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {serverError}
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={signInMutation.isPending}>
                {signInMutation.isPending ? "Signing in..." : "Sign in"}
              </Button>

              <p className="text-center text-muted-foreground text-sm">
                Need an account?{" "}
                <Link to="/sign-up" className="font-medium text-primary underline-offset-4 hover:underline">
                  Sign up
                </Link>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}

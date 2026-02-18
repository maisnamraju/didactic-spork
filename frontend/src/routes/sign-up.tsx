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
import { signUp } from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/errors";
import { sessionQueryKey } from "@/lib/queries/auth";

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
  email: z.string().trim().email("Email must be valid"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

export function SignUpPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const signUpMutation = useMutation({
    mutationFn: signUp,
    onSuccess: async () => {
      setServerError(null);
      await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      await navigate({ to: "/dashboard" });
    },
    onError: (error) => {
      setServerError(getErrorMessage(error));
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    await signUpMutation.mutateAsync(values);
  });

  return (
    <main className="flex min-h-[80vh] items-center justify-center">
      <Card className="w-full max-w-md border-border/70 bg-card/95 shadow-lg backdrop-blur">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>
            Register to manage patients and AI conversations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                      <Input type="password" autoComplete="new-password" {...field} />
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

              <Button type="submit" className="w-full" disabled={signUpMutation.isPending}>
                {signUpMutation.isPending ? "Creating account..." : "Create account"}
              </Button>

              <p className="text-center text-muted-foreground text-sm">
                Already have an account?{" "}
                <Link to="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}

import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const REDIRECT_DELAY_SECONDS = 3;

export function EmailVerifiedPage() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(REDIRECT_DELAY_SECONDS);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    const timeout = setTimeout(() => {
      navigate({ to: "/sign-in" });
    }, REDIRECT_DELAY_SECONDS * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <main className="flex min-h-[80vh] items-center justify-center">
      <Card className="w-full max-w-md border-border/70 bg-card/95 shadow-lg backdrop-blur">
        <CardHeader>
          <CardTitle className="text-center text-green-600">Email verified!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground text-sm">
            You will be taken to the login page in {countdown} second{countdown !== 1 ? "s" : ""}...
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

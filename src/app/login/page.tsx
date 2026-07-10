"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    try {
      await api.login(formData);
      toast.success("Successfully logged in");
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to log in. Please check your credentials.");
      toast.error("Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6] p-4">
      <Card className="w-full max-w-md border-border bg-[#FAF9F6]">
        <CardHeader className="space-y-1">
          <CardTitle className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            Academic Research Console
          </CardTitle>
          <CardDescription className="font-sans text-xs text-muted-foreground">
            Enter your credentials to access the thesis verification workspace.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-severity-critical/10 border border-severity-critical/20 p-3 text-xs text-severity-critical font-mono">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Academic Email
              </Label>
              <Input
                id="username"
                name="username"
                type="email"
                required
                className="bg-[#FAF9F6] border-border text-foreground font-sans focus-visible:ring-primary"
                placeholder="email@university.edu"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                className="bg-[#FAF9F6] border-border text-foreground font-sans focus-visible:ring-primary"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" disabled={isLoading} className="w-full font-mono text-xs">
              {isLoading ? "Authenticating..." : "AUTHENTICATE"}
            </Button>
            <div className="text-center text-xs text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/register" className="text-primary hover:underline font-mono">
                Register here
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push("/login");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6] font-mono text-xs text-muted-foreground">
      REDIRECTING TO CONSOLE LOGIN...
    </div>
  );
}

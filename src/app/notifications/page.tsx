"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Bell, BellOff, ShieldAlert, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function NotificationsPage() {
  const router = useRouter();

  // Fetch all notifications (including read ones)
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: () => api.getNotifications(false),
  });

  const severityIcons = {
    critical: <ShieldAlert className="h-4 w-4 text-severity-critical" />,
    moderate: <AlertTriangle className="h-4 w-4 text-severity-moderate" />,
    low: <CheckCircle2 className="h-4 w-4 text-severity-ok" />,
  };

  const severityBg = {
    critical: "bg-severity-critical/5 border-severity-critical/10",
    moderate: "bg-severity-moderate/5 border-severity-moderate/10",
    low: "bg-severity-ok/5 border-severity-ok/10",
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6]">
      <header className="border-b border-border bg-[#FAF9F6] px-6 py-4 flex items-center gap-4">
        <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-border" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-serif text-lg font-bold text-foreground">
            Notification Center
          </h1>
          <p className="font-mono text-[10px] text-muted-foreground uppercase">
            Activity logs and RAG agent flags
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-6 space-y-6">
        {isLoading ? (
          <div className="text-center font-mono text-xs py-12">LOADING NOTIFICATIONS...</div>
        ) : notifications && notifications.length > 0 ? (
          <div className="space-y-4">
            {notifications.map((notif: any) => (
              <Card 
                key={notif.id} 
                className={`border border-border/80 bg-[#FAF9F6] transition-all ${
                  !notif.read && "border-primary/30 shadow-sm"
                }`}
              >
                <div className={`p-4 flex gap-4 ${severityBg[notif.severity as keyof typeof severityBg] || ""}`}>
                  <div className="mt-0.5">
                    {severityIcons[notif.severity as keyof typeof severityIcons] || <Bell className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                        {notif.severity} notification
                      </span>
                      <span className="font-mono text-[9px] text-muted-foreground">
                        {new Date(notif.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="font-sans text-xs text-foreground leading-relaxed">
                      {notif.message}
                    </p>
                    {notif.flag_id && (
                      <span className="font-mono text-[9px] text-muted-foreground block mt-1">
                        FLAG REFERENCE: {notif.flag_id}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-border p-12 text-center text-xs text-muted-foreground bg-muted/10 font-mono flex flex-col items-center gap-2">
            <BellOff className="h-6 w-6 text-muted-foreground/60" />
            No notifications logged in your inbox.
          </div>
        )}
      </main>
    </div>
  );
}

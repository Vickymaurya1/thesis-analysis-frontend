"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell, BookOpen, LogOut, Plus, Upload, UserCheck, Inbox, ShieldAlert, Award, FileText } from "lucide-react";
import { toast } from "sonner";

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // 1. Fetch current user profile
  const { data: user, isLoading: userLoading, error: userError } = useQuery({
    queryKey: ["me"],
    queryFn: api.getMe,
    retry: false,
  });

  // Redirect if unauthorized
  React.useEffect(() => {
    if (userError) {
      toast.error("Please log in first");
      router.push("/login");
    }
  }, [userError, router]);

  // 2. Fetch notifications (Unread count only, polls every 45s)
  const { data: notifications } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api.getNotifications(true),
    enabled: !!user,
    refetchInterval: 45000, // Poll every 45 seconds
  });

  // 3. Fetch student's theses
  const { data: theses, isLoading: thesesLoading } = useQuery({
    queryKey: ["theses"],
    queryFn: api.listTheses,
    enabled: !!user && user.role === "student",
  });

  // 4. Fetch teacher's pending invites
  const { data: pendingInvites, refetch: refetchInvites } = useQuery({
    queryKey: ["pending-links"],
    queryFn: api.getPendingLinks,
    enabled: !!user && user.role === "teacher",
  });

  // 5. Fetch teacher's supervised students/theses (re-uses theses endpoint but structured differently on backend or parsed here)
  const { data: teacherTheses, isLoading: teacherThesesLoading } = useQuery({
    queryKey: ["teacher-theses"],
    queryFn: api.listTheses,
    enabled: !!user && user.role === "teacher",
  });

  // Create Thesis mutation
  const createThesisMutation = useMutation({
    mutationFn: api.createThesis,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["theses"] });
      toast.success("Thesis profile created successfully!");
      setIsCreateOpen(false);
      setNewTitle("");
      router.push(`/thesis/${data.id}`);
    },
    onError: (err: any) => {
      toast.error(`Creation failed: ${err.message}`);
    },
  });

  // Accept Link mutation
  const acceptLinkMutation = useMutation({
    mutationFn: ({ linkId, thesisId }: { linkId: string; thesisId?: string }) =>
      api.acceptLink(linkId, thesisId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-links"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-theses"] });
      toast.success("Advisor invitation accepted!");
    },
    onError: (err: any) => {
      toast.error(`Failed to accept: ${err.message}`);
    },
  });

  const handleLogout = () => {
    api.logout();
    toast.success("Logged out successfully");
    router.push("/login");
  };

  const handleCreateThesisSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createThesisMutation.mutate({ title: newTitle });
  };

  if (userLoading || thesesLoading || teacherThesesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6] font-mono text-xs">
        LOADING CONSOLE WORKSPACE...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6]">
      {/* Top Header Bar */}
      <header className="border-b border-border bg-[#FAF9F6] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="font-serif text-lg font-bold tracking-tight text-foreground">
            Academic Research Console
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {/* Notification bell */}
          <div className="relative cursor-pointer" onClick={() => router.push("/notifications")}>
            <Bell className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            {notifications && notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-severity-critical opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-severity-critical"></span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded-sm border border-border">
              {user.name} ({user.role.toUpperCase()})
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout} className="font-mono text-xs gap-1 border-border">
              <LogOut className="h-3 w-3" /> EXIT
            </Button>
          </div>
        </div>
      </header>

      {/* Main Console Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        
        {/* STUDENT VIEW */}
        {user.role === "student" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
                Your Thesis Workspace
              </h2>
              {(!theses || theses.length === 0) && (
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger render={<Button size="sm" className="font-mono text-xs gap-1" />}>
                    <Plus className="h-3.5 w-3.5" /> CREATE THESIS RECORD
                  </DialogTrigger>
                  <DialogContent className="bg-[#FAF9F6] border-border max-w-md">
                    <form onSubmit={handleCreateThesisSubmit}>
                      <DialogHeader>
                        <DialogTitle className="font-serif text-lg">Create Thesis Profile</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                          Enter your thesis title. This initializes the RAG agent workspace for automated checks.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="title" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            Thesis Title
                          </Label>
                          <Input
                            id="title"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            required
                            placeholder="An Analysis of..."
                            className="bg-[#FAF9F6] border-border text-foreground font-sans focus-visible:ring-primary"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={createThesisMutation.isPending} className="w-full font-mono text-xs">
                          {createThesisMutation.isPending ? "INITIALIZING..." : "INITIALIZE PROFILE"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* List of Student's Theses */}
            {theses && theses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {theses.map((thesis: any) => (
                  <Card
                    key={thesis.id}
                    className="border-border bg-[#FAF9F6] cursor-pointer hover:border-primary/40 transition-all duration-200"
                    onClick={() => router.push(`/thesis/${thesis.id}`)}
                  >
                    <CardHeader>
                      <span className="font-mono text-[9px] text-muted-foreground tracking-wider uppercase block">
                        RECORD ID: {thesis.id}
                      </span>
                      <CardTitle className="font-serif text-base font-semibold leading-snug">
                        {thesis.title}
                      </CardTitle>
                      <CardDescription className="font-mono text-[10px] text-muted-foreground uppercase mt-1">
                        Status: <span className="text-foreground">{thesis.status}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      {thesis.advisor ? (
                        <div className="flex items-center gap-1.5 text-muted-foreground font-mono text-[11px]">
                          <UserCheck className="h-3.5 w-3.5 text-severity-ok" />
                          Advisor: {thesis.advisor.name}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-severity-moderate font-mono text-[11px]">
                          <Inbox className="h-3.5 w-3.5" />
                          Advisor Invite Pending
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="border-t border-border/40 pt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Last updated: {new Date(thesis.updated_at || thesis.created_at).toLocaleDateString()}</span>
                      <Button variant="ghost" size="sm" className="font-mono text-[11px] h-7 px-2">
                        OPEN CONSOLE &rarr;
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-border p-12 text-center text-xs text-muted-foreground bg-muted/10 font-mono">
                No active thesis profile found. Click the button above to register your thesis.
              </div>
            )}
          </div>
        )}

        {/* TEACHER VIEW */}
        {user.role === "teacher" && (
          <div className="space-y-6">
            
            {/* Pending invites */}
            {pendingInvites && pendingInvites.length > 0 && (
              <Card className="border-severity-moderate/30 bg-severity-moderate/5">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-severity-moderate">
                    <ShieldAlert className="h-4 w-4" />
                    <CardTitle className="font-serif text-sm font-semibold">
                      Pending Advisor Requests ({pendingInvites.length})
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-muted-foreground">
                    Students have invited you to supervise their theses. Accept below to grant workspace access.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pendingInvites.map((invite: any) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between border-b border-border/30 pb-2 text-xs"
                    >
                      <div>
                        <span className="font-sans font-medium text-foreground block">{invite.student_name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{invite.student_email}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="default"
                        className="font-mono text-xs h-7"
                        onClick={() => acceptLinkMutation.mutate({ linkId: invite.id })}
                        disabled={acceptLinkMutation.isPending}
                      >
                        ACCEPT INVITE
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Supervised Students List */}
            <div className="space-y-4">
              <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
                Supervised Thesis Profiles
              </h2>
              
              {teacherTheses && teacherTheses.length > 0 ? (
                <div className="border border-border">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 bg-muted/40 border-b border-border p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-4">Student & Title</div>
                    <div className="col-span-3">Department & Degree</div>
                    <div className="col-span-2 text-center">Quality Score</div>
                    <div className="col-span-2 text-center">Status</div>
                    <div className="col-span-1 text-right">Action</div>
                  </div>

                  {/* Table Body */}
                  <div className="divide-y divide-border/60">
                    {teacherTheses.map((thesis: any) => (
                      <div
                        key={thesis.id}
                        onClick={() => router.push(`/thesis/${thesis.id}`)}
                        className="grid grid-cols-12 p-3 items-center text-xs hover:bg-secondary/10 cursor-pointer transition-colors duration-150"
                      >
                        <div className="col-span-4 pr-4">
                          <span className="font-sans font-semibold text-foreground block text-sm">
                            {thesis.owner_name || "Active Student"}
                          </span>
                          <span className="font-serif text-muted-foreground italic line-clamp-1">
                            "{thesis.title}"
                          </span>
                        </div>
                        <div className="col-span-3 pr-4 font-mono text-[11px] text-muted-foreground">
                          <span className="block">{thesis.owner_degree || "MTech"}</span>
                          <span>{thesis.owner_department || "CS"}</span>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="font-mono text-sm font-semibold bg-primary/5 border border-primary/10 px-2 py-0.5 rounded-sm">
                            {thesis.overall_score || "N/A"}
                          </span>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="font-mono text-[10px] uppercase bg-muted border border-border px-2 py-0.5 rounded-sm">
                            {thesis.status}
                          </span>
                        </div>
                        <div className="col-span-1 text-right">
                          <Button variant="ghost" size="sm" className="font-mono text-xs h-7 px-2">
                            VIEW
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-border p-12 text-center text-xs text-muted-foreground bg-muted/10 font-mono">
                  You are not currently supervising any thesis profiles. Student invites will appear here once accepted.
                </div>
              )}
            </div>

          </div>
        )}

      </main>
    </div>
  );
}

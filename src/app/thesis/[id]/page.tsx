"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FlagCard } from "@/components/flag-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  ArrowLeft, Upload, FileText, CheckCircle2, AlertTriangle, 
  HelpCircle, History, UserCheck, Play, Send, RefreshCw, Layers 
} from "lucide-react";
import { toast } from "sonner";
import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts";

export default function ThesisDetailsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const queryClient = useQueryClient();
  const chatBottomRef = useRef<HTMLDivElement>(null);
  
  // State variables
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // Viva practice chat state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [isChatSending, setIsChatSending] = useState(false);

  // 1. Get current user
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: api.getMe,
  });

  // 2. Get thesis core details (includes versions, advisor/student links)
  const { data: thesis, isLoading: thesisLoading, error: thesisError } = useQuery({
    queryKey: ["thesis", id],
    queryFn: () => api.getThesis(id),
    enabled: !!id,
  });

  // Auto-set the active version to the latest current version if not set
  useEffect(() => {
    if (thesis && thesis.versions && thesis.versions.length > 0 && !selectedVersionId) {
      // Find current version or default to the most recent one
      const curr = thesis.current_version_id || thesis.versions[0].id;
      setSelectedVersionId(curr);
    }
  }, [thesis, selectedVersionId]);

  // 3. Get Dashboard assessment (based on selected version if possible, or overall)
  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ["dashboard", id, selectedVersionId],
    queryFn: () => api.getDashboard(id),
    enabled: !!id && !!selectedVersionId,
  });

  // 4. Trigger review mutations
  const triggerReviewMutation = useMutation({
    mutationFn: ({ tool }: { tool: string }) => {
      if (tool === "quality_review") return api.triggerQualityReview(id);
      if (tool === "plagiarism_monitor") return api.triggerPlagiarismReview(id);
      if (tool === "novelty_detection") return api.triggerNoveltyReview(id);
      if (tool === "literature_review") return api.triggerLiteratureReview(id);
      if (tool === "reviewer_simulation") return api.triggerReviewerReport(id);
      throw new Error(`Unknown review tool: ${tool}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["thesis", id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", id, selectedVersionId] });
      toast.success(`${variables.tool.replace("_", " ").toUpperCase()} completed!`);
    },
    onError: (err: any) => {
      toast.error(`Evaluation failed: ${err.message}`);
    },
  });

  // Update Status mutation
  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.updateThesisStatus(id, status),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["thesis", id] });
      toast.success(`Thesis status updated to ${data.status}`);
    },
    onError: (err: any) => {
      toast.error(`Failed to update status: ${err.message}`);
    },
  });

  // Upload Version mutation
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    // Client-side 10MB limit check
    if (uploadFile.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds maximum limit of 10MB");
      return;
    }

    setIsUploading(true);
    setUploadProgress(15); // Pseudo step: Uploading started

    try {
      const interval = setInterval(() => {
        setUploadProgress((prev) => (prev < 90 ? prev + 15 : prev));
      }, 800);

      await api.uploadThesisVersion(id, uploadFile);
      clearInterval(interval);
      setUploadProgress(100);
      
      toast.success("Thesis version uploaded successfully and RAG triggers queued!");
      setUploadFile(null);
      setIsUploadOpen(false);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["thesis", id] });
      setSelectedVersionId(null); // Force reset to latest
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Viva Session Mutations
  const createVivaSession = useMutation({
    mutationFn: () => api.createReviewerSimSession(id),
    onSuccess: (data) => {
      setCurrentSessionId(data.id);
      setChatHistory([]);
      toast.success("Viva simulation session initialized");
    },
    onError: (err: any) => {
      toast.error(`Failed to start session: ${err.message}`);
    },
  });

  const sendVivaMessage = async () => {
    if (!chatMessage.trim() || !currentSessionId) return;
    setIsChatSending(true);

    const userMsg = { role: "student", content: chatMessage };
    setChatHistory((prev) => [...prev, userMsg]);
    setChatMessage("");

    try {
      // Scroll to bottom
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      
      const response = await api.sendReviewerSimMessage(id, currentSessionId, userMsg.content);
      
      const assistantMsg = { role: "examiner", content: response.response };
      setChatHistory((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      toast.error(`Message failed: ${err.message}`);
    } finally {
      setIsChatSending(false);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  if (thesisLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6] font-mono text-xs">
        LOADING WORKSPACE FOR THESIS RECORD...
      </div>
    );
  }

  if (thesisError || !thesis) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF9F6] p-6 text-center space-y-4">
        <h1 className="font-serif text-lg font-bold text-severity-critical">Error Accessing Record</h1>
        <p className="text-xs text-muted-foreground max-w-md">
          {thesisError?.message || "You do not have permission to view this thesis or the record does not exist."}
        </p>
        <Button size="sm" onClick={() => router.push("/dashboard")} className="font-mono text-xs">
          RETURN TO DASHBOARD
        </Button>
      </div>
    );
  }

  // Find active version details
  const activeVersion = thesis.versions?.find((v: any) => v.id === selectedVersionId);
  const isTeacher = user?.role === "teacher";
  const isOwner = user?.id === thesis.owner_id;

  // Simple overall score chart data
  const scoreVal = dashboard?.overall_quality_score || 0;
  const scoreData = [
    { name: "score", value: scoreVal, fill: scoreVal > 70 ? "#2D5A3D" : scoreVal > 40 ? "#B8860B" : "#B3261E" },
    { name: "max", value: 100 - scoreVal, fill: "#E5E2D9" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6]">
      {/* Detail Header */}
      <header className="border-b border-border bg-[#FAF9F6] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-border" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <span className="font-mono text-[9px] text-muted-foreground tracking-wider uppercase block">
              Thesis Record / {id.substring(0, 8)}
            </span>
            <h1 className="font-serif text-lg font-bold text-foreground leading-tight">
              {thesis.title}
            </h1>
            <p className="font-mono text-[10px] text-muted-foreground mt-1">
              STUDENT: <span className="text-foreground">{thesis.owner_name || "Jane Doe"}</span> | 
              DEGREE: <span className="text-foreground">{thesis.degree_level || "MTech"}</span> | 
              FIELD: <span className="text-foreground">{thesis.field || "CS"}</span>
            </p>
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-3">
          {/* Version Selector */}
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] text-muted-foreground uppercase">Ver:</span>
            <Select value={selectedVersionId || ""} onValueChange={setSelectedVersionId}>
              <SelectTrigger className="w-[80px] h-8 bg-[#FAF9F6] border-border text-xs font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#FAF9F6] border-border text-xs font-mono">
                {thesis.versions?.map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>
                    v{v.version_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status selector (Teacher only) or Status Label (Student) */}
          {isTeacher ? (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[9px] text-muted-foreground uppercase">Status:</span>
              <Select value={thesis.status} onValueChange={(val) => updateStatusMutation.mutate(val)}>
                <SelectTrigger className="w-[120px] h-8 bg-[#FAF9F6] border-border text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#FAF9F6] border-border text-xs font-mono">
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="defended">Defended</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <span className="font-mono text-[10px] uppercase bg-muted border border-border px-2 py-1 rounded-sm">
              Status: {thesis.status}
            </span>
          )}

          {/* Upload Revision CTA (Student only) */}
          {isOwner && (
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
              <DialogTrigger render={<Button size="sm" className="font-mono text-xs h-8 gap-1" />}>
                <Upload className="h-3.5 w-3.5" /> UPLOAD REVISION
              </DialogTrigger>
              <DialogContent className="bg-[#FAF9F6] border-border max-w-md">
                <form onSubmit={handleUploadSubmit}>
                  <DialogHeader>
                    <DialogTitle className="font-serif text-lg">Upload Thesis Draft</DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Upload a PDF copy of your thesis version. Size must not exceed 10MB.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {!isUploading ? (
                      <div className="border border-dashed border-border p-8 rounded-sm text-center bg-muted/10">
                        <input
                          id="file-input"
                          type="file"
                          accept=".pdf"
                          onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                        <label htmlFor="file-input" className="cursor-pointer block space-y-2">
                          <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
                          <span className="font-mono text-[10px] block text-primary underline">
                            {uploadFile ? uploadFile.name : "CHOOSE PDF FILE"}
                          </span>
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <span className="font-mono text-[10px] block text-muted-foreground text-center">
                          PROCESSING DOCUMENT & QUEUING REVIEWERS ({uploadProgress}%)
                        </span>
                        <Progress value={uploadProgress} className="h-1 bg-border" />
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isUploading || !uploadFile} className="w-full font-mono text-xs">
                      {isUploading ? "INGESTING..." : "START PROCESSING"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      {/* Detail Tabs */}
      <Tabs defaultValue="overview" className="flex-1 flex flex-col">
        <div className="border-b border-border bg-[#FAF9F6] px-6">
          <TabsList className="bg-[#FAF9F6] border-0 h-10 gap-4 justify-start">
            <TabsTrigger value="overview" className="font-mono text-[11px] uppercase tracking-wider h-10 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary rounded-none">
              Overview
            </TabsTrigger>
            <TabsTrigger value="citations" className="font-mono text-[11px] uppercase tracking-wider h-10 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary rounded-none">
              Citations
            </TabsTrigger>
            <TabsTrigger value="quality" className="font-mono text-[11px] uppercase tracking-wider h-10 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary rounded-none">
              Quality Review
            </TabsTrigger>
            <TabsTrigger value="integrity" className="font-mono text-[11px] uppercase tracking-wider h-10 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary rounded-none">
              Integrity
            </TabsTrigger>
            <TabsTrigger value="literature" className="font-mono text-[11px] uppercase tracking-wider h-10 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary rounded-none">
              Literature Review
            </TabsTrigger>
            <TabsTrigger value="viva" className="font-mono text-[11px] uppercase tracking-wider h-10 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary rounded-none">
              Reviewer Sim
            </TabsTrigger>
          </TabsList>
        </div>

        {/* -------------------- TAB CONTENT: OVERVIEW -------------------- */}
        <TabsContent value="overview" className="flex-1 p-6 space-y-6 max-w-6xl mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Radial score gauge */}
            <Card className="border-border bg-[#FAF9F6] md:col-span-1 flex flex-col items-center justify-center p-6 text-center">
              <span className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider mb-2">
                Overall Quality score
              </span>
              <div className="h-40 w-40 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart innerRadius="70%" outerRadius="90%" barSize={10} data={scoreData} startAngle={90} endAngle={-270}>
                    <RadialBar dataKey="value" background cornerRadius={5} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center">
                  <span className="font-mono text-3xl font-bold text-foreground">{scoreVal}</span>
                  <span className="font-mono text-[9px] text-muted-foreground uppercase">OUT OF 100</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4 leading-relaxed italic">
                {scoreVal >= 70 ? "Excellent academic quality and documentation. Minor adjustments needed." : 
                 scoreVal >= 40 ? "Adequate draft with minor structural and citation warnings. Revision advised." : 
                 "Critical structure, plagiarism, or formatting flaws detected. Re-evaluating recommended."}
              </p>
            </Card>

            {/* Checklist of sections */}
            <Card className="border-border bg-[#FAF9F6] md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="font-serif text-sm font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                  SECTION INTEGRITY CHECKLIST
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  The RAG pipeline automatically evaluates sections based on thesis guidelines.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard?.sections && dashboard.sections.length > 0 ? (
                  dashboard.sections.map((section: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between border-b border-border/30 pb-2">
                      <div className="flex items-center gap-2">
                        {section.status === "ok" ? (
                          <CheckCircle2 className="h-4 w-4 text-severity-ok" />
                        ) : section.status === "warning" ? (
                          <AlertTriangle className="h-4 w-4 text-severity-moderate" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-severity-critical" />
                        )}
                        <span className="font-serif text-xs font-medium text-foreground">{section.title}</span>
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-sm">
                        SCORE: {section.score}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic font-mono">No sections detected or evaluated yet.</p>
                )}
              </CardContent>
            </Card>

          </div>

          {/* Version History Timeline */}
          <Card className="border-border bg-[#FAF9F6]">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <History className="h-4 w-4" />
                <CardTitle className="font-serif text-sm font-semibold uppercase tracking-wider font-mono">
                  VERSION REVISION LOGS
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {thesis.versions?.map((v: any, index: number) => (
                <div key={v.id} className="flex items-start gap-4 border-l-2 border-border pl-4 pb-2 relative">
                  <div className="absolute -left-1.5 top-1.5 h-3 w-3 bg-[#FAF9F6] border-2 border-primary rounded-full"></div>
                  <div>
                    <span className="font-mono text-xs font-semibold text-foreground">
                      Version v{v.version_number}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground block">
                      Uploaded at: {new Date(v.created_at).toLocaleString()}
                    </span>
                    {v.id === thesis.current_version_id && (
                      <span className="font-mono text-[9px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 mt-1 inline-block uppercase rounded-sm">
                        Active current version
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------- TAB CONTENT: CITATIONS -------------------- */}
        <TabsContent value="citations" className="flex-1 p-6 space-y-6 max-w-6xl mx-auto w-full">
          <Card className="border-border bg-[#FAF9F6]">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-serif text-sm font-semibold uppercase tracking-wider font-mono">
                  CITATION VERIFICATION MODULE
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Verifies if in-text citations matches bibliography and claims align with actual cited sources.
                </CardDescription>
              </div>
              {isOwner && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="font-mono text-xs gap-1 border-border"
                  onClick={() => triggerReviewMutation.mutate({ tool: "citation_verification" })}
                  disabled={triggerReviewMutation.isPending}
                >
                  <RefreshCw className="h-3 w-3" /> RE-VERIFY CITATIONS
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard?.citation_summary && (
                <div className="grid grid-cols-3 gap-4 border border-border p-3 bg-muted/10 font-mono text-xs mb-4">
                  <div className="text-center">
                    <span className="text-muted-foreground block text-[9px] uppercase">Total Citations</span>
                    <span className="text-sm font-semibold">{dashboard.citation_summary.total}</span>
                  </div>
                  <div className="text-center border-x border-border/50">
                    <span className="text-severity-ok block text-[9px] uppercase">Verified</span>
                    <span className="text-sm font-semibold text-severity-ok">{dashboard.citation_summary.verified}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-severity-critical block text-[9px] uppercase">Flagged</span>
                    <span className="text-sm font-semibold text-severity-critical">{dashboard.citation_summary.flagged}</span>
                  </div>
                </div>
              )}

              {/* Citations List */}
              {dashboard?.citation_flags && dashboard.citation_flags.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.citation_flags.map((flag: any) => (
                    <FlagCard 
                      key={flag.id} 
                      thesisId={id} 
                      flag={{ ...flag, type: "citation" }} 
                      currentUser={user} 
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic font-mono text-center py-6">
                  No citation issues flagged for this version. Clean bibliography match!
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------- TAB CONTENT: QUALITY REVIEW -------------------- */}
        <TabsContent value="quality" className="flex-1 p-6 space-y-6 max-w-6xl mx-auto w-full">
          <Card className="border-border bg-[#FAF9F6]">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-serif text-sm font-semibold uppercase tracking-wider font-mono">
                  ACADEMIC QUALITY ASSESSMENT
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Evaluates draft structure, methodology validity, and semantic clarity using RAG guidelines.
                </CardDescription>
              </div>
              {isOwner && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="font-mono text-xs gap-1 border-border"
                  onClick={() => triggerReviewMutation.mutate({ tool: "quality_review" })}
                  disabled={triggerReviewMutation.isPending}
                >
                  <RefreshCw className="h-3 w-3" /> RE-EVALUATE QUALITY
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {dashboard?.quality_flags && dashboard.quality_flags.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.quality_flags.map((flag: any) => (
                    <FlagCard 
                      key={flag.id} 
                      thesisId={id} 
                      flag={{ ...flag, type: "quality" }} 
                      currentUser={user} 
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic font-mono text-center py-6">
                  No major quality or coherence issues flagged. Draft meets structural requirements.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------- TAB CONTENT: INTEGRITY -------------------- */}
        <TabsContent value="integrity" className="flex-1 p-6 space-y-6 max-w-6xl mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Plagiarism Monitor */}
            <Card className="border-border bg-[#FAF9F6]">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-serif text-sm font-semibold uppercase tracking-wider font-mono">
                    PLAGIARISM CHECK
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Verifies vector similarity matches against internal thesis database.
                  </CardDescription>
                </div>
                {isOwner && (
                  <Button 
                    size="xs" 
                    variant="outline" 
                    className="font-mono text-[10px] h-7 px-1.5 border-border"
                    onClick={() => triggerReviewMutation.mutate({ tool: "plagiarism_monitor" })}
                    disabled={triggerReviewMutation.isPending}
                  >
                    RUN CHECK
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard?.plagiarism_flags && dashboard.plagiarism_flags.length > 0 ? (
                  <div className="space-y-3">
                    {dashboard.plagiarism_flags.map((flag: any) => (
                      <FlagCard 
                        key={flag.id} 
                        thesisId={id} 
                        flag={{ ...flag, type: "plagiarism" }} 
                        currentUser={user} 
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic font-mono text-center py-6">
                    No plagiarism matches found above threshold.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Novelty Detection */}
            <Card className="border-border bg-[#FAF9F6]">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-serif text-sm font-semibold uppercase tracking-wider font-mono">
                    NOVELTY AUDIT
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Evaluates thesis claims against external scientific literature.
                  </CardDescription>
                </div>
                {isOwner && (
                  <Button 
                    size="xs" 
                    variant="outline" 
                    className="font-mono text-[10px] h-7 px-1.5 border-border"
                    onClick={() => triggerReviewMutation.mutate({ tool: "novelty_detection" })}
                    disabled={triggerReviewMutation.isPending}
                  >
                    RUN AUDIT
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard?.novelty_flags && dashboard.novelty_flags.length > 0 ? (
                  <div className="space-y-3">
                    {dashboard.novelty_flags.map((flag: any) => (
                      <FlagCard 
                        key={flag.id} 
                        thesisId={id} 
                        flag={{ ...flag, type: "novelty" }} 
                        currentUser={user} 
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic font-mono text-center py-6">
                    All core contribution claims are evaluated as sufficiently novel.
                  </p>
                )}
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        {/* -------------------- TAB CONTENT: LITERATURE REVIEW -------------------- */}
        <TabsContent value="literature" className="flex-1 p-6 space-y-6 max-w-6xl mx-auto w-full">
          <Card className="border-border bg-[#FAF9F6]">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-serif text-sm font-semibold uppercase tracking-wider font-mono">
                  LITERATURE DRAFTING ASSISTANT
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Greedy semantic clustering of cached external papers with automatic Claude synthesis drafts.
                </CardDescription>
              </div>
              {isOwner && (
                <Button 
                  size="sm" 
                  className="font-mono text-xs gap-1"
                  onClick={() => triggerReviewMutation.mutate({ tool: "literature_review" })}
                  disabled={triggerReviewMutation.isPending}
                >
                  <RefreshCw className="h-3 w-3" /> COMPILE LITERATURE REVIEW
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {dashboard?.literature_clusters && dashboard.literature_clusters.length > 0 ? (
                <div className="space-y-6">
                  {dashboard.literature_clusters.map((cluster: any, idx: number) => (
                    <Card key={idx} className="border-border bg-[#FAF9F6]">
                      <CardHeader className="pb-2 bg-muted/20">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground block">
                          CLUSTER #{idx + 1}
                        </span>
                        <CardTitle className="font-serif text-sm font-semibold text-foreground">
                          Theme: {cluster.theme_label}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-4">
                        {/* Clustered Papers */}
                        <div className="space-y-2">
                          <span className="font-mono text-[9px] uppercase text-muted-foreground tracking-wider block">
                            Associated Literature:
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {cluster.papers?.map((paper: any, pIdx: number) => (
                              <div key={pIdx} className="border border-border/60 p-2.5 bg-muted/5 font-mono text-[11px]">
                                <span className="font-sans font-medium text-foreground block">{paper.title}</span>
                                <span className="text-[10px] text-muted-foreground">DOI: {paper.doi || "N/A"}</span>
                                {paper.abstract && (
                                  <p className="text-[10px] text-muted-foreground/80 mt-1 line-clamp-2 italic">
                                    "{paper.abstract}"
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Synthesis Paragraph */}
                        <div className="space-y-1">
                          <span className="font-mono text-[9px] uppercase text-primary tracking-wider block">
                            Claude Synthesis Draft:
                          </span>
                          <p className="font-sans text-xs text-foreground/90 leading-relaxed bg-primary/5 p-3 border border-primary/10">
                            {cluster.synthesis_paragraph}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-border p-12 text-center text-xs text-muted-foreground bg-muted/10 font-mono">
                  No synthesized literature review compiled. Click the button above to execute greedy semantic clustering.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------- TAB CONTENT: REVIEWER SIM -------------------- */}
        <TabsContent value="viva" className="flex-1 p-6 space-y-6 max-w-6xl mx-auto w-full">
          {/* STUDENT: Practice Chat Console */}
          {!isTeacher && (
            <Card className="border-border bg-[#FAF9F6] flex flex-col h-[500px]">
              <CardHeader className="border-b border-border/40 pb-3 flex flex-row items-center justify-between bg-[#FAF9F6]">
                <div>
                  <CardTitle className="font-serif text-sm font-semibold uppercase tracking-wider font-mono">
                    VIVA PRACTICE EXAMINER SIMULATOR
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Defend your thesis in a turn-by-turn chat. Claude acts as a rigorous examiner targeting your flagged weaknesses.
                  </CardDescription>
                </div>
                {!currentSessionId && (
                  <Button 
                    size="sm" 
                    className="font-mono text-xs gap-1"
                    onClick={() => createVivaSession.mutate()}
                    disabled={createVivaSession.isPending}
                  >
                    <Play className="h-3.5 w-3.5" /> INITIATE VIVA SIM
                  </Button>
                )}
              </CardHeader>
              
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/5">
                {currentSessionId ? (
                  <>
                    <div className="text-center font-mono text-[10px] text-muted-foreground uppercase py-1 border-b border-border/30">
                      Practice session active. Examiner is ready.
                    </div>
                    {chatHistory.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex gap-3 max-w-[85%] ${
                          msg.role === "student" ? "ml-auto flex-row-reverse" : "mr-auto"
                        }`}
                      >
                        <Avatar className="h-7 w-7 border border-border">
                          <AvatarFallback className="text-[10px] font-mono">
                            {msg.role === "student" ? "ST" : "EX"}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={`p-3 text-xs leading-relaxed ${
                            msg.role === "student"
                              ? "bg-primary text-primary-foreground"
                              : "bg-[#FAF9F6] border border-border text-foreground"
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    <div ref={chatBottomRef} />
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <HelpCircle className="h-8 w-8 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground font-mono max-w-sm">
                      Initialize the Viva Simulator. Claude will read your version, look at all citation, quality, and novelty flags, and start asking probing questions.
                    </p>
                  </div>
                )}
              </CardContent>

              {currentSessionId && (
                <CardFooter className="border-t border-border/40 p-3 flex gap-2 bg-[#FAF9F6]">
                  <Input
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Type your defense statement..."
                    className="flex-1 bg-[#FAF9F6] border-border text-xs focus-visible:ring-primary"
                    onKeyDown={(e) => e.key === "Enter" && sendVivaMessage()}
                    disabled={isChatSending}
                  />
                  <Button size="sm" onClick={sendVivaMessage} disabled={isChatSending || !chatMessage.trim()} className="font-mono text-xs gap-1">
                    <Send className="h-3 w-3" /> SEND
                  </Button>
                </CardFooter>
              )}
            </Card>
          )}

          {/* TEACHER: One-shot Report view */}
          {isTeacher && (
            <Card className="border-border bg-[#FAF9F6]">
              <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-serif text-sm font-semibold uppercase tracking-wider font-mono">
                    MOCK EXTERNAL EXAMINER REPORT
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Simulates a structured assessment report to assist in preparing the student for defense.
                  </CardDescription>
                </div>
                <Button 
                  size="sm" 
                  className="font-mono text-xs gap-1"
                  onClick={() => triggerReviewMutation.mutate({ tool: "reviewer_simulation" })}
                  disabled={triggerReviewMutation.isPending}
                >
                  <RefreshCw className="h-3 w-3" /> COMPILE MOCK REPORT
                </Button>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {dashboard?.reviewer_report ? (
                  <div className="space-y-6">
                    {/* Overall Assessment */}
                    <div className="space-y-2">
                      <span className="font-mono text-[10px] uppercase text-primary tracking-wider block">
                        I. OVERALL ASSESSMENT
                      </span>
                      <p className="font-sans text-xs text-foreground/90 leading-relaxed p-3 bg-muted/10 border border-border">
                        {dashboard.reviewer_report.assessment}
                      </p>
                    </div>

                    {/* Strengths */}
                    <div className="space-y-2">
                      <span className="font-mono text-[10px] uppercase text-primary tracking-wider block">
                        II. ACADEMIC STRENGTHS
                      </span>
                      <ul className="list-disc pl-5 text-xs text-foreground/90 space-y-1.5">
                        {dashboard.reviewer_report.strengths?.map((str: string, sIdx: number) => (
                          <li key={sIdx}>{str}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Weaknesses linked to Flags */}
                    <div className="space-y-2">
                      <span className="font-mono text-[10px] uppercase text-primary tracking-wider block">
                        III. IDENTIFIED WEAKNESSES
                      </span>
                      {dashboard.reviewer_report.weaknesses && dashboard.reviewer_report.weaknesses.length > 0 ? (
                        <div className="space-y-3">
                          {dashboard.reviewer_report.weaknesses.map((weakness: any, wIdx: number) => (
                            <FlagCard
                              key={wIdx}
                              thesisId={id}
                              flag={{
                                id: weakness.referenced_flag_id || `weakness-${wIdx}`,
                                type: "quality",
                                severity: "moderate",
                                message: weakness.weakness_text,
                                evidence_excerpt: weakness.evidence_excerpt,
                                resolved: false,
                                reasoning: weakness.recommended_action
                              }}
                              currentUser={user}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic font-mono">No specific weaknesses evaluated.</p>
                      )}
                    </div>

                    {/* Suggested Viva Questions */}
                    <div className="space-y-2">
                      <span className="font-mono text-[10px] uppercase text-primary tracking-wider block">
                        IV. SUGGESTED VIVA DEFENSE QUESTIONS
                      </span>
                      <div className="divide-y divide-border/40 border border-border">
                        {dashboard.reviewer_report.suggested_questions?.map((q: string, qIdx: number) => (
                          <div key={qIdx} className="p-3 bg-muted/5 text-xs font-serif leading-relaxed">
                            {qIdx + 1}. {q}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-border p-12 text-center text-xs text-muted-foreground bg-muted/10 font-mono">
                    No mock report generated. Click "Compile Mock Report" above to trigger evaluation.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}

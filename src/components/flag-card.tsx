"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, ShieldAlert, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface FlagCardProps {
  thesisId: string;
  flag: {
    id: string;
    type: string; // 'quality' | 'citation' | 'plagiarism' | 'novelty'
    severity: string; // 'critical' | 'moderate' | 'low'
    message: string;
    evidence_excerpt?: string;
    resolved: boolean;
    resolved_by?: string;
    reasoning?: string;
  };
  currentUser: {
    id: string;
    role: string; // 'student' | 'teacher' | 'admin'
  } | null;
}

// Map flag type to permission feature name for client-side capability checking
const FLAG_TYPE_TO_FEATURE = {
  citation: "citation_verification",
  plagiarism: "plagiarism_monitor",
  quality: "quality_review",
  novelty: "novelty_detection",
};

// Check if user has FULL access required to resolve this flag type
function canResolve(role: string | undefined, flagType: string): boolean {
  if (!role || role === "student") return false;
  if (role === "admin") return true;
  
  // Teachers (advisors) can resolve plagiarism, quality, novelty, but NOT citations
  if (role === "teacher") {
    if (flagType === "citation") return false;
    return true; 
  }
  return false;
}

export function FlagCard({ thesisId, flag, currentUser }: FlagCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const queryClient = useQueryClient();

  const severityColors = {
    critical: "text-severity-critical border-severity-critical/20 bg-severity-critical/5",
    moderate: "text-severity-moderate border-severity-moderate/20 bg-severity-moderate/5",
    low: "text-severity-ok border-severity-ok/20 bg-severity-ok/5",
  };

  const severityIcons = {
    critical: <ShieldAlert className="h-4 w-4 text-severity-critical" />,
    moderate: <AlertTriangle className="h-4 w-4 text-severity-moderate" />,
    low: <CheckCircle className="h-4 w-4 text-severity-ok" />,
  };

  const resolveMutation = useMutation({
    mutationFn: ({ resolve }: { resolve: boolean }) =>
      api.resolveFlag(thesisId, flag.id, resolve),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["thesis", thesisId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", thesisId] });
      toast.success(data.resolved ? "Flag resolved successfully" : "Flag reopened");
    },
    onError: (err: any) => {
      toast.error(`Failed to update flag: ${err.message}`);
    },
  });

  const userCanResolve = canResolve(currentUser?.role, flag.type);

  return (
    <div
      className={cn(
        "border border-border bg-[#FAF9F6] transition-all duration-200 overflow-hidden",
        flag.resolved && "opacity-60 bg-muted/20"
      )}
    >
      {/* Collapsed Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/20"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {severityIcons[flag.severity as keyof typeof severityIcons] || (
            <AlertTriangle className="h-4 w-4" />
          )}
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            [{flag.type}]
          </span>
          <span className="font-serif text-sm font-medium text-foreground">
            {flag.message}
          </span>
          {flag.resolved && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-severity-ok bg-severity-ok/10 px-2 py-0.5 rounded-sm">
              <Award className="h-3 w-3" /> Resolved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border",
            severityColors[flag.severity as keyof typeof severityColors]
          )}>
            {flag.severity}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/50 bg-[#FAF9F6]">
          {/* Quoted Evidence Excerpt (indented blockquote style) */}
          {flag.evidence_excerpt && (
            <div className="my-3 pl-3 border-l-2 border-primary/40">
              <blockquote className="font-mono text-xs text-muted-foreground italic leading-relaxed whitespace-pre-wrap">
                "{flag.evidence_excerpt}"
              </blockquote>
            </div>
          )}

          {/* Reasoning / Explanation */}
          {flag.reasoning && (
            <div className="mt-2 text-xs text-foreground/80 leading-relaxed">
              <span className="font-mono text-[10px] text-muted-foreground block uppercase tracking-wider">
                Reasoning:
              </span>
              {flag.reasoning}
            </div>
          )}

          {/* Action Row */}
          <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-3">
            <span className="font-mono text-[9px] text-muted-foreground">
              FLAG ID: {flag.id}
            </span>
            {userCanResolve && (
              <Button
                variant={flag.resolved ? "outline" : "default"}
                size="sm"
                className="font-mono text-xs"
                disabled={resolveMutation.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  resolveMutation.mutate({ resolve: !flag.resolved });
                }}
              >
                {flag.resolved ? "Reopen Flag" : "Dismiss / Resolve"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

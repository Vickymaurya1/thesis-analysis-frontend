"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [isLoading, setIsLoading] = useState(false);
  
  // Field-specific validation errors from backend (422/400)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setFieldErrors({});
    setGeneralError(null);

    const formData = new FormData(e.currentTarget);
    const payload: Record<string, any> = {
      email: formData.get("email"),
      password: formData.get("password"),
      name: formData.get("name"),
      role: role,
      university: formData.get("university"),
      department: formData.get("department"),
    };

    if (role === "student") {
      payload.degree = formData.get("degree");
      payload.field_of_study = formData.get("field_of_study");
      payload.advisor_email = formData.get("advisor_email") || undefined;
    } else {
      payload.designation = formData.get("designation");
    }

    // Client-side quick checks
    const errors: Record<string, string> = {};
    if (!payload.email) errors.email = "Email is required";
    if (!payload.password) errors.password = "Password is required";
    if (!payload.name) errors.name = "Name is required";
    if (!payload.university) errors.university = "University is required";
    if (!payload.department) errors.department = "Department is required";
    
    if (role === "student") {
      if (!payload.degree) errors.degree = "Degree is required for students";
      if (!payload.field_of_study) errors.field_of_study = "Field of study is required for students";
    } else {
      if (!payload.designation) errors.designation = "Designation is required for teachers";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setIsLoading(false);
      return;
    }

    try {
      await api.register(payload);
      toast.success("Registration successful! Please log in.");
      router.push("/login");
    } catch (err: any) {
      const msg = err.message || "";
      // Map common error response structures
      if (msg.toLowerCase().includes("email") && msg.toLowerCase().includes("registered")) {
        setFieldErrors({ email: "This email is already registered." });
      } else if (msg.toLowerCase().includes("degree")) {
        setFieldErrors({ degree: "Degree is required." });
      } else if (msg.toLowerCase().includes("field_of_study")) {
        setFieldErrors({ field_of_study: "Field of study is required." });
      } else if (msg.toLowerCase().includes("designation")) {
        setFieldErrors({ designation: "Designation is required." });
      } else {
        setGeneralError(msg || "Registration failed. Please check your inputs.");
      }
      toast.error("Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6] p-4">
      <Card className="w-full max-w-lg border-border bg-[#FAF9F6]">
        <CardHeader className="space-y-1">
          <CardTitle className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            Register Account
          </CardTitle>
          <CardDescription className="font-sans text-xs text-muted-foreground">
            Create a secure profile on the research verification network.
          </CardDescription>
        </CardHeader>
        
        {/* Role Toggle at the top */}
        <div className="px-6 flex gap-2">
          <Button
            type="button"
            variant={role === "student" ? "default" : "outline"}
            size="sm"
            className="flex-1 font-mono text-xs"
            onClick={() => {
              setRole("student");
              setFieldErrors({});
            }}
          >
            STUDENT USER
          </Button>
          <Button
            type="button"
            variant={role === "teacher" ? "default" : "outline"}
            size="sm"
            className="flex-1 font-mono text-xs"
            onClick={() => {
              setRole("teacher");
              setFieldErrors({});
            }}
          >
            TEACHER / ADVISOR
          </Button>
        </div>

        <form onSubmit={handleRegister} className="mt-4">
          <CardContent className="space-y-4">
            {generalError && (
              <div className="bg-severity-critical/10 border border-severity-critical/20 p-3 text-xs text-severity-critical font-mono">
                {generalError}
              </div>
            )}

            {/* Base Fields (Shared) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Email Address
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  className="bg-[#FAF9F6] border-border text-foreground font-sans focus-visible:ring-primary"
                  placeholder="name@university.edu"
                />
                {fieldErrors.email && (
                  <p className="text-[11px] font-mono text-severity-critical mt-1">{fieldErrors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  className="bg-[#FAF9F6] border-border text-foreground font-sans focus-visible:ring-primary"
                />
                {fieldErrors.password && (
                  <p className="text-[11px] font-mono text-severity-critical mt-1">{fieldErrors.password}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Full Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  className="bg-[#FAF9F6] border-border text-foreground font-sans focus-visible:ring-primary"
                  placeholder="Dr. John Doe or Jane Smith"
                />
                {fieldErrors.name && (
                  <p className="text-[11px] font-mono text-severity-critical mt-1">{fieldErrors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="university" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  University / Institution
                </Label>
                <Input
                  id="university"
                  name="university"
                  type="text"
                  maxLength={100}
                  className="bg-[#FAF9F6] border-border text-foreground font-sans focus-visible:ring-primary"
                  placeholder="MIT, Stanford, etc."
                />
                {fieldErrors.university && (
                  <p className="text-[11px] font-mono text-severity-critical mt-1">{fieldErrors.university}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Department
              </Label>
              <Input
                id="department"
                name="department"
                type="text"
                maxLength={100}
                className="bg-[#FAF9F6] border-border text-foreground font-sans focus-visible:ring-primary"
                placeholder="Computer Science, Physics, etc."
              />
              {fieldErrors.department && (
                <p className="text-[11px] font-mono text-severity-critical mt-1">{fieldErrors.department}</p>
              )}
            </div>

            {/* Role Conditional Fields (Student) */}
            {role === "student" && (
              <div className="space-y-4 pt-2 border-t border-border/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="degree" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Degree Program
                    </Label>
                    <Input
                      id="degree"
                      name="degree"
                      type="text"
                      maxLength={100}
                      className="bg-[#FAF9F6] border-border text-foreground font-sans focus-visible:ring-primary"
                      placeholder="MTech, MS, PhD, etc."
                    />
                    {fieldErrors.degree && (
                      <p className="text-[11px] font-mono text-severity-critical mt-1">{fieldErrors.degree}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="field_of_study" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Field of Study
                    </Label>
                    <Input
                      id="field_of_study"
                      name="field_of_study"
                      type="text"
                      maxLength={100}
                      className="bg-[#FAF9F6] border-border text-foreground font-sans focus-visible:ring-primary"
                      placeholder="Natural Language Processing, etc."
                    />
                    {fieldErrors.field_of_study && (
                      <p className="text-[11px] font-mono text-severity-critical mt-1">{fieldErrors.field_of_study}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="advisor_email" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Advisor / Supervisor Email (Optional)
                  </Label>
                  <Input
                    id="advisor_email"
                    name="advisor_email"
                    type="email"
                    className="bg-[#FAF9F6] border-border text-foreground font-sans focus-visible:ring-primary"
                    placeholder="advisor@university.edu"
                  />
                </div>
              </div>
            )}

            {/* Role Conditional Fields (Teacher) */}
            {role === "teacher" && (
              <div className="space-y-4 pt-2 border-t border-border/50">
                <div className="space-y-2">
                  <Label htmlFor="designation" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Designation / Title
                  </Label>
                  <Input
                    id="designation"
                    name="designation"
                    type="text"
                    maxLength={100}
                    className="bg-[#FAF9F6] border-border text-foreground font-sans focus-visible:ring-primary"
                    placeholder="Professor, Associate Professor, etc."
                  />
                  {fieldErrors.designation && (
                    <p className="text-[11px] font-mono text-severity-critical mt-1">{fieldErrors.designation}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" disabled={isLoading} className="w-full font-mono text-xs">
              {isLoading ? "CREATING PROFILE..." : "CREATE ACCOUNT"}
            </Button>
            <div className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline font-mono">
                Log in here
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

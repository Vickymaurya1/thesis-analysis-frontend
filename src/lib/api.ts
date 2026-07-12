const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Helper to make fetch requests with cookie credentials and standard JSON handling
async function request(path: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${path}`;
  
  // Set default headers
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Check if we have a token stored in localStorage/memory as a fallback for SSR or Dev
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("auth_token");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // Essential for HttpOnly cookie propagation
  });

  if (!response.ok) {
    let errorDetail = "An error occurred";
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {
      errorDetail = response.statusText || errorDetail;
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  // Auth
  register: (payload: any) => request("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  
  login: async (form: FormData) => {
    // OAuth2PasswordRequestForm expects URLSearchParams form-data
    const params = new URLSearchParams();
    form.forEach((value, key) => {
      params.append(key, value as string);
    });

    const data = await request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    // Save token to localStorage as a client-side fallback (backend sets httpOnly cookie too)
    if (data && data.access_token) {
      localStorage.setItem("auth_token", data.access_token);
    }
    return data;
  },

  logout: () => {
    localStorage.removeItem("auth_token");
    // Clear cookies by setting max-age to 0 (client-side trigger)
    document.cookie = "access_token=; Path=/; Max-Age=0;";
  },

  getMe: () => request("/auth/me"),

  // Advisor Links
  getPendingLinks: () => request("/links/pending"),
  acceptLink: (linkId: string, thesisId?: string) => {
    const path = thesisId ? `/links/${linkId}/accept?thesis_id=${thesisId}` : `/links/${linkId}/accept`;
    return request(path, { method: "POST" });
  },

  // Theses CRUD
  listTheses: () => request("/theses"),
  createThesis: (payload: { title: string }) => request("/theses", { method: "POST", body: JSON.stringify(payload) }),
  getThesis: (id: string) => request(`/theses/${id}`),
  updateThesisStatus: (id: string, status: string) => 
    request(`/theses/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),

  // Version Upload
  uploadThesisVersion: (thesisId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/theses/${thesisId}/versions`, {
      method: "POST",
      body: formData,
    });
  },

  // Dashboard Aggregator
  getDashboard: (id: string) => request(`/theses/${id}/dashboard`),

  // Specific Tool triggers
  triggerQualityReview: (id: string) => request(`/theses/${id}/quality-review/trigger`, { method: "POST" }),
  triggerPlagiarismReview: (id: string) => request(`/theses/${id}/plagiarism/trigger`, { method: "POST" }),
  triggerNoveltyReview: (id: string) => request(`/theses/${id}/novelty/trigger`, { method: "POST" }),
  triggerLiteratureReview: (id: string) => request(`/theses/${id}/literature-review/draft`, { method: "POST" }),
  triggerReviewerReport: (id: string) => request(`/theses/${id}/reviewer-sim/report`, { method: "POST" }),
  triggerCitationVerification: (id: string) => request(`/theses/${id}/citations/trigger`, { method: "POST" }),

  // Flag Resolution
  resolveFlag: (thesisId: string, flagId: string, resolve: boolean) => 
    request(`/theses/${thesisId}/flags/${flagId}/resolve?resolve=${resolve}`, { method: "POST" }),

  // Reviewer Simulation practice viva
  createReviewerSimSession: (thesisId: string) => 
    request(`/theses/${thesisId}/reviewer-sim/session`, { 
      method: "POST",
      body: JSON.stringify({ mode: "student_practice" }),
    }),
  sendReviewerSimMessage: (thesisId: string, sessionId: string, message: string) => 
    request(`/theses/${thesisId}/reviewer-sim/session/${sessionId}/message`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  // Notifications
  getNotifications: (unreadOnly = false) => request(`/notifications?unread=${unreadOnly}`),
};

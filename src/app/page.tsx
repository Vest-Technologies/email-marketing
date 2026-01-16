"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Zap,
  LayoutDashboard,
  Search,
  FileText,
  Users,
  RefreshCw,
  Loader2,
  Building2,
  CheckCircle2,
  Send,
  LogOut
} from "lucide-react";

import { PipelineStats } from "@/components/pipeline/pipeline-stats";
import { CompanyCard } from "@/components/pipeline/company-card";
import { BatchActionBar } from "@/components/pipeline/batch-action-bar";
import { DeleteConfirmationDialog } from "@/components/pipeline/delete-confirmation-dialog";
import { SendConfirmationDialog } from "@/components/pipeline/send-confirmation-dialog";
import { EmailReviewModal } from "@/components/pipeline/email-review-modal";
import { PromptEditor } from "@/components/pipeline/prompt-editor";
import { CompanySearch } from "@/components/apollo/company-search";
import { TargetTitleManager } from "@/components/settings/target-title-manager";
import { EmailSettings } from "@/components/settings/email-settings";
import { PIPELINE_STATES, DEFAULT_SYSTEM_PROMPT } from "@/lib/constants";

type Company = {
  id: string;
  name: string;
  domain: string;
  website?: string | null;
  industry?: string | null;
  location?: string | null;
  employeeCount?: number | null;
  pipelineState: string;
  // Target contact info
  targetContactFirstName?: string | null;
  targetContactLastName?: string | null;
  targetContactEmail?: string | null;
  targetContactTitle?: string | null;
  notGeneratedReason?: any;
  email?: {
    id: string;
    subject: string;
    body: string;
    editedSubject?: string | null;
    editedBody?: string | null;
    finalSubject?: string | null;
    finalBody?: string | null;
    sentTo?: string | null;
  } | null;
};

export default function Dashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("titles");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };
  const [activeState, setActiveState] = useState<string | null>(null);

  // Restore activeTab from localStorage after hydration
  useEffect(() => {
    const savedTab = localStorage.getItem("activeTab");
    if (savedTab) {
      setActiveTab(savedTab);
    }
  }, []);

  // Persist activeTab to localStorage
  useEffect(() => {
    localStorage.setItem("activeTab", activeTab);
  }, [activeTab]);
  const [reviewingCompany, setReviewingCompany] = useState<Company | null>(null);
  const [customPrompt, setCustomPrompt] = useState(DEFAULT_SYSTEM_PROMPT);

  // Selection state for batch operations
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);

  // Send confirmation dialog state
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendingCompany, setSendingCompany] = useState<Company | null>(null);

  // Clear selection when switching pipeline states
  useEffect(() => {
    setSelectedCompanyIds(new Set());
  }, [activeState]);

  // Selection helpers
  const toggleSelection = (companyId: string) => {
    setSelectedCompanyIds(prev => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  };

  const selectAll = () => {
    const allIds = companies.map(c => c.id);
    setSelectedCompanyIds(new Set(allIds));
  };

  const clearSelection = () => {
    setSelectedCompanyIds(new Set());
  };

  // Fetch pipeline stats
  const { data: statsData, refetch: refetchStats } = useQuery({
    queryKey: ["pipeline-stats"],
    queryFn: async () => {
      const res = await fetch("/api/pipeline/stats");
      return res.json();
    },
    staleTime: 0, // Always fetch fresh data
  });

  // Fetch companies by state
  const { data: companiesData, refetch: refetchCompanies, isLoading: isLoadingCompanies } = useQuery({
    queryKey: ["companies", activeState],
    queryFn: async () => {
      if (!activeState) return { companies: [] };
      const url = new URL("/api/pipeline/companies", window.location.origin);
      url.searchParams.set("state", activeState);
      const res = await fetch(url);
      return res.json();
    },
    enabled: !!activeState,
    staleTime: 0, // Always fetch fresh data when switching tabs
  });

  // Save review mutation
  const saveReviewMutation = useMutation({
    mutationFn: async ({ emailId, subject, body, recipientEmail }: { emailId: string; subject: string; body: string; recipientEmail?: string }) => {
      const res = await fetch(`/api/emails/${emailId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedSubject: subject, editedBody: body, recipientEmail }),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => {
      refetchCompanies();
    },
  });

  // Approve email mutation
  const approveMutation = useMutation({
    mutationFn: async ({ emailId, subject, body }: { emailId: string; subject?: string; body?: string }) => {
      // First save if there are edits
      if (subject && body) {
        await fetch(`/api/emails/${emailId}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ editedSubject: subject, editedBody: body }),
        });
      }

      const res = await fetch(`/api/emails/${emailId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Approve failed");
      return res.json();
    },
    onSuccess: () => {
      refetchCompanies();
      refetchStats();
    },
  });

  // Regenerate email mutation
  const regenerateEmailMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const res = await fetch(`/api/companies/${companyId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPrompt }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Email yeniden oluşturulamadı");
      }
      return data;
    },
    onSuccess: () => {
      refetchCompanies();
      refetchStats();
    },
  });

  // Retry email generation (for email_not_generated state)
  const retryEmailMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const res = await fetch(`/api/companies/${companyId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPrompt }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Email oluşturulamadı");
      }
      return data;
    },
    onSuccess: () => {
      refetchCompanies();
      refetchStats();
    },
  });

  // Reset company to pending_generation
  const resetCompanyMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineState: PIPELINE_STATES.PENDING_GENERATION,
          notGeneratedReason: null,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Şirket sıfırlanamadı");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchCompanies();
      refetchStats();
    },
  });

  // Send email mutation
  const sendMutation = useMutation({
    mutationFn: async ({ emailId, recipientEmail, senderEmail }: { emailId: string; recipientEmail: string; senderEmail?: string }) => {
      const res = await fetch(`/api/emails/${emailId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail, senderEmail }),
      });
      if (!res.ok) throw new Error("Send failed");
      return res.json();
    },
    onSuccess: () => {
      refetchCompanies();
      refetchStats();
    },
  });

  // Find contact mutation
  const findContactMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const res = await fetch(`/api/companies/${companyId}/find-contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Kişi bulunamadı");
      }
      return data;
    },
    onSuccess: () => {
      refetchCompanies();
      refetchStats();
    },
    onError: (error: Error) => {
      console.error("Find contact error:", error);
      // Error will be shown in UI via mutation state
    },
  });

  // Import companies mutation (now auto-generates emails)
  const importMutation = useMutation({
    mutationFn: async ({ companies }: { companies: unknown[] }) => {
      const res = await fetch("/api/companies/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companies,
          customPrompt: customPrompt !== DEFAULT_SYSTEM_PROMPT ? customPrompt : undefined,
        }),
      });
      if (!res.ok) throw new Error("Import failed");
      return res.json();
    },
    onSuccess: () => {
      // Switch to Pipeline tab and show Generated state
      setActiveTab("dashboard");
      setActiveState(PIPELINE_STATES.PENDING_REVIEW);
      refetchStats();
      // Invalidate and refetch companies query - it will auto-refetch when activeState changes
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });

  // Batch approve mutation
  const batchApproveMutation = useMutation({
    mutationFn: async (companyIds: string[]) => {
      const res = await fetch("/api/pipeline/batch-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Toplu onaylama başarısız");
      }
      return res.json();
    },
    onSuccess: (data) => {
      clearSelection();
      refetchStats();
      refetchCompanies();
      // Auto-navigate to approved_to_send if any were approved
      if (data.approved > 0) {
        setActiveState(PIPELINE_STATES.APPROVED_TO_SEND);
      }
    },
  });

  // Batch delete mutation
  const batchDeleteMutation = useMutation({
    mutationFn: async ({ companyIds, alsoDeleteFromFetched }: { companyIds: string[]; alsoDeleteFromFetched: boolean }) => {
      const res = await fetch("/api/pipeline/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds, alsoDeleteFromFetched }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Toplu silme başarısız");
      }
      return res.json();
    },
    onSuccess: () => {
      clearSelection();
      setDeleteDialogOpen(false);
      setDeleteTargetIds([]);
      refetchStats();
      refetchCompanies();
    },
  });

  // Batch send mutation
  const batchSendMutation = useMutation({
    mutationFn: async (companyIds: string[]) => {
      const res = await fetch("/api/pipeline/batch-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Toplu gönderim başarısız");
      }
      return res.json();
    },
    onSuccess: (data) => {
      clearSelection();
      refetchStats();
      refetchCompanies();
      // Auto-navigate to sent if any were sent
      if (data.sent > 0) {
        setActiveState(PIPELINE_STATES.SENT);
      }
    },
  });

  // Batch retry mutation
  const batchRetryMutation = useMutation({
    mutationFn: async (companyIds: string[]) => {
      const res = await fetch("/api/pipeline/batch-retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds, customPrompt }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Toplu yeniden deneme başarısız");
      }
      return res.json();
    },
    onSuccess: (data) => {
      clearSelection();
      refetchStats();
      refetchCompanies();
      // Auto-navigate to pending_review if any were generated
      if (data.generated > 0) {
        setActiveState(PIPELINE_STATES.PENDING_REVIEW);
      }
    },
  });

  const stats = statsData?.stats || {
    total: 0,
    byState: {
      email_not_generated: 0,
      pending_review: 0,
      approved_to_send: 0,
      sent: 0,
    },
  };

  const companies: Company[] = companiesData?.companies || [];

  const handleStateClick = (state: string) => {
    setActiveState(state === activeState ? null : state);
  };

  const handleRefresh = () => {
    refetchStats();
    if (activeState) refetchCompanies();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Background Pattern */}
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
      <div className="fixed inset-0 bg-grid-pattern opacity-50 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">BrandVox</h1>
                <p className="text-xs text-muted-foreground">Email Automation</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-8">
            <TabsTrigger value="titles" className="gap-2">
              <Users className="h-4 w-4" />
              Ayarlar
            </TabsTrigger>
            <TabsTrigger value="prompts" className="gap-2">
              <FileText className="h-4 w-4" />
              Prompts
            </TabsTrigger>
            <TabsTrigger value="search" className="gap-2">
              <Search className="h-4 w-4" />
              Lead Search
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Pipeline
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-8 animate-fade-in">
            {/* Pipeline Stats */}
            <div className="space-y-4">
              <PipelineStats
                stats={stats}
                onStateClick={handleStateClick}
                activeState={activeState || undefined}
              />
            </div>

            {/* Companies Grid */}
            {activeState && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold">
                      {activeState.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </h2>
                    {companies.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={selectedCompanyIds.size === companies.length ? clearSelection : selectAll}
                      >
                        {selectedCompanyIds.size === companies.length ? "Seçimi Kaldır" : "Tümünü Seç"}
                      </Button>
                    )}
                  </div>
                  <Badge variant="secondary">
                    {selectedCompanyIds.size > 0
                      ? `${selectedCompanyIds.size} / ${companies.length} seçildi`
                      : `${companies.length} şirket`}
                  </Badge>
                </div>

                {isLoadingCompanies ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : companies.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        No companies in this state
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {companies.map((company) => (
                      <CompanyCard
                        key={company.id}
                        company={company}
                        isSelected={selectedCompanyIds.has(company.id)}
                        onSelect={toggleSelection}
                        onFindContact={async (id) => {
                          await findContactMutation.mutateAsync(id);
                        }}
                        onReview={(id) => {
                          const comp = companies.find(c => c.id === id);
                          if (comp) setReviewingCompany(comp);
                        }}
                        onApprove={async (id) => {
                          const comp = companies.find(c => c.id === id);
                          if (comp?.email) {
                            await approveMutation.mutateAsync({ emailId: comp.email.id });
                          }
                        }}
                        onSend={(id) => {
                          const comp = companies.find(c => c.id === id);
                          if (comp) {
                            setSendingCompany(comp);
                            setSendDialogOpen(true);
                          }
                        }}
                        onRetry={async (id) => {
                          await retryEmailMutation.mutateAsync(id);
                        }}
                        onReset={async (id) => {
                          await resetCompanyMutation.mutateAsync(id);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {!activeState && (
              <Card>
                <CardContent className="py-12 text-center">
                  <LayoutDashboard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Select a Pipeline State</h3>
                  <p className="text-muted-foreground">
                    Click on a state card above to view companies in that stage
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Lead Search Tab */}
          <TabsContent value="search" className="animate-fade-in">
            <CompanySearch
              onImport={async (companies) => {
                await importMutation.mutateAsync({ companies });
              }}
            />
          </TabsContent>

          {/* Prompts Tab */}
          <TabsContent value="prompts" className="animate-fade-in">
            <PromptEditor
              initialPrompt={customPrompt}
              onSave={async (prompt) => {
                setCustomPrompt(prompt);
              }}
            />
          </TabsContent>

          {/* Titles Tab */}
          <TabsContent value="titles" className="animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TargetTitleManager />
              <EmailSettings />
            </div>
          </TabsContent>

        </Tabs>
      </main>

      {/* Email Review Modal */}
      <EmailReviewModal
        isOpen={!!reviewingCompany}
        onClose={() => setReviewingCompany(null)}
        company={reviewingCompany}
        onSave={async (emailId, subject, body, recipientEmail) => {
          await saveReviewMutation.mutateAsync({ emailId, subject, body, recipientEmail });
        }}
        onApprove={async (emailId, subject, body) => {
          await approveMutation.mutateAsync({ emailId, subject, body });
        }}
        onSend={async (emailId: string, recipientEmail: string, senderEmail: string, subject: string, body: string) => {
          // First save any changes to the email
          await saveReviewMutation.mutateAsync({ emailId, subject, body, recipientEmail });
          // Then send the email
          await sendMutation.mutateAsync({ emailId, recipientEmail, senderEmail });
        }}
        onRegenerate={async (companyId: string) => {
          const wasApproved = reviewingCompany?.pipelineState === PIPELINE_STATES.APPROVED_TO_SEND;
          await regenerateEmailMutation.mutateAsync(companyId);
          // If regenerating from approved state, navigate to generated tab
          if (wasApproved) {
            setActiveState(PIPELINE_STATES.PENDING_REVIEW);
          }
        }}
      />

      {/* Send Confirmation Dialog */}
      <SendConfirmationDialog
        isOpen={sendDialogOpen}
        onClose={() => {
          setSendDialogOpen(false);
          setSendingCompany(null);
        }}
        company={sendingCompany}
        onConfirm={async (recipientEmail: string, senderEmail: string) => {
          if (sendingCompany?.email) {
            await sendMutation.mutateAsync({
              emailId: sendingCompany.email.id,
              recipientEmail,
              senderEmail,
            });
            setSendDialogOpen(false);
            setSendingCompany(null);
          }
        }}
        isLoading={sendMutation.isPending}
      />

      {/* Batch Action Bar */}
      <BatchActionBar
        selectedCount={selectedCompanyIds.size}
        totalCount={companies.length}
        pipelineState={activeState}
        onApprove={() => {
          batchApproveMutation.mutate([...selectedCompanyIds]);
        }}
        onDelete={() => {
          setDeleteTargetIds([...selectedCompanyIds]);
          setDeleteDialogOpen(true);
        }}
        onSend={() => {
          if (confirm(`${selectedCompanyIds.size} email göndermek istediğinize emin misiniz?`)) {
            batchSendMutation.mutate([...selectedCompanyIds]);
          }
        }}
        onRetry={() => {
          batchRetryMutation.mutate([...selectedCompanyIds]);
        }}
        onClear={clearSelection}
        isLoading={{
          approve: batchApproveMutation.isPending,
          delete: batchDeleteMutation.isPending,
          send: batchSendMutation.isPending,
          retry: batchRetryMutation.isPending,
        }}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeleteTargetIds([]);
        }}
        onConfirm={async (alsoDeleteFromFetched) => {
          await batchDeleteMutation.mutateAsync({
            companyIds: deleteTargetIds,
            alsoDeleteFromFetched,
          });
        }}
        count={deleteTargetIds.length}
        isLoading={batchDeleteMutation.isPending}
      />

    </div>
  );
}

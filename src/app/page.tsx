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
  Play,
  CheckCircle2,
  Send,
  LogOut
} from "lucide-react";

import { PipelineStats } from "@/components/pipeline/pipeline-stats";
import { CompanyCard } from "@/components/pipeline/company-card";
import { EmailReviewModal } from "@/components/pipeline/email-review-modal";
import { SendEmailModal } from "@/components/pipeline/send-email-modal";
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
  const [sendingCompany, setSendingCompany] = useState<Company | null>(null);
  const [customPrompt, setCustomPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [processingAll, setProcessingAll] = useState(false);
  const [processAllResult, setProcessAllResult] = useState<{
    processed: number;
    emailsGenerated: number;
    noContact: number;
    errors: number;
  } | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendAllResult, setSendAllResult] = useState<{
    sent: number;
    failed: number;
    errors: Array<{ companyId: string; companyName: string; error: string }>;
  } | null>(null);

  // Fetch pipeline stats
  const { data: statsData, refetch: refetchStats } = useQuery({
    queryKey: ["pipeline-stats"],
    queryFn: async () => {
      const res = await fetch("/api/pipeline/stats");
      return res.json();
    },
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
  });

  // Generate email mutation
  const generateMutation = useMutation({
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

  // Save review mutation
  const saveReviewMutation = useMutation({
    mutationFn: async ({ emailId, subject, body }: { emailId: string; subject: string; body: string }) => {
      const res = await fetch(`/api/emails/${emailId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedSubject: subject, editedBody: body }),
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

  // Delete email mutation
  const deleteEmailMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const res = await fetch(`/api/companies/${companyId}/email`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Email silinemedi");
      }
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

  // Import companies mutation
  const importMutation = useMutation({
    mutationFn: async ({ companies }: { companies: unknown[] }) => {
      const res = await fetch("/api/companies/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies }),
      });
      if (!res.ok) throw new Error("Import failed");
      return res.json();
    },
    onSuccess: () => {
      // Set active state first so query is enabled, then refetch
      setActiveState(PIPELINE_STATES.PENDING_GENERATION);
      refetchStats();
      // Invalidate and refetch companies query - it will auto-refetch when activeState changes
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });

  // Process all companies mutation
  const processAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/pipeline/process-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          customPrompt: customPrompt !== DEFAULT_SYSTEM_PROMPT ? customPrompt : undefined,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "İşleme başarısız");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setProcessAllResult(data);
      refetchStats();
      if (activeState === PIPELINE_STATES.PENDING_GENERATION) {
        refetchCompanies();
      }
      // Auto-switch to pending_review if emails were generated
      if (data.emailsGenerated > 0) {
        setActiveState(PIPELINE_STATES.PENDING_REVIEW);
      }
    },
    onError: (error: Error) => {
      console.error("Process all error:", error);
      setProcessingAll(false);
    },
  });

  // Send all approved emails mutation
  const sendAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/pipeline/send-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Gönderme başarısız");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSendAllResult(data);
      refetchStats();
      if (activeState === PIPELINE_STATES.APPROVED_TO_SEND) {
        refetchCompanies();
      }
      // Auto-switch to sent if emails were sent
      if (data.sent > 0) {
        setActiveState(PIPELINE_STATES.SENT);
      }
    },
    onError: (error: Error) => {
      console.error("Send all error:", error);
      setSendingAll(false);
    },
  });

  const stats = statsData?.stats || {
    total: 0,
    byState: {
      pending_generation: 0,
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
              
              {/* Process All Button */}
              {stats.byState.pending_generation > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold mb-1">Otomatik İşleme</h3>
                        <p className="text-sm text-muted-foreground">
                          {stats.byState.pending_generation} şirket için otomatik olarak kişi bul ve email oluştur
                        </p>
                      </div>
                      <Button
                        onClick={async () => {
                          setProcessingAll(true);
                          setProcessAllResult(null);
                          try {
                            await processAllMutation.mutateAsync();
                          } finally {
                            setProcessingAll(false);
                          }
                        }}
                        disabled={processingAll || processAllMutation.isPending}
                        size="lg"
                      >
                        {processingAll || processAllMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            İşleniyor...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Tümünü İşle
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {/* Process All Result */}
                    {processAllResult && (
                      <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          İşleme Tamamlandı
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">İşlenen</div>
                            <div className="font-semibold">{processAllResult.processed}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Email Oluşturulan</div>
                            <div className="font-semibold text-green-600">{processAllResult.emailsGenerated}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Kişi Bulunamadı</div>
                            <div className="font-semibold text-yellow-600">{processAllResult.noContact}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Hata</div>
                            <div className="font-semibold text-red-600">{processAllResult.errors}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Send All Button */}
              {stats.byState.approved_to_send > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold mb-1">Toplu Gönderim</h3>
                        <p className="text-sm text-muted-foreground">
                          {stats.byState.approved_to_send} onaylanmış email'i gönder
                        </p>
                      </div>
                      <Button
                        onClick={async () => {
                          if (!confirm(`Are you sure you want to send ${stats.byState.approved_to_send} emails? This action cannot be undone.`)) {
                            return;
                          }
                          setSendingAll(true);
                          setSendAllResult(null);
                          try {
                            await sendAllMutation.mutateAsync();
                          } finally {
                            setSendingAll(false);
                          }
                        }}
                        disabled={sendingAll || sendAllMutation.isPending}
                        size="lg"
                        variant="default"
                      >
                        {sendingAll || sendAllMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Gönderiliyor...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Tümünü Gönder
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {/* Send All Result */}
                    {sendAllResult && (
                      <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Gönderim Tamamlandı
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Gönderilen</div>
                            <div className="font-semibold text-green-600">{sendAllResult.sent}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Başarısız</div>
                            <div className="font-semibold text-red-600">{sendAllResult.failed}</div>
                          </div>
                        </div>
                        {sendAllResult.errors.length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs font-medium text-muted-foreground mb-1">Hatalar:</div>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {sendAllResult.errors.slice(0, 5).map((error, idx) => (
                                <div key={idx} className="text-xs text-red-600">
                                  {error.companyName}: {error.error}
                                </div>
                              ))}
                              {sendAllResult.errors.length > 5 && (
                                <div className="text-xs text-muted-foreground">
                                  +{sendAllResult.errors.length - 5} more errors
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Companies Grid */}
            {activeState && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    {activeState.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </h2>
                  <Badge variant="secondary">
                    {companies.length} companies
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
                        onFindContact={async (id) => {
                          await findContactMutation.mutateAsync(id);
                        }}
                        onGenerate={async (id) => {
                          await generateMutation.mutateAsync(id);
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
                          if (comp) setSendingCompany(comp);
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
        onSave={async (emailId, subject, body) => {
          await saveReviewMutation.mutateAsync({ emailId, subject, body });
        }}
        onApprove={async (emailId, subject, body) => {
          await approveMutation.mutateAsync({ emailId, subject, body });
        }}
      />

      {/* Send Email Modal */}
      <SendEmailModal
        isOpen={!!sendingCompany}
        onClose={() => setSendingCompany(null)}
        company={sendingCompany}
        onSend={async (emailId, recipientEmail, senderEmail) => {
          await sendMutation.mutateAsync({ emailId, recipientEmail, senderEmail });
        }}
        onDelete={sendingCompany?.id ? async (companyId) => {
          await deleteEmailMutation.mutateAsync(companyId);
        } : undefined}
        onRegenerate={sendingCompany?.id ? async (companyId) => {
          await regenerateEmailMutation.mutateAsync(companyId);
        } : undefined}
      />

    </div>
  );
}

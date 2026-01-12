"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Globe,
  Users,
  MapPin,
  Sparkles,
  Eye,
  Send,
  CheckCircle2,
  Loader2,
  ExternalLink,
  UserSearch,
  Mail,
  RefreshCw,
  RotateCcw,
  AlertCircle
} from "lucide-react";

interface CompanyCardProps {
  company: {
    id: string;
    name: string;
    domain: string;
    website?: string | null;
    industry?: string | null;
    location?: string | null;
    employeeCount?: number | null;
    pipelineState: string;
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
  onFindContact: (companyId: string) => Promise<void>;
  onGenerate: (companyId: string) => Promise<void>;
  onReview: (companyId: string) => void;
  onApprove: (companyId: string) => Promise<void>;
  onSend: (companyId: string) => void;
  onRetry?: (companyId: string) => Promise<void>;
  onReset?: (companyId: string) => Promise<void>;
}

const stateLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" }> = {
  pending_generation: { label: "Pending", variant: "secondary" },
  email_not_generated: { label: "Not Generated", variant: "warning" },
  pending_review: { label: "Review Needed", variant: "info" },
  approved_to_send: { label: "Approved", variant: "success" },
  sent: { label: "Sent", variant: "default" },
};

export function CompanyCard({
  company,
  onFindContact,
  onGenerate,
  onReview,
  onApprove,
  onSend,
  onRetry,
  onReset
}: CompanyCardProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleAction = async (action: string, handler: () => Promise<void>) => {
    setIsLoading(action);
    try {
      await handler();
    } finally {
      setIsLoading(null);
    }
  };

  const stateInfo = stateLabels[company.pipelineState] || { label: company.pipelineState, variant: "outline" as const };
  
  const hasContact = !!(company.targetContactFirstName || company.targetContactEmail);
  const contactName = hasContact 
    ? [company.targetContactFirstName, company.targetContactLastName]
        .filter(Boolean)
        .join(' ')
        .trim() || company.targetContactFirstName || 'Unknown'
    : null;

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold truncate flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              {company.name}
            </CardTitle>
            <a
              href={company.website || `https://${company.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mt-1"
            >
              <Globe className="h-3 w-3" />
              {company.domain}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <Badge variant={stateInfo.variant}>{stateInfo.label}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Company Info */}
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          {company.industry && (
            <span className="font-medium">{company.industry}</span>
          )}
          {company.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {company.location}
            </span>
          )}
          {company.employeeCount && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {company.employeeCount.toLocaleString()}
            </span>
          )}
        </div>

        {/* Target Contact */}
        {hasContact ? (
          <div className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2 font-medium">
              <UserSearch className="h-4 w-4" />
              {contactName}
            </div>
            {company.targetContactTitle && (
              <div className="text-sm opacity-80">{company.targetContactTitle}</div>
            )}
            {company.targetContactEmail && (
              <div className="text-sm flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {company.targetContactEmail}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
            Henüz hedef kişi bulunamadı
          </div>
        )}

        {/* Not Generated Reason */}
        {company.pipelineState === "email_not_generated" && company.notGeneratedReason && (
          <div className="bg-amber-500/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Email Oluşturulamadı
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  {typeof company.notGeneratedReason === 'object' && company.notGeneratedReason.reason
                    ? company.notGeneratedReason.reason
                    : typeof company.notGeneratedReason === 'string'
                    ? company.notGeneratedReason
                    : 'Bilinmeyen hata'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Email Preview */}
        {company.email && (
          <div className="bg-muted/30 rounded-lg p-3 space-y-2">
            <div className="text-sm font-medium truncate">
              📧 {company.email.finalSubject || company.email.editedSubject || company.email.subject}
            </div>
            <div className="text-xs text-muted-foreground line-clamp-2">
              {(company.email.finalBody || company.email.editedBody || company.email.body).slice(0, 150)}...
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          {/* Find Contact Button - first step */}
          {company.pipelineState === "pending_generation" && !hasContact && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction("find", () => onFindContact(company.id))}
              disabled={isLoading !== null}
            >
              {isLoading === "find" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserSearch className="h-4 w-4" />
              )}
              Kişi Bul
            </Button>
          )}

          {/* Generate Button - after contact found */}
          {company.pipelineState === "pending_generation" && hasContact && (
            <Button
              size="sm"
              onClick={() => handleAction("generate", () => onGenerate(company.id))}
              disabled={isLoading !== null}
            >
              {isLoading === "generate" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Email Oluştur
            </Button>
          )}

          {/* Review Button */}
          {company.pipelineState === "pending_review" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReview(company.id)}
            >
              <Eye className="h-4 w-4" />
              İncele
            </Button>
          )}

          {/* Approve Button */}
          {company.pipelineState === "pending_review" && (
            <Button
              size="sm"
              variant="success"
              onClick={() => handleAction("approve", () => onApprove(company.id))}
              disabled={isLoading !== null}
            >
              {isLoading === "approve" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Onayla
            </Button>
          )}

          {/* Send Button */}
          {company.pipelineState === "approved_to_send" && (
            <Button
              size="sm"
              onClick={() => onSend(company.id)}
            >
              <Send className="h-4 w-4" />
              Gönder
            </Button>
          )}

          {/* Not Generated Actions */}
          {company.pipelineState === "email_not_generated" && (
            <>
              {onRetry && hasContact && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction("retry", () => onRetry(company.id))}
                  disabled={isLoading !== null}
                >
                  {isLoading === "retry" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Tekrar Dene
                </Button>
              )}
              {onReset && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction("reset", () => onReset(company.id))}
                  disabled={isLoading !== null}
                >
                  {isLoading === "reset" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Sıfırla
                </Button>
              )}
              {!hasContact && onFindContact && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction("find", () => onFindContact(company.id))}
                  disabled={isLoading !== null}
                >
                  {isLoading === "find" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserSearch className="h-4 w-4" />
                  )}
                  Kişi Bul
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

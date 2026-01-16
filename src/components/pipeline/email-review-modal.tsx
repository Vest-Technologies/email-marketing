"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Building2,
  Save,
  CheckCircle2,
  X,
  Loader2,
  AlertCircle,
  Eye,
  Send,
  Mail,
  User,
  AtSign,
  RefreshCw
} from "lucide-react";

interface EmailReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: {
    id: string;
    name: string;
    domain: string;
    pipelineState: string;
    targetContactEmail?: string | null;
    targetContactFirstName?: string | null;
    targetContactLastName?: string | null;
    targetContactTitle?: string | null;
    email?: {
      id: string;
      subject: string;
      body: string;
      editedSubject?: string | null;
      editedBody?: string | null;
      finalSubject?: string | null;
      finalBody?: string | null;
    } | null;
  } | null;
  onSave: (emailId: string, subject: string, body: string, recipientEmail?: string) => Promise<void>;
  onApprove: (emailId: string, subject: string, body: string) => Promise<void>;
  onSend?: (emailId: string, recipientEmail: string, senderEmail: string, subject: string, body: string) => Promise<void>;
  onRegenerate?: (companyId: string) => Promise<void>;
}

interface SettingsResponse {
  settings: {
    senderEmail: string | null;
    senderName: string | null;
  };
  userEmail: string | null;
  envFallback: {
    senderEmail: string | null;
  };
}

export function EmailReviewModal({
  isOpen,
  onClose,
  company,
  onSave,
  onApprove,
  onSend,
  onRegenerate,
}: EmailReviewModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const isApproved = company?.pipelineState === "approved_to_send";

  // Fetch settings to get sender email
  const { data: settingsData } = useQuery<SettingsResponse>({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
    enabled: isOpen && isApproved,
  });

  // Get effective sender email
  const defaultSenderEmail = settingsData?.settings?.senderEmail ||
    settingsData?.userEmail ||
    settingsData?.envFallback?.senderEmail ||
    "";

  // Auto-populate sender email when settings load
  useEffect(() => {
    if (isOpen && isApproved && defaultSenderEmail && !senderEmail) {
      setSenderEmail(defaultSenderEmail);
    }
  }, [isOpen, isApproved, defaultSenderEmail, senderEmail]);

  // Initialize form when company changes
  useEffect(() => {
    if (company?.email) {
      // For approved emails, use finalSubject/finalBody, otherwise use edited or original
      const initialSubject = isApproved
        ? (company.email.finalSubject || company.email.editedSubject || company.email.subject)
        : (company.email.editedSubject || company.email.subject);
      const initialBody = isApproved
        ? (company.email.finalBody || company.email.editedBody || company.email.body)
        : (company.email.editedBody || company.email.body);
      setSubject(initialSubject);
      setBody(initialBody);
      setHasChanges(false);
    }
    if (company?.targetContactEmail) {
      setRecipientEmail(company.targetContactEmail);
    }
  }, [company, isApproved]);

  // Reset sender email when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSenderEmail("");
    }
  }, [isOpen]);

  // Track changes
  useEffect(() => {
    if (company?.email) {
      const originalSubject = isApproved
        ? (company.email.finalSubject || company.email.editedSubject || company.email.subject)
        : (company.email.editedSubject || company.email.subject);
      const originalBody = isApproved
        ? (company.email.finalBody || company.email.editedBody || company.email.body)
        : (company.email.editedBody || company.email.body);
      const originalRecipient = company.targetContactEmail || '';

      // For approved emails, also track recipient email changes
      const hasContentChanges = subject !== originalSubject || body !== originalBody;
      const hasRecipientChange = isApproved && recipientEmail !== originalRecipient;

      setHasChanges(hasContentChanges || hasRecipientChange);
    }
  }, [subject, body, recipientEmail, company, isApproved]);

  const handleSave = async () => {
    if (!company?.email) return;
    setIsSaving(true);
    try {
      // Pass recipientEmail only for approved emails
      await onSave(company.email.id, subject, body, isApproved ? recipientEmail : undefined);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!company?.email) return;
    setIsApproving(true);
    try {
      await onApprove(company.email.id, subject, body);
      onClose();
    } finally {
      setIsApproving(false);
    }
  };

  const handleSend = async () => {
    if (!company?.email || !onSend || !recipientEmail || !senderEmail) return;
    setIsSending(true);
    try {
      await onSend(company.email.id, recipientEmail, senderEmail, subject, body);
      onClose();
    } finally {
      setIsSending(false);
    }
  };

  const handleRegenerate = async () => {
    if (!company?.id || !onRegenerate) return;
    setIsRegenerating(true);
    try {
      await onRegenerate(company.id);
      onClose();
    } finally {
      setIsRegenerating(false);
    }
  };

  const isValidRecipientEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail);
  const isValidSenderEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail);

  if (!company?.email) return null;

  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const charCount = body.length;

  const isAnyLoading = isSaving || isApproving || isSending || isRegenerating;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Review Email</DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  <Building2 className="h-4 w-4" />
                  {company.name} • {company.domain}
                </DialogDescription>
              </div>
            </div>
            {hasChanges && (
              <Badge variant="warning">Unsaved Changes</Badge>
            )}
          </div>
        </DialogHeader>

        <Separator className="my-4" />

        <ScrollArea className="flex-1 min-h-0 pr-4">
          <div className="space-y-6">
            {/* Sender and Recipient Email - only for approved emails */}
            {isApproved && (
              <>
                {/* Sender Email */}
                <div className="space-y-2">
                  <Label htmlFor="sender" className="text-sm font-medium flex items-center gap-2">
                    <AtSign className="h-4 w-4" />
                    Gönderen Email (From)
                  </Label>
                  <Input
                    id="sender"
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder={defaultSenderEmail || "noreply@yourdomain.com"}
                    className={`text-base ${!isValidSenderEmail && senderEmail ? "border-destructive" : ""}`}
                  />
                  {!isValidSenderEmail && senderEmail && (
                    <p className="text-xs text-destructive">Geçerli bir email adresi girin</p>
                  )}
                </div>

                {/* Recipient Email */}
                <div className="space-y-2">
                  <Label htmlFor="recipient" className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Alıcı Email (To)
                  </Label>
                  {company.targetContactFirstName && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-2">
                      <User className="h-4 w-4" />
                      <span>
                        {company.targetContactFirstName} {company.targetContactLastName}
                        {company.targetContactTitle && ` • ${company.targetContactTitle}`}
                      </span>
                    </div>
                  )}
                  <Input
                    id="recipient"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="ornek@firma.com"
                    className={`text-base ${!isValidRecipientEmail && recipientEmail ? "border-destructive" : ""}`}
                  />
                  {!isValidRecipientEmail && recipientEmail && (
                    <p className="text-xs text-destructive">Geçerli bir email adresi girin</p>
                  )}
                </div>
              </>
            )}

            {/* Subject Line */}
            <div className="space-y-2">
              <Label htmlFor="subject" className="text-sm font-medium">
                Subject Line
              </Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject..."
                className="text-base"
              />
              <p className="text-xs text-muted-foreground">
                {subject.length} characters • Keep it under 60 for best deliverability
              </p>
            </div>

            {/* Email Body */}
            <div className="space-y-2">
              <Label htmlFor="body" className="text-sm font-medium">
                Email Body
              </Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Enter email body..."
                className="min-h-[300px] text-base leading-relaxed font-mono"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{wordCount} words • {charCount} characters</span>
                <span className={charCount > 2000 ? "text-destructive" : ""}>
                  {charCount > 2000 ? (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Too long
                    </span>
                  ) : (
                    "Recommended: 150-250 words"
                  )}
                </span>
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Preview</Label>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                {isApproved && (
                  <>
                    <div className="text-sm">
                      <span className="text-muted-foreground">From: </span>
                      <span className="font-medium">{senderEmail || "(not set)"}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">To: </span>
                      <span className="font-medium">{recipientEmail || "(not set)"}</span>
                    </div>
                  </>
                )}
                <div className="text-sm">
                  <span className="text-muted-foreground">Subject: </span>
                  <span className="font-medium">{subject || "(empty)"}</span>
                </div>
                <Separator />
                <div className="text-sm whitespace-pre-wrap">
                  {body || "(empty)"}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <Separator className="my-4" />

        <DialogFooter className="flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={isAnyLoading}>
                <X className="h-4 w-4" />
                İptal
              </Button>
              {/* Regenerate button - available for both pending_review and approved states */}
              {onRegenerate && (
                <Button
                  variant="outline"
                  onClick={handleRegenerate}
                  disabled={isAnyLoading}
                >
                  {isRegenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Yeniden Oluştur
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {isApproved ? (
                <>
                  {/* Approved state: Save and Send buttons */}
                  <Button
                    variant="outline"
                    onClick={handleSave}
                    disabled={isAnyLoading || !hasChanges}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Kaydet
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={isAnyLoading || !subject.trim() || !body.trim() || !isValidRecipientEmail || !isValidSenderEmail}
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Gönder
                  </Button>
                </>
              ) : (
                <>
                  {/* Pending review state: Save Draft and Approve buttons */}
                  <Button
                    variant="outline"
                    onClick={handleSave}
                    disabled={isAnyLoading || !hasChanges}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Taslak Kaydet
                  </Button>
                  <Button
                    variant="success"
                    onClick={handleApprove}
                    disabled={isAnyLoading || !subject.trim() || !body.trim()}
                  >
                    {isApproving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Onayla
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

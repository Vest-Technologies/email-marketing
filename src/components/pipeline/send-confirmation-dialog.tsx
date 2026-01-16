"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send, Mail, AtSign, User } from "lucide-react";

interface SendConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (recipientEmail: string, senderEmail: string) => Promise<void>;
  company: {
    name: string;
    targetContactEmail?: string | null;
    targetContactFirstName?: string | null;
    targetContactLastName?: string | null;
    targetContactTitle?: string | null;
    email?: {
      finalSubject?: string | null;
      subject: string;
    } | null;
  } | null;
  isLoading?: boolean;
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

export function SendConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  company,
  isLoading = false,
}: SendConfirmationDialogProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [senderEmail, setSenderEmail] = useState("");

  // Fetch settings to get sender email
  const { data: settingsData } = useQuery<SettingsResponse>({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
    enabled: isOpen,
  });

  // Get effective sender email
  const defaultSenderEmail = settingsData?.settings?.senderEmail ||
    settingsData?.userEmail ||
    settingsData?.envFallback?.senderEmail ||
    "";

  // Initialize emails when dialog opens
  useEffect(() => {
    if (isOpen) {
      if (company?.targetContactEmail) {
        setRecipientEmail(company.targetContactEmail);
      }
      if (defaultSenderEmail) {
        setSenderEmail(defaultSenderEmail);
      }
    }
  }, [isOpen, company?.targetContactEmail, defaultSenderEmail]);

  // Reset when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setRecipientEmail("");
      setSenderEmail("");
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    await onConfirm(recipientEmail, senderEmail);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !isLoading) {
      onClose();
    }
  };

  const isValidRecipientEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail);
  const isValidSenderEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail);
  const canSend = isValidRecipientEmail && isValidSenderEmail && !isLoading;

  const subject = company?.email?.finalSubject || company?.email?.subject || "";

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Email Gönder
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">{company?.name}</span> şirketine email göndermek üzeresiniz.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Subject preview */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-sm text-muted-foreground">Konu:</div>
            <div className="text-sm font-medium truncate">{subject}</div>
          </div>

          {/* Sender Email */}
          <div className="space-y-2">
            <Label htmlFor="sender-confirm" className="text-sm font-medium flex items-center gap-2">
              <AtSign className="h-4 w-4" />
              Gönderen Email (From)
            </Label>
            <Input
              id="sender-confirm"
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder={defaultSenderEmail || "noreply@yourdomain.com"}
              className={!isValidSenderEmail && senderEmail ? "border-destructive" : ""}
              disabled={isLoading}
            />
            {!isValidSenderEmail && senderEmail && (
              <p className="text-xs text-destructive">Geçerli bir email adresi girin</p>
            )}
          </div>

          {/* Recipient Email */}
          <div className="space-y-2">
            <Label htmlFor="recipient-confirm" className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Alıcı Email (To)
            </Label>
            {company?.targetContactFirstName && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-2">
                <User className="h-4 w-4" />
                <span>
                  {company.targetContactFirstName} {company.targetContactLastName}
                  {company.targetContactTitle && ` • ${company.targetContactTitle}`}
                </span>
              </div>
            )}
            <Input
              id="recipient-confirm"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="ornek@firma.com"
              className={!isValidRecipientEmail && recipientEmail ? "border-destructive" : ""}
              disabled={isLoading}
            />
            {!isValidRecipientEmail && recipientEmail && (
              <p className="text-xs text-destructive">Geçerli bir email adresi girin</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            İptal
          </Button>
          <Button onClick={handleConfirm} disabled={!canSend}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Gönder
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

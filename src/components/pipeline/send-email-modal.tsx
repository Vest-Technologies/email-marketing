"use client";

import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Building2, 
  Send, 
  X,
  Loader2,
  Mail,
  User,
  Trash2,
  RefreshCw
} from "lucide-react";

interface SendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: {
    id: string;
    name: string;
    domain: string;
    targetContactEmail?: string | null;
    targetContactFirstName?: string | null;
    targetContactLastName?: string | null;
    targetContactTitle?: string | null;
    email?: {
      id: string;
      finalSubject?: string | null;
      finalBody?: string | null;
      subject: string;
      body: string;
    } | null;
    employees?: Array<{
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      title: string;
      isTitleValid: boolean;
    }>;
  } | null;
  onSend: (emailId: string, recipientEmail: string) => Promise<void>;
  onDelete?: (companyId: string) => Promise<void>;
  onRegenerate?: (companyId: string) => Promise<void>;
}

export function SendEmailModal({
  isOpen,
  onClose,
  company,
  onSend,
  onDelete,
  onRegenerate,
}: SendEmailModalProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  // Auto-populate recipient email when modal opens if targetContactEmail exists
  useEffect(() => {
    if (isOpen && company?.targetContactEmail) {
      setRecipientEmail(company.targetContactEmail);
      // Also select it if it matches an employee email
      const matchingEmployee = company.employees?.find(
        emp => emp.email === company.targetContactEmail
      );
      if (matchingEmployee?.email) {
        setSelectedEmployee(matchingEmployee.email);
      } else {
        setSelectedEmployee(null);
      }
    } else if (isOpen && !company?.targetContactEmail) {
      // Reset when modal opens without targetContactEmail
      setRecipientEmail("");
      setSelectedEmployee(null);
    }
  }, [isOpen, company?.targetContactEmail, company?.employees]);

  const handleSelectEmployee = (email: string) => {
    setRecipientEmail(email);
    setSelectedEmployee(email);
  };

  const handleSend = async () => {
    if (!company?.email || !recipientEmail) return;
    setIsSending(true);
    try {
      await onSend(company.email.id, recipientEmail);
      onClose();
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async () => {
    if (!company?.id || !onDelete) return;
    if (!confirm('Are you sure you want to delete this email? This will remove the email and reset the company to pending generation.')) {
      return;
    }
    setIsDeleting(true);
    try {
      await onDelete(company.id);
      onClose();
    } finally {
      setIsDeleting(false);
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

  if (!company?.email) return null;

  const validEmployees = company.employees?.filter(e => e.isTitleValid && e.email) || [];
  const subject = company.email.finalSubject || company.email.subject;
  const body = company.email.finalBody || company.email.body;

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Send className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Send Email</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <Building2 className="h-4 w-4" />
                {company.name} • {company.domain}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Separator className="my-4" />

        <div className="flex-1 flex flex-col min-h-0 gap-4">
          {/* Recipient Selection */}
          <div className="space-y-2 flex-shrink-0">
            <Label className="text-sm font-medium">Select Recipient</Label>
            
            {/* Show enriched contact if available */}
            {company.targetContactEmail && (
              <button
                onClick={() => handleSelectEmployee(company.targetContactEmail!)}
                className={`w-full flex items-center gap-2 p-2 rounded-lg border transition-all ${
                  selectedEmployee === company.targetContactEmail || recipientEmail === company.targetContactEmail
                    ? "border-primary bg-primary/5"
                    : "border-primary/20 bg-primary/5 hover:border-primary/50 hover:bg-primary/10"
                }`}
              >
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium text-sm truncate">
                    {company.targetContactFirstName} {company.targetContactLastName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {company.targetContactTitle} • {company.targetContactEmail}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="text-xs text-primary font-medium">Enriched</div>
                  {(selectedEmployee === company.targetContactEmail || recipientEmail === company.targetContactEmail) && (
                    <Mail className="h-3.5 w-3.5 text-primary" />
                  )}
                </div>
              </button>
            )}

            {/* Show employees list if available and we have employees data */}
            {validEmployees.length > 0 && (
              <div className="space-y-1.5">
                {validEmployees.slice(0, 5).map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => handleSelectEmployee(emp.email!)}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg border transition-all ${
                      selectedEmployee === emp.email
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-medium text-sm truncate">
                        {emp.firstName} {emp.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {emp.title} • {emp.email}
                      </div>
                    </div>
                    {selectedEmployee === emp.email && (
                      <Mail className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or enter manually
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e) => {
                  setRecipientEmail(e.target.value);
                  setSelectedEmployee(null);
                }}
                placeholder="Enter recipient email..."
                className="flex-1"
              />
            </div>
          </div>

          {/* Email Preview */}
          <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
            <Label className="text-sm font-medium">Email Preview</Label>
            <div className="bg-muted/50 rounded-lg border border-border flex-1 flex flex-col min-h-0">
              <div className="p-2.5 space-y-1.5 border-b border-border flex-shrink-0">
                <div className="text-sm">
                  <span className="text-muted-foreground">To: </span>
                  <span className="font-medium">{recipientEmail || "(select recipient)"}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Subject: </span>
                  <span className="font-medium">{subject}</span>
                </div>
              </div>
              <div className="flex-1 overflow-auto min-h-0">
                <div className="p-3">
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">
                    {body}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        <DialogFooter className="flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                <X className="h-4 w-4" />
                Cancel
              </Button>
              {onDelete && (
                <Button
                  variant="outline"
                  onClick={handleDelete}
                  disabled={isDeleting || isSending || isRegenerating}
                  className="text-destructive hover:text-destructive"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete
                </Button>
              )}
              {onRegenerate && (
                <Button
                  variant="outline"
                  onClick={handleRegenerate}
                  disabled={isRegenerating || isSending || isDeleting}
                >
                  {isRegenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Regenerate
                </Button>
              )}
            </div>
            <Button
              onClick={handleSend}
              disabled={isSending || !recipientEmail || !isValidEmail || isDeleting || isRegenerating}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send Email
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

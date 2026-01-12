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
  Eye
} from "lucide-react";

interface EmailReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: {
    id: string;
    name: string;
    domain: string;
    email?: {
      id: string;
      subject: string;
      body: string;
      editedSubject?: string | null;
      editedBody?: string | null;
    } | null;
  } | null;
  onSave: (emailId: string, subject: string, body: string) => Promise<void>;
  onApprove: (emailId: string, subject: string, body: string) => Promise<void>;
}

export function EmailReviewModal({
  isOpen,
  onClose,
  company,
  onSave,
  onApprove,
}: EmailReviewModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form when company changes
  useEffect(() => {
    if (company?.email) {
      const initialSubject = company.email.editedSubject || company.email.subject;
      const initialBody = company.email.editedBody || company.email.body;
      setSubject(initialSubject);
      setBody(initialBody);
      setHasChanges(false);
    }
  }, [company]);

  // Track changes
  useEffect(() => {
    if (company?.email) {
      const originalSubject = company.email.editedSubject || company.email.subject;
      const originalBody = company.email.editedBody || company.email.body;
      setHasChanges(subject !== originalSubject || body !== originalBody);
    }
  }, [subject, body, company]);

  const handleSave = async () => {
    if (!company?.email) return;
    setIsSaving(true);
    try {
      await onSave(company.email.id, subject, body);
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

  if (!company?.email) return null;

  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const charCount = body.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
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

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
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
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={isSaving || isApproving || !hasChanges}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Draft
              </Button>
              <Button
                variant="success"
                onClick={handleApprove}
                disabled={isSaving || isApproving || !subject.trim() || !body.trim()}
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Approve to Send
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

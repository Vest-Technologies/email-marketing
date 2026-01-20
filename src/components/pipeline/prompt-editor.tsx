"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Save,
  RotateCcw,
  Loader2,
  Info
} from "lucide-react";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/constants";

interface PromptEditorProps {
  initialPrompt?: string;
  onSave: (prompt: string) => Promise<void>;
  title?: string;
  description?: string;
}

export function PromptEditor({
  initialPrompt,
  onSave,
  title = "Email Generation Prompt",
  description = "Customize the AI prompt used to generate emails. The company website content will be automatically appended."
}: PromptEditorProps) {
  const [prompt, setPrompt] = useState(initialPrompt || DEFAULT_SYSTEM_PROMPT);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync prompt state when initialPrompt prop changes (e.g., after API data loads)
  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
      setHasChanges(false);
    }
  }, [initialPrompt]);

  const handleChange = (value: string) => {
    setPrompt(value);
    setHasChanges(value !== (initialPrompt || DEFAULT_SYSTEM_PROMPT));
  };

  const handleReset = () => {
    setPrompt(DEFAULT_SYSTEM_PROMPT);
    setHasChanges(DEFAULT_SYSTEM_PROMPT !== (initialPrompt || DEFAULT_SYSTEM_PROMPT));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(prompt);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          {hasChanges && <Badge variant="warning">Unsaved</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p>
              The prompt must instruct the AI to output JSON with <code className="bg-blue-200/50 dark:bg-blue-800/50 px-1 rounded">subject</code> and <code className="bg-blue-200/50 dark:bg-blue-800/50 px-1 rounded">email_body</code> fields.
            </p>
          </div>
        </div>

        {/* Prompt Editor */}
        <div className="space-y-2">
          <Label htmlFor="prompt" className="text-sm font-medium">
            Prompt Content
          </Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => handleChange(e.target.value)}
            className="min-h-[400px] font-mono text-sm"
            placeholder="Enter your custom prompt..."
          />
          <p className="text-xs text-muted-foreground">
            {prompt.length} characters
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isSaving}
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Default
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Prompt
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  Trash2,
  Send,
  RefreshCw,
  X,
  Loader2,
} from "lucide-react";

interface BatchActionBarProps {
  selectedCount: number;
  totalCount: number;
  pipelineState: string | null;
  onApprove?: () => void;
  onDelete?: () => void;
  onSend?: () => void;
  onRetry?: () => void;
  onClear: () => void;
  isLoading?: {
    approve?: boolean;
    delete?: boolean;
    send?: boolean;
    retry?: boolean;
  };
}

export function BatchActionBar({
  selectedCount,
  totalCount,
  pipelineState,
  onApprove,
  onDelete,
  onSend,
  onRetry,
  onClear,
  isLoading = {},
}: BatchActionBarProps) {
  if (selectedCount === 0) return null;

  const isAnyLoading = Object.values(isLoading).some(Boolean);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200">
      <Card className="shadow-xl border-2 bg-background/95 backdrop-blur-sm">
        <CardContent className="flex items-center gap-4 py-3 px-4">
          <span className="text-sm font-medium whitespace-nowrap">
            {selectedCount} / {totalCount} seçildi
          </span>

          <Separator orientation="vertical" className="h-6" />

          {/* Actions for Generated (pending_review) */}
          {pipelineState === "pending_review" && (
            <>
              {onApprove && (
                <Button
                  size="sm"
                  variant="success"
                  onClick={onApprove}
                  disabled={isAnyLoading}
                >
                  {isLoading.approve ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                  )}
                  Tümünü Onayla
                </Button>
              )}
              {onDelete && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={onDelete}
                  disabled={isAnyLoading}
                >
                  {isLoading.delete ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Sil
                </Button>
              )}
            </>
          )}

          {/* Actions for Not Generated (email_not_generated) */}
          {pipelineState === "email_not_generated" && (
            <>
              {onRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                  disabled={isAnyLoading}
                >
                  {isLoading.retry ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Tekrar Dene
                </Button>
              )}
              {onDelete && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={onDelete}
                  disabled={isAnyLoading}
                >
                  {isLoading.delete ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Sil
                </Button>
              )}
            </>
          )}

          {/* Actions for Approved (approved_to_send) */}
          {pipelineState === "approved_to_send" && (
            <>
              {onSend && (
                <Button
                  size="sm"
                  onClick={onSend}
                  disabled={isAnyLoading}
                >
                  {isLoading.send ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  Tümünü Gönder
                </Button>
              )}
              {onDelete && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={onDelete}
                  disabled={isAnyLoading}
                >
                  {isLoading.delete ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Sil
                </Button>
              )}
            </>
          )}

          {/* Actions for Sent */}
          {pipelineState === "sent" && (
            <>
              {onDelete && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={onDelete}
                  disabled={isAnyLoading}
                >
                  {isLoading.delete ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Sil
                </Button>
              )}
            </>
          )}

          <Separator orientation="vertical" className="h-6" />

          <Button
            size="sm"
            variant="ghost"
            onClick={onClear}
            disabled={isAnyLoading}
          >
            <X className="h-4 w-4 mr-1" />
            Temizle
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

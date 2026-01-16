"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2 } from "lucide-react";

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (alsoDeleteFromFetched: boolean) => Promise<void>;
  count: number;
  isLoading?: boolean;
}

export function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  count,
  isLoading = false,
}: DeleteConfirmationDialogProps) {
  const [alsoDeleteFromFetched, setAlsoDeleteFromFetched] = useState(false);

  const handleConfirm = async () => {
    await onConfirm(alsoDeleteFromFetched);
    setAlsoDeleteFromFetched(false); // Reset for next time
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !isLoading) {
      setAlsoDeleteFromFetched(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            {count === 1 ? "Şirketi Sil" : `${count} Şirketi Sil`}
          </DialogTitle>
          <DialogDescription>
            {count === 1
              ? "Bu şirketi silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
              : `${count} şirketi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-start space-x-3 rounded-lg border p-4 bg-muted/50">
            <Checkbox
              id="delete-from-fetched"
              checked={alsoDeleteFromFetched}
              onCheckedChange={(checked) => setAlsoDeleteFromFetched(checked === true)}
              disabled={isLoading}
            />
            <div className="space-y-1">
              <Label
                htmlFor="delete-from-fetched"
                className="text-sm font-medium cursor-pointer"
              >
                Arama geçmişinden de sil
              </Label>
              <p className="text-xs text-muted-foreground">
                Bu seçenek işaretlenirse, şirket gelecekteki Apollo aramalarında tekrar görünecektir.
                İşaretlenmezse, şirket aramalardan hariç tutulmaya devam eder.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            İptal
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            variant="destructive"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Siliniyor...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Sil
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

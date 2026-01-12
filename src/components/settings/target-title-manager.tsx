"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Loader2, UserSearch, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface TargetTitle {
  id: string;
  title: string;
  priority: number;
  isActive: boolean;
}

export function TargetTitleManager() {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [selectedTitles, setSelectedTitles] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["targetTitles"],
    queryFn: async () => {
      const res = await fetch("/api/target-titles");
      if (!res.ok) throw new Error("Failed to fetch titles");
      return res.json();
    },
  });

  const titles: TargetTitle[] = data?.titles || [];

  const addMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch("/api/target-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add title");
      }
      return res.json();
    },
    onSuccess: () => {
      setNewTitle("");
      queryClient.invalidateQueries({ queryKey: ["targetTitles"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/target-titles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Failed to delete titles");
      return res.json();
    },
    onSuccess: () => {
      setSelectedTitles(new Set());
      queryClient.invalidateQueries({ queryKey: ["targetTitles"] });
    },
  });

  const handleAdd = () => {
    if (newTitle.trim()) {
      addMutation.mutate(newTitle.trim());
    }
  };

  const handleDelete = () => {
    if (selectedTitles.size > 0) {
      deleteMutation.mutate(Array.from(selectedTitles));
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedTitles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <UserSearch className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Hedef Ünvanlar ({titles.length})</CardTitle>
            <CardDescription>
              Ulaşmak istediğiniz kişilerin iş unvanlarını yönetin
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add New Title */}
        <div className="flex gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Yeni ünvan ekle... (örn: CEO, Marketing Director)"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            disabled={addMutation.isPending}
          />
          <Button
            onClick={handleAdd}
            disabled={!newTitle.trim() || addMutation.isPending}
          >
            {addMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Ekle
          </Button>
        </div>

        {addMutation.isError && (
          <p className="text-destructive text-sm">
            <X className="inline h-4 w-4 mr-1" />
            {addMutation.error?.message}
          </p>
        )}

        {/* Delete Selected Button */}
        {selectedTitles.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Seçilenleri Sil ({selectedTitles.size})
          </Button>
        )}

        {/* Title List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : titles.length === 0 ? (
          <div className="text-muted-foreground text-center py-8">
            Henüz ünvan eklenmemiş
          </div>
        ) : (
          <ScrollArea className="h-[300px] border rounded-md p-2">
            <div className="flex flex-wrap gap-2">
              {titles.map((title) => (
                <div
                  key={title.id}
                  className={`flex items-center gap-2 px-3 py-1.5 border rounded-full cursor-pointer transition-colors ${
                    selectedTitles.has(title.id)
                      ? "bg-destructive/10 border-destructive text-destructive"
                      : "bg-muted/50 hover:bg-muted"
                  }`}
                  onClick={() => toggleSelection(title.id)}
                >
                  <Checkbox
                    checked={selectedTitles.has(title.id)}
                    onCheckedChange={() => toggleSelection(title.id)}
                    className="h-3 w-3"
                  />
                  <span className="text-sm">{title.title}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <p className="text-xs text-muted-foreground">
          💡 Bu ünvanlara sahip kişiler şirketlerde aranacak. Öncelik sırasına göre ilk bulunan kişiye email atılacak.
        </p>
      </CardContent>
    </Card>
  );
}

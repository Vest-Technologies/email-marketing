"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Mail, Loader2, Save, AlertCircle, CheckCircle2, Eye, EyeOff, Code } from "lucide-react";

interface Settings {
  id: string;
  senderEmail: string | null;
  senderName: string | null;
  signature: string | null;
}

interface SettingsResponse {
  settings: Settings;
  envFallback: {
    senderEmail: string | null;
  };
  userEmail: string | null;
}

export function EmailSettings() {
  const queryClient = useQueryClient();
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [signature, setSignature] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSignaturePreview, setShowSignaturePreview] = useState(false);

  const { data, isLoading, isError, error } = useQuery<SettingsResponse>({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
    retry: false,
  });

  // Update form when data loads
  useEffect(() => {
    if (data?.settings) {
      setSenderEmail(data.settings.senderEmail || "");
      setSenderName(data.settings.senderName || "");
      setSignature(data.settings.signature || "");
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async ({ senderEmail, senderName, signature }: { senderEmail: string; senderName: string; signature: string }) => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderEmail: senderEmail || null, senderName: senderName || null, signature: signature || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const handleSave = () => {
    saveMutation.mutate({ senderEmail, senderName, signature });
  };

  const hasChanges = data?.settings && (
    senderEmail !== (data.settings.senderEmail || "") ||
    senderName !== (data.settings.senderName || "") ||
    signature !== (data.settings.signature || "")
  );

  const effectiveEmail = senderEmail || data?.userEmail || data?.envFallback?.senderEmail;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Email Ayarlari</CardTitle>
            <CardDescription>
              Gonderici email adresini ve ismini yapilandirin
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-destructive text-sm py-4">
            <AlertCircle className="h-4 w-4" />
            {error?.message || "Ayarlar yuklenemedi"}
          </div>
        ) : (
          <>
            {/* Sender Email */}
            <div className="space-y-2">
              <Label htmlFor="senderEmail">Gonderici Email Adresi</Label>
              <div className="flex gap-2">
                <Input
                  id="senderEmail"
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder={data?.userEmail || data?.envFallback?.senderEmail || "noreply@yourdomain.com"}
                />
                {senderEmail && data?.userEmail && senderEmail !== data.userEmail && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSenderEmail("")}
                    className="shrink-0"
                  >
                    Sifirla
                  </Button>
                )}
              </div>
              {!senderEmail && data?.userEmail && (
                <p className="text-xs text-muted-foreground">
                  Giris yapilan email kullaniliyor: {data.userEmail}
                </p>
              )}
              {!senderEmail && !data?.userEmail && data?.envFallback?.senderEmail && (
                <p className="text-xs text-muted-foreground">
                  Ortam degiskeninden kullaniliyor: {data.envFallback.senderEmail}
                </p>
              )}
            </div>

            {/* Sender Name */}
            <div className="space-y-2">
              <Label htmlFor="senderName">Gonderici Adi (Opsiyonel)</Label>
              <Input
                id="senderName"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="BrandVox"
              />
              <p className="text-xs text-muted-foreground">
                Alicinin gorecegi isim. Ornegin: "BrandVox" &lt;noreply@brandvox.com&gt;
              </p>
            </div>

            {/* Signature */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="signature" className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Email Imzasi - HTML (Opsiyonel)
                </Label>
                {signature && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSignaturePreview(!showSignaturePreview)}
                    className="h-8"
                  >
                    {showSignaturePreview ? (
                      <>
                        <EyeOff className="h-4 w-4 mr-1" />
                        Kodu Goster
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-1" />
                        Onizleme
                      </>
                    )}
                  </Button>
                )}
              </div>

              {showSignaturePreview && signature ? (
                <div className="border rounded-lg p-4 bg-white min-h-[120px]">
                  <p className="text-xs text-muted-foreground mb-2 border-b pb-2">Imza Onizlemesi:</p>
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: signature }}
                  />
                </div>
              ) : (
                <Textarea
                  id="signature"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder={`<p>Saygilar,<br><strong>Isim Soyisim</strong><br>Sirket Adi</p>`}
                  rows={6}
                  className="font-mono text-sm"
                />
              )}

              <p className="text-xs text-muted-foreground">
                HTML formatinda imza. Tum emaillerin sonuna eklenecek. Bos birakilirsa imza eklenmez.
              </p>
            </div>

            {/* Current effective sender */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-1">Aktif Gonderici:</p>
              <p className="text-sm text-muted-foreground">
                {senderName ? `"${senderName}" <${effectiveEmail}>` : effectiveEmail || "Yapilandirilmadi"}
              </p>
            </div>

            {/* Error message */}
            {saveMutation.isError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {saveMutation.error?.message}
              </div>
            )}

            {/* Success message */}
            {saveSuccess && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                Ayarlar basariyla kaydedildi
              </div>
            )}

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saveMutation.isPending}
              className="w-full"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Kaydet
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground">
              Not: Gonderici email adresi Amazon SES'te dogrulanmis olmalidir.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

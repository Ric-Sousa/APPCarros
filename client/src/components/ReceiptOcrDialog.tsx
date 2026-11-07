import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { post, handleApiError } from "@/lib/apiUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Vehicle } from "@shared/schema";

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

interface ReceiptOcrDialogProps {
  vehicles: Vehicle[];
  selectedVehicle: string;
  onSelectVehicle: (id: string) => void;
}

/** Upload a receipt (JPEG/PNG/PDF, max 10 MB) and create an expense from its OCR result. */
export default function ReceiptOcrDialog({ vehicles, selectedVehicle, onSelectVehicle }: ReceiptOcrDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string>("");
  const [ocrProcessing, setOcrProcessing] = useState<boolean>(false);
  const [ocrResult, setOcrResult] = useState<{ vendor?: string; totalAmount?: number; date?: string; description?: string } | null>(null);
  const [ocrError, setOcrError] = useState<string>("");

  return (
    <Dialog open={isOcrModalOpen} onOpenChange={(open) => { setIsOcrModalOpen(open); if (!open) { setOcrFile(null); setOcrPreviewUrl(""); setOcrResult(null); setOcrError(""); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="self-start sm:self-auto">
          <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
          Processar Recibo (OCR)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Processar Recibo (OCR)</DialogTitle>
          <DialogDescription>Envie uma fotografia ou PDF do recibo; a despesa é criada com os dados lidos.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ocr-vehicle">Veículo</Label>
              <Select value={selectedVehicle} onValueChange={onSelectVehicle}>
                <SelectTrigger id="ocr-vehicle" className="w-full mt-1">
                  <SelectValue placeholder="Selecione um veículo" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.brand} {v.model} ({v.licensePlate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ocr-file">Ficheiro (JPEG, PNG ou PDF)</Label>
              <Input
                id="ocr-file"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setOcrFile(f);
                  setOcrResult(null);
                  setOcrError("");
                  if (f && f.type.startsWith('image/')) {
                    const url = URL.createObjectURL(f);
                    setOcrPreviewUrl(url);
                  } else {
                    setOcrPreviewUrl("");
                  }
                }}
              />
            </div>
          </div>

          {ocrPreviewUrl && (
            <div className="mt-2">
              <p className="text-sm font-medium">Pré-visualização</p>
              <img src={ocrPreviewUrl} alt="Pré-visualização do recibo" className="mt-2 rounded border max-h-64 object-contain" />
            </div>
          )}

          {ocrError && (
            <div className="text-destructive text-sm" role="alert">{ocrError}</div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOcrModalOpen(false)}>Fechar</Button>
            <Button
              onClick={async () => {
                try {
                  setOcrProcessing(true);
                  setOcrError("");
                  setOcrResult(null);
                  if (!ocrFile) {
                    setOcrError('Selecione um ficheiro para enviar.');
                    setOcrProcessing(false);
                    return;
                  }
                  if (!selectedVehicle) {
                    setOcrError('Selecione um veículo.');
                    setOcrProcessing(false);
                    return;
                  }
                  const formData = new FormData();
                  formData.append('receipt', ocrFile);
                  formData.append('vehicleId', selectedVehicle);
                  if (ocrFile.size > MAX_RECEIPT_BYTES) {
                        setOcrError('O ficheiro não pode ter mais de 10MB.');
                        setOcrProcessing(false);
                        return;
                      }
                      const data = await post<any>('/api/expenses/ocr', formData);
                  setOcrResult({
                    vendor: data?.ocr?.vendor,
                    totalAmount: data?.ocr?.totalAmount,
                    date: data?.ocr?.date ? new Date(data.ocr.date).toLocaleDateString('pt-PT') : undefined,
                    description: data?.ocr?.description,
                  });
                  // Refresh expenses list
                  queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
                  toast({
                    title: 'Despesa criada via OCR',
                    description: 'O recibo foi processado e a despesa registada.',
                  });
                } catch (e) {
                  setOcrError(handleApiError(e, 'Erro no OCR'));
                } finally {
                  setOcrProcessing(false);
                }
              }}
              disabled={ocrProcessing}
              className="bg-primary hover:bg-primary/90"
            >
              {ocrProcessing ? 'A processar...' : 'Processar e Criar Despesa'}
            </Button>
          </div>

          {ocrResult && (
            <div className="mt-4 border border-border rounded p-3 bg-muted/30">
              <p className="text-sm text-muted-foreground">Resultado do OCR</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                <div><span className="text-muted-foreground">Estabelecimento:</span> <span className="font-medium">{ocrResult.vendor || '—'}</span></div>
                <div><span className="text-muted-foreground">Valor Total:</span> <span className="font-medium">{ocrResult.totalAmount !== undefined ? ocrResult.totalAmount.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }) : '—'}</span></div>
                <div><span className="text-muted-foreground">Data:</span> <span className="font-medium">{ocrResult.date || '—'}</span></div>
                <div className="md:col-span-2"><span className="text-muted-foreground">Descrição:</span> <span className="font-medium">{ocrResult.description || '—'}</span></div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

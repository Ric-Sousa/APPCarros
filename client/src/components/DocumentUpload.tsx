import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Upload, FileText, AlertCircle, CalendarCheck } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { post, patch, handleApiError } from '@/lib/apiUtils';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { toastApiError } from '@/lib/planLimit';
import { DOCUMENT_TYPES } from './DocumentList';
import { queryClient } from '@/lib/queryClient';

/** Validade lida do documento (OCR no servidor) que pode atualizar um prazo do veículo. */
interface Suggestion {
  field: 'insuranceDue' | 'inspectionDue' | 'iucDue';
  date: string;
  label: string;
}
const FIELD_LABEL: Record<Suggestion['field'], string> = { insuranceDue: 'do seguro', inspectionDue: 'da inspeção', iucDue: 'do IUC' };

interface DocumentUploadProps {
  vehicleId: string;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ vehicleId }) => {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [applying, setApplying] = useState(false);
  const { toast } = useToast();

  const applySuggestion = async () => {
    if (!suggestion) return;
    setApplying(true);
    try {
      await patch(`/api/vehicles/${vehicleId}`, { [suggestion.field]: suggestion.date });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({ title: 'Prazo atualizado', description: `Prazo ${FIELD_LABEL[suggestion.field]}: ${formatDate(suggestion.date)}` });
      setSuggestion(null);
    } catch (err) {
      toastApiError(toast, err, 'Não foi possível atualizar o prazo.');
    } finally {
      setApplying(false);
    }
  };

  const documentTypes = Object.entries(DOCUMENT_TYPES).map(([value, t]) => ({ value, label: t.label }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('O ficheiro não pode ter mais de 10MB');
        return;
      }
      
      // Check file type (images and PDFs only)
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(selectedFile.type)) {
        setError('Apenas são permitidos ficheiros JPEG, PNG, WebP e PDF');
        return;
      }
      
      setFile(selectedFile);
      setError('');
      
      // Auto-set description from filename if empty
      if (!description) {
        setDescription(selectedFile.name);
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !type) {
      setError('Por favor, selecione um ficheiro e um tipo de documento');
      return;
    }

    setUploading(true);
    setError('');
    setSuggestion(null);

    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('type', type);
      formData.append('description', description);
      formData.append('notes', notes);

      const created = await post<{ suggestion?: Suggestion | null }>(`/api/vehicles/${vehicleId}/documents`, formData);
      if (created?.suggestion?.date && created.suggestion.field in FIELD_LABEL) setSuggestion(created.suggestion);
      setFile(null);
      setType('');
      setDescription('');
      setNotes('');
      
      const fileInput = document.getElementById('document-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      queryClient.invalidateQueries({ queryKey: ['/api/vehicles', vehicleId, 'documents'] });
      toast({ title: 'Documento enviado' });
    } catch (error) {
      setError(handleApiError(error, 'Erro ao enviar o documento'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" aria-hidden="true" />
          Adicionar Documento
        </CardTitle>
        <CardDescription>
          Envie documentos do veículo (seguro, livrete, recibos, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {suggestion && (
          <Alert>
            <CalendarCheck className="h-4 w-4" aria-hidden="true" />
            <AlertDescription className="space-y-2">
              <p>Encontrámos a validade {formatDate(suggestion.date)} — atualizar o prazo {FIELD_LABEL[suggestion.field]}?</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={applySuggestion} disabled={applying}>{applying ? 'A atualizar...' : 'Atualizar prazo'}</Button>
                <Button size="sm" variant="ghost" onClick={() => setSuggestion(null)}>Agora não</Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div>
          <Label htmlFor="document-upload">Ficheiro</Label>
          <Input
            id="document-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFileChange}
            className="mt-1"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Máximo 10MB. Formatos: JPEG, PNG, WebP, PDF
          </p>
        </div>

        <div>
          <Label htmlFor="document-type">Tipo de Documento</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="document-type" className="mt-1">
              <SelectValue placeholder="Selecione o tipo de documento" />
            </SelectTrigger>
            <SelectContent>
              {documentTypes.map((docType) => (
                <SelectItem key={docType.value} value={docType.value}>
                  {docType.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="document-description">Descrição</Label>
          <Input
            id="document-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Nome ou descrição do documento"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="document-notes">Notas (opcional)</Label>
          <Textarea
            id="document-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Informações adicionais sobre o documento"
            className="mt-1"
            rows={3}
          />
        </div>

        <Button 
          onClick={handleUpload} 
          disabled={!file || !type || uploading}
          className="w-full"
        >
          {uploading ? (
            'A enviar...'
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
              Enviar Documento
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default DocumentUpload;

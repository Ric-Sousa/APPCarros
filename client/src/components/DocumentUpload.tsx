import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { post } from '@/lib/apiUtils';
import { queryClient } from '@/lib/queryClient';

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

  const documentTypes = [
    { value: 'insurance', label: 'Seguro' },
    { value: 'registration', label: 'Livrete' },
    { value: 'inspection_report', label: 'Relatório de Inspeção' },
    { value: 'receipt', label: 'Recibo/Fatura' },
    { value: 'other', label: 'Outro' }
  ];

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

    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('type', type);
      formData.append('description', description);
      formData.append('notes', notes);

            await post(`/api/vehicles/${vehicleId}/documents`, formData);

      
      setFile(null);
      setType('');
      setDescription('');
      setNotes('');
      
      const fileInput = document.getElementById('document-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

            queryClient.invalidateQueries({ queryKey: ['/api/vehicles', vehicleId, 'documents'] });
    } catch (error) {
      
      setError(error instanceof Error ? error.message : 'Erro ao fazer upload do documento');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Adicionar Documento
        </CardTitle>
        <CardDescription>
          Faça upload de documentos relacionados com o seu veículo (seguro, livrete, recibos, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
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
            <SelectTrigger className="mt-1">
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
          <Label htmlFor="description">Descrição</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Nome ou descrição do documento"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="notes">Notas (opcional)</Label>
          <Textarea
            id="notes"
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
            'A fazer upload...'
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Fazer Upload
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default DocumentUpload;

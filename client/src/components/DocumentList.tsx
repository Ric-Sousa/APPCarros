import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Trash2, Download, FileText, FileImage, Eye } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle } from 'lucide-react';
import { del, handleApiError, openProtectedUrl } from '@/lib/apiUtils';

interface Document {
  id: string;
  vehicleId: string;
  type: string;
  description?: string;
  fileUrl: string;
  uploadDate: string;
  notes?: string;
  createdAt: string;
}

interface DocumentListProps {
  vehicleId: string;
}

const DocumentList: React.FC<DocumentListProps> = ({ vehicleId }) => {
  const queryKey = ['/api/vehicles', vehicleId, 'documents'];
  const { data: documents = [], isLoading: loading, error: loadError } = useQuery<Document[]>({ queryKey });
  const [actionError, setActionError] = useState<string>('');
  const error = actionError || (loadError ? handleApiError(loadError) : '');

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => del(`/api/documents/${documentId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (err) => setActionError(handleApiError(err)),
  });

  const documentTypeLabels: Record<string, string> = {
    insurance: 'Seguro',
    registration: 'Livrete',
    inspection_report: 'Relatório de Inspeção',
    receipt: 'Recibo/Fatura',
    other: 'Outro'
  };

  const documentTypeColors: Record<string, string> = {
    insurance: 'bg-blue-100 text-blue-800',
    registration: 'bg-green-100 text-green-800',
    inspection_report: 'bg-yellow-100 text-yellow-800',
    receipt: 'bg-purple-100 text-purple-800',
    other: 'bg-gray-100 text-gray-800'
  };

  

  const handleDelete = async (documentId: string) => {
    if (!confirm('Tem a certeza que pretende eliminar este documento?')) {
      return;
    }

        setActionError('');
    deleteMutation.mutate(documentId);
  };

  const handleView = async (fileUrl: string) => {
    try {
            await openProtectedUrl(fileUrl);
    } catch (err: any) {
      setActionError(handleApiError(err));
    }
  };

  const getFileIcon = (fileUrl: string) => {
    const extension = fileUrl.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension || '')) {
      return <FileImage className="h-4 w-4" />;
    }
    
    return <FileText className="h-4 w-4" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-PT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">A carregar documentos...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documentos do Veículo</CardTitle>
        <CardDescription>
          Gerir documentos relacionados com o seu veículo
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Ainda não há documentos para este veículo.</p>
            <p className="text-sm">Faça upload do primeiro documento acima.</p>
            
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((document) => (
              <div
                key={document.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-3 flex-1">
                  {getFileIcon(document.fileUrl)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm truncate">
                        {document.description || 'Documento'}
                      </p>
                      <Badge 
                        className={`text-xs ${documentTypeColors[document.type] || documentTypeColors.other}`}
                      >
                        {documentTypeLabels[document.type] || document.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enviado em {formatDate(document.uploadDate)}
                    </p>
                    {document.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {document.notes}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                                        onClick={() => handleView(document.fileUrl)}
                    aria-label="Ver documento"
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                                        onClick={() => handleDelete(document.id)}
                    className="text-destructive hover:text-destructive"
                    aria-label="Eliminar documento"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DocumentList;

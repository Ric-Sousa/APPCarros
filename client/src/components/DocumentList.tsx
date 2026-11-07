import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, Eye, FileImage, FileText, Trash2 } from 'lucide-react';
import type { Document } from '@shared/schema';
import { queryClient } from '@/lib/queryClient';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import ConfirmDialog from './ConfirmDialog';
import { del, handleApiError, openProtectedUrl } from '@/lib/apiUtils';
import { formatDate } from '@/lib/utils';

export const DOCUMENT_TYPES: Record<string, { label: string; color: string }> = {
  insurance: { label: 'Seguro', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  registration: { label: 'Documento Único / Livrete', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  inspection_report: { label: 'Relatório de Inspeção', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  receipt: { label: 'Recibo/Fatura', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  other: { label: 'Outro', color: 'bg-muted text-muted-foreground' },
};

export default function DocumentList({ vehicleId }: { vehicleId: string }) {
  const queryKey = ['/api/vehicles', vehicleId, 'documents'];
  const { data: documents = [], isLoading, error: loadError } = useQuery<Document[]>({ queryKey });
  const [actionError, setActionError] = useState('');
  const [toDelete, setToDelete] = useState<Document | null>(null);
  const error = actionError || (loadError ? handleApiError(loadError) : '');

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`/api/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setToDelete(null);
    },
    onError: (err) => setActionError(handleApiError(err)),
  });

  const view = (fileUrl: string) => openProtectedUrl(fileUrl).catch((err) => setActionError(handleApiError(err)));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documentos do Veículo</CardTitle>
        <CardDescription>Seguro, livrete, inspeções e faturas</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <p className="text-center text-muted-foreground" role="status">A carregar documentos...</p>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
            <p>Ainda não há documentos para este veículo.</p>
            <p className="text-sm">Envie o primeiro documento no formulário ao lado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => {
              const type = DOCUMENT_TYPES[doc.type] ?? { label: doc.type, color: DOCUMENT_TYPES.other.color };
              const isImage = /\.(jpe?g|png|webp|gif)$/i.test(doc.fileUrl);
              const Icon = isImage ? FileImage : FileText;
              const name = doc.description || 'Documento';
              return (
                <div key={doc.id} className="flex items-center justify-between gap-3 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{name}</p>
                        <Badge className={`text-xs ${type.color}`}>{type.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Enviado em {formatDate(doc.uploadDate)}</p>
                      {doc.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{doc.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => view(doc.fileUrl)} aria-label={`Ver ${name}`}>
                      <Eye className="h-3 w-3" aria-hidden="true" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setActionError(''); setToDelete(doc); }} className="text-destructive hover:text-destructive" aria-label={`Eliminar ${name}`}>
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Eliminar documento?"
        description={`"${toDelete?.description || 'Documento'}" e o ficheiro serão apagados.`}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        pending={deleteMutation.isPending}
      />
    </Card>
  );
}

import { useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { del, handleApiError } from "@/lib/apiUtils";

const UNDO_MS = 5000;

interface Options {
  /** Query com a lista onde o item aparece (removido já da cache, de forma otimista). */
  queryKey: QueryKey;
  url: (id: string) => string;
  /** "Abastecimento eliminado" */
  message: string;
  /** Outras queries a atualizar depois de o servidor apagar. */
  invalidate?: QueryKey[];
}

/**
 * Apagar com "Anular": o item desaparece logo, aparece um toast durante 5 s e só depois o pedido DELETE é feito.
 * Ao sair da página, os pedidos pendentes são enviados de imediato.
 * ponytail: se o separador fechar nos 5 s, o pedido perde-se e o item continua a existir (seguro, nunca apaga a mais)
 */
export function useUndoableDelete<T extends { id: string }>({ queryKey, url, message, invalidate = [] }: Options) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const pending = useRef(new Map<string, () => void>());

  useEffect(() => {
    const map = pending.current;
    return () => map.forEach((commit) => commit());
  }, []);

  return (item: T) => {
    const index = queryClient.getQueryData<T[]>(queryKey)?.findIndex((x) => x.id === item.id) ?? -1;
    queryClient.setQueryData<T[]>(queryKey, (old) => old?.filter((x) => x.id !== item.id));

    let settled = false;
    // Repõe só este item (outros apagados entretanto continuam fora)
    const restore = () =>
      queryClient.setQueryData<T[]>(queryKey, (old) => {
        if (!old || old.some((x) => x.id === item.id)) return old;
        const next = [...old];
        next.splice(index < 0 ? next.length : Math.min(index, next.length), 0, item);
        return next;
      });
    const commit = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      pending.current.delete(item.id);
      del(url(item.id))
        .catch((error) => {
          restore();
          toast({ title: "Não foi possível eliminar", description: handleApiError(error), variant: "destructive" });
        })
        .finally(() => [queryKey, ...invalidate].forEach((key) => queryClient.invalidateQueries({ queryKey: key })));
    };
    const timer = setTimeout(commit, UNDO_MS);
    pending.current.set(item.id, commit);

    toast({
      title: message,
      duration: UNDO_MS,
      action: (
        <ToastAction
          altText="Anular"
          onClick={() => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            pending.current.delete(item.id);
            restore();
          }}
        >
          Anular
        </ToastAction>
      ),
    });
  };
}

import type { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";

interface Props {
  form: UseFormReturn<any>;
  oilRecommendations: string[];
  tireRecommendations: string[];
  /** Marca de óleo escolhida (sugestão, recomendação ou ao sair do campo). */
  onOilBrandCommit: (oilBrand: string) => void;
}

/** Óleo e pneus do formulário de registo: marca e data da última troca. */
export default function VehicleMaintenanceFields({ form, oilRecommendations, tireRecommendations, onOilBrandCommit }: Props) {
  return (
    <>
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Informações do Óleo</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="oilBrand"
            render={({ field }) => (
              <FormItem>
                <AutocompleteInput
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onCommit={onOilBrandCommit}
                  type="oil"
                  placeholder="Escreva para pesquisar (ex.: Castrol)"
                  label="Marca do Óleo"
                  recommendations={oilRecommendations}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastOilChange"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Última Troca</FormLabel>
                <FormControl>
                  <Input {...field} type="date" data-testid="input-last-oil-change" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Informações dos Pneus</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="tireBrand"
            render={({ field }) => (
              <FormItem>
                <AutocompleteInput
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  type="tire"
                  placeholder="Escreva para pesquisar (ex.: Michelin)"
                  label="Marca dos Pneus"
                  recommendations={tireRecommendations}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastTireChange"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Última Troca</FormLabel>
                <FormControl>
                  <Input {...field} type="date" data-testid="input-last-tire-change" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </>
  );
}

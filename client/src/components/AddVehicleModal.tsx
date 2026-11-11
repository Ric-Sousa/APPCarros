import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { post, get, handleApiError, ApiError } from "@/lib/apiUtils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VehicleRecommendationsCard } from "@/components/VehicleRecommendationsCard";
import { fetchOilInterval } from "@/hooks/useVehicleSpecs";
import VehicleRegistrationFields from "@/components/VehicleRegistrationFields";
import VehicleDatesFields from "@/components/VehicleDatesFields";
import VehiclePhotoField from "@/components/VehiclePhotoField";
import VehicleMaintenanceFields from "@/components/VehicleMaintenanceFields";
import { toastApiError } from "@/lib/planLimit";

interface AddVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const optionalNumber = z.coerce.number<number>().min(0, "Valor inválido").optional();

// Só o essencial é obrigatório; o resto pode vir da matrícula ou ser preenchido depois
const formSchema = z.object({
  licensePlate: z.string().min(1, "Matrícula é obrigatória"),
  brand: z.string().min(1, "Marca é obrigatória"),
  model: z.string().min(1, "Modelo é obrigatório"),
  year: z.coerce.number<number>().int().min(1900, "Ano de produção inválido").max(new Date().getFullYear() + 1, "Ano de produção inválido"),
  currentMileage: z.coerce.number<number>().int().min(0, "Quilómetros inválidos"),
  registrationDate: z.string().optional(),
  fuelType: z.string().optional(),
  iucCategory: z.string().optional(),
  certifyingEntity: z.string().optional(),
  vehicleCategory: z.string().optional(),
  inspectionDue: z.string().optional(),
  iucDue: z.string().optional(),
  insuranceDue: z.string().optional(),
  imageUrl: z.string().optional(),
  imageCredit: z.string().optional(),
  imageCreditUrl: z.string().optional(),
  originalColor: z.string().optional(),
  origin: z.string().optional(),
  registrationLocation: z.string().optional(),
  powerCV: optionalNumber,
  powerKW: optionalNumber,
  engineDisplacement: optionalNumber,
  oilBrand: z.string().optional(),
  lastOilChange: z.string().optional(),
  lastOilChangeMileage: optionalNumber,
  oilChangeInterval: optionalNumber,
  tireBrand: z.string().optional(),
  lastTireChange: z.string().optional(),
  lastTireChangeMileage: optionalNumber,
  tireChangeInterval: optionalNumber,
});
type FormValues = z.infer<typeof formSchema>;

const defaultValues: FormValues = {
  licensePlate: "", brand: "", model: "", year: new Date().getFullYear(), currentMileage: 0,
  registrationDate: "", fuelType: "", iucCategory: "", certifyingEntity: "", vehicleCategory: "",
  inspectionDue: "", iucDue: "", insuranceDue: "", imageUrl: "", imageCredit: "", imageCreditUrl: "",
  originalColor: "", origin: "", registrationLocation: "", powerCV: 0, powerKW: 0, engineDisplacement: 0,
  oilBrand: "", lastOilChange: "", lastOilChangeMileage: 0, oilChangeInterval: 15000,
  tireBrand: "", lastTireChange: "", lastTireChangeMileage: 0, tireChangeInterval: 50000,
};

/** Campos que a consulta de matrícula pode devolver (já com os nomes do formulário). */
const LOOKUP_FIELDS = [
  "brand", "model", "year", "registrationDate", "fuelType", "powerCV", "powerKW", "engineDisplacement",
  "iucCategory", "certifyingEntity", "vehicleCategory", "origin", "inspectionDue", "insuranceDue",
] as const;

// "12AB34" -> "12-AB-34"
const formatLicensePlate = (value: string) => {
  let formatted = value.replace(/[^0-9A-Za-z]/g, "");
  if (formatted.length > 2) formatted = formatted.slice(0, 2) + "-" + formatted.slice(2);
  if (formatted.length > 5) formatted = formatted.slice(0, 5) + "-" + formatted.slice(5, 7);
  return formatted.toUpperCase();
};

export default function AddVehicleModal({ isOpen, onClose }: AddVehicleModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [lookupLoading, setLookupLoading] = useState(false);
  const lookupPlate = useRef<string | null>(null);
  const [oilRecommendations, setOilRecommendations] = useState<string[]>([]);
  const [tireRecommendations, setTireRecommendations] = useState<string[]>([]);

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues });
  const brand = useWatch({ control: form.control, name: "brand" });
  const model = useWatch({ control: form.control, name: "model" });

  const createVehicleMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => post("/api/vehicles", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({ title: "Veículo adicionado", description: "O veículo foi adicionado com sucesso!" });
      onClose();
    },
    onError: (error) => toastApiError(toast, error, "Erro ao adicionar veículo. Tente novamente."),
  });

  // Consulta de matrícula: só preenche os campos que vierem; nunca apaga o que o utilizador escreveu
  const fetchVehicleData = async (licensePlate: string) => {
    if (lookupPlate.current === licensePlate) return;
    lookupPlate.current = licensePlate;
    setLookupLoading(true);
    try {
      const data = await get<Partial<Record<(typeof LOOKUP_FIELDS)[number], string | number>>>(`/api/vehicle-data/${encodeURIComponent(licensePlate)}`);
      let filled = 0;
      for (const key of LOOKUP_FIELDS) {
        const value = data[key];
        if (value !== undefined && value !== null && value !== "") {
          form.setValue(key, value as never, { shouldValidate: true });
          filled++;
        }
      }
      toast({ title: "Dados encontrados", description: `${filled} campos preenchidos a partir da matrícula.` });
    } catch (error) {
      const notFound = error instanceof ApiError && error.status === 404;
      toast({
        title: notFound ? "Matrícula sem dados" : "Consulta indisponível",
        description: notFound ? "Não foram encontrados dados; preencha os campos manualmente." : handleApiError(error),
      });
    } finally {
      setLookupLoading(false);
    }
  };

  const onSubmit = (data: FormValues) => {
    // Campos vazios ou a 0 (opcionais) não são enviados; os km atuais podem ser 0
    const serverData = Object.fromEntries(
      Object.entries(data).filter(([key, v]) => v !== "" && v !== undefined && (v !== 0 || key === "currentMileage")),
    );
    createVehicleMutation.mutate(serverData);
  };

  const onOilBrandCommit = async (oilBrand: string) => {
    const { brand, model } = form.getValues();
    if (!brand || !model || !oilBrand) return;
    const info = await fetchOilInterval(oilBrand, brand, model);
    if (info) {
      form.setValue("oilChangeInterval", info.intervalKm);
      toast({ title: "Intervalo de mudança de óleo", description: info.description });
    }
  };

  // Limpa o formulário sempre que o diálogo fecha
  useEffect(() => {
    if (!isOpen) {
      form.reset(defaultValues);
      lookupPlate.current = null;
    }
  }, [isOpen, form]);

  const busy = createVehicleMutation.isPending || lookupLoading;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Adicionar Veículo</DialogTitle>
          <DialogDescription>Escreva a matrícula para preencher os dados automaticamente.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6 min-w-0">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit, (errors) => {
                  const first = Object.values(errors)[0];
                  toast({
                    title: "Erro de validação",
                    description: first?.message ? String(first.message) : "Verifique os campos obrigatórios.",
                    variant: "destructive",
                  });
                })}
                className="space-y-6"
              >
                <VehiclePhotoField form={form} />

                <FormField
                  control={form.control}
                  name="licensePlate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Matrícula</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="12-AB-34"
                          onChange={(e) => {
                            const formatted = formatLicensePlate(e.target.value);
                            field.onChange(formatted);
                            if (formatted.length === 8) fetchVehicleData(formatted);
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                          data-testid="input-license-plate"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {lookupLoading && (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm" role="status">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                    A consultar a matrícula...
                  </div>
                )}

                <VehicleRegistrationFields form={form} />

                <FormField
                  control={form.control}
                  name="currentMileage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quilómetros Atuais</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" inputMode="numeric" placeholder="123000" data-testid="input-current-mileage" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <VehicleMaintenanceFields
                  form={form}
                  oilRecommendations={oilRecommendations}
                  tireRecommendations={tireRecommendations}
                  onOilBrandCommit={onOilBrandCommit}
                />

                <VehicleDatesFields form={form} />

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={onClose} data-testid="button-cancel">
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-primary to-secondary hover:shadow-lg transition-all duration-300"
                    disabled={busy}
                    data-testid="button-submit"
                  >
                    {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> : <Plus className="w-4 h-4 mr-2" aria-hidden="true" />}
                    {lookupLoading ? "A obter dados..." : "Adicionar"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>

          <div className="space-y-4 min-w-0">
            <VehicleRecommendationsCard
              brand={brand}
              model={model}
              onOilRecommendation={setOilRecommendations}
              onTireRecommendation={setTireRecommendations}
              onOilIntervalUpdate={(intervalKm) => form.setValue("oilChangeInterval", intervalKm)}
              onTireIntervalUpdate={(intervalKm) => form.setValue("tireChangeInterval", intervalKm)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

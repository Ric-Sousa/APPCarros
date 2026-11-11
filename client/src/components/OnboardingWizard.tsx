import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Car, CheckCircle2, Image as ImageIcon, Loader2, Search } from "lucide-react";
import { FUEL_TYPES } from "@shared/fuel";
import { BRAND } from "@shared/brand";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VehicleImagePicker, type PickedPhoto } from "@/components/VehicleImagePicker";
import { useToast } from "@/hooks/use-toast";
import { useConfig } from "@/hooks/useConfig";
import { useAdaptiveUI, LEAD_DAYS } from "@/contexts/AdaptiveUIContext";
import { ApiError, get, post } from "@/lib/apiUtils";
import { toastApiError } from "@/lib/planLimit";
import { suggestDeadlines } from "@/lib/deadlineHints";
import { formatDate } from "@/lib/utils";

const formatPlate = (value: string) => {
  let v = value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  if (v.length > 2) v = `${v.slice(0, 2)}-${v.slice(2)}`;
  if (v.length > 5) v = `${v.slice(0, 5)}-${v.slice(5, 7)}`;
  return v;
};

interface Draft {
  licensePlate: string;
  brand: string;
  model: string;
  year: string;
  currentMileage: string;
  registrationDate: string;
  fuelType: string;
  vehicleCategory: string;
  iucCategory: string;
  inspectionDue: string;
  iucDue: string;
  insuranceDue: string;
  photo: PickedPhoto | null;
}

const EMPTY: Draft = {
  licensePlate: "", brand: "", model: "", year: "", currentMileage: "", registrationDate: "", fuelType: "",
  vehicleCategory: "", iucCategory: "", inspectionDue: "", iucDue: "", insuranceDue: "", photo: null,
};

const STEPS = ["O seu veículo", "Confirmar", "Lembretes"];

/**
 * Primeira experiência: matrícula → confirmar dados e prazos → quando avisar.
 * O objetivo é ter um veículo com lembretes ativos em menos de um minuto.
 */
export default function OnboardingWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const config = useConfig();
  const { preferences, updatePreferences } = useAdaptiveUI();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "done" | "none">("idle");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [leadDays, setLeadDays] = useState<number[]>(preferences.notificationPreferences.leadDays);
  const [emailOn, setEmailOn] = useState(preferences.notificationPreferences.email);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const plateLookup = config?.features.plateLookup ?? false;

  // Ao avançar para "Confirmar", sugere IUC e inspeção a partir da data de matrícula (sem apagar o que já foi escrito)
  const goToConfirm = () => {
    const s = suggestDeadlines(draft.registrationDate, draft.vehicleCategory, draft.iucCategory);
    set({ iucDue: draft.iucDue || s.iucDue || "", inspectionDue: draft.inspectionDue || s.inspectionDue || "" });
    setStep(1);
  };

  const lookup = async () => {
    setLookupState("loading");
    try {
      const data = await get<Record<string, string | number | undefined>>(`/api/vehicle-data/${encodeURIComponent(draft.licensePlate)}`);
      const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));
      setDraft((d) => ({
        ...d,
        brand: str(data.brand) || d.brand,
        model: str(data.model) || d.model,
        year: str(data.year) || d.year,
        registrationDate: str(data.registrationDate) || d.registrationDate,
        fuelType: str(data.fuelType) || d.fuelType,
        vehicleCategory: str(data.vehicleCategory) || d.vehicleCategory,
        iucCategory: str(data.iucCategory) || d.iucCategory,
        inspectionDue: str(data.inspectionDue) || d.inspectionDue,
        insuranceDue: str(data.insuranceDue) || d.insuranceDue,
      }));
      setLookupState("done");
    } catch (error) {
      setLookupState("none");
      if (!(error instanceof ApiError && error.status === 404)) toastApiError(toast, error);
    }
  };

  const markOnboarded = () =>
    post("/api/user/onboarded")
      .catch(() => {})
      .finally(() => queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] }));

  const skip = () => {
    markOnboarded();
    onClose();
  };

  const finish = async () => {
    setSaving(true);
    try {
      await updatePreferences({ notificationPreferences: { ...preferences.notificationPreferences, email: emailOn, leadDays } });
      const body: Record<string, unknown> = {
        licensePlate: draft.licensePlate,
        brand: draft.brand.trim(),
        model: draft.model.trim(),
        year: Number(draft.year),
        currentMileage: Number(draft.currentMileage || 0),
        ...(draft.photo ?? {}),
      };
      for (const key of ["registrationDate", "fuelType", "vehicleCategory", "iucCategory", "inspectionDue", "iucDue", "insuranceDue"] as const) {
        if (draft[key]) body[key] = draft[key];
      }
      await post("/api/vehicles", body);
      await markOnboarded();
      ["/api/vehicles", "/api/stats", "/api/alerts"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      setFinished(true);
    } catch (error) {
      toastApiError(toast, error, "Não foi possível guardar o veículo.");
    } finally {
      setSaving(false);
    }
  };

  const step1Valid = draft.licensePlate.length >= 6 && draft.brand.trim() && draft.model.trim() && Number(draft.year) >= 1900 && Number(draft.currentMileage || 0) >= 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && (finished ? onClose() : skip())}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {finished ? (
          <div className="text-center space-y-4 py-4">
            <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto" aria-hidden="true" />
            <DialogHeader>
              <DialogTitle className="text-center">Está tudo pronto!</DialogTitle>
              <DialogDescription className="text-center">
                O {draft.brand} {draft.model} foi registado. Vamos avisá-lo antes de cada prazo.
              </DialogDescription>
            </DialogHeader>
            <Button onClick={onClose} className="w-full">Ver o meu dashboard</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Bem-vindo ao {BRAND.name}</DialogTitle>
              <DialogDescription>
                Passo {step + 1} de {STEPS.length}: {STEPS[step]}
              </DialogDescription>
            </DialogHeader>
            <ol className="flex gap-2" aria-hidden="true">
              {STEPS.map((s, i) => (
                <li key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
              ))}
            </ol>

            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="ob-plate">Qual é a matrícula?</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      id="ob-plate"
                      value={draft.licensePlate}
                      placeholder="12-AB-34"
                      autoFocus
                      onChange={(e) => set({ licensePlate: formatPlate(e.target.value) })}
                      className="text-lg tracking-wider"
                    />
                    {plateLookup && (
                      <Button type="button" variant="outline" onClick={lookup} disabled={draft.licensePlate.length < 8 || lookupState === "loading"}>
                        {lookupState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                        <span className="ml-1">Procurar</span>
                      </Button>
                    )}
                  </div>
                  {lookupState === "done" && <p className="mt-1 text-sm text-green-700 dark:text-green-400" role="status">Dados encontrados. Confirme abaixo.</p>}
                  {lookupState === "none" && <p className="mt-1 text-sm text-muted-foreground" role="status">Sem dados para esta matrícula; preencha à mão.</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <Label htmlFor="ob-brand">Marca</Label>
                    <Input id="ob-brand" value={draft.brand} onChange={(e) => set({ brand: e.target.value })} placeholder="Renault" className="mt-1" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <Label htmlFor="ob-model">Modelo</Label>
                    <Input id="ob-model" value={draft.model} onChange={(e) => set({ model: e.target.value })} placeholder="Clio" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="ob-year">Ano</Label>
                    <Input id="ob-year" type="number" inputMode="numeric" value={draft.year} onChange={(e) => set({ year: e.target.value })} placeholder="2019" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="ob-km">Quilómetros</Label>
                    <Input id="ob-km" type="number" inputMode="numeric" value={draft.currentMileage} onChange={(e) => set({ currentMileage: e.target.value })} placeholder="85000" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="ob-reg">Data da matrícula</Label>
                    <Input id="ob-reg" type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(draft.registrationDate) ? draft.registrationDate : ""} onChange={(e) => set({ registrationDate: e.target.value })} className="mt-1" />
                    {draft.registrationDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.registrationDate) && (
                      <p className="text-xs text-muted-foreground mt-1">Da matrícula: {draft.registrationDate}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="ob-fuel">Combustível</Label>
                    <Select value={draft.fuelType} onValueChange={(v) => set({ fuelType: v })}>
                      <SelectTrigger id="ob-fuel" className="mt-1"><SelectValue placeholder="Escolher" /></SelectTrigger>
                      <SelectContent>
                        {FUEL_TYPES.map((f) => <SelectItem key={f.code} value={f.code}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Com a data da matrícula sugerimos os prazos do IUC e da inspeção.</p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  {draft.photo ? (
                    <img src={draft.photo.imageUrl} alt="" className="h-16 w-24 rounded object-cover" />
                  ) : (
                    <div className="h-16 w-24 rounded bg-muted flex items-center justify-center"><Car className="h-6 w-6 text-muted-foreground" aria-hidden="true" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words">{draft.brand} {draft.model} · {draft.year}</p>
                    <p className="text-sm text-muted-foreground">{draft.licensePlate}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                    <ImageIcon className="h-4 w-4 mr-1" aria-hidden="true" /> Foto
                  </Button>
                </div>
                <VehicleImagePicker
                  open={pickerOpen}
                  onOpenChange={setPickerOpen}
                  vehicle={{ brand: draft.brand, model: draft.model, year: Number(draft.year) || null, vehicleCategory: draft.vehicleCategory, iucCategory: draft.iucCategory }}
                  onSelect={(photo) => set({ photo })}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="ob-iuc">IUC até</Label>
                    <Input id="ob-iuc" type="date" value={draft.iucDue} onChange={(e) => set({ iucDue: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="ob-insp">Próxima inspeção</Label>
                    <Input id="ob-insp" type="date" value={draft.inspectionDue} onChange={(e) => set({ inspectionDue: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="ob-ins">Seguro (opcional)</Label>
                    <Input id="ob-ins" type="date" value={draft.insuranceDue} onChange={(e) => set({ insuranceDue: e.target.value })} className="mt-1" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {draft.iucDue || draft.inspectionDue
                    ? `Datas sugeridas a partir da matrícula${draft.registrationDate ? ` (${formatDate(draft.registrationDate, draft.registrationDate)})` : ""}. Confirme ou corrija.`
                    : "Indique as datas que souber; pode completar depois."}
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Bell className="h-5 w-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                  <p className="text-sm">Avisamos antes do IUC, da inspeção, do seguro e das mudanças de óleo e pneus.</p>
                </div>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium mb-1">Quando quer ser avisado?</legend>
                  {LEAD_DAYS.map((d) => (
                    <div key={d} className="flex items-center gap-2">
                      <input type="checkbox" className="h-4 w-4 accent-primary" id={`ob-lead-${d}`} checked={leadDays.includes(d)} onChange={(e) => setLeadDays((cur) => (e.target.checked ? [...cur, d] : cur.filter((x) => x !== d)))} />
                      <Label htmlFor={`ob-lead-${d}`} className="font-normal">{d === 1 ? "1 dia antes" : `${d} dias antes`}</Label>
                    </div>
                  ))}
                </fieldset>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 accent-primary" id="ob-email" checked={emailOn} onChange={(e) => setEmailOn(e.target.checked)} />
                  <Label htmlFor="ob-email" className="font-normal">Receber lembretes por email</Label>
                </div>
                {config?.features.push && (
                  <p className="text-sm text-muted-foreground">
                    Também pode receber notificações no telemóvel em <Link href="/definicoes" className="text-primary underline">Definições</Link>.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={skip}>Saltar</Button>
              <div className="flex gap-2">
                {step > 0 && <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>Voltar</Button>}
                {step === 0 && <Button type="button" onClick={goToConfirm} disabled={!step1Valid}>Continuar</Button>}
                {step === 1 && <Button type="button" onClick={() => setStep(2)}>Continuar</Button>}
                {step === 2 && (
                  <Button type="button" onClick={finish} disabled={saving || leadDays.length === 0 && emailOn}>
                    {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />}
                    Concluir
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

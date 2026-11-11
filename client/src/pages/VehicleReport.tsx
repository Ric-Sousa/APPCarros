import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Printer } from "lucide-react";
import type { ExpenseRecord, FuelRecord, MaintenanceRecord, Vehicle } from "@shared/schema";
import { BRAND } from "@shared/brand";
import { fuelLabel } from "@shared/fuel";
import { get, handleApiError, isPlanLimit } from "@/lib/apiUtils";
import { expenseBreakdown } from "@/lib/expenses";
import { maintenanceLabel } from "@/lib/maintenance";
import { formatDate, formatEuro, formatNumber } from "@/lib/utils";
import { DOCUMENT_TYPES } from "@/components/DocumentList";

interface Report {
  vehicle: Vehicle;
  owner: { name: string };
  maintenance: MaintenanceRecord[];
  fuel: FuelRecord[];
  expenses: ExpenseRecord[];
  documents: { type: string; description: string | null; uploadDate: string }[];
  totals: { maintenanceCost: number; fuelCost: number; fuelLiters: number; expenses: number; consumptionL100: number | null; kmTracked: number };
  generatedAt: string;
}

// Página de impressão: cores claras fixas (não segue o tema escuro) e A4 com margens
const PRINT_CSS = `
@page { size: A4; margin: 14mm; }
@media print {
  html, body { background: #fff !important; }
  .no-print { display: none !important; }
  .report section { break-inside: avoid; }
  .report tr { break-inside: avoid; }
}`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-base font-semibold border-b border-zinc-300 pb-1 mb-2">{title}</h2>
      {children}
    </section>
  );
}

const th = "text-left font-medium text-zinc-600 py-1 pr-3";
const td = "py-1 pr-3 align-top";

/** Livro de revisões: histórico completo do veículo, pronto a imprimir ou guardar em PDF (útil na venda do carro). */
export default function VehicleReport() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const { data, isLoading, error } = useQuery<Report>({
    queryKey: ["/api/vehicles", vehicleId, "report"],
    queryFn: () => get<Report>(`/api/vehicles/${encodeURIComponent(vehicleId!)}/report`),
    enabled: !!vehicleId,
    retry: false,
  });

  if (isLoading) {
    return <main className="min-h-screen bg-white text-zinc-700 p-8 flex items-center gap-2" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> A preparar o livro de revisões...</main>;
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-white text-zinc-800 p-8 max-w-xl mx-auto space-y-3">
        <h1 className="text-xl font-semibold">{isPlanLimit(error) ? "O livro de revisões em PDF é Premium" : "Não foi possível gerar o relatório"}</h1>
        <p className="text-zinc-600">{handleApiError(error, "Veículo não encontrado.")}</p>
        {isPlanLimit(error) && <Link href="/planos" className="inline-block rounded-md bg-blue-600 px-4 py-2 text-white">Ver planos</Link>}
      </main>
    );
  }

  const { vehicle, totals } = data;
  const breakdown = expenseBreakdown(data.expenses);
  const maintenance = [...data.maintenance].sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());

  return (
    <main className="report min-h-screen bg-white text-zinc-900 print:min-h-0">
      <style>{PRINT_CSS}</style>
      <div className="no-print sticky top-0 border-b border-zinc-200 bg-white/95 backdrop-blur px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-600">Pré-visualização do livro de revisões</p>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir / Guardar PDF
        </button>
      </div>

      <article className="mx-auto max-w-[210mm] px-4 sm:px-8 py-6 text-sm">
        <header className="flex items-start justify-between gap-4 border-b-2 border-zinc-800 pb-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">{BRAND.name} · Livro de revisões</p>
            <h1 className="text-2xl font-bold">{vehicle.brand} {vehicle.model}</h1>
            <p className="text-zinc-600">{vehicle.licensePlate} · {vehicle.year} · {fuelLabel(vehicle.fuelType)}</p>
          </div>
          {vehicle.imageUrl && <img src={vehicle.imageUrl} alt="" className="h-20 w-32 object-cover rounded" />}
        </header>

        <Section title="Dados do veículo">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1">
            <div><dt className="text-zinc-500">Proprietário</dt><dd>{data.owner.name}</dd></div>
            <div><dt className="text-zinc-500">Quilómetros atuais</dt><dd>{formatNumber(vehicle.currentMileage)} km</dd></div>
            <div><dt className="text-zinc-500">Data da matrícula</dt><dd>{formatDate(vehicle.registrationDate, "—")}</dd></div>
            <div><dt className="text-zinc-500">Próxima inspeção</dt><dd>{formatDate(vehicle.inspectionDue, "—")}</dd></div>
            <div><dt className="text-zinc-500">IUC</dt><dd>{formatDate(vehicle.iucDue, "—")}</dd></div>
            <div><dt className="text-zinc-500">Seguro</dt><dd>{formatDate(vehicle.insuranceDue, "—")}</dd></div>
            <div><dt className="text-zinc-500">Última mudança de óleo</dt><dd>{formatDate(vehicle.lastOilChange, "—")}{vehicle.lastOilChangeMileage ? ` · ${formatNumber(vehicle.lastOilChangeMileage)} km` : ""}</dd></div>
            <div><dt className="text-zinc-500">Pneus</dt><dd>{formatDate(vehicle.lastTireChange, "—")}{vehicle.lastTireChangeMileage ? ` · ${formatNumber(vehicle.lastTireChangeMileage)} km` : ""}</dd></div>
          </dl>
        </Section>

        <Section title="Resumo">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded border border-zinc-200 p-2"><dt className="text-zinc-500 text-xs">Manutenção</dt><dd className="font-semibold">{formatEuro(totals.maintenanceCost)}</dd></div>
            <div className="rounded border border-zinc-200 p-2"><dt className="text-zinc-500 text-xs">Combustível</dt><dd className="font-semibold">{formatEuro(totals.fuelCost)}</dd></div>
            <div className="rounded border border-zinc-200 p-2"><dt className="text-zinc-500 text-xs">Outras despesas</dt><dd className="font-semibold">{formatEuro(totals.expenses)}</dd></div>
            <div className="rounded border border-zinc-200 p-2"><dt className="text-zinc-500 text-xs">Consumo médio</dt><dd className="font-semibold">{totals.consumptionL100 != null ? `${formatNumber(totals.consumptionL100, 1)} L/100 km` : "—"}</dd></div>
          </dl>
        </Section>

        <Section title={`Histórico de manutenção (${maintenance.length})`}>
          {maintenance.length === 0 ? <p className="text-zinc-500">Sem registos.</p> : (
            <table className="w-full">
              <thead><tr><th className={th}>Data</th><th className={th}>Tipo</th><th className={th}>Descrição</th><th className={th}>Km</th><th className={`${th} text-right`}>Custo</th></tr></thead>
              <tbody className="divide-y divide-zinc-200">
                {maintenance.map((m) => (
                  <tr key={m.id}>
                    <td className={td}>{formatDate(m.performedAt)}</td>
                    <td className={td}>{maintenanceLabel(m.type)}</td>
                    <td className={td}>{m.description}</td>
                    <td className={td}>{m.mileage != null ? formatNumber(m.mileage) : "—"}</td>
                    <td className={`${td} text-right`}>{m.cost != null && Number(m.cost) > 0 ? formatEuro(m.cost) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Combustível">
          <p>
            {data.fuel.length} abastecimentos · {formatNumber(totals.fuelLiters, 1)} L · {formatEuro(totals.fuelCost)}
            {totals.kmTracked > 0 && ` · ${formatNumber(totals.kmTracked)} km registados`}
          </p>
        </Section>

        <Section title="Despesas por categoria">
          {breakdown.categories.length === 0 ? <p className="text-zinc-500">Sem despesas.</p> : (
            <table className="w-full">
              <tbody className="divide-y divide-zinc-200">
                {breakdown.categories.map((c) => (
                  <tr key={c.key}><td className={td}>{c.label}</td><td className={td}>{c.count}</td><td className={`${td} text-right`}>{formatEuro(c.total)}</td></tr>
                ))}
                <tr className="font-semibold"><td className={td}>Total</td><td className={td} /><td className={`${td} text-right`}>{formatEuro(breakdown.total)}</td></tr>
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Documentos">
          {data.documents.length === 0 ? <p className="text-zinc-500">Sem documentos.</p> : (
            <ul className="list-disc pl-5">
              {data.documents.map((d, i) => (
                <li key={i}>{DOCUMENT_TYPES[d.type]?.label ?? d.type}{d.description ? ` — ${d.description}` : ""} ({formatDate(d.uploadDate)})</li>
              ))}
            </ul>
          )}
        </Section>

        <footer className="mt-8 border-t border-zinc-300 pt-2 text-xs text-zinc-500 flex justify-between gap-2">
          <span>Gerado por {BRAND.name} em {new Date(data.generatedAt).toLocaleString("pt-PT")}</span>
          <span>{BRAND.website}</span>
        </footer>
      </article>
    </main>
  );
}

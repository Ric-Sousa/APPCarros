// Planos e o que cada um permite. O servidor aplica os limites; o cliente usa-os para mostrar o que está incluído.

export type PlanId = 'free' | 'premium' | 'business';

export interface Plan {
  id: PlanId;
  name: string;
  /** Preço mensal em euros (referência para a página de preços; o valor cobrado vem do fornecedor de pagamentos). */
  priceMonthly: number;
  priceNote?: string;
  /** null = ilimitado */
  maxVehicles: number | null;
  features: {
    pushNotifications: boolean;
    receiptOcr: boolean;
    pdfReport: boolean;
    sharing: boolean;
    fleetReport: boolean;
  };
  highlights: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Grátis',
    priceMonthly: 0,
    maxVehicles: 1,
    features: { pushNotifications: false, receiptOcr: false, pdfReport: false, sharing: false, fleetReport: false },
    highlights: ['1 veículo', 'Lembretes por email (IUC, inspeção, seguro, óleo)', 'Histórico de manutenção e despesas', 'Prazos no calendário'],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    priceMonthly: 2.99,
    maxVehicles: null,
    features: { pushNotifications: true, receiptOcr: true, pdfReport: true, sharing: true, fleetReport: false },
    highlights: ['Veículos ilimitados', 'Notificações no telemóvel', 'Leitura automática de recibos', 'Livro de revisões em PDF', 'Partilha com a família'],
  },
  business: {
    id: 'business',
    name: 'Empresas',
    priceMonthly: 1.99,
    priceNote: 'por veículo/mês',
    maxVehicles: null,
    features: { pushNotifications: true, receiptOcr: true, pdfReport: true, sharing: true, fleetReport: true },
    highlights: ['Tudo do Premium', 'Vários condutores por veículo', 'Relatório da frota (CSV)', 'Suporte prioritário'],
  },
};

/** Plano efetivo: um plano pago expirado volta a Grátis. */
export function effectivePlan(plan: string | null | undefined, expiresAt?: Date | string | null, now = new Date()): Plan {
  const id = (plan && plan in PLANS ? plan : 'free') as PlanId;
  if (id !== 'free' && expiresAt && new Date(expiresAt).getTime() < now.getTime()) return PLANS.free;
  return PLANS[id];
}

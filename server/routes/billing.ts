// Planos pagos. Com STRIPE_SECRET_KEY usa o Stripe (subscrições, portal do cliente e webhook).
// Em desenvolvimento, sem chave, há uma ativação direta para testar os planos.
// ponytail: faturação certificada pela AT pendente (ligar um software certificado ao webhook quando houver empresa)
import express, { type Express } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { effectivePlan, type PlanId } from '@shared/plans';
import { storage } from '../storage';
import { requireAuth, userId, HttpError } from '../http';
import { appUrl } from '../services/mailer';

export const paymentsProvider = (): 'stripe' | 'dev' | 'none' =>
  process.env.STRIPE_SECRET_KEY ? 'stripe' : process.env.NODE_ENV !== 'production' ? 'dev' : 'none';

let stripeClient: Stripe | null = null;
const stripe = () => (stripeClient ??= new Stripe(process.env.STRIPE_SECRET_KEY!));

const PRICE_ENV: Record<Exclude<PlanId, 'free'>, string> = { premium: 'STRIPE_PRICE_PREMIUM', business: 'STRIPE_PRICE_BUSINESS' };

/** Fim do período pago de uma subscrição (o campo mudou de sítio nas versões recentes da API). */
const periodEnd = (sub: any): Date | null => {
  const ts = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000) : null;
};

async function applySubscription(sub: any, userIdHint?: string) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  const user = userIdHint ? await storage.getUser(userIdHint) : await storage.findUserByStripeCustomer(customerId);
  if (!user) return;
  const active = ['active', 'trialing', 'past_due'].includes(sub.status);
  const plan = (sub.metadata?.plan as PlanId) || 'premium';
  await storage.setUserFields(user.id, {
    stripeCustomerId: customerId,
    plan: active ? plan : 'free',
    planExpiresAt: active ? periodEnd(sub) : null,
  });
}

/** Webhook do Stripe: tem de receber o corpo em bruto (registado antes do express.json, ver index.ts). */
export function registerBillingWebhook(app: Express) {
  app.post('/api/billing/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
    if (paymentsProvider() !== 'stripe' || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(404).end();
    let event: Stripe.Event;
    try {
      event = stripe().webhooks.constructEvent(req.body, String(req.headers['stripe-signature'] ?? ''), process.env.STRIPE_WEBHOOK_SECRET);
    } catch {
      return res.status(400).json({ message: 'Assinatura inválida' });
    }
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const sub = await stripe().subscriptions.retrieve(String(session.subscription));
        await applySubscription(sub, session.client_reference_id ?? undefined);
        if (session.client_reference_id) await storage.trackEvent(session.client_reference_id, 'subscribed');
      }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      await applySubscription(event.data.object);
    }
    res.json({ received: true });
  });
}

export function registerBillingRoutes(app: Express) {
  app.get('/api/billing', requireAuth, async (req, res) => {
    const user = await storage.getUser(userId(req));
    const plan = effectivePlan(user?.plan, user?.planExpiresAt);
    res.json({
      plan: plan.id,
      planExpiresAt: plan.id === 'free' ? null : user?.planExpiresAt ?? null,
      provider: paymentsProvider(),
      canManage: paymentsProvider() === 'stripe' && !!user?.stripeCustomerId,
    });
  });

  app.post('/api/billing/checkout', requireAuth, async (req, res) => {
    if (paymentsProvider() !== 'stripe') throw new HttpError(400, 'Pagamentos não configurados.');
    const { plan, quantity } = z.object({ plan: z.enum(['premium', 'business']), quantity: z.coerce.number().int().min(1).max(500).optional() }).parse(req.body);
    const price = process.env[PRICE_ENV[plan]];
    if (!price) throw new HttpError(500, `Preço do plano não configurado (${PRICE_ENV[plan]}).`);
    const user = await storage.getUser(userId(req));
    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: plan === 'business' ? quantity ?? Math.max(1, (await storage.getOwnedVehicles(userId(req))).length) : 1 }],
      ...(user?.stripeCustomerId ? { customer: user.stripeCustomerId } : { customer_email: user?.email ?? undefined }),
      client_reference_id: userId(req),
      metadata: { userId: userId(req), plan },
      subscription_data: { metadata: { userId: userId(req), plan } },
      allow_promotion_codes: true,
      locale: 'pt',
      success_url: appUrl('/planos?checkout=success'),
      cancel_url: appUrl('/planos?checkout=cancel'),
    });
    res.json({ url: session.url });
  });

  app.post('/api/billing/portal', requireAuth, async (req, res) => {
    const user = await storage.getUser(userId(req));
    if (paymentsProvider() !== 'stripe' || !user?.stripeCustomerId) throw new HttpError(400, 'Sem subscrição para gerir.');
    const portal = await stripe().billingPortal.sessions.create({ customer: user.stripeCustomerId, return_url: appUrl('/planos') });
    res.json({ url: portal.url });
  });

  // Só em desenvolvimento e sem Stripe: muda o plano diretamente (30 dias)
  app.post('/api/billing/dev-activate', requireAuth, async (req, res) => {
    if (paymentsProvider() !== 'dev') throw new HttpError(404, 'Não disponível.');
    const { plan } = z.object({ plan: z.enum(['free', 'premium', 'business']) }).parse(req.body);
    await storage.setUserFields(userId(req), { plan, planExpiresAt: plan === 'free' ? null : new Date(Date.now() + 30 * 86_400_000) });
    res.status(204).send();
  });
}

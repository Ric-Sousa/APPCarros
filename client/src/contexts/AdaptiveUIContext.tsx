import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { get, post } from '@/lib/apiUtils';

export type ThemeMode = 'auto' | 'light' | 'dark';

export interface UserPreferences {
  theme: ThemeMode;
  notificationPreferences: NotificationPreferences;
}

export const LEAD_DAYS = [30, 7, 1] as const;

export interface NotificationPreferences {
  /** Lembretes por email */
  email: boolean;
  /** Notificações push nos dispositivos subscritos */
  push: boolean;
  /** Com quantos dias de antecedência avisar (subconjunto de LEAD_DAYS) */
  leadDays: number[];
  /** Resumo semanal dos próximos prazos */
  weeklyDigest: boolean;
  maintenance: boolean;
  fuel: boolean;
  expenses: boolean;
  recommendations: boolean;
}

interface PreferencesContext {
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
}

const LOCAL_KEY = 'user-preferences';
const DEFAULTS: UserPreferences = {
  theme: 'auto',
  notificationPreferences: {
    email: true, push: true, leadDays: [30, 7, 1], weeklyDigest: false,
    maintenance: true, fuel: true, expenses: false, recommendations: true,
  },
};

/** Junta preferências guardadas (locais ou do servidor) com os valores por omissão, ignorando valores antigos/inválidos */
function merge(base: UserPreferences, raw: unknown): UserPreferences {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<UserPreferences>;
  return {
    theme: p.theme === 'light' || p.theme === 'dark' || p.theme === 'auto' ? p.theme : base.theme,
    notificationPreferences: (() => {
      const n = { ...base.notificationPreferences, ...(p.notificationPreferences ?? {}) };
      const lead = Array.isArray(n.leadDays) ? n.leadDays.filter((d) => (LEAD_DAYS as readonly number[]).includes(d)) : base.notificationPreferences.leadDays;
      return { ...n, leadDays: lead };
    })(),
  };
}

function readLocal(): UserPreferences {
  try {
    return merge(DEFAULTS, JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null'));
  } catch {
    return DEFAULTS;
  }
}

const Ctx = createContext<PreferencesContext | undefined>(undefined);

export const useAdaptiveUI = () => {
  const context = useContext(Ctx);
  if (!context) throw new Error('useAdaptiveUI tem de estar dentro de AdaptiveUIProvider');
  return context;
};

export function AdaptiveUIProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(readLocal);
  const { user } = useAuth();

  // Com sessão iniciada, as preferências do servidor têm prioridade sobre as locais
  useEffect(() => {
    if (!user) return;
    get<unknown>('/api/user/preferences')
      .then((remote) => setPreferences((prev) => merge(prev, remote)))
      .catch(() => { /* fica com as preferências locais */ });
  }, [user]);

  // Tema: "auto" segue o sistema operativo, incluindo mudanças enquanto a app está aberta
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = preferences.theme === 'dark' || (preferences.theme === 'auto' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    if (preferences.theme !== 'auto') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preferences.theme]);

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    const next = { ...preferences, ...updates };
    setPreferences(next);
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    } catch { /* armazenamento indisponível */ }
    if (user) await post('/api/user/preferences', next).catch(() => { /* guardado localmente */ });
  }, [preferences, user]);

  return <Ctx.Provider value={{ preferences, updatePreferences }}>{children}</Ctx.Provider>;
}

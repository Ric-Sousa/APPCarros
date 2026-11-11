import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Home, Fuel, Receipt, User, Bell, LogOut, Car, Timer, Navigation, Settings, HelpCircle, Crown,
  BarChart3, MoreHorizontal, MailWarning, X, type LucideIcon,
} from "lucide-react";
import { useAdaptiveUI } from "@/contexts/AdaptiveUIContext";
import type { ThemeMode } from "@/contexts/AdaptiveUIContext";
import { queryClient } from "@/lib/queryClient";
import { post, setAccessToken, handleApiError } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { BRAND } from "@shared/brand";

interface NavItem { icon: LucideIcon; label: string; href: string }

const mainItems: NavItem[] = [
  { icon: Home, label: "Início", href: "/dashboard" },
  { icon: Fuel, label: "Combustível", href: "/fuel" },
  { icon: Timer, label: "Gravador KM", href: "/mileage-tracker" },
  { icon: Receipt, label: "Despesas", href: "/expenses" },
  { icon: Navigation, label: "Planeador", href: "/route-planner" },
];

const accountItems: NavItem[] = [
  { icon: User, label: "Perfil", href: "/profile" },
  { icon: Settings, label: "Definições", href: "/definicoes" },
  { icon: Crown, label: "Planos", href: "/planos" },
  { icon: HelpCircle, label: "Ajuda", href: "/ajuda" },
];

/** Na barra inferior do telemóvel cabem 4 atalhos + "Mais". */
const bottomItems: NavItem[] = [mainItems[0], mainItems[1], mainItems[3], mainItems[4]];

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate: () => void }) {
  const [location] = useLocation();
  return (
    <>
      {items.map(({ icon: Icon, label, href }) => {
        const active = location === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm transition-colors ${
              active ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="w-5 h-5" aria-hidden="true" />
            <span className="font-medium">{label}</span>
          </Link>
        );
      })}
    </>
  );
}

function SidebarContent({ onNavigate, onLogout }: { onNavigate: () => void; onLogout: () => void }) {
  const { user } = useAuth();
  const { preferences, updatePreferences } = useAdaptiveUI();
  const items = user?.isAdmin ? [...accountItems, { icon: BarChart3, label: "Administração", href: "/admin" }] : accountItems;

  const userInitials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"
    : "U";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 p-6 border-b border-border bg-card">
        <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
          <Car className="w-5 h-5 text-primary-foreground" aria-hidden="true" />
        </div>
        <span className="text-xl font-semibold text-foreground">{BRAND.name}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 bg-card space-y-6">
        <nav className="space-y-1" aria-label="Navegação principal">
          <NavLinks items={mainItems} onNavigate={onNavigate} />
        </nav>
        <nav className="space-y-1 border-t border-border pt-6" aria-label="Conta">
          <NavLinks items={items} onNavigate={onNavigate} />
        </nav>
      </div>

      <div className="p-5 border-t border-border bg-card">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center shrink-0">
              <span className="text-base font-medium text-primary-foreground">{userInitials}</span>
            </div>
            <p className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">
              {user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user?.email || "Utilizador"}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <select
              value={preferences.theme}
              onChange={(e) => updatePreferences({ theme: e.target.value as ThemeMode })}
              className="text-sm p-2 border border-border rounded bg-background text-foreground w-32"
              aria-label="Tema"
            >
              <option value="auto">Auto</option>
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </select>
            <Button variant="ghost" size="sm" onClick={onLogout} className="text-muted-foreground hover:text-foreground" aria-label="Terminar sessão" title="Terminar sessão">
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Aviso para confirmar o email (sem email confirmado não há lembretes por email). */
function VerifyEmailBanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [hidden, setHidden] = useState(false);
  const [sending, setSending] = useState(false);
  if (!user || user.emailVerifiedAt || hidden) return null;

  const resend = async () => {
    setSending(true);
    try {
      await post("/api/auth/resend-verification");
      toast({ title: "Email enviado", description: `Abra o link que enviámos para ${user.email}.` });
    } catch (error) {
      toast({ title: "Não foi possível reenviar", description: handleApiError(error), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div role="status" className="flex flex-wrap items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
      <MailWarning className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <span className="flex-1 min-w-[10rem]">Confirme o seu email para receber lembretes.</span>
      <div className="flex items-center gap-1 ml-auto">
        <Button size="sm" variant="outline" onClick={resend} disabled={sending}>
          {sending ? "A enviar..." : "Reenviar email"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setHidden(true)} aria-label="Fechar aviso">
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

export default function Sidebar({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const handleLogout = async () => {
    await post("/api/auth/logout").catch(() => { /* a sessão local termina na mesma */ });
    setAccessToken(null);
    queryClient.clear();
    navigate("/login");
  };

  const closeMenu = () => setMoreOpen(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-card border-r border-border">
          <SidebarContent onNavigate={closeMenu} onLogout={handleLogout} />
        </div>
      </div>

      {/* Telemóvel: cabeçalho */}
      <header className="lg:hidden bg-card shadow-sm border-b border-border sticky top-0 z-40">
        <div className="px-4 flex justify-between items-center h-14">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
              <Car className="w-4 h-4 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="text-lg font-semibold text-foreground">{BRAND.name}</span>
          </Link>
          <Link href="/dashboard" className="p-2 text-muted-foreground hover:text-foreground" aria-label="Alertas" title="Alertas">
            <Bell className="w-5 h-5" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <div className="lg:pl-64 pb-20 lg:pb-0">
        <VerifyEmailBanner />
        {children}
      </div>

      {/* Telemóvel: navegação inferior */}
      <nav
        aria-label="Navegação principal"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]"
      >
        {bottomItems.map(({ icon: Icon, label, href }) => {
          const active = location === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 py-2 text-[11px] ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center justify-center gap-1 py-2 text-[11px] text-muted-foreground"
          aria-haspopup="dialog"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
          Mais
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="right" className="w-72 p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Navegação completa do {BRAND.name}</SheetDescription>
          <SidebarContent onNavigate={closeMenu} onLogout={handleLogout} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

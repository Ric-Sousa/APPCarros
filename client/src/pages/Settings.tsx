import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Bell, CalendarDays, Copy, Crown, Database, Download, KeyRound, Laptop, Mail, ShieldCheck, Smartphone, Trash2,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";
import ConfirmDialog from "@/components/ConfirmDialog";
import PasswordInput, { PasswordStrength } from "@/components/PasswordInput";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth, AUTH_USER_KEY } from "@/hooks/useAuth";
import { useConfig } from "@/hooks/useConfig";
import { useAdaptiveUI, LEAD_DAYS, type NotificationPreferences } from "@/contexts/AdaptiveUIContext";
import { del, get, post, put, handleApiError, downloadProtected, setAccessToken } from "@/lib/apiUtils";
import { pushStatus, pushSupported, subscribePush, unsubscribePush, type PushStatus } from "@/lib/push";
import { queryClient } from "@/lib/queryClient";
import { effectivePlan } from "@shared/plans";
import { BRAND } from "@shared/brand";

const TABS = ["notificacoes", "calendario", "seguranca", "plano", "dados"] as const;
type Tab = (typeof TABS)[number];

function useErrorToast() {
  const { toast } = useToast();
  return (title: string) => (error: unknown) => toast({ title, description: handleApiError(error), variant: "destructive" });
}

// ---------- Notificações ----------

/** Evento do navegador para instalar a app (PWA), guardado até o utilizador carregar no botão. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function NotificationsSection() {
  const { toast } = useToast();
  const onError = useErrorToast();
  const config = useConfig();
  const { preferences, updatePreferences } = useAdaptiveUI();
  const prefs = preferences.notificationPreferences;
  const [status, setStatus] = useState<PushStatus>("unsupported");
  const [busy, setBusy] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    pushStatus().then(setStatus);
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvent(e as InstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const set = (updates: Partial<NotificationPreferences>) =>
    updatePreferences({ notificationPreferences: { ...prefs, ...updates } });

  const toggleLead = (days: number, on: boolean) =>
    set({ leadDays: (on ? [...prefs.leadDays, days] : prefs.leadDays.filter((d) => d !== days)).sort((a, b) => b - a) });

  const run = async (action: () => Promise<unknown>, success: string, errorTitle: string) => {
    setBusy(true);
    try {
      await action();
      toast({ title: success });
    } catch (error) {
      onError(errorTitle)(error);
    } finally {
      setBusy(false);
      pushStatus().then(setStatus);
    }
  };

  const pushAvailable = !!config?.features.push && !!config.vapidPublicKey && pushSupported();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" aria-hidden="true" /> Lembretes</CardTitle>
          <CardDescription>Avisamos antes de cada prazo: IUC, inspeção, seguro, óleo e pneus.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="notif-email">Por email</Label>
              <p className="text-sm text-muted-foreground">Requer o email confirmado.</p>
            </div>
            <Switch id="notif-email" checked={prefs.email} onCheckedChange={(email) => set({ email })} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="notif-push">No telemóvel ou computador (push)</Label>
              <p className="text-sm text-muted-foreground">Nos dispositivos onde ativar as notificações (abaixo).</p>
            </div>
            <Switch id="notif-push" checked={prefs.push} onCheckedChange={(push) => set({ push })} />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Avisar com antecedência de</legend>
            <div className="flex flex-wrap gap-4">
              {LEAD_DAYS.map((d) => (
                <label key={d} className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" className="h-4 w-4 accent-primary" checked={prefs.leadDays.includes(d)} onChange={(e) => toggleLead(d, e.target.checked)} />
                  {d === 1 ? "1 dia" : `${d} dias`}
                </label>
              ))}
            </div>
            {prefs.leadDays.length === 0 && <p className="text-sm text-amber-600 dark:text-amber-400">Sem antecedência escolhida só avisamos quando o prazo vencer.</p>}
          </fieldset>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="notif-digest">Resumo semanal</Label>
              <p className="text-sm text-muted-foreground">À segunda-feira, os prazos das próximas semanas num só email.</p>
            </div>
            <Switch id="notif-digest" checked={prefs.weeklyDigest} onCheckedChange={(weeklyDigest) => set({ weeklyDigest })} />
          </div>
          <Button variant="outline" disabled={busy} onClick={() => run(() => post("/api/notifications/test-email"), "Email de teste enviado", "Não foi possível enviar")}>
            Enviar email de teste
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5" aria-hidden="true" /> Este dispositivo</CardTitle>
          <CardDescription>Notificações push e instalação da app no ecrã principal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pushAvailable ? (
            <p className="text-sm text-muted-foreground">
              {pushSupported() ? "As notificações push ainda não estão disponíveis." : "Este navegador não suporta notificações push. No iPhone, instale primeiro a app no ecrã principal (Partilhar → Adicionar ao ecrã principal)."}
            </p>
          ) : status === "denied" ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">As notificações foram bloqueadas nas definições do navegador para este site. Desbloqueie-as lá e volte aqui.</p>
          ) : status === "subscribed" ? (
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary">Notificações ativas neste dispositivo</Badge>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => post("/api/push/test"), "Notificação de teste enviada", "Não foi possível enviar")}>Enviar teste</Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(unsubscribePush, "Notificações desativadas neste dispositivo", "Erro")}>Desativar</Button>
            </div>
          ) : (
            <Button disabled={busy} onClick={() => run(() => subscribePush(config!.vapidPublicKey!), "Notificações ativadas", "Não foi possível ativar")}>
              <Bell className="mr-2 h-4 w-4" aria-hidden="true" /> Ativar notificações neste dispositivo
            </Button>
          )}
          {installEvent && (
            <Button
              variant="outline"
              onClick={async () => {
                await installEvent.prompt();
                await installEvent.userChoice;
                setInstallEvent(null);
              }}
            >
              <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Instalar a app {BRAND.name}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Calendário ----------

function CalendarSection() {
  const { toast } = useToast();
  const onError = useErrorToast();
  const { data } = useQuery({ queryKey: ["/api/user/calendar"], queryFn: () => get<{ url: string | null }>("/api/user/calendar") });
  const create = useMutation({
    mutationFn: () => post<{ url: string }>("/api/user/calendar"),
    onSuccess: (res) => {
      queryClient.setQueryData(["/api/user/calendar"], res);
      toast({ title: "Endereço do calendário criado" });
    },
    onError: onError("Não foi possível criar o endereço"),
  });
  const url = data?.url ?? null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Endereço copiado" });
    } catch {
      toast({ title: "Copie o endereço manualmente", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" aria-hidden="true" /> Prazos no seu calendário</CardTitle>
        <CardDescription>Subscreva os prazos (IUC, inspeção, seguro e marcações) no Google Calendar, Apple ou Outlook. Atualizam-se sozinhos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {url ? (
          <>
            <div className="flex gap-2">
              <Input readOnly value={url} aria-label="Endereço de subscrição do calendário" onFocus={(e) => e.target.select()} />
              <Button variant="outline" onClick={copy} aria-label="Copiar endereço"><Copy className="h-4 w-4" aria-hidden="true" /></Button>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              <li><strong className="text-foreground">Google Calendar:</strong> Outros calendários → + → A partir do URL → colar o endereço.</li>
              <li><strong className="text-foreground">iPhone/Mac:</strong> Calendário → Ficheiro (ou Definições → Contas) → Nova subscrição de calendário.</li>
              <li><strong className="text-foreground">Outlook:</strong> Adicionar calendário → Subscrever a partir da Web.</li>
            </ul>
            <p className="text-xs text-muted-foreground">Este endereço é secreto: quem o tiver vê os seus prazos. Se o partilhou por engano, gere um novo.</p>
            <Button variant="ghost" size="sm" disabled={create.isPending} onClick={() => create.mutate()}>Gerar novo endereço</Button>
          </>
        ) : (
          <Button disabled={create.isPending} onClick={() => create.mutate()}>Criar endereço de subscrição</Button>
        )}
        <div>
          <Button variant="outline" onClick={() => downloadProtected("/api/calendar.ics", "prazos.ics").catch(onError("Não foi possível descarregar"))}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Descarregar ficheiro .ics
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Segurança ----------

interface Session { id: string; userAgent: string | null; createdAt: string; current: boolean }

function describeAgent(ua: string | null) {
  if (!ua) return "Dispositivo desconhecido";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} em ${os}` : browser;
}

function PasswordCard() {
  const { toast } = useToast();
  const onError = useErrorToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const change = useMutation({
    mutationFn: () => put("/api/user/password", { currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      queryClient.invalidateQueries({ queryKey: ["/api/user/sessions"] });
      toast({ title: "Palavra-passe alterada", description: "As sessões noutros dispositivos foram terminadas." });
    },
    onError: onError("Não foi possível alterar"),
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) return toast({ title: "Palavra-passe demasiado curta", description: "Use pelo menos 8 caracteres.", variant: "destructive" });
    if (newPassword !== confirmPassword) return toast({ title: "As palavras-passe não coincidem", variant: "destructive" });
    change.mutate();
  };
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" aria-hidden="true" /> Palavra-passe</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="current-password">Palavra-passe atual</Label>
            <PasswordInput id="current-password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova palavra-passe</Label>
            <PasswordInput id="new-password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            <PasswordStrength password={newPassword} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar nova palavra-passe</Label>
            <PasswordInput id="confirm-password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          <Button type="submit" disabled={change.isPending}>{change.isPending ? "A guardar..." : "Alterar palavra-passe"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TwoFactorCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const onError = useErrorToast();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string; qrSvg: string } | null>(null);
  const [code, setCode] = useState("");
  const [disableOpen, setDisableOpen] = useState(false);
  const [password, setPassword] = useState("");

  const refreshUser = () => queryClient.invalidateQueries({ queryKey: AUTH_USER_KEY });
  const start = useMutation({ mutationFn: () => post<{ secret: string; otpauthUrl: string; qrSvg: string }>("/api/user/2fa/setup"), onSuccess: setSetup, onError: onError("Não foi possível iniciar") });
  const enable = useMutation({
    mutationFn: () => post("/api/user/2fa/enable", { code }),
    onSuccess: () => { setSetup(null); setCode(""); refreshUser(); toast({ title: "Autenticação em dois passos ativada" }); },
    onError: onError("Código inválido"),
  });
  const disable = useMutation({
    mutationFn: () => post("/api/user/2fa/disable", { password, code }),
    onSuccess: () => { setDisableOpen(false); setPassword(""); setCode(""); refreshUser(); toast({ title: "Autenticação em dois passos desativada" }); },
    onError: onError("Não foi possível desativar"),
  });

  const codeInput = (id: string) => (
    <Input id={id} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="w-40 text-center tracking-[0.3em]" />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" aria-hidden="true" /> Autenticação em dois passos</CardTitle>
        <CardDescription>Além da palavra-passe, pede um código da sua app de autenticação (Google Authenticator, Microsoft Authenticator, 1Password...).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {user?.totpEnabled ? (
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-emerald-600 text-white">Ativa</Badge>
            <Button variant="outline" onClick={() => setDisableOpen(true)}>Desativar</Button>
          </div>
        ) : setup ? (
          <div className="space-y-4">
            <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
              <li>Leia o código QR com a app de autenticação (ou introduza a chave manualmente).</li>
              <li>Escreva o código de 6 dígitos que aparece na app.</li>
            </ol>
            {/* SVG gerado pelo nosso servidor a partir do segredo */}
            <div className="w-48 h-48 rounded-lg bg-white p-2" role="img" aria-label="Código QR para a app de autenticação" dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
            <p className="text-sm text-muted-foreground break-all">Chave: <code className="text-foreground">{setup.secret}</code></p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="totp-enable">Código</Label>
                {codeInput("totp-enable")}
              </div>
              <Button disabled={code.length !== 6 || enable.isPending} onClick={() => enable.mutate()}>Ativar</Button>
              <Button variant="ghost" onClick={() => { setSetup(null); setCode(""); }}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <Button disabled={start.isPending} onClick={() => start.mutate()}>Configurar</Button>
        )}
      </CardContent>
      <ConfirmDialog
        open={disableOpen}
        onOpenChange={(open) => { setDisableOpen(open); if (!open) { setPassword(""); setCode(""); } }}
        title="Desativar a autenticação em dois passos?"
        description="A conta fica protegida só pela palavra-passe. Confirme com a palavra-passe e um código da app."
        confirmLabel="Desativar"
        onConfirm={() => disable.mutate()}
        pending={disable.isPending}
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="disable-password">Palavra-passe</Label>
            <PasswordInput id="disable-password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="totp-disable">Código da app</Label>
            {codeInput("totp-disable")}
          </div>
        </div>
      </ConfirmDialog>
    </Card>
  );
}

function SessionsCard() {
  const { toast } = useToast();
  const onError = useErrorToast();
  const { data: sessions = [] } = useQuery({ queryKey: ["/api/user/sessions"], queryFn: () => get<Session[]>("/api/user/sessions") });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/user/sessions"] });
  const revoke = useMutation({ mutationFn: (id: string) => del(`/api/user/sessions/${id}`), onSuccess: () => { refresh(); toast({ title: "Sessão terminada" }); }, onError: onError("Erro") });
  const revokeOthers = useMutation({ mutationFn: () => post("/api/user/sessions/revoke-others"), onSuccess: () => { refresh(); toast({ title: "Outras sessões terminadas" }); }, onError: onError("Erro") });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Laptop className="h-5 w-5" aria-hidden="true" /> Sessões ativas</CardTitle>
        <CardDescription>Dispositivos com sessão iniciada. Termine as que não reconhecer.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                {describeAgent(s.userAgent)} {s.current && <Badge variant="secondary" className="ml-2">Esta sessão</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">Desde {new Date(s.createdAt).toLocaleString("pt-PT")}</p>
            </div>
            {!s.current && <Button variant="ghost" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate(s.id)}>Terminar</Button>}
          </div>
        ))}
        {sessions.filter((s) => !s.current).length > 0 && (
          <Button variant="outline" disabled={revokeOthers.isPending} onClick={() => revokeOthers.mutate()}>Terminar todas as outras</Button>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Plano ----------

function PlanSection() {
  const { user } = useAuth();
  const plan = effectivePlan(user?.plan, user?.planExpiresAt);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5" aria-hidden="true" /> O seu plano: {plan.name}</CardTitle>
        {user?.planExpiresAt && plan.id !== "free" && (
          <CardDescription>Renova ou termina a {new Date(user.planExpiresAt).toLocaleDateString("pt-PT")}.</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          {plan.highlights.map((h) => <li key={h}>{h}</li>)}
        </ul>
        <Button asChild><Link href="/planos">{plan.id === "free" ? "Ver planos pagos" : "Mudar ou gerir plano"}</Link></Button>
      </CardContent>
    </Card>
  );
}

// ---------- Os meus dados ----------

function DataSection() {
  const { toast } = useToast();
  const onError = useErrorToast();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [exporting, setExporting] = useState(false);

  const remove = useMutation({
    mutationFn: () => del("/api/user", { password }),
    onSuccess: () => {
      setAccessToken(null);
      queryClient.clear();
      navigate("/");
      toast({ title: "Conta eliminada", description: "Todos os seus dados foram apagados." });
    },
    onError: onError("Não foi possível eliminar"),
  });

  const exportData = async () => {
    setExporting(true);
    try {
      await downloadProtected("/api/user/export", `${BRAND.name.toLowerCase()}-dados.json`);
    } catch (error) {
      onError("Não foi possível exportar")(error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" aria-hidden="true" /> Exportar os meus dados</CardTitle>
          <CardDescription>Um ficheiro com a conta, veículos, registos, despesas e documentos (lista de ficheiros), num formato legível por outros serviços.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled={exporting} onClick={exportData}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" /> {exporting ? "A preparar..." : "Exportar (JSON)"}
          </Button>
        </CardContent>
      </Card>
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-5 w-5" aria-hidden="true" /> Eliminar conta</CardTitle>
          <CardDescription>Apaga a conta, os veículos, os registos e os ficheiros enviados. Não pode ser desfeito. Se tiver um plano pago, cancele-o primeiro em Planos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setOpen(true)}>Eliminar a minha conta</Button>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setPassword(""); }}
        title="Eliminar a conta?"
        description="Todos os seus dados serão apagados definitivamente. Confirme com a sua palavra-passe."
        confirmLabel="Eliminar definitivamente"
        onConfirm={() => remove.mutate()}
        pending={remove.isPending}
      >
        <div className="space-y-2">
          <Label htmlFor="delete-password">Palavra-passe</Label>
          <PasswordInput id="delete-password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </ConfirmDialog>
    </div>
  );
}

export default function Settings() {
  const initial = (window.location.hash.slice(1) as Tab) || "notificacoes";
  const [tab, setTab] = useState<Tab>(TABS.includes(initial) ? initial : "notificacoes");

  const change = (value: string) => {
    setTab(value as Tab);
    history.replaceState(null, "", `#${value}`);
  };

  return (
    <Sidebar>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Definições</h1>
          <p className="text-muted-foreground">Notificações, segurança, plano e os seus dados.</p>
        </div>
        <Tabs value={tab} onValueChange={change} className="space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="notificacoes" className="shrink-0">Notificações</TabsTrigger>
            <TabsTrigger value="calendario" className="shrink-0">Calendário</TabsTrigger>
            <TabsTrigger value="seguranca" className="shrink-0">Segurança</TabsTrigger>
            <TabsTrigger value="plano" className="shrink-0">Plano</TabsTrigger>
            <TabsTrigger value="dados" className="shrink-0">Os meus dados</TabsTrigger>
          </TabsList>
          <TabsContent value="notificacoes"><NotificationsSection /></TabsContent>
          <TabsContent value="calendario"><CalendarSection /></TabsContent>
          <TabsContent value="seguranca" className="space-y-6"><PasswordCard /><TwoFactorCard /><SessionsCard /></TabsContent>
          <TabsContent value="plano"><PlanSection /></TabsContent>
          <TabsContent value="dados"><DataSection /></TabsContent>
        </Tabs>
      </div>
      <Footer className="mt-8" />
    </Sidebar>
  );
}

import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { ToastAction } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { PLAN_LIMIT_EVENT, type ApiError } from "@/lib/apiUtils";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import NotFound from "@/pages/not-found";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Profile = lazy(() => import("@/pages/Profile"));
const FuelConsumption = lazy(() => import("@/pages/FuelConsumption"));
const ExpenseManagement = lazy(() => import("@/pages/ExpenseManagement"));
const VehicleDetails = lazy(() => import("@/pages/VehicleDetails"));
const VehicleReport = lazy(() => import("@/pages/VehicleReport"));
const MileageTracker = lazy(() => import("@/pages/MileageTracker"));
const RoutePlanner = lazy(() => import("@/pages/RoutePlanner"));
const Settings = lazy(() => import("@/pages/Settings"));
const Admin = lazy(() => import("@/pages/Admin"));
const AcceptInvite = lazy(() => import("@/pages/AcceptInvite"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const VerifyEmail = lazy(() => import("@/pages/VerifyEmail"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));
const Help = lazy(() => import("@/pages/Help"));
const Pricing = lazy(() => import("@/pages/Pricing"));

function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center" role="status">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">A carregar...</p>
      </div>
    </div>
  );
}

/** Só para quem tem sessão; sem sessão vai para o login e volta aqui depois de entrar. */
function Protected({ component: Page }: { component: ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    return <Redirect to={`/login?next=${next}`} />;
  }
  return <Page />;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/recuperar" component={ForgotPassword} />
        <Route path="/repor-palavra-passe" component={ResetPassword} />
        <Route path="/verificar-email" component={VerifyEmail} />
        <Route path="/privacidade" component={Privacy} />
        <Route path="/termos" component={Terms} />
        <Route path="/ajuda" component={Help} />
        <Route path="/planos" component={Pricing} />
        <Route path="/convite">{() => <Protected component={AcceptInvite} />}</Route>
        <Route path="/dashboard">{() => <Protected component={Dashboard} />}</Route>
        {/* Livro de revisões: página para imprimir, sem o layout da app */}
        <Route path="/vehicle/:vehicleId/relatorio">{() => <Protected component={VehicleReport} />}</Route>
        <Route path="/vehicle/:vehicleId">{() => <Protected component={VehicleDetails} />}</Route>
        <Route path="/profile">{() => <Protected component={Profile} />}</Route>
        <Route path="/definicoes">{() => <Protected component={Settings} />}</Route>
        <Route path="/admin">{() => <Protected component={Admin} />}</Route>
        <Route path="/fuel">{() => <Protected component={FuelConsumption} />}</Route>
        <Route path="/expenses">{() => <Protected component={ExpenseManagement} />}</Route>
        <Route path="/mileage-tracker">{() => <Protected component={MileageTracker} />}</Route>
        <Route path="/route-planner">{() => <Protected component={RoutePlanner} />}</Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

/** Qualquer 402 (funcionalidade fora do plano) mostra um aviso com atalho para os planos. */
function PlanLimitToasts() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  useEffect(() => {
    const onLimit = (e: Event) => {
      const error = (e as CustomEvent<ApiError>).detail;
      toast({
        title: "Disponível num plano pago",
        description: error.message,
        action: <ToastAction altText="Ver planos" onClick={() => navigate("/planos")}>Ver planos</ToastAction>,
      });
    };
    window.addEventListener(PLAN_LIMIT_EVENT, onLimit);
    return () => window.removeEventListener(PLAN_LIMIT_EVENT, onLimit);
  }, [toast, navigate]);
  return null;
}

function App() {
  return (
    <TooltipProvider>
      <Toaster />
      <PlanLimitToasts />
      <Router />
    </TooltipProvider>
  );
}

export default App;

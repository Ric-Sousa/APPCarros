import { lazy, Suspense, type ComponentType } from "react";
import { Switch, Route, Redirect } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import NotFound from "@/pages/not-found";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Profile = lazy(() => import("@/pages/Profile"));
const FuelConsumption = lazy(() => import("@/pages/FuelConsumption"));
const ExpenseManagement = lazy(() => import("@/pages/ExpenseManagement"));
const VehicleDetails = lazy(() => import("@/pages/VehicleDetails"));
const MileageTracker = lazy(() => import("@/pages/MileageTracker"));
const RoutePlanner = lazy(() => import("@/pages/RoutePlanner"));

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

/** Renders the page only for authenticated users; otherwise redirects to /login. */
function Protected({ component: Page }: { component: ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Page />;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/dashboard">{() => <Protected component={Dashboard} />}</Route>
        <Route path="/vehicle/:vehicleId">{() => <Protected component={VehicleDetails} />}</Route>
        <Route path="/profile">{() => <Protected component={Profile} />}</Route>
        <Route path="/fuel">{() => <Protected component={FuelConsumption} />}</Route>
        <Route path="/expenses">{() => <Protected component={ExpenseManagement} />}</Route>
        <Route path="/mileage-tracker">{() => <Protected component={MileageTracker} />}</Route>
        <Route path="/route-planner">{() => <Protected component={RoutePlanner} />}</Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <TooltipProvider>
      <Toaster />
      <Router />
    </TooltipProvider>
  );
}

export default App;

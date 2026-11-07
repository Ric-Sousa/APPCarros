import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import {
  Home,
  Fuel,
  Receipt,
  User,
  Bell,
  Menu,
  LogOut,
  Car,
  Timer,
  Navigation
} from "lucide-react";
import { useAdaptiveUI } from "@/contexts/AdaptiveUIContext";
import type { ThemeMode } from "@/contexts/AdaptiveUIContext";
import { queryClient } from "@/lib/queryClient";

const navigationItems = [
  { icon: Home, label: "Dashboard", href: "/dashboard" },
  { icon: Fuel, label: "Combustível", href: "/fuel" },
  { icon: Timer, label: "Gravador KM", href: "/mileage-tracker" },
  { icon: Receipt, label: "Despesas", href: "/expenses" },
  { icon: Navigation, label: "Planeador", href: "/route-planner" },
  { icon: User, label: "Perfil", href: "/profile" },
];

interface SidebarProps {
  children: React.ReactNode;
}

function SidebarContent({ onNavigate, onLogout }: { onNavigate: () => void; onLogout: () => void }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const { preferences, updatePreferences } = useAdaptiveUI();

  const userInitials = user ?
    `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() || 'U' : 'U';

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center space-x-4 p-6 border-b border-border bg-card">
        <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
          <Car className="w-5 h-5 text-primary-foreground" aria-hidden="true" />
        </div>
        <span className="text-xl font-semibold text-foreground">Logicar</span>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 px-4 py-8 bg-card">
        <nav className="space-y-3" aria-label="Navegação principal">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={`w-full flex items-center space-x-4 px-4 py-4 rounded-xl text-left transition-colors text-sm ${
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="w-6 h-6" aria-hidden="true" />
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Section */}
      <div className="p-5 border-t border-border bg-card">
        <div className="flex flex-col gap-3">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center">
              <span className="text-base font-medium text-white">
                {userInitials}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email || 'Utilizador'
                }
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between space-x-3">
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

            <div className="ml-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Terminar sessão"
                title="Terminar sessão"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ children }: SidebarProps) {
  const [, navigate] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    queryClient.clear();
    navigate('/login');
  };

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-card border-r border-border">
          <SidebarContent onNavigate={closeMenu} onLogout={handleLogout} />
        </div>
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden">
        <div className="bg-card shadow-sm border-b border-border sticky top-0 z-40">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                  <Car className="w-4 h-4 text-white" aria-hidden="true" />
                </div>
                <span className="text-xl font-semibold text-foreground">Logicar</span>
              </div>

              <div className="flex items-center space-x-4">
                <Link
                  href="/dashboard"
                  className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Alertas"
                  title="Alertas"
                >
                  <Bell className="w-5 h-5" aria-hidden="true" />
                </Link>

                <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm" aria-label="Abrir menu">
                      <Menu className="w-5 h-5" aria-hidden="true" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-64 p-0">
                    <SheetTitle className="sr-only">Menu</SheetTitle>
                    <SheetDescription className="sr-only">Navegação principal da LogiCar</SheetDescription>
                    <SidebarContent onNavigate={closeMenu} onLogout={handleLogout} />
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:pl-64">
        {children}
      </div>
    </div>
  );
}

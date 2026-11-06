import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { get, post } from '@/lib/apiUtils';

export type UserExperienceLevel = 'beginner' | 'intermediate' | 'expert';
export type ThemeMode = 'auto' | 'light' | 'dark' | 'vehicle-branded';
export type LayoutPreference = 'compact' | 'comfortable' | 'spacious';

interface UserPreferences {
  experienceLevel: UserExperienceLevel;
  theme: ThemeMode;
  layout: LayoutPreference;
  showAdvancedFeatures: boolean;
  enableVoiceControl: boolean;
  primaryVehicleBrand?: string;
  language: string;
  notificationPreferences: {
    maintenance: boolean;
    fuel: boolean;
    expenses: boolean;
    recommendations: boolean;
  };
}

interface AdaptiveUIContext {
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  isSimplifiedUI: boolean;
  getComponentStyle: (component: string) => string;
  shouldShowFeature: (feature: string) => boolean;
}

// Try to read persisted preference from localStorage for initial state
let persistedTheme: ThemeMode | null = null;
try {
  const t = localStorage.getItem('theme-preference');
  if (t === 'light' || t === 'dark' || t === 'auto' || t === 'vehicle-branded') persistedTheme = t as ThemeMode;
} catch (e) {
  // ignore
}

const defaultPreferences: UserPreferences = {
  experienceLevel: 'beginner',
  theme: (persistedTheme as ThemeMode) || 'auto',
  layout: 'comfortable', 
  showAdvancedFeatures: false,
  enableVoiceControl: false,
  language: 'pt',
  notificationPreferences: {
    maintenance: true,
    fuel: true,
    expenses: false,
    recommendations: true,
  }
};

const AdaptiveUIContext = createContext<AdaptiveUIContext | undefined>(undefined);

export const useAdaptiveUI = () => {
  const context = useContext(AdaptiveUIContext);
  if (!context) {
    throw new Error('useAdaptiveUI must be used within AdaptiveUIProvider');
  }
  return context;
};

interface AdaptiveUIProviderProps {
  children: React.ReactNode;
}

export const AdaptiveUIProvider: React.FC<AdaptiveUIProviderProps> = ({ children }) => {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  // Load user preferences on mount
  useEffect(() => {
    if (user) {
      loadUserPreferences();
    } else {
      // Apply any locally saved preferences even sem autenticação
      try {
        const localRaw = localStorage.getItem('user-preferences');
        if (localRaw) {
          const localPrefs = JSON.parse(localRaw);
          setPreferences({ ...defaultPreferences, ...localPrefs });
        }
      } catch {}
      setIsLoading(false);
    }
  }, [user]);

  // Apply theme changes
  useEffect(() => {
    applyTheme(preferences.theme, preferences.primaryVehicleBrand);
  }, [preferences.theme, preferences.primaryVehicleBrand]);

  const loadUserPreferences = async () => {
    // Primeiro tenta aplicar preferências locais (fallback em caso de 404 backend)
    try {
      const localRaw = localStorage.getItem('user-preferences');
      if (localRaw) {
        const localPrefs = JSON.parse(localRaw);
        setPreferences(prev => ({ ...prev, ...localPrefs }));
      }
    } catch {}

    try {
      const userPrefs = await get('/api/user/preferences') as UserPreferences;
      setPreferences({ ...defaultPreferences, ...userPrefs });
    } catch (error: any) {
      const msg = (error && error.message) ? String(error.message) : '';
      // Suaviza o erro conhecido de produção quando a rota não existe
      if (msg.includes('API route not found') || msg.includes('404')) {
        // Não poluir o console, usar apenas as preferências locais/default
        // console.info('Preferências não disponíveis no servidor, a usar fallback local/default');
      } else {
        console.error('Failed to load user preferences:', error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    const newPreferences = { ...preferences, ...updates };
    setPreferences(newPreferences);
    // Persist theme preference if changed
    try {
      if (updates.theme) {
        localStorage.setItem('theme-preference', updates.theme);
      }
    } catch (e) {
      // ignore
    }
    
    try {
      await post('/api/user/preferences', newPreferences);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      // Optionally revert changes
    }

    // Persistência local como fallback para cenários offline/404
    try {
      localStorage.setItem('user-preferences', JSON.stringify(newPreferences));
    } catch {}
  };

  const applyTheme = (theme: ThemeMode, vehicleBrand?: string) => {
    const root = document.documentElement;
    
    switch (theme) {
      case 'dark':
        root.classList.add('dark');
        break;
      case 'light':
        root.classList.remove('dark');
        break;
      case 'vehicle-branded':
        if (vehicleBrand) {
          applyBrandedTheme(vehicleBrand);
        }
        break;
      case 'auto':
      default:
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
        break;
    }
  };

  const applyBrandedTheme = (brand: string) => {
    const brandColors: Record<string, { primary: string; secondary: string }> = {
      'BMW': { primary: '#1C69D4', secondary: '#F0F8FF' },
      'Mercedes': { primary: '#00233F', secondary: '#E8F1FA' },
      'Audi': { primary: '#BB0A30', secondary: '#FFF5F5' },
      'Volkswagen': { primary: '#001E50', secondary: '#F0F8FF' },
      'Toyota': { primary: '#EB0A1E', secondary: '#FFF5F5' },
      'Honda': { primary: '#E60012', secondary: '#FFF5F5' },
      'Ford': { primary: '#003478', secondary: '#F0F8FF' },
      'Renault': { primary: '#FFCB05', secondary: '#FFFBF0' },
      'Peugeot': { primary: '#00205B', secondary: '#F0F8FF' },
      'Citroën': { primary: '#B12A28', secondary: '#FFF5F5' },
    };

    const colors = brandColors[brand] || brandColors['BMW'];
    const root = document.documentElement;
    
    root.style.setProperty('--brand-primary', colors.primary);
    root.style.setProperty('--brand-secondary', colors.secondary);
    root.setAttribute('data-theme', 'branded');
  };

  const isSimplifiedUI = preferences.experienceLevel === 'beginner';

  const getComponentStyle = (component: string): string => {
    const baseStyles: Record<string, Record<LayoutPreference, string>> = {
      card: {
        compact: 'p-3 space-y-2',
        comfortable: 'p-4 space-y-4',
        spacious: 'p-6 space-y-6',
      },
      button: {
        compact: 'h-8 px-3 text-sm',
        comfortable: 'h-10 px-4',
        spacious: 'h-12 px-6 text-lg',
      },
      input: {
        compact: 'h-8 text-sm',
        comfortable: 'h-10',
        spacious: 'h-12 text-lg',
      },
    };

    return baseStyles[component]?.[preferences.layout] || '';
  };

  const shouldShowFeature = (feature: string): boolean => {
    const featureMap: Record<string, UserExperienceLevel[]> = {
      'advanced-analytics': ['expert'],
      'detailed-charts': ['intermediate', 'expert'],
      'voice-control': ['expert'],
      'predictive-maintenance': ['intermediate', 'expert'],
      'technical-details': ['expert'],
      'simplified-dashboard': ['beginner'],
      'guided-tutorials': ['beginner'],
      'expert-mode': ['expert'],
    };

    const allowedLevels = featureMap[feature];
    if (!allowedLevels) return true; // Show by default if not specified
    
    return allowedLevels.includes(preferences.experienceLevel);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <AdaptiveUIContext.Provider
      value={{
        preferences,
        updatePreferences,
        isSimplifiedUI,
        getComponentStyle,
        shouldShowFeature,
      }}
    >
      {children}
    </AdaptiveUIContext.Provider>
  );
};

// Component for user preferences settings
export const UIPreferencesPanel: React.FC = () => {
  const { preferences, updatePreferences } = useAdaptiveUI();

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Preferências de Interface</h3>
      
      {/* Experience Level */}
      <div>
        <label className="block text-sm font-medium mb-2">Nível de Experiência</label>
        <select
          value={preferences.experienceLevel}
          onChange={(e) => updatePreferences({ experienceLevel: e.target.value as UserExperienceLevel })}
          className="w-full p-2 border rounded-md"
        >
          <option value="beginner">Iniciante</option>
          <option value="intermediate">Intermediário</option>
          <option value="expert">Especialista</option>
        </select>
      </div>

      {/* Theme */}
      <div>
        <label className="block text-sm font-medium mb-2">Tema</label>
        <select
          value={preferences.theme}
          onChange={(e) => updatePreferences({ theme: e.target.value as ThemeMode })}
          className="w-full p-2 border rounded-md"
        >
          <option value="auto">Automático</option>
          <option value="light">Claro</option>
          <option value="dark">Escuro</option>
          <option value="vehicle-branded">Marca do Veículo</option>
        </select>
      </div>

      {/* Layout */}
      <div>
        <label className="block text-sm font-medium mb-2">Layout</label>
        <select
          value={preferences.layout}
          onChange={(e) => updatePreferences({ layout: e.target.value as LayoutPreference })}
          className="w-full p-2 border rounded-md"
        >
          <option value="compact">Compacto</option>
          <option value="comfortable">Confortável</option>
          <option value="spacious">Espaçoso</option>
        </select>
      </div>

      {/* Advanced Features Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Mostrar Funcionalidades Avançadas</label>
        <input
          type="checkbox"
          checked={preferences.showAdvancedFeatures}
          onChange={(e) => updatePreferences({ showAdvancedFeatures: e.target.checked })}
          className="toggle"
        />
      </div>
    </div>
  );
};

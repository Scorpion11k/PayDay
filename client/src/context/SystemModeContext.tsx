import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

export type SystemMode = 'demo' | 'development' | 'production';

interface SystemModeContextType {
  mode: SystemMode;
  setMode: (mode: SystemMode) => Promise<void>;
  loading: boolean;
}

const SystemModeContext = createContext<SystemModeContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

interface SystemModeProviderProps {
  children: ReactNode;
}

export function SystemModeProvider({ children }: SystemModeProviderProps) {
  const [mode, setModeState] = useState<SystemMode>('demo');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMode = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/settings`);
        if (response.ok) {
          const body = await response.json();
          if (body.success && body.data?.mode) {
            setModeState(body.data.mode);
          }
        }
      } catch {
        // Server unavailable — keep default
      } finally {
        setLoading(false);
      }
    };
    fetchMode();
  }, []);

  const setMode = useCallback(async (newMode: SystemMode) => {
    const response = await fetch(`${API_BASE_URL}/settings/mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: newMode }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to update system mode');
    }

    const body = await response.json();
    setModeState(body.data.mode);
  }, []);

  return (
    <SystemModeContext.Provider value={{ mode, setMode, loading }}>
      {children}
    </SystemModeContext.Provider>
  );
}

export function useSystemMode(): SystemModeContextType {
  const context = useContext(SystemModeContext);
  if (context === undefined) {
    throw new Error('useSystemMode must be used within a SystemModeProvider');
  }
  return context;
}

export default SystemModeContext;

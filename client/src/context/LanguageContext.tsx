import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import rtlPlugin from 'stylis-plugin-rtl';
import { prefixer } from 'stylis';
import { createAppTheme } from '../theme/theme';
import { LANGUAGE_STORAGE_KEY } from '../i18n';

type Language = 'en' | 'he';
type Direction = 'ltr' | 'rtl';

interface LanguageContextType {
  language: Language;
  direction: Direction;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Create LTR cache (default)
const ltrCache = createCache({
  key: 'mui-ltr',
  prepend: true,
});

// Create RTL cache with RTL plugin
const rtlCache = createCache({
  key: 'mui-rtl',
  stylisPlugins: [prefixer, rtlPlugin],
  prepend: true,
});

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const { i18n } = useTranslation();
  
  // Initialize language from localStorage or default to 'en'
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return (saved === 'he' || saved === 'en') ? saved : 'en';
  });

  const direction: Direction = language === 'he' ? 'rtl' : 'ltr';
  const isRTL = direction === 'rtl';

  // Create theme with correct direction
  const theme = useMemo(() => createAppTheme(direction), [direction]);

  // Select appropriate cache based on direction
  const cache = isRTL ? rtlCache : ltrCache;

  // Update document direction and language
  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = language;
  }, [direction, language]);

  // Sync with i18next
  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  };

  const value: LanguageContextType = {
    language,
    direction,
    setLanguage,
    isRTL,
  };

  return (
    <LanguageContext.Provider value={value}>
      <CacheProvider value={cache}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </CacheProvider>
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export default LanguageContext;


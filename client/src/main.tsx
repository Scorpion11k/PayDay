import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { ChatVisibilityProvider } from './context/ChatVisibilityContext';
import App from './App';
import './index.css';

// Initialize i18n before rendering
import './i18n';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <ChatVisibilityProvider>
          <App />
        </ChatVisibilityProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>
);

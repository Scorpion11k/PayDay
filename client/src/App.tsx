import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import AppShell from './layout/AppShell';
import HomePage from './pages/HomePage';
import CustomersPage from './pages/CustomersPage';
import TemplatesPage from './pages/TemplatesPage';
import ActivitiesPage from './pages/ActivitiesPage';
import DashboardsPage from './pages/DashboardsPage';
import FlowsPage from './pages/FlowsPage';
import ContractsPage from './pages/ContractsPage';
import ChatHistoryPage from './pages/ChatHistoryPage';
import CustomerInsightPage from './pages/CustomerInsightPage';
import IntegrationsPage from './pages/IntegrationsPage';
import SettingsPage from './pages/SettingsPage';
import { checkServerHealth } from './services/api';

function App() {
  useEffect(() => {
    // Check server connection on app startup
    const checkConnection = async () => {
      console.log('🔍 Checking server connection...');
      console.log('📍 API Base URL:', import.meta.env.VITE_API_BASE_URL || '/api');
      
      const result = await checkServerHealth();
      
      if (result.connected) {
        console.log('✅ Server connection successful!');
        console.log('📡', result.message);
      } else {
        console.error('❌ Server connection failed!');
        console.error('⚠️', result.message);
        console.error('💡 Tip: Make sure the server is running and VITE_API_BASE_URL is configured correctly.');
      }
    };

    checkConnection();
  }, []);

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/activities" element={<ActivitiesPage />} />
        <Route path="/dashboards" element={<DashboardsPage />} />
        <Route path="/flows" element={<FlowsPage />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/chat-history" element={<ChatHistoryPage />} />
        <Route path="/customer-insight" element={<CustomerInsightPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppShell>
  );
}

export default App;

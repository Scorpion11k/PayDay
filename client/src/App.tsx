import { Routes, Route } from 'react-router-dom';
import AppShell from './layout/AppShell';
import HomePage from './pages/HomePage';
import CustomersPage from './pages/CustomersPage';
import ActivitiesPage from './pages/ActivitiesPage';
import DashboardsPage from './pages/DashboardsPage';
import FlowsPage from './pages/FlowsPage';
import ContractsPage from './pages/ContractsPage';
import ChatHistoryPage from './pages/ChatHistoryPage';
import CustomerInsightPage from './pages/CustomerInsightPage';
import IntegrationsPage from './pages/IntegrationsPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/customers" element={<CustomersPage />} />
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

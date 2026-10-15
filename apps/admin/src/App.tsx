import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './lib';
import { AuthGate } from './components/AuthGate';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toasts';
import { BannersPage } from './features/banners/BannersPage';
import { OverviewPage } from './features/overview/OverviewPage';
import { PagesPage } from './features/pages/PagesPage';
import { PlansPage } from './features/plans/PlansPage';
import { PopupsPage } from './features/popups/PopupsPage';
import { TeamPage } from './features/team/TeamPage';

export function App() {
  const routes = (
    <ToastProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="banners" element={<BannersPage />} />
          <Route path="popups" element={<PopupsPage />} />
          <Route path="pages" element={<PagesPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ToastProvider>
  );

  // Practice mode has no server, so no login. Everything else waits for the API to say "welcome".
  return api.isMock ? routes : <AuthGate>{routes}</AuthGate>;
}

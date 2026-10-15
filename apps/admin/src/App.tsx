import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toasts';
import { BannersPage } from './features/banners/BannersPage';
import { OverviewPage } from './features/overview/OverviewPage';
import { PagesPage } from './features/pages/PagesPage';
import { PlansPage } from './features/plans/PlansPage';
import { PopupsPage } from './features/popups/PopupsPage';

export function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="banners" element={<BannersPage />} />
          <Route path="popups" element={<PopupsPage />} />
          <Route path="pages" element={<PagesPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}

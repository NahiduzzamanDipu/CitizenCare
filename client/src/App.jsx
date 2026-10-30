import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth, homePathFor } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Spinner } from './ui/Card';

import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { LiveMap } from './pages/LiveMap';
import { ReportCrime } from './pages/ReportCrime';
import { Emergency } from './pages/Emergency';
import { NotFound } from './pages/NotFound';

import {
  CitizenAppShell,
  CitizenSafetyHome,
  CitizenAlerts,
  CitizenProfile,
  CitizenReports,
  CitizenReport,
} from './citizen/CitizenApp';

// The staff portals and the charts they use are large and role-gated, so they
// are split out of the initial bundle — a visitor on the home page never
// downloads them.
const named = (loader, key) => lazy(() => loader().then((m) => ({ default: m[key] })));

const PoliceLayout = named(() => import('./police/PoliceLayout'), 'PoliceLayout');
const PoliceDashboard = named(() => import('./police/PoliceDashboard'), 'PoliceDashboard');
const PoliceLiveFeeds = named(() => import('./police/PoliceLiveFeeds'), 'PoliceLiveFeeds');
const PoliceSettings = named(() => import('./police/PoliceSettings'), 'PoliceSettings');

const AdminLayout = named(() => import('./admin/AdminLayout'), 'AdminLayout');
const AdminOverview = named(() => import('./admin/AdminOverview'), 'AdminOverview');
const AdminUsers = named(() => import('./admin/AdminUsers'), 'AdminUsers');
const AdminStations = named(() => import('./admin/AdminStations'), 'AdminStations');
const AdminAudit = named(() => import('./admin/AdminAudit'), 'AdminAudit');

const ReportsQueue = named(() => import('./shared/ReportsQueue'), 'ReportsQueue');
const AlertsBoard = named(() => import('./shared/AlertsBoard'), 'AlertsBoard');
const Analytics = named(() => import('./shared/Analytics'), 'Analytics');
const AIDetectLazy = named(() => import('./pages/AIDetect'), 'AIDetect');

const STAFF = ['police', 'admin'];

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <SocketProvider>
              <Layout>
                <Suspense fallback={<RouteFallback />}>
                <Routes>
                  {/* Public */}
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/map" element={<LiveMap />} />

                  {/* Citizen app shell */}
                  <Route
                    path="/app"
                    element={
                      <ProtectedRoute roles={['citizen']}>
                        <CitizenAppShell />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<CitizenSafetyHome />} />
                    <Route path="reports" element={<CitizenReports />} />
                    <Route path="alerts" element={<CitizenAlerts />} />
                    <Route path="profile" element={<CitizenProfile />} />
                    <Route path="report" element={<CitizenReport />} />
                  </Route>

                  {/* Signed-in, any role */}
                  <Route
                    path="/report"
                    element={
                      <ProtectedRoute>
                        <ReportCrime />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/emergency"
                    element={
                      <ProtectedRoute>
                        <Emergency />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/ai"
                    element={
                      <ProtectedRoute>
                        <AIDetectLazy />
                      </ProtectedRoute>
                    }
                  />

                  {/* Police command centre */}
                  <Route
                    path="/police"
                    element={
                      <ProtectedRoute roles={STAFF}>
                        <PoliceLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Navigate to="/police/dashboard" replace />} />
                    <Route path="dashboard" element={<PoliceDashboard />} />
                    <Route path="live-feeds" element={<PoliceLiveFeeds />} />
                    <Route path="incidents" element={<ReportsQueue />} />
                    <Route path="alerts" element={<AlertsBoard />} />
                    <Route path="map" element={<LiveMap />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="settings" element={<PoliceSettings />} />
                  </Route>

                  {/* Admin portal */}
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute roles={['admin']}>
                        <AdminLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<AdminOverview />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="stations" element={<AdminStations />} />
                    <Route
                      path="reports"
                      element={
                        <ReportsQueue
                          title="Report moderation"
                          description="Every submission across all stations. Verifying a report publishes it to the public map."
                        />
                      }
                    />
                    <Route path="alerts" element={<AlertsBoard />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="audit" element={<AdminAudit />} />
                  </Route>

                  {/* Legacy path kept working for bookmarks. */}
                  <Route
                    path="/cctv"
                    element={<Navigate to="/police/live-feeds" replace />}
                  />
                  <Route path="/dashboard" element={<RoleHome />} />

                  <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
              </Layout>
            </SocketProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

/** Shown while a lazily-loaded route chunk is downloading. */
function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner className="h-10 w-10" />
    </div>
  );
}

/** Sends whoever lands on the legacy /dashboard path to their own portal. */
function RoleHome() {
  return (
    <ProtectedRoute>
      <RoleRedirect />
    </ProtectedRoute>
  );
}

function RoleRedirect() {
  const { user } = useAuth();
  return <Navigate to={homePathFor(user?.role)} replace />;
}

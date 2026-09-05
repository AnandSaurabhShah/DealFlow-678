import { useQueryClient } from '@tanstack/react-query'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import AdminConfigPage from './pages/AdminConfigPage'
import ApprovalDetailPage from './pages/ApprovalDetailPage'
import ApprovalsPage from './pages/ApprovalsPage'
import LoginPage from './pages/LoginPage'
import FulfillmentPage from './pages/FulfillmentPage'
import QuotationBuilderPage from './pages/QuotationBuilderPage'
import QuotationsPage from './pages/QuotationsPage'
import { useAuthStore } from './store/authStore'

const paths = { quotations: '/quotations', builder: '/quotations/new', approvals: '/approvals', fulfillment: '/fulfillment', config: '/configuration' }

export default function App() {
  const user = useAuthStore(state => state.user)
  return <Routes>
    <Route path="/login" element={user ? <Navigate to="/quotations" replace /> : <LoginPage />} />
    <Route element={<ProtectedLayout />}>
      <Route index element={<Navigate to="/quotations" replace />} />
      <Route path="/quotations" element={<QuotationsPage />} />
      <Route path="/fulfillment" element={<RoleGate roles={['REP', 'ADMIN']}><QuotationsPage fulfillmentOnly /></RoleGate>} />
      <Route path="/quotations/new" element={<RoleGate roles={['REP']}><QuotationBuilderPage /></RoleGate>} />
      <Route path="/quotations/:quotationId" element={<RoleGate roles={['REP']}><QuotationBuilderPage /></RoleGate>} />
      <Route path="/quotations/:quotationId/fulfillment" element={<RoleGate roles={['REP', 'ADMIN']}><FulfillmentPage /></RoleGate>} />
      <Route path="/approvals" element={<RoleGate roles={['MANAGER', 'FINANCE']}><ApprovalsPage /></RoleGate>} />
      <Route path="/approvals/:quotationId" element={<ApprovalDetailPage />} />
      <Route path="/configuration" element={<RoleGate roles={['ADMIN']}><AdminConfigPage /></RoleGate>} />
    </Route>
    <Route path="*" element={<Navigate to={user ? '/quotations' : '/login'} replace />} />
  </Routes>
}

function ProtectedLayout() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore(state => state.user)
  const logout = useAuthStore(state => state.logout)
  if (!user) return <Navigate to="/login" replace />

  const page = location.pathname.includes('/fulfillment')
    ? 'fulfillment'
    : location.pathname.startsWith('/approvals')
    ? 'approvals'
    : location.pathname === '/configuration'
      ? 'config'
      : location.pathname === '/quotations' ? 'quotations' : 'builder'
  const signOut = () => {
    logout()
    queryClient.clear()
    navigate('/login', { replace: true })
  }

  return <AppShell page={page} onNavigate={target => navigate(paths[target])} user={user} onLogout={signOut}><Outlet /></AppShell>
}

function RoleGate({ roles, children }) {
  const role = useAuthStore(state => state.user?.role)
  return roles.includes(role) ? children : <Navigate to="/quotations" replace />
}

import { useQueryClient } from '@tanstack/react-query'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import AdminConfigPage from './pages/AdminConfigPage'
import ApprovalDetailPage from './pages/ApprovalDetailPage'
import ApprovalsPage from './pages/ApprovalsPage'
import BillingPage from './pages/BillingPage'
import LoginPage from './pages/LoginPage'
import FulfillmentPage from './pages/FulfillmentPage'
import CustomerLoginPage from './pages/CustomerLoginPage'
import CustomerPortalHomePage from './pages/CustomerPortalHomePage'
import CustomerQuotationPage from './pages/CustomerQuotationPage'
import InternalNegotiationPage from './pages/InternalNegotiationPage'
import QuotationBuilderPage from './pages/QuotationBuilderPage'
import QuotationsPage from './pages/QuotationsPage'
import CustomerPortalShell from './components/CustomerPortalShell'
import { useAuthStore } from './store/authStore'
import { useCustomerAuthStore } from './store/customerAuthStore'

const paths = { quotations: '/quotations', builder: '/quotations/new', approvals: '/approvals', fulfillment: '/fulfillment', billing: '/billing', config: '/configuration' }

export default function App() {
  const user = useAuthStore(state => state.user)
  const customer = useCustomerAuthStore(state => state.customer)
  return <Routes>
    <Route path="/login" element={user ? <Navigate to="/quotations" replace /> : <LoginPage />} />
    <Route path="/portal/login" element={<CustomerAuthRoute customer={customer}><CustomerLoginPage /></CustomerAuthRoute>} />
    <Route path="/portal/signup" element={<CustomerAuthRoute customer={customer}><CustomerLoginPage /></CustomerAuthRoute>} />
    <Route path="/portal" element={<CustomerProtectedLayout />}>
      <Route index element={<CustomerPortalHomePage />} />
      <Route path="quotations/:quotationId" element={<CustomerQuotationPage />} />
    </Route>
    <Route element={<ProtectedLayout />}>
      <Route index element={<Navigate to="/quotations" replace />} />
      <Route path="/quotations" element={<QuotationsPage />} />
      <Route path="/fulfillment" element={<RoleGate roles={['REP', 'ADMIN']}><QuotationsPage fulfillmentOnly /></RoleGate>} />
      <Route path="/billing" element={<RoleGate roles={['REP', 'ADMIN']}><QuotationsPage billingOnly /></RoleGate>} />
      <Route path="/quotations/new" element={<RoleGate roles={['REP']}><QuotationBuilderPage /></RoleGate>} />
      <Route path="/quotations/:quotationId" element={<RoleGate roles={['REP']}><QuotationBuilderPage /></RoleGate>} />
      <Route path="/quotations/:quotationId/fulfillment" element={<RoleGate roles={['REP', 'ADMIN']}><FulfillmentPage /></RoleGate>} />
      <Route path="/quotations/:quotationId/billing" element={<RoleGate roles={['REP', 'ADMIN']}><BillingPage /></RoleGate>} />
      <Route path="/quotations/:quotationId/negotiation" element={<RoleGate roles={['REP', 'MANAGER', 'ADMIN']}><InternalNegotiationPage /></RoleGate>} />
      <Route path="/approvals" element={<RoleGate roles={['MANAGER', 'FINANCE']}><ApprovalsPage /></RoleGate>} />
      <Route path="/approvals/:quotationId" element={<ApprovalDetailPage />} />
      <Route path="/configuration" element={<RoleGate roles={['ADMIN']}><AdminConfigPage /></RoleGate>} />
    </Route>
    <Route path="*" element={<Navigate to={user ? '/quotations' : '/login'} replace />} />
  </Routes>
}

function CustomerAuthRoute({ customer, children }) {
  const location = useLocation()
  return customer ? <Navigate to={location.state?.from || '/portal'} replace /> : children
}

function CustomerProtectedLayout() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const customer = useCustomerAuthStore(state => state.customer)
  const logout = useCustomerAuthStore(state => state.logout)
  if (!customer) return <Navigate to="/portal/login" state={{ from: location.pathname }} replace />
  const signOut = () => {
    logout()
    queryClient.removeQueries({ queryKey: ['portalQuotation'] })
    queryClient.removeQueries({ queryKey: ['portalQuotations'] })
  }
  return <CustomerPortalShell customer={customer} onLogout={signOut}><Outlet /></CustomerPortalShell>
}

function ProtectedLayout() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore(state => state.user)
  const logout = useAuthStore(state => state.logout)
  if (!user) return <Navigate to="/login" replace />

  const page = location.pathname.includes('/billing')
    ? 'billing'
    : location.pathname.includes('/fulfillment')
    ? 'fulfillment'
    : location.pathname.startsWith('/approvals')
    ? 'approvals'
    : location.pathname === '/configuration'
      ? 'config'
      : location.pathname.includes('/negotiation') ? 'negotiation'
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

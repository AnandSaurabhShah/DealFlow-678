import { useState } from 'react'
import AppShell from './components/AppShell'
import { seedQuotes } from './data/mockData'
import LoginPage from './pages/LoginPage'
import OverviewPage from './pages/OverviewPage'
import QuotationBuilderPage from './pages/QuotationBuilderPage'
import QuotationsPage from './pages/QuotationsPage'

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('df_user') || 'null'))
  const [page, setPage] = useState('overview')
  const [quotes, setQuotes] = useState(seedQuotes)
  const login = nextUser => { localStorage.setItem('df_user', JSON.stringify(nextUser)); setUser(nextUser) }
  const logout = () => { localStorage.removeItem('df_user'); setUser(null) }
  const saveQuote = ({ customer, value }) => {
    setQuotes([{ id: 'Q-1049', customer, contact: 'New contact', value, status: 'Draft', owner: user.name, updated: 'Just now' }, ...quotes])
    setPage('quotes')
  }
  const deleteQuote = quoteId => {
    setQuotes(currentQuotes => currentQuotes.filter(quote => quote.id !== quoteId))
  }

  if (!user) return <LoginPage onLogin={login} />
  return <AppShell page={page} onNavigate={setPage} user={user} onLogout={logout}>
    {page === 'overview' && <OverviewPage quotes={quotes} onNavigate={setPage} />}
    {page === 'quotes' && <QuotationsPage quotes={quotes} onNavigate={setPage} onDelete={deleteQuote} />}
    {page === 'builder' && <QuotationBuilderPage onSave={saveQuote} />}
  </AppShell>
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApiError } from '../api/client'
import QuoteTable from '../components/QuoteTable'
import { useQuotations } from '../hooks/useApiQueries'
import { useAuthStore } from '../store/authStore'

const filters = ['ALL', 'DRAFT', 'PENDING_MANAGER_APPROVAL', 'PENDING_FINANCE_APPROVAL', 'APPROVED', 'REJECTED', 'CONFIRMED']
const filterLabels = { ALL: 'All', DRAFT: 'Draft', PENDING_MANAGER_APPROVAL: 'Pending Manager', PENDING_FINANCE_APPROVAL: 'Pending Finance', APPROVED: 'Approved', REJECTED: 'Rejected', CONFIRMED: 'Confirmed' }

export default function QuotationsPage() {
  const [filter, setFilter] = useState('ALL')
  const user = useAuthStore(state => state.user)
  const navigate = useNavigate()
  const quotations = useQuotations()
  const data = quotations.data || []
  const visible = filter === 'ALL' ? data : data.filter(quote => quote.status === filter)
  const openQuotation = quote => {
    if (user.role === 'REP' && quote.status === 'DRAFT') navigate(`/quotations/${quote.id}`)
    else navigate(`/approvals/${quote.id}`)
  }

  return <section className="min-h-[500px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 overflow-x-auto p-4">
      <div className="flex min-w-max gap-1">{filters.map(item => <button key={item} onClick={() => setFilter(item)} className={`rounded-lg px-3 py-2 text-[11px] ${filter === item ? 'bg-violet-100 font-semibold text-violet-700' : 'text-slate-500 hover:bg-slate-50'}`}>{filterLabels[item]}<span className="ml-1.5 rounded-full bg-white px-1.5 py-0.5 text-[9px]">{item === 'ALL' ? data.length : data.filter(quote => quote.status === item).length}</span></button>)}</div>
      <button onClick={() => quotations.refetch()} disabled={quotations.isFetching} className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold disabled:opacity-50">{quotations.isFetching ? 'Refreshing…' : 'Refresh'}</button>
    </div>
    {quotations.isLoading && <Message>Loading quotations…</Message>}
    {quotations.isError && <Message error>{getApiError(quotations.error, 'Unable to load quotations')}</Message>}
    {quotations.isSuccess && <QuoteTable quotes={visible} onSelect={openQuotation} />}
  </section>
}

function Message({ children, error = false }) {
  return <div role={error ? 'alert' : undefined} className={`grid min-h-72 place-items-center text-sm ${error ? 'text-red-600' : 'text-slate-400'}`}>{children}</div>
}

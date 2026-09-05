import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApiError } from '../api/client'
import QuoteTable from '../components/QuoteTable'
import Pagination from '../components/Pagination'
import { useQuotations } from '../hooks/useApiQueries'
import { useAuthStore } from '../store/authStore'

const filters = ['ALL', 'DRAFT', 'PENDING_MANAGER_APPROVAL', 'PENDING_FINANCE_APPROVAL', 'APPROVED', 'SENT_TO_CUSTOMER', 'UNDER_NEGOTIATION', 'FULFILLED', 'REJECTED', 'CONFIRMED']
const filterLabels = { ALL: 'All', DRAFT: 'Draft', PENDING_MANAGER_APPROVAL: 'Pending Manager', PENDING_FINANCE_APPROVAL: 'Pending Finance', APPROVED: 'Approved', SENT_TO_CUSTOMER: 'Sent to Customer', UNDER_NEGOTIATION: 'Under Negotiation', FULFILLED: 'Fulfilled', REJECTED: 'Rejected', CONFIRMED: 'Confirmed' }

export default function QuotationsPage({ fulfillmentOnly = false, billingOnly = false }) {
  const [filter, setFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const user = useAuthStore(state => state.user)
  const navigate = useNavigate()
  const workflowOnly = fulfillmentOnly || billingOnly
  const availableFilters = workflowOnly ? ['ALL', 'APPROVED', 'FULFILLED'] : filters
  const status = filter === 'ALL' ? workflowOnly ? 'APPROVED,FULFILLED' : undefined : filter
  const quotations = useQuotations({ page, pageSize, status })
  const visible = quotations.data?.items || []
  const pagination = quotations.data?.pagination
  const openQuotation = quote => {
    if (billingOnly) navigate(`/quotations/${quote.id}/billing`)
    else if (fulfillmentOnly) navigate(`/quotations/${quote.id}/fulfillment`)
    else if (user.role === 'REP' && quote.status === 'DRAFT') navigate(`/quotations/${quote.id}`)
    else if (['REP', 'ADMIN'].includes(user.role) && quote.status === 'FULFILLED') navigate(`/quotations/${quote.id}/fulfillment`)
    else if (['REP', 'MANAGER', 'ADMIN'].includes(user.role) && ['APPROVED', 'SENT_TO_CUSTOMER', 'UNDER_NEGOTIATION'].includes(quote.status)) navigate(`/quotations/${quote.id}/negotiation`)
    else navigate(`/approvals/${quote.id}`)
  }

  return <section className="min-h-[500px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    {fulfillmentOnly && <div className="border-b border-slate-100 px-5 py-4"><p className="text-[10px] font-semibold tracking-widest text-violet-600">FULFILLMENT WORKSPACE</p><h2 className="mt-1 font-display text-base font-bold">Ready and completed quotations</h2><p className="mt-1 text-xs text-slate-500">Open an approved quotation to plan fulfillment, or review a completed allocation.</p></div>}
    {billingOnly && <div className="border-b border-slate-100 px-5 py-4"><p className="text-[10px] font-semibold tracking-widest text-violet-600">BILLING WORKSPACE</p><h2 className="mt-1 font-display text-base font-bold">Approved and fulfilled quotations</h2><p className="mt-1 text-xs text-slate-500">Open a quotation to generate or review its separated one-time and recurring billing.</p></div>}
    <div className="flex items-center justify-between gap-3 overflow-x-auto p-4">
      <div className="flex min-w-max gap-1">{availableFilters.map(item => <button key={item} onClick={() => { setFilter(item); setPage(1) }} className={`rounded-lg px-3 py-2 text-[11px] ${filter === item ? 'bg-violet-100 font-semibold text-violet-700' : 'text-slate-500 hover:bg-slate-50'}`}>{item === 'ALL' && workflowOnly ? billingOnly ? 'All billing' : 'All fulfillment' : filterLabels[item]}{filter === item && pagination && <span className="ml-1.5 rounded-full bg-white px-1.5 py-0.5 text-[9px]">{pagination.total}</span>}</button>)}</div>
      <button onClick={() => quotations.refetch()} disabled={quotations.isFetching} className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold disabled:opacity-50">{quotations.isFetching ? 'Refreshing…' : 'Refresh'}</button>
    </div>
    {quotations.isLoading && <Message>Loading quotations…</Message>}
    {quotations.isError && <Message error>{getApiError(quotations.error, 'Unable to load quotations')}</Message>}
    {quotations.isSuccess && <QuoteTable quotes={visible} onSelect={openQuotation} />}
    {quotations.isSuccess && <Pagination pagination={pagination} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1) }} disabled={quotations.isFetching} />}
  </section>
}

function Message({ children, error = false }) {
  return <div role={error ? 'alert' : undefined} className={`grid min-h-72 place-items-center text-sm ${error ? 'text-red-600' : 'text-slate-400'}`}>{children}</div>
}

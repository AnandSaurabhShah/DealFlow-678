import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApiError } from '../api/client'
import Icon from '../components/Icon'
import StatusBadge from '../components/StatusBadge'
import Pagination from '../components/Pagination'
import { usePortalQuotations } from '../hooks/usePortalQueries'
import { formatDate, formatMoney, shortId } from '../lib/format'

export default function CustomerPortalHomePage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const quotations = usePortalQuotations({ page, pageSize })
  const items = quotations.data?.items || []

  return <section className="mx-auto max-w-4xl pt-6">
    <div className="text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Icon name="file" size={22} /></span>
      <h1 className="mt-5 font-display text-3xl font-bold text-slate-900">Your quotations</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Quotations shared with your account appear here automatically. We’ll also email you a direct link when a new one is ready.</p>
    </div>

    {quotations.isLoading && <div className="mt-8 h-48 animate-pulse rounded-2xl bg-slate-200" />}
    {quotations.isError && <p role="alert" className="mt-8 rounded-xl bg-red-50 p-4 text-sm text-red-700">{getApiError(quotations.error, 'Unable to load your quotations')}</p>}
    {quotations.data && !items.length && <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="font-display text-lg font-bold text-slate-800">No quotations yet</h2><p className="mt-2 text-xs text-slate-500">Your representative will email you when a quotation is ready for review.</p></div>}
    {items.length > 0 && <div className="mt-8 grid gap-4 sm:grid-cols-2">
      {items.map(quotation => <button key={quotation.id} onClick={() => navigate(`/portal/quotations/${quotation.id}`)} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold tracking-widest text-slate-400">QUOTATION</p><h2 className="mt-1 font-display text-lg font-bold text-slate-900">{shortId(quotation.id)}</h2></div><StatusBadge value={quotation.status} /></div>
        <p className="mt-5 font-display text-2xl font-bold text-slate-900">{formatMoney(Number(quotation.grandTotal))}</p>
        <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400"><span>{quotation._count.lines} line{quotation._count.lines === 1 ? '' : 's'} · {quotation._count.negotiationComments} comment{quotation._count.negotiationComments === 1 ? '' : 's'}</span><span>Updated {formatDate(quotation.updatedAt)}</span></div>
      </button>)}
    </div>}
    {quotations.isSuccess && <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white"><Pagination pagination={quotations.data.pagination} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1) }} disabled={quotations.isFetching} /></div>}
  </section>
}

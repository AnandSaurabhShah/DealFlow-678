import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApiError } from '../api/client'
import Icon from '../components/Icon'
import StatusBadge from '../components/StatusBadge'
import Pagination from '../components/Pagination'
import SearchInput from '../components/SearchInput'
import { usePendingApprovals } from '../hooks/useApiQueries'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { formatDate, formatMoney, shortId } from '../lib/format'

export default function ApprovalsPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const approvals = usePendingApprovals({ page, pageSize, search: debouncedSearch })
  const navigate = useNavigate()
  const items = approvals.data?.items || []
  const pagination = approvals.data?.pagination

  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 p-5">
      <div>
        <h2 className="font-display text-base font-bold">Approval Center</h2>
        <p className="mt-1 text-xs text-slate-400">{approvals.isSuccess ? `${pagination.total} quotation${pagination.total === 1 ? '' : 's'} require your action.` : 'Review quotations assigned to you.'}</p>
      </div>
      <button onClick={() => approvals.refetch()} disabled={approvals.isFetching} className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold disabled:opacity-50">{approvals.isFetching ? 'Refreshing…' : 'Refresh'}</button>
    </div>
    <div className="border-t border-slate-100 p-4"><SearchInput value={search} onChange={value => { setSearch(value); setPage(1) }} placeholder="Search customer, quote ID, or owner…" /></div>

    {approvals.isLoading && <ApprovalSkeleton />}
    {approvals.isError && <div role="alert" className="grid min-h-72 place-items-center px-5 text-center text-sm text-red-600">{approvals.error.response?.status === 403 ? 'You do not have permission to view pending approvals.' : getApiError(approvals.error, 'Unable to load pending approvals')}</div>}
    {approvals.isSuccess && items.length === 0 && <div className="grid min-h-72 place-items-center px-6 text-center"><div><span className="mx-auto grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Icon name="check" /></span><h3 className="mt-3 text-sm font-bold">You’re all caught up</h3><p className="mt-1 text-xs text-slate-400">No quotations currently require your approval.</p></div></div>}
    {approvals.isSuccess && items.length > 0 && <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[11px]">
        <thead><tr className="border-y border-slate-100 bg-slate-50/70 text-[9px] tracking-wide text-slate-400">
          <th className="px-5 py-3 font-semibold">QUOTATION</th><th className="px-5 py-3 font-semibold">CUSTOMER</th><th className="px-5 py-3 font-semibold">AMOUNT</th><th className="px-5 py-3 font-semibold">RISK</th><th className="px-5 py-3 font-semibold">STATUS</th><th className="px-5 py-3 font-semibold">UPDATED</th><th className="px-5 py-3 font-semibold">ACTION</th>
        </tr></thead>
        <tbody>{items.map(quote => <tr key={quote.id} className="border-b border-slate-100 transition hover:bg-violet-50/30">
          <td className="px-5 py-3 font-bold">{shortId(quote.id)}</td>
          <td className="px-5 py-3"><strong>{quote.customerName}</strong><p className="mt-0.5 text-[9px] text-slate-400">{quote.rep?.name || 'Unknown owner'}</p></td>
          <td className="px-5 py-3 font-bold">{formatMoney(Number(quote.grandTotal))}</td>
          <td className="px-5 py-3"><span className="font-semibold">{Number(quote.blendedRiskScore)}</span></td>
          <td className="px-5 py-3"><StatusBadge value={quote.status} /></td>
          <td className="px-5 py-3 text-slate-400">{formatDate(quote.updatedAt)}</td>
          <td className="px-5 py-3"><button onClick={() => navigate(`/approvals/${quote.id}`)} className="flex items-center gap-1 font-semibold text-violet-600 hover:text-violet-800">View <Icon name="arrow" size={14} /></button></td>
        </tr>)}</tbody>
      </table>
    </div>}
    {approvals.isSuccess && <Pagination pagination={pagination} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1) }} disabled={approvals.isFetching} />}
  </section>
}

function ApprovalSkeleton() {
  return <div className="space-y-2 border-t border-slate-100 p-5" aria-label="Loading pending approvals">{[1, 2, 3].map(item => <div key={item} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}</div>
}

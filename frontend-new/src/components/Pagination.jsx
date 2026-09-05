export default function Pagination({ pagination, onPageChange, onPageSizeChange, disabled = false }) {
  if (!pagination || pagination.total === 0) return null

  const first = (pagination.page - 1) * pagination.pageSize + 1
  const last = Math.min(pagination.page * pagination.pageSize, pagination.total)

  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-[11px] text-slate-500">
    <span>Showing {first}–{last} of {pagination.total}</span>
    <div className="flex items-center gap-2">
      {onPageSizeChange && <label className="flex items-center gap-2">Rows
        <select value={pagination.pageSize} onChange={event => onPageSizeChange(Number(event.target.value))} disabled={disabled} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] outline-none focus:border-violet-500 disabled:opacity-50">
          {[10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>}
      <button type="button" disabled={disabled || !pagination.hasPreviousPage} onClick={() => onPageChange(pagination.page - 1)} className="rounded-md border border-slate-200 px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
      <span className="min-w-16 text-center">{pagination.totalPages ? `Page ${pagination.page} of ${pagination.totalPages}` : 'No pages'}</span>
      <button type="button" disabled={disabled || !pagination.hasNextPage} onClick={() => onPageChange(pagination.page + 1)} className="rounded-md border border-slate-200 px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40">Next</button>
    </div>
  </div>
}

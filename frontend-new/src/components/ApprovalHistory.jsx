import { getApiError } from '../api/client'
import { actionLabels, roleLabels } from '../lib/approval'
import { formatDate } from '../lib/format'

export default function ApprovalHistory({ history }) {
  if (history.isLoading) return <div className="space-y-3" aria-label="Loading approval history">
    {[1, 2].map(item => <div key={item} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}
  </div>

  if (history.isError) return <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{getApiError(history.error, 'Unable to load approval history')}</p>

  if (!history.data?.length) return <p className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">No approval actions have been recorded.</p>

  return <ol className="divide-y divide-slate-100">
    {history.data.map(entry => <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs"><strong>{entry.actor?.name || roleLabels[entry.actor?.role] || 'Unknown actor'}</strong><span className="mx-2 text-slate-300">·</span><span>{actionLabels[entry.action] || entry.action}</span></div>
        <time className="text-[10px] text-slate-400" dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
      </div>
      {entry.actor?.role && <p className="mt-1 text-[10px] text-slate-400">{roleLabels[entry.actor.role] || entry.actor.role}</p>}
      {entry.reason && <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600"><span className="font-semibold">Reason:</span> {entry.reason}</p>}
    </li>)}
  </ol>
}

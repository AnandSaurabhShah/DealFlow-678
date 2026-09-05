import { fulfillmentErrorMessage } from '../lib/fulfillment'
import FulfillmentPlanTable from './FulfillmentPlanTable'
import Icon from './Icon'

export default function BackorderAvailability({ requested, onRequest, query, quotationLines }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-[9px] font-semibold tracking-widest text-slate-400">BACKORDER FOLLOW-UP</p><h3 className="mt-1 font-display text-base font-bold">Availability check</h3><p className="mt-1 text-xs text-slate-500">Check whether newly added warehouse stock can cover outstanding units.</p></div>
      <button onClick={onRequest} disabled={query.isFetching} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"><Icon name="refresh" size={15} />{query.isFetching ? 'Checking…' : requested ? 'Check Again' : 'Check Availability'}</button>
    </div>
    {query.isLoading && <div className="mt-4 h-20 animate-pulse rounded-lg bg-slate-100" />}
    {query.isError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{fulfillmentErrorMessage(query.error, 'Unable to check backorder availability')}</p>}
    {query.isSuccess && !query.data.outstandingBackorders.length && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">No outstanding backorders remain.</p>}
    {query.isSuccess && query.data.outstandingBackorders.length > 0 && !query.data.canConsolidate && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">No new warehouse stock is currently available for this backorder.</p>}
    {query.isSuccess && query.data.canConsolidate && <div className="mt-4 space-y-3">
      <p className="rounded-lg bg-cyan-50 p-3 text-xs text-cyan-800">New stock available — {query.data.fullyCoverable ? 'the full backorder can now be covered.' : 'part of the backorder can now be covered.'}</p>
      <FulfillmentPlanTable rows={query.data.suggestedAllocations} quotationLines={quotationLines} />
      <p className="text-[10px] leading-relaxed text-slate-400">This is a read-only availability suggestion. The backend does not expose an endpoint to persist a second allocation.</p>
    </div>}
  </section>
}

import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import BackorderAvailability from '../components/BackorderAvailability'
import FulfillmentPlanTable from '../components/FulfillmentPlanTable'
import FulfillmentSummary from '../components/FulfillmentSummary'
import Icon from '../components/Icon'
import StatusBadge from '../components/StatusBadge'
import { useConfirmFulfillment, useFulfillmentBackorder, useFulfillmentSuggestion, useQuotation } from '../hooks/useApiQueries'
import { fulfillmentErrorMessage } from '../lib/fulfillment'
import { formatMoney, shortId } from '../lib/format'
import { useAuthStore } from '../store/authStore'

export default function FulfillmentPage() {
  const { quotationId } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore(state => state.user)
  const quotation = useQuotation(quotationId)
  const quote = quotation.data
  const canManage = user.role === 'ADMIN' || (user.role === 'REP' && quote?.repId === user.id)
  const suggestion = useFulfillmentSuggestion(quotationId, canManage && quote?.status === 'APPROVED')
  const [backorderRequested, setBackorderRequested] = useState(false)
  const backorder = useFulfillmentBackorder(quotationId, backorderRequested && quote?.status === 'FULFILLED')
  const confirmFulfillment = useConfirmFulfillment()
  const [manualMode, setManualMode] = useState(false)
  const [manualRows, setManualRows] = useState([])
  const [validationError, setValidationError] = useState('')
  const [notice, setNotice] = useState('')

  const persistedRows = quote?.fulfillmentSplits || confirmFulfillment.data?.fulfillmentSplits || []
  const displayRows = quote?.status === 'FULFILLED'
    ? persistedRows
    : manualMode ? manualRows : suggestion.data || []
  const orderedUnits = useMemo(() => (quote?.lines || []).reduce((sum, line) => sum + line.qty, 0), [quote?.lines])
  const hasAllocationData = displayRows.length > 0
  const fulfilledUnits = hasAllocationData ? displayRows.reduce((sum, row) => sum + (Number(row.qtyFulfilled) || 0), 0) : '—'
  const backorderedUnits = hasAllocationData
    ? manualMode
      ? Math.max(orderedUnits - fulfilledUnits, 0)
      : displayRows.reduce((sum, row) => sum + row.qtyBackordered, 0)
    : '—'
  const warehouseCount = hasAllocationData ? new Set(displayRows.filter(row => row.warehouseId).map(row => row.warehouseId)).size : '—'
  const allBackordered = !manualMode && fulfilledUnits === 0 && Number(backorderedUnits) > 0

  if (quotation.isLoading) return <FulfillmentSkeleton />
  if (quotation.isError) return <PageError error={quotation.error} onBack={() => navigate('/quotations')} />

  const updateManualQuantity = (index, value) => {
    setValidationError('')
    confirmFulfillment.reset()
    setManualRows(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, qtyFulfilled: value } : row))
  }

  const validateAllocations = rows => {
    const usableRows = rows.filter(row => row.warehouseId)
    for (const row of usableRows) {
      if (!/^\d+$/.test(String(row.qtyFulfilled))) return 'Fulfilled quantities must be non-negative whole numbers.'
    }
    for (const line of quote.lines) {
      const productRows = usableRows.filter(row => row.productId === line.productId)
      if (!productRows.length) return `No warehouse allocation is available for ${line.product?.name || 'one quotation product'}.`
      const total = productRows.reduce((sum, row) => sum + Number(row.qtyFulfilled), 0)
      if (total > line.qty) return `Allocated quantity for ${line.product?.name || 'a product'} exceeds the ordered quantity.`
    }
    return ''
  }

  const submitAllocations = rows => {
    setNotice('')
    const error = validateAllocations(rows)
    if (error) {
      setValidationError(error)
      return
    }
    const allocations = rows.filter(row => row.warehouseId).map(row => ({
      warehouseId: row.warehouseId,
      productId: row.productId,
      qtyFulfilled: Number(row.qtyFulfilled),
    }))
    confirmFulfillment.mutate({ id: quote.id, allocations }, {
      onSuccess: () => {
        setManualMode(false)
        setValidationError('')
        const message = 'Fulfillment confirmed. Inventory and quotation status were updated by the server.'
        setNotice(message)
        toast.success(message)
      },
    })
  }

  const startManualOverride = () => {
    setManualRows((suggestion.data || []).map(row => ({ ...row, qtyFulfilled: String(row.qtyFulfilled) })))
    setManualMode(true)
    setValidationError('')
    confirmFulfillment.reset()
  }

  const cancelManualOverride = () => {
    setManualMode(false)
    setManualRows((suggestion.data || []).map(row => ({ ...row, qtyFulfilled: String(row.qtyFulfilled) })))
    setValidationError('')
    confirmFulfillment.reset()
  }

  const refreshSuggestion = async () => {
    setManualMode(false)
    setValidationError('')
    confirmFulfillment.reset()
    await suggestion.refetch()
  }

  const requestBackorderCheck = () => {
    if (backorderRequested) backorder.refetch()
    else setBackorderRequested(true)
  }

  const conflictCode = confirmFulfillment.error?.response?.data?.error?.code
  const isFulfilled = quote.status === 'FULFILLED'
  const isEligible = quote.status === 'APPROVED'

  return <div className="space-y-5">
    <button onClick={() => navigate('/quotations')} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"><Icon name="back" size={15} />Back to quotations</button>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
        <div><p className="text-[10px] font-semibold tracking-widest text-violet-600">FULFILLMENT</p><h2 className="mt-2 font-display text-xl font-bold">{shortId(quote.id)}</h2><p className="mt-1 text-sm text-slate-500">{quote.customerName}</p></div>
        <div className="text-right"><p className="font-display text-2xl font-bold">{formatMoney(Number(quote.grandTotal))}</p><div className="mt-2"><StatusBadge value={quote.status} /></div></div>
      </div>
    </section>

    <FulfillmentSummary ordered={orderedUnits} fulfilled={fulfilledUnits} backordered={backorderedUnits} warehouseCount={warehouseCount} />

    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">{notice}</p>}

    {!canManage && <StatePanel icon="alert" title="Fulfillment unavailable" message="You don't have permission to fulfill this quotation." error />}
    {canManage && !isEligible && !isFulfilled && <StatePanel icon="alert" title="Quotation not eligible" message="Only an approved quotation can be planned for fulfillment." />}

    {canManage && isEligible && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-[9px] font-semibold tracking-widest text-violet-600">{manualMode ? 'MANUAL ALLOCATION' : 'SUGGESTED FULFILLMENT'}</p><h3 className="mt-1 font-display text-base font-bold">{manualMode ? 'Review manual quantities' : 'Warehouse allocation'}</h3><p className="mt-1 text-xs text-slate-500">{manualMode ? 'Adjust fulfilled quantities. The server will validate stock and derive backorders.' : 'Generated from current warehouse stock. Review before confirming.'}</p></div>
        {!manualMode && suggestion.isSuccess && <button onClick={refreshSuggestion} disabled={suggestion.isFetching || confirmFulfillment.isPending} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"><Icon name="refresh" size={14} />{suggestion.isFetching ? 'Refreshing…' : 'Refresh Suggestion'}</button>}
      </div>

      {suggestion.isLoading && <SuggestionSkeleton />}
      {suggestion.isError && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-xs text-red-700">{fulfillmentErrorMessage(suggestion.error, 'Unable to load the fulfillment suggestion')}</p>}
      {suggestion.isSuccess && <div className="mt-5"><FulfillmentPlanTable rows={displayRows} quotationLines={quote.lines} manual={manualMode} disabled={confirmFulfillment.isPending} onQuantityChange={updateManualQuantity} /></div>}

      {allBackordered && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">No current warehouse stock can fulfill this order.</p>}
      {!manualMode && Number(backorderedUnits) > 0 && !allBackordered && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{backorderedUnits} units are currently backordered. Partial fulfillment can still be confirmed.</p>}
      {validationError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{validationError}</p>}
      {confirmFulfillment.isError && <div role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-xs text-red-700"><p>{fulfillmentErrorMessage(confirmFulfillment.error)}</p>{conflictCode === 'INSUFFICIENT_STOCK' && <button onClick={refreshSuggestion} className="mt-3 rounded-md border border-red-200 bg-white px-3 py-2 font-semibold text-red-700">Refresh Suggestion</button>}</div>}

      {suggestion.isSuccess && suggestion.data.length > 0 && <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-5">
        {manualMode ? <>
          <button disabled={confirmFulfillment.isPending} onClick={cancelManualOverride} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold disabled:opacity-50">Cancel</button>
          <button disabled={confirmFulfillment.isPending} onClick={() => submitAllocations(manualRows)} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"><Icon name="check" size={15} />{confirmFulfillment.isPending ? 'Confirming fulfillment…' : 'Confirm Fulfillment'}</button>
        </> : <>
          <button disabled={confirmFulfillment.isPending || allBackordered} onClick={startManualOverride} className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"><Icon name="edit" size={15} />Manual Override</button>
          <button disabled={confirmFulfillment.isPending || allBackordered} onClick={() => submitAllocations(suggestion.data)} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"><Icon name="truck" size={16} />{confirmFulfillment.isPending ? 'Confirming fulfillment…' : 'Accept Suggested Split'}</button>
        </>}
      </div>}
    </section>}

    {canManage && isFulfilled && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[9px] font-semibold tracking-widest text-emerald-600">COMMITTED FULFILLMENT</p><h3 className="mt-1 font-display text-base font-bold">Final allocation</h3><p className="mb-5 mt-1 text-xs text-slate-500">This quotation has been fulfilled. The rows below are the allocation returned by the server.</p>
      {persistedRows.length ? <FulfillmentPlanTable rows={persistedRows} quotationLines={quote.lines} /> : <p className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">Fulfillment is complete. The quotation detail response does not include previously committed split rows.</p>}
    </section>}

    {canManage && isFulfilled && <BackorderAvailability requested={backorderRequested} onRequest={requestBackorderCheck} query={backorder} quotationLines={quote.lines} />}
  </div>
}

function SuggestionSkeleton() {
  return <div className="mt-5 space-y-2" aria-label="Loading fulfillment suggestion">{[1, 2, 3].map(item => <div key={item} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}</div>
}

function FulfillmentSkeleton() {
  return <div className="space-y-5" aria-label="Loading fulfillment"><div className="h-36 animate-pulse rounded-xl bg-slate-200" /><div className="h-28 animate-pulse rounded-xl bg-slate-200" /><div className="h-80 animate-pulse rounded-xl bg-slate-200" /></div>
}

function StatePanel({ icon, title, message, error = false }) {
  return <section className="grid min-h-52 place-items-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm"><div><span className={`mx-auto grid size-11 place-items-center rounded-xl ${error ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}><Icon name={icon} /></span><h3 className="mt-3 text-sm font-bold">{title}</h3><p className="mt-1 text-xs text-slate-500">{message}</p></div></section>
}

function PageError({ error, onBack }) {
  return <section className="grid min-h-96 place-items-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm"><div><span className="mx-auto grid size-11 place-items-center rounded-xl bg-red-50 text-red-600"><Icon name="alert" /></span><h2 className="mt-3 text-sm font-bold">Unable to open fulfillment</h2><p role="alert" className="mt-1 text-xs text-red-600">{fulfillmentErrorMessage(error, 'Unable to load quotation')}</p><button onClick={onBack} className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold">Back to quotations</button></div></section>
}

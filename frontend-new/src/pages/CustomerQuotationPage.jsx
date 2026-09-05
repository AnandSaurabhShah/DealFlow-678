import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getApiError } from '../api/client'
import Icon from '../components/Icon'
import NegotiationThread from '../components/NegotiationThread'
import StatusBadge from '../components/StatusBadge'
import { usePortalComment, usePortalConfirm, usePortalDiscount, usePortalQuotation } from '../hooks/usePortalQueries'
import { formatMoney, shortId } from '../lib/format'

const negotiableStatuses = ['SENT_TO_CUSTOMER', 'UNDER_NEGOTIATION']

export default function CustomerQuotationPage() {
  const { quotationId } = useParams()
  const navigate = useNavigate()
  const quotation = usePortalQuotation(quotationId)
  const addComment = usePortalComment()
  const updateDiscount = usePortalDiscount()
  const confirm = usePortalConfirm()
  const [discounts, setDiscounts] = useState({})
  const [notice, setNotice] = useState('')

  if (quotation.isLoading) return <div className="h-96 animate-pulse rounded-xl bg-slate-200" />
  if (quotation.isError) return <ErrorState error={quotation.error} onBack={() => navigate('/portal')} />
  const quote = quotation.data
  const canEdit = negotiableStatuses.includes(quote.status)
  const pendingReview = ['PENDING_MANAGER_APPROVAL', 'PENDING_FINANCE_APPROVAL'].includes(quote.status)
  const mutationError = [addComment, updateDiscount, confirm].find(item => item.isError)?.error
  const submitDiscount = line => {
    setNotice('')
    const discountPercent = discounts[line.id] ?? String(line.discountPercent)
    updateDiscount.mutate({ id: quote.id, lineId: line.id, discountPercent }, {
      onSuccess: () => setNotice(`Discount request submitted for ${line.product.name}. Confirm the quotation when all requested terms are ready.`),
    })
  }
  const confirmQuotation = () => {
    setNotice('')
    confirm.mutate(quote.id, {
      onSuccess: updated => setNotice(['PENDING_MANAGER_APPROVAL', 'PENDING_FINANCE_APPROVAL'].includes(updated.status) ? 'Your request is being reviewed.' : 'Quotation confirmed. Your updated terms are approved.'),
    })
  }

  return <div className="space-y-5">
    <button onClick={() => navigate('/portal')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"><Icon name="back" size={15} />All quotations</button>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-slate-100 p-6 sm:p-8">
        <div><p className="text-[10px] font-bold tracking-[.18em] text-coral">QUOTATION FOR {quote.customerName?.toUpperCase()}</p><h1 className="mt-2 font-display text-2xl font-bold text-slate-900">{shortId(quote.id)}</h1><div className="mt-3"><StatusBadge value={quote.status} /></div></div>
        <div className="text-right"><p className="text-[10px] font-semibold text-slate-400">TOTAL</p><p className="mt-1 font-display text-3xl font-bold text-slate-900">{formatMoney(Number(quote.grandTotal))}</p><p className="mt-1 text-xs text-emerald-600">You save {formatMoney(Number(quote.totalDiscount))}</p></div>
      </div>
      {(pendingReview || quote.status === 'APPROVED') && <div role="status" className={`mx-6 mt-6 rounded-xl p-4 text-sm sm:mx-8 ${pendingReview ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}><strong>{pendingReview ? 'Your request is being reviewed.' : 'Your quotation is approved.'}</strong><p className="mt-1 text-xs opacity-80">{pendingReview ? 'Your representative will follow up after the approval team reviews the requested terms.' : 'The current pricing terms have completed approval.'}</p></div>}
      <div className="p-6 sm:p-8">
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="border-b border-slate-200 text-[9px] tracking-widest text-slate-400"><th className="pb-3">PRODUCT</th><th className="pb-3">QTY</th><th className="pb-3">UNIT PRICE</th><th className="pb-3">DISCOUNT REQUEST</th><th className="pb-3 text-right">LINE TOTAL</th></tr></thead><tbody>{quote.lines.map(line => <tr key={line.id} className="border-b border-slate-100 last:border-0"><td className="py-4"><p className="text-xs font-semibold text-slate-800">{line.product.name}</p><p className="mt-0.5 text-[10px] text-slate-400">{line.product.category} · {line.product.unit}</p></td><td className="py-4 text-xs">{line.qty}</td><td className="py-4 text-xs">{formatMoney(Number(line.unitPrice))}</td><td className="py-4"><div className="flex items-center gap-2"><div className="relative"><input aria-label={`Discount for ${line.product.name}`} type="number" min="0" max="100" step="0.01" disabled={!canEdit} value={discounts[line.id] ?? String(line.discountPercent)} onChange={event => setDiscounts(current => ({ ...current, [line.id]: event.target.value }))} className="w-24 rounded-lg border border-slate-200 py-2 pl-3 pr-7 text-xs outline-none focus:border-violet-500 disabled:bg-slate-50" /><span className="absolute right-3 top-2 text-xs text-slate-400">%</span></div><button disabled={!canEdit || updateDiscount.isPending} onClick={() => submitDiscount(line)} className="rounded-lg border border-violet-200 px-3 py-2 text-[10px] font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-40">Submit request</button></div></td><td className="py-4 text-right text-xs font-semibold">{formatMoney(Number(line.lineTotal))}</td></tr>)}</tbody></table></div>
      </div>
    </section>

    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-xs text-emerald-800">{notice}</p>}
    {mutationError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-xs text-red-700">{getApiError(mutationError, 'Unable to update the quotation')}</p>}
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-[9px] font-bold tracking-widest text-slate-400">SHARED CONVERSATION</p><h2 className="mb-5 mt-1 font-display text-lg font-bold">Comments</h2><NegotiationThread comments={quote.comments} lines={quote.lines} currentAuthorType="CUSTOMER" disabled={!canEdit} isSubmitting={addComment.isPending} onSubmit={(body, done) => addComment.mutate({ id: quote.id, ...body }, { onSuccess: done })} /></section>
      <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[9px] font-bold tracking-widest text-slate-400">FINAL STEP</p><h2 className="mt-1 font-display text-lg font-bold">Confirm quotation</h2><p className="mt-2 text-xs leading-relaxed text-slate-500">Discount requests above update the proposed terms. Confirmation submits the complete quotation for final governance review.</p><button disabled={!canEdit || confirm.isPending} onClick={confirmQuotation} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"><Icon name="check" size={16} />{confirm.isPending ? 'Confirming…' : 'Confirm quotation'}</button>{!canEdit && <p className="mt-3 text-center text-[10px] text-slate-400">Terms are locked while this quotation is in its current state.</p>}</aside>
    </div>
  </div>
}

function ErrorState({ error, onBack }) {
  return <section className="grid min-h-96 place-items-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm"><div><span className="mx-auto grid size-12 place-items-center rounded-xl bg-red-50 text-red-600"><Icon name="alert" /></span><h1 className="mt-4 font-display text-lg font-bold">Quotation unavailable</h1><p role="alert" className="mt-2 text-xs text-red-600">{getApiError(error, 'This quotation could not be opened')}</p><button onClick={onBack} className="mt-5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold">Back to portal</button></div></section>
}

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { getApiError } from '../api/client'
import Icon from '../components/Icon'
import NegotiationThread from '../components/NegotiationThread'
import StatusBadge from '../components/StatusBadge'
import { useInternalNegotiationComment, useNegotiationThread, useQuotation, useSendToCustomer } from '../hooks/useApiQueries'
import { formatDate, formatMoney, shortId } from '../lib/format'

export default function InternalNegotiationPage() {
  const { quotationId } = useParams()
  const navigate = useNavigate()
  const quotation = useQuotation(quotationId)
  const quote = quotation.data
  const isSent = Boolean(quote?.sentToCustomerAt)
  const thread = useNegotiationThread(quotationId, isSent)
  const send = useSendToCustomer()
  const comment = useInternalNegotiationComment()
  const [customerEmail, setCustomerEmail] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)
  if (quotation.isLoading) return <div className="h-96 animate-pulse rounded-xl bg-slate-200" />
  if (quotation.isError) return <p role="alert" className="rounded-xl bg-red-50 p-5 text-sm text-red-700">{getApiError(quotation.error, 'Unable to load quotation')}</p>
  const mutationError = send.error || comment.error
  const customerLink = `${window.location.origin}/portal/quotations/${quote.id}`
  const doSend = () => {
    setNotice('')
    send.mutate({
      id: quote.id,
      customerEmail: quote.customerId ? undefined : customerEmail.trim() || undefined,
    }, {
      onSuccess: ({ emailDelivery }) => {
        if (emailDelivery?.status === 'SENT') {
          const message = 'Quotation sent and the customer has been emailed a secure portal link.'
          setNotice(message)
          toast.success(message)
        } else if (emailDelivery?.status === 'FAILED') {
          const message = 'Quotation was shared, but email delivery failed. You can still copy the portal link below.'
          setNotice(message)
          toast.error(message)
        } else {
          const message = 'Quotation was shared. Configure SMTP to email the portal link automatically.'
          setNotice(message)
          toast.warning(message)
        }
      },
    })
  }
  return <div className="space-y-5">
    <button onClick={() => navigate('/quotations')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"><Icon name="back" size={15} />Back</button>
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-semibold tracking-widest text-violet-600">CUSTOMER NEGOTIATION</p><h2 className="mt-2 font-display text-xl font-bold">{shortId(quote.id)}</h2><p className="mt-1 text-sm text-slate-500">{quote.customerName}</p></div><div className="text-right"><p className="font-display text-2xl font-bold">{formatMoney(Number(quote.grandTotal))}</p><div className="mt-2"><StatusBadge value={quote.status} /></div></div></div></section>
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-4 text-xs text-emerald-700">{notice}</p>}
    {mutationError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-xs text-red-700">{getApiError(mutationError, 'Unable to update negotiation')}</p>}
    {!isSent ? <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-[9px] font-semibold tracking-widest text-slate-400">OPEN CUSTOMER PORTAL ACCESS</p><h3 className="mt-1 font-display text-lg font-bold">Send to customer</h3><p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-500">The customer will receive an email containing a direct link to this quotation.</p>{quote.customerId ? <div className="mt-5 flex max-w-xl flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-xs text-slate-800">{quote.customer?.name || quote.customerName}</strong><p className="mt-1 text-[10px] text-slate-500">{quote.customer?.email}</p></div><button onClick={doSend} disabled={send.isPending} className="rounded-lg bg-violet-600 px-5 py-3 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50">{send.isPending ? 'Sending…' : 'Send and email customer'}</button></div> : <div className="mt-5"><p className="mb-2 text-[10px] text-amber-700">This is a legacy quotation created before customer selection was required. Link it once using the portal email.</p><div className="flex max-w-xl flex-col gap-2 sm:flex-row"><input type="email" value={customerEmail} onChange={event => setCustomerEmail(event.target.value)} placeholder="Customer portal email" className="min-w-0 flex-1 rounded-lg border border-slate-200 p-3 text-xs outline-none focus:border-violet-500" /><button onClick={doSend} disabled={send.isPending || !customerEmail.trim()} className="rounded-lg bg-violet-600 px-5 py-3 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50">{send.isPending ? 'Sending…' : 'Link and send'}</button></div></div>}</section> : <>
      <section className="rounded-xl border border-blue-200 bg-blue-50 p-5"><p className="text-[9px] font-semibold tracking-widest text-blue-500">CUSTOMER ACCESS LINK</p><h3 className="mt-1 font-display text-base font-bold text-blue-950">Share this link with {thread.data?.customer?.name || quote.customerName}</h3><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input aria-label="Customer portal link" readOnly value={customerLink} className="min-w-0 flex-1 rounded-lg border border-blue-200 bg-white p-3 text-xs text-blue-900" /><button onClick={async () => { await navigator.clipboard.writeText(customerLink); setCopied(true) }} className="rounded-lg bg-blue-700 px-4 py-3 text-xs font-semibold text-white hover:bg-blue-800">{copied ? 'Copied' : 'Copy customer link'}</button></div><p className="mt-2 text-[10px] text-blue-700">The customer signs in—or creates an account—then this quotation opens directly.</p></section>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[9px] font-semibold tracking-widest text-slate-400">SHARED THREAD</p><h3 className="mb-5 mt-1 font-display text-lg font-bold">Customer conversation</h3>{thread.isLoading ? <div className="h-48 animate-pulse rounded-lg bg-slate-100" /> : thread.isError ? <p role="alert" className="text-xs text-red-600">{getApiError(thread.error, 'Unable to load comments')}</p> : <NegotiationThread comments={thread.data.comments} lines={quote.lines} currentAuthorType="INTERNAL" isSubmitting={comment.isPending} onSubmit={(body, done) => comment.mutate({ id: quote.id, ...body }, { onSuccess: () => { done(); toast.success('Reply sent to the customer.') } })} />}</section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[9px] font-semibold tracking-widest text-slate-400">AUDIT EVENTS</p><h3 className="mb-4 mt-1 font-display text-lg font-bold">Negotiation activity</h3>{thread.data?.events?.length ? <ol className="space-y-4">{thread.data.events.map(event => <li key={event.id} className="border-l-2 border-violet-200 pl-3"><p className="text-xs font-semibold text-slate-700">{event.action.replaceAll('_', ' ')}</p><p className="mt-1 text-[10px] text-slate-400">{event.actorDisplayName} · {formatDate(event.createdAt)}</p>{event.details?.resultingStatus && <p className="mt-1 text-[10px] text-slate-500">Result: {event.details.resultingStatus.replaceAll('_', ' ')}</p>}</li>)}</ol> : <p className="text-xs text-slate-400">No negotiation events recorded.</p>}</section>
      </div>
    </>}
  </div>
}

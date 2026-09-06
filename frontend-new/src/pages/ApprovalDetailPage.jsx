import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import ApprovalChain from '../components/ApprovalChain'
import ApprovalDecisionDialog from '../components/ApprovalDecisionDialog'
import ApprovalHistory from '../components/ApprovalHistory'
import Icon from '../components/Icon'
import NegotiationThread from '../components/NegotiationThread'
import StatusBadge from '../components/StatusBadge'
import { useApprovalHistory, useApproveQuotation, useInternalNegotiationComment, useNegotiationThread, usePendingApprovals, useQuotation, useRejectQuotation, useReturnQuotation } from '../hooks/useApiQueries'
import { approvalErrorMessage, roleLabels } from '../lib/approval'
import { formatMoney, shortId } from '../lib/format'
import { useAuthStore } from '../store/authStore'

export default function ApprovalDetailPage() {
  const { quotationId } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore(state => state.user)
  const quotation = useQuotation(quotationId)
  const history = useApprovalHistory(quotationId)
  const pending = usePendingApprovals({ quotationId })
  const negotiation = useNegotiationThread(quotationId, Boolean(quotation.data?.sentToCustomerAt))
  const negotiationComment = useInternalNegotiationComment()
  const approve = useApproveQuotation()
  const reject = useRejectQuotation()
  const returnForRevision = useReturnQuotation()
  const [dialog, setDialog] = useState(null)
  const [notice, setNotice] = useState('')

  if (quotation.isLoading) return <DetailSkeleton />
  if (quotation.isError) return <PageError error={quotation.error} onBack={() => navigate('/quotations')} />

  const quote = quotation.data
  const isReviewer = ['MANAGER', 'FINANCE'].includes(user.role)
  const canManageFulfillment = user.role === 'ADMIN' || (user.role === 'REP' && quote.repId === user.id)
  const showFulfillmentAction = canManageFulfillment && ['CONFIRMED', 'FULFILLED'].includes(quote.status)
  const showBillingAction = canManageFulfillment && ['CONFIRMED', 'FULFILLED'].includes(quote.status)
  const assignedToUser = isReviewer && pending.isSuccess && pending.data.items.some(item => item.id === quote.id)
  const mutations = [approve, reject, returnForRevision]
  const activeMutation = mutations.find(mutation => mutation.isPending)
  const mutationError = mutations.find(mutation => mutation.isError)?.error

  const approveQuote = () => {
    setNotice('')
    approve.mutate(quote.id, { onSuccess: updated => {
      const message = updated.status === 'PENDING_FINANCE_APPROVAL' ? 'Manager approval recorded. The quotation now requires Finance approval.' : 'Quotation approved.'
      setNotice(message)
      toast.success(message)
    } })
  }
  const submitReason = reason => {
    setNotice('')
    const mutation = dialog === 'reject' ? reject : returnForRevision
    mutation.mutate({ id: quote.id, reason }, {
      onSuccess: updated => {
        setDialog(null)
        const message = updated.status === 'DRAFT' ? 'Quotation returned to the sales rep for revision.' : 'Quotation rejected.'
        setNotice(message)
        toast.success(message)
      },
    })
  }

  return <div className="space-y-5">
    <button onClick={() => navigate(isReviewer ? '/approvals' : '/quotations')} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"><Icon name="back" size={15} />Back</button>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
        <div><p className="text-[10px] font-semibold tracking-widest text-violet-600">QUOTATION</p><h2 className="mt-2 font-display text-xl font-bold">{shortId(quote.id)}</h2><p className="mt-1 text-sm text-slate-500">{quote.customerName}</p></div>
        <div className="text-right"><p className="font-display text-2xl font-bold">{formatMoney(Number(quote.grandTotal))}</p><div className="mt-2"><StatusBadge value={quote.status} /></div>{(showFulfillmentAction || showBillingAction) && <div className="mt-3 flex flex-wrap justify-end gap-2">{showBillingAction && <button onClick={() => navigate(`/quotations/${quote.id}/billing`)} className="inline-flex items-center gap-2 rounded-lg border border-violet-200 px-3.5 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50"><Icon name="receipt" size={15} />View Billing</button>}{showFulfillmentAction && <button onClick={() => navigate(`/quotations/${quote.id}/fulfillment`)} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"><Icon name="truck" size={15} />{quote.status === 'FULFILLED' ? 'View Fulfillment' : 'Plan Fulfillment'}</button>}</div>}</div>
      </div>
      <div className="grid divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
        <Fact label="Owner" value={quote.rep?.name || 'Unknown'} />
        <Fact label="Blended Risk Score" value={Number(quote.blendedRiskScore)} emphasis />
        <Fact label="Approval Requirement" value={assignedToUser ? `${roleLabels[user.role]} action required` : approvalRequirement(quote, history.data || [])} />
      </div>
    </section>

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <Card title="Risk" eyebrow="SERVER ASSESSED"><div className="flex items-end justify-between gap-4 rounded-lg bg-slate-50 p-4"><div><p className="text-xs font-semibold">Blended Risk Score</p><p className="mt-1 text-[10px] text-slate-400">Calculated by discount governance</p></div><strong className="font-display text-3xl text-violet-700">{Number(quote.blendedRiskScore)}</strong></div><p className="mt-3 text-[10px] leading-relaxed text-slate-400">Line-level discount ceilings and risk contributions are not exposed by the API, so no client-side risk calculation is shown.</p></Card>
        <Card title="Approval" eyebrow="CURRENT WORKFLOW"><ApprovalChain quotation={quote} history={history.data || []} /></Card>
        <Card title="Audit History" eyebrow="RECORDED ACTIONS"><ApprovalHistory history={history} /></Card>
      </div>

      <Card title="Decision" eyebrow="REVIEW ACTION">
        {notice && <p role="status" className="mb-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">{notice}</p>}
        {mutationError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{approvalErrorMessage(mutationError, 'Unable to update this quotation')}</p>}
        {isReviewer && pending.isLoading && <p className="text-xs text-slate-400">Checking your approval assignment…</p>}
        {isReviewer && pending.isError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{approvalErrorMessage(pending.error, 'Unable to verify this approval assignment')}</p>}
        {assignedToUser ? <div className="space-y-2">
          <button disabled={Boolean(activeMutation)} onClick={approveQuote} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Icon name="check" size={16} />{approve.isPending ? 'Approving…' : 'Approve'}</button>
          <button disabled={Boolean(activeMutation)} onClick={() => setDialog('reject')} className="w-full rounded-lg border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Reject</button>
          <button disabled={Boolean(activeMutation)} onClick={() => setDialog('return')} className="w-full rounded-lg border border-amber-200 px-4 py-2.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Return for Revision</button>
        </div> : !pending.isLoading && <p className="rounded-lg bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">No approval action is assigned to you for this quotation.</p>}
      </Card>
    </div>

    {quote.sentToCustomerAt && <Card title="Customer conversation" eyebrow="SHARED NEGOTIATION THREAD">
      {negotiation.isLoading ? <div className="h-40 animate-pulse rounded-lg bg-slate-100" /> : negotiation.isError ? <p role="alert" className="text-xs text-red-600">{approvalErrorMessage(negotiation.error, 'Unable to load customer comments')}</p> : <NegotiationThread comments={negotiation.data.comments} lines={quote.lines} currentAuthorType="INTERNAL" disabled={user.role === 'FINANCE'} isSubmitting={negotiationComment.isPending} onSubmit={(body, done) => negotiationComment.mutate({ id: quote.id, ...body }, { onSuccess: () => { done(); toast.success('Reply sent to the customer.') } })} />}
      {negotiationComment.isError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{approvalErrorMessage(negotiationComment.error, 'Unable to send comment')}</p>}
      {user.role === 'FINANCE' && <p className="mt-3 text-[10px] text-slate-400">Finance access is read-only for customer conversations.</p>}
    </Card>}

    {dialog && <ApprovalDecisionDialog action={dialog} isSubmitting={reject.isPending || returnForRevision.isPending} onClose={() => setDialog(null)} onSubmit={submitReason} />}
  </div>
}

function approvalRequirement(quotation, history) {
  if (quotation.status === 'PENDING_MANAGER_APPROVAL') return 'Sales Manager approval required'
  if (quotation.status === 'PENDING_FINANCE_APPROVAL') {
    const managerApproved = history.some(entry => entry.action === 'APPROVED' && entry.actor?.role === 'MANAGER')
    return managerApproved ? 'Finance approval required' : 'Sales Manager review precedes Finance'
  }
  if (quotation.status === 'REJECTED') return 'Rejected'
  if (quotation.status === 'DRAFT') return 'No approval currently required'
  if (quotation.status === 'FULFILLED') return 'Fulfillment complete'
  return 'Approval complete'
}

function Fact({ label, value, emphasis = false }) {
  return <div className="p-5"><p className="text-[9px] font-semibold tracking-wide text-slate-400">{label.toUpperCase()}</p><p className={`mt-1.5 font-semibold ${emphasis ? 'text-lg text-violet-700' : 'text-xs'}`}>{value}</p></div>
}

function Card({ title, eyebrow, children }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[9px] font-semibold tracking-widest text-slate-400">{eyebrow}</p><h3 className="mb-4 mt-1 font-display text-base font-bold">{title}</h3>{children}</section>
}

function DetailSkeleton() {
  return <div className="space-y-5" aria-label="Loading approval detail"><div className="h-40 animate-pulse rounded-xl bg-slate-200" /><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="h-80 animate-pulse rounded-xl bg-slate-200" /><div className="h-64 animate-pulse rounded-xl bg-slate-200" /></div></div>
}

function PageError({ error, onBack }) {
  return <section className="grid min-h-96 place-items-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm"><div><span className="mx-auto grid size-11 place-items-center rounded-xl bg-red-50 text-red-600"><Icon name="alert" /></span><h2 className="mt-3 text-sm font-bold">Unable to open quotation</h2><p role="alert" className="mt-1 text-xs text-red-600">{approvalErrorMessage(error, 'Unable to load quotation')}</p><button onClick={onBack} className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold">Back to quotations</button></div></section>
}

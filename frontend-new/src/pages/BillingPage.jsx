import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { getApiError } from '../api/client'
import Icon from '../components/Icon'
import OneTimeBillingSection from '../components/OneTimeBillingSection'
import RecurringBillingSection from '../components/RecurringBillingSection'
import StatusBadge from '../components/StatusBadge'
import {
  useBilling,
  useCancelRecurringLine,
  useGenerateBilling,
  usePayInvoice,
  useUpdateRecurringQuantity,
} from '../hooks/useApiQueries'
import { billingErrorMessage, hasGeneratedBilling } from '../lib/billing'
import { shortId } from '../lib/format'

export default function BillingPage() {
  const { quotationId } = useParams()
  const navigate = useNavigate()
  const billing = useBilling(quotationId)
  const generate = useGenerateBilling()
  const quantity = useUpdateRecurringQuantity()
  const cancellation = useCancelRecurringLine()
  const payment = usePayInvoice()
  const [notice, setNotice] = useState('')

  if (billing.isLoading) return <BillingSkeleton />
  if (billing.isError) return <PageError error={billing.error} onBack={() => navigate('/billing')} />

  const data = billing.data
  const generated = hasGeneratedBilling(data)
  const billingEligible = ['CONFIRMED', 'FULFILLED'].includes(data.status)
  const actionError = [generate, quantity, cancellation, payment].find(item => item.isError)?.error
  const resetFeedback = () => {
    setNotice('')
    generate.reset()
    quantity.reset()
    cancellation.reset()
    payment.reset()
  }

  const generateBilling = () => {
    resetFeedback()
    generate.mutate(quotationId, {
      onSuccess: () => {
        const message = 'Billing generated. The invoice and monthly schedule are ready.'
        setNotice(message)
        toast.success(message)
      },
    })
  }
  const updateQuantity = (lineId, qty) => {
    resetFeedback()
    quantity.mutate({ quotationId, lineId, qty }, {
      onSuccess: result => {
        const label = result.proration.type === 'SCHEDULE_ENTRY' ? 'Prorated charge added' : 'Credit note issued'
        const message = `${label}: ${formatAmount(result.proration.amount)}.`
        setNotice(message)
        toast.success(message)
      },
    })
  }
  const cancelLine = lineId => {
    resetFeedback()
    cancellation.mutate({ quotationId, lineId }, {
      onSuccess: result => {
        const message = result.creditNote
          ? `Subscription cancelled. Credit note issued for ${formatAmount(result.creditNote.amount)}.`
          : 'Subscription cancelled. Future billing has stopped.'
        setNotice(message)
        toast.success(message)
      },
    })
  }
  const payInvoice = invoiceId => {
    resetFeedback()
    payment.mutate({ quotationId, invoiceId }, {
      onSuccess: invoice => {
        const message = `Payment of ${formatAmount(invoice.amount)} recorded.`
        setNotice(message)
        toast.success(message)
      },
    })
  }

  return <div className="space-y-5">
    <button onClick={() => navigate('/billing')} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"><Icon name="back" size={15} />Back to billing</button>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
        <div><p className="text-[10px] font-semibold tracking-widest text-violet-600">HYBRID BILLING</p><h2 className="mt-2 font-display text-xl font-bold">{shortId(data.quotationId)}</h2><p className="mt-1 text-sm text-slate-500">{data.customerName}</p></div>
        <div className="flex flex-col items-end gap-3"><StatusBadge value={data.status} />{!generated && billingEligible && <button disabled={generate.isPending} onClick={generateBilling} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-50"><Icon name="receipt" size={16} />{generate.isPending ? 'Generating…' : 'Generate Billing'}</button>}</div>
      </div>
      <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-[10px] text-slate-500">One-time and recurring charges are separated by the server. All adjustments shown here are persisted immediately.</div>
    </section>

    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">{notice}</p>}
    {actionError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{billingErrorMessage(actionError)}</p>}
    {!generated && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">{billingEligible ? 'This confirmed quotation has billable lines but no invoice or recurring schedule yet. Generate billing to create both sections.' : 'Billing becomes available only after the customer confirms the quotation and any resulting approvals are completed.'}</p>}

    <div className="grid items-start gap-5 2xl:grid-cols-2">
      <OneTimeBillingSection
        lines={data.oneTimeLines}
        invoices={data.oneTimeInvoices}
        payment={{ isPending: payment.isPending, invoiceId: payment.variables?.invoiceId, onPay: payInvoice }}
      />
      <RecurringBillingSection
        lines={data.recurringLines}
        quantityChange={{ isPending: quantity.isPending, lineId: quantity.variables?.lineId, onChange: updateQuantity }}
        cancellation={{ isPending: cancellation.isPending, lineId: cancellation.variables?.lineId, onCancel: cancelLine }}
      />
    </div>
  </div>
}

function formatAmount(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value))
}

function BillingSkeleton() {
  return <div className="space-y-5" aria-label="Loading billing"><div className="h-36 animate-pulse rounded-xl bg-slate-200" /><div className="grid gap-5 2xl:grid-cols-2"><div className="h-96 animate-pulse rounded-xl bg-slate-200" /><div className="h-96 animate-pulse rounded-xl bg-slate-200" /></div></div>
}

function PageError({ error, onBack }) {
  return <section className="grid min-h-96 place-items-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm"><div><span className="mx-auto grid size-11 place-items-center rounded-xl bg-red-50 text-red-600"><Icon name="alert" /></span><h2 className="mt-3 text-sm font-bold">Unable to open billing</h2><p role="alert" className="mt-1 text-xs text-red-600">{getApiError(error, 'Unable to load billing')}</p><button onClick={onBack} className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold">Back to billing</button></div></section>
}

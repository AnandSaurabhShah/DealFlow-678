import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { getApiError } from '../api/client'
import { quotationApi } from '../api/quotations'
import Icon from '../components/Icon'
import Pagination from '../components/Pagination'
import SearchInput from '../components/SearchInput'
import StatusBadge from '../components/StatusBadge'
import { useCustomers, useProducts, useQuotation, useUsers } from '../hooks/useApiQueries'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { formatMoney, shortId } from '../lib/format'
import { configEnumLabel } from '../lib/configEnums'
import { useAuthStore } from '../store/authStore'

const inputClass = 'mt-1.5 block w-full rounded-lg border border-slate-200 bg-white p-2.5 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10'

export default function QuotationBuilderPage() {
  const { quotationId } = useParams()
  const isAdmin = useAuthStore(state => state.user?.role === 'ADMIN')
  const [productPage, setProductPage] = useState(1)
  const [customerPage, setCustomerPage] = useState(1)
  const [productSearch, setProductSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const debouncedProductSearch = useDebouncedValue(productSearch)
  const debouncedCustomerSearch = useDebouncedValue(customerSearch)
  const products = useProducts({ page: productPage, pageSize: 20, search: debouncedProductSearch })
  const customers = useCustomers({ page: customerPage, pageSize: 20, search: debouncedCustomerSearch })
  const reps = useUsers({ pageSize: 100, role: 'REP', enabled: isAdmin })
  const quotation = useQuotation(quotationId)

  if (products.isLoading || customers.isLoading || (isAdmin && reps.isLoading) || (quotationId && quotation.isLoading)) return <PanelMessage>Loading quotation builder…</PanelMessage>
  if (products.isError) return <PanelMessage error>{getApiError(products.error, 'Unable to load products')}</PanelMessage>
  if (customers.isError) return <PanelMessage error>{getApiError(customers.error, 'Unable to load customers')}</PanelMessage>
  if (isAdmin && reps.isError) return <PanelMessage error>{getApiError(reps.error, 'Unable to load sales reps')}</PanelMessage>
  if (quotation.isError) return <PanelMessage error>{getApiError(quotation.error, 'Unable to load quotation')}</PanelMessage>

  return <BuilderForm isAdmin={isAdmin} reps={reps.data?.items || []} initialQuotation={quotation.data} products={products.data?.items || []} productPagination={products.data?.pagination} onProductPageChange={setProductPage} productSearch={productSearch} onProductSearchChange={value => { setProductSearch(value); setProductPage(1) }} customers={customers.data?.items || []} customerPagination={customers.data?.pagination} onCustomerPageChange={setCustomerPage} customerSearch={customerSearch} onCustomerSearchChange={value => { setCustomerSearch(value); setCustomerPage(1) }} />
}

function BuilderForm({ isAdmin, reps, initialQuotation, products, productPagination, onProductPageChange, productSearch, onProductSearchChange, customers, customerPagination, onCustomerPageChange, customerSearch, onCustomerSearchChange }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [draftId, setDraftId] = useState(initialQuotation?.id || null)
  const [status, setStatus] = useState(initialQuotation?.status || 'DRAFT')
  const [customerId, setCustomerId] = useState(initialQuotation?.customerId || customers[0]?.id || '')
  const [repId, setRepId] = useState(initialQuotation?.repId || reps[0]?.id || '')
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '')
  const [lines, setLines] = useState(() => (initialQuotation?.lines || []).map(line => ({
    productId: line.productId,
    name: line.product.name,
    category: line.product.category,
    billingType: line.billingType,
    billingCycle: line.billingCycle,
    unitPrice: Number(line.unitPrice),
    qty: line.qty,
    discountPercent: Number(line.discountPercent),
  })))
  const [notice, setNotice] = useState('')
  const isEditable = status === 'DRAFT'
  const customerChoices = initialQuotation?.customer && !customers.some(customer => customer.id === initialQuotation.customer.id)
    ? [initialQuotation.customer, ...customers]
    : customers
  const activeCustomerId = customerChoices.some(customer => customer.id === customerId)
    ? customerId
    : customerChoices[0]?.id || ''
  const selectedCustomer = customerChoices.find(customer => customer.id === activeCustomerId) || initialQuotation?.customer
  const activeSelectedProductId = products.some(product => product.id === selectedProductId)
    ? selectedProductId
    : products[0]?.id || ''

  const totals = useMemo(() => lines.reduce((sum, line) => {
    const gross = line.unitPrice * line.qty
    const discount = gross * line.discountPercent / 100
    return { subtotal: sum.subtotal + gross, totalDiscount: sum.totalDiscount + discount, grandTotal: sum.grandTotal + gross - discount }
  }, { subtotal: 0, totalDiscount: 0, grandTotal: 0 }), [lines])

  const saveMutation = useMutation({
    mutationFn: async ({ shouldConfirm }) => {
      if (!draftId && !activeCustomerId) throw new Error('Select a customer before creating the quotation')
      if (!draftId && isAdmin && !repId) throw new Error('Select a sales rep to own the quotation')
      if (shouldConfirm && lines.length === 0) throw new Error('Add at least one product before confirming')
      const draft = draftId
        ? { id: draftId }
        : await quotationApi.create({ customerId: activeCustomerId, ...(isAdmin ? { repId } : {}) })
      const saved = await quotationApi.replaceLines(draft.id, lines.map(line => ({
        productId: line.productId,
        qty: line.qty,
        discountPercent: line.discountPercent,
      })))
      return shouldConfirm ? quotationApi.confirm(saved.id) : saved
    },
    onSuccess: (saved, variables) => {
      setDraftId(saved.id)
      setStatus(saved.status)
      setCustomerId(saved.customerId || '')
      setLines(saved.lines.map(line => ({ productId: line.productId, name: line.product.name, category: line.product.category, billingType: line.billingType, billingCycle: line.billingCycle, unitPrice: Number(line.unitPrice), qty: line.qty, discountPercent: Number(line.discountPercent) })))
      queryClient.setQueryData(['quotation', saved.id], saved)
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      if (variables.shouldConfirm) {
        const messages = {
          PENDING_MANAGER_APPROVAL: 'Sent for Manager approval.',
          PENDING_FINANCE_APPROVAL: 'Sent for Manager approval, followed by Finance.',
          APPROVED: 'Approved. No further approval is required.',
          CONFIRMED: 'Quotation confirmed.',
        }
        const message = messages[saved.status] || `Quotation status: ${saved.status}`
        setNotice(message)
        toast.success(message)
      } else {
        const message = 'Draft saved and totals synced with the server.'
        setNotice(message)
        toast.success(message)
      }
    },
  })

  const addProduct = () => {
    const product = products.find(item => item.id === activeSelectedProductId)
    if (!product || lines.some(line => line.productId === product.id)) return
    setNotice('')
    setLines(current => [...current, { productId: product.id, name: product.name, category: product.category, billingType: product.billingType, billingCycle: product.billingCycle, unitPrice: Number(product.price), qty: 1, discountPercent: 0 }])
  }
  const updateLine = (productId, field, value) => setLines(current => current.map(line => line.productId === productId ? { ...line, [field]: field === 'qty' ? Math.max(1, Number(value)) : Math.min(100, Math.max(0, Number(value))) } : line))
  const removeLine = productId => setLines(current => current.filter(line => line.productId !== productId))

  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between p-5"><div><h2 className="font-display text-base font-bold">{draftId ? `Quotation ${shortId(draftId)}` : 'New quotation'}</h2><p className="mt-1 text-[10px] text-slate-400">Add products, quantities, and line discounts.</p></div><StatusBadge value={status} /></div>
      <div className="px-5 pb-5">{draftId ? <div><p className="text-[10px] font-semibold">Customer</p><div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3"><strong className="text-xs">{selectedCustomer?.name || initialQuotation?.customerName}</strong><p className="mt-1 text-[10px] text-slate-400">{selectedCustomer?.email || 'Legacy quotation without a linked portal account'}</p></div><p className="mt-1 text-[9px] text-slate-400">The customer link is fixed after the draft is created.</p></div> : <div><p className="text-[10px] font-semibold">Customer</p><SearchInput value={customerSearch} onChange={onCustomerSearchChange} placeholder="Search customer name or email…" className="mt-1.5" /><select required className={`${inputClass} mt-2`} value={activeCustomerId} onChange={event => setCustomerId(event.target.value)}><option value="">Select a customer</option>{customerChoices.map(customer => <option key={customer.id} value={customer.id}>{customer.name} · {customer.email}</option>)}</select>{!customerChoices.length && <p className="mt-2 text-[10px] text-amber-700">No customer portal accounts match this search.</p>}<Pagination pagination={customerPagination} onPageChange={onCustomerPageChange} /></div>}</div>
      {isAdmin && <div className="px-5 pb-5"><label className="text-[10px] font-semibold">Quotation owner<select required disabled={Boolean(draftId)} className={`${inputClass} disabled:bg-slate-50`} value={repId} onChange={event => setRepId(event.target.value)}><option value="">Select a sales rep</option>{reps.map(rep => <option key={rep.id} value={rep.id}>{rep.name} · {rep.email}</option>)}</select></label><p className="mt-1 text-[9px] text-slate-400">Admin-created quotations are assigned to a sales rep for workflow ownership.</p></div>}
      <div className="border-t border-slate-100 p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><h3 className="text-xs font-semibold">Line items <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] text-violet-700">{lines.length}</span></h3><SearchInput value={productSearch} onChange={onProductSearchChange} placeholder="Search product catalog…" className="w-full sm:max-w-72" /></div><div className="mt-3 flex justify-end gap-2"><select aria-label="Product" disabled={!products.length || !isEditable} className="min-h-9 max-w-[280px] flex-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] disabled:bg-slate-50" value={activeSelectedProductId} onChange={event => setSelectedProductId(event.target.value)}>{products.map(product => <option value={product.id} key={product.id}>{product.name} · {product.billingType === 'RECURRING' ? 'Monthly' : 'One-time'}</option>)}</select><button type="button" onClick={addProduct} disabled={!activeSelectedProductId || !isEditable} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold disabled:opacity-50"><Icon name="plus" />Add</button></div></div>
      {!products.length && <p className="border-t border-slate-100 p-5 text-xs text-amber-700">No products are available on this catalog page.</p>}
      <Pagination pagination={productPagination} onPageChange={onProductPageChange} disabled={!isEditable} />
      {lines.length > 0 && <div><div className="hidden grid-cols-[minmax(190px,2fr)_55px_90px_90px_95px_20px] gap-2 border-y border-slate-100 bg-slate-50 px-5 py-2.5 text-[8px] text-slate-400 md:grid"><span>PRODUCT</span><span>QTY</span><span>UNIT PRICE</span><span>DISCOUNT</span><span>LINE TOTAL</span><span /></div>{lines.map(line => <div className="grid grid-cols-[1fr_55px_80px] items-center gap-2 border-b border-slate-100 px-5 py-3 text-[10px] md:grid-cols-[minmax(190px,2fr)_55px_90px_90px_95px_20px]" key={line.productId}><div className="col-span-3 flex items-center gap-2 md:col-span-1"><span className="grid size-8 place-items-center rounded-lg bg-violet-50 text-violet-600"><Icon name="box" /></span><div className="flex flex-col"><strong>{line.name}</strong><small className="mt-0.5 text-[8px] text-slate-400">{configEnumLabel(line.category)} · {line.billingType === 'RECURRING' ? 'Monthly recurring' : 'One-time'}</small></div></div><input aria-label={`${line.name} quantity`} disabled={!isEditable} className="w-full rounded-md border border-slate-200 p-2 disabled:bg-slate-50" type="number" min="1" value={line.qty} onChange={event => updateLine(line.productId, 'qty', event.target.value)} /><span>{formatMoney(line.unitPrice)}</span><label className="flex items-center rounded-md border border-slate-200 p-2"><input aria-label={`${line.name} discount`} disabled={!isEditable} className="w-full min-w-0 border-0 outline-none disabled:bg-slate-50" type="number" min="0" max="100" value={line.discountPercent} onChange={event => updateLine(line.productId, 'discountPercent', event.target.value)} /><span>%</span></label><strong>{formatMoney(line.unitPrice * line.qty * (1 - line.discountPercent / 100))}</strong><button type="button" aria-label={`Remove ${line.name}`} disabled={!isEditable} onClick={() => removeLine(line.productId)} className="text-lg text-slate-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30">×</button></div>)}</div>}
    </section>
    <aside className="sticky top-28 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="bg-ink px-5 py-4 text-white"><span className="text-[9px] tracking-widest text-violet-200/70">QUOTATION SUMMARY</span></div><div className="space-y-2 border-b border-slate-100 p-5 text-[11px]"><SummaryLine label="Subtotal" value={formatMoney(totals.subtotal)} /><SummaryLine label="Discount" value={`−${formatMoney(totals.totalDiscount)}`} accent /><SummaryLine label="Grand total" value={formatMoney(totals.grandTotal)} strong /></div><div className="space-y-2 p-5">{notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-[10px] text-emerald-700">{notice}</p>}{saveMutation.isError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-[10px] text-red-700">{getApiError(saveMutation.error, 'Unable to save quotation')}</p>}{isEditable ? <><button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate({ shouldConfirm: false })} className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold disabled:opacity-50">Save draft</button><button type="button" disabled={saveMutation.isPending || !lines.length} onClick={() => saveMutation.mutate({ shouldConfirm: true })} className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-3 text-xs font-semibold text-white shadow-lg shadow-violet-600/20 disabled:opacity-50">{saveMutation.isPending ? 'Saving…' : 'Save & confirm'}<Icon name="arrow" /></button></> : <button type="button" onClick={() => navigate(`/approvals/${draftId}`)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-3 text-xs font-semibold text-white hover:bg-violet-700">View Approval <Icon name="arrow" /></button>}</div><p className="px-5 pb-5 text-center text-[8px] text-slate-400">Final prices, risk, and approval routing are validated by the server.</p></aside>
  </div>
}

function SummaryLine({ label, value, accent, strong }) {
  return <div className="flex justify-between"><span className="text-slate-400">{label}</span><span className={`${accent ? 'text-coral' : ''} ${strong ? 'font-display text-base font-bold text-slate-900' : 'font-semibold'}`}>{value}</span></div>
}

function PanelMessage({ children, error = false }) {
  return <div role={error ? 'alert' : undefined} className={`grid min-h-96 place-items-center rounded-xl border border-slate-200 bg-white text-sm shadow-sm ${error ? 'text-red-600' : 'text-slate-400'}`}>{children}</div>
}

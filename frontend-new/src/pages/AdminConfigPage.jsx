import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { configApi } from '../api/config'
import { getApiError } from '../api/client'
import Pagination from '../components/Pagination'
import { useAdminConfig } from '../hooks/useApiQueries'
import { formatMoney } from '../lib/format'

const sections = {
  products: {
    label: 'Products',
    queryKey: 'products',
    create: configApi.createProduct,
    initial: { name: '', category: '', price: '', unit: 'unit', tax: '0', description: '', billingType: 'ONE_TIME', billingCycle: 'MONTHLY' },
    fields: [
      ['name', 'Name'], ['category', 'Category'], ['price', 'Price', 'number'],
      ['unit', 'Unit'], ['tax', 'Tax %', 'number'], ['description', 'Description'],
      ['billingType', 'Billing type', 'billingType'], ['billingCycle', 'Billing cycle', 'billingCycle'],
    ],
  },
  priceLists: {
    label: 'Price lists',
    queryKey: 'priceLists',
    create: configApi.createPriceList,
    initial: { name: '', customerTier: '', currency: 'USD' },
    fields: [['name', 'Name'], ['customerTier', 'Customer tier'], ['currency', 'Currency']],
  },
  warehouses: {
    label: 'Warehouses',
    queryKey: 'warehouses',
    create: configApi.createWarehouse,
    initial: { name: '', location: '' },
    fields: [['name', 'Name'], ['location', 'Location']],
  },
  discountTiers: {
    label: 'Discount tiers',
    queryKey: 'discountTiers',
    create: configApi.createDiscountTier,
    initial: { tierName: '', maxDiscountPercent: '' },
    fields: [['tierName', 'Tier name'], ['maxDiscountPercent', 'Maximum discount %', 'number']],
  },
}

export default function AdminConfigPage() {
  const [active, setActive] = useState('products')
  const [form, setForm] = useState(sections.products.initial)
  const [notice, setNotice] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const queryClient = useQueryClient()
  const queries = useAdminConfig(active, page, pageSize)
  const section = sections[active]
  const query = queries[active]
  const createMutation = useMutation({
    mutationFn: values => section.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [section.queryKey] })
      setForm(section.initial)
      setPage(1)
      const message = `${section.label.slice(0, -1)} created.`
      setNotice(message)
      toast.success(message)
    },
  })

  const selectSection = key => {
    setActive(key)
    setForm(sections[key].initial)
    setNotice('')
    setPage(1)
    createMutation.reset()
  }
  const submit = event => { event.preventDefault(); createMutation.mutate(form) }

  return <div className="grid items-start gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
    <aside className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">{Object.entries(sections).map(([key, item]) => <button key={key} onClick={() => selectSection(key)} className={`block w-full rounded-lg px-3 py-2.5 text-left text-xs ${active === key ? 'bg-violet-50 font-semibold text-violet-700' : 'text-slate-500 hover:bg-slate-50'}`}>{item.label}</button>)}</aside>
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5"><h2 className="font-display text-base font-bold">Add {section.label.toLowerCase().slice(0, -1)}</h2><p className="mt-1 text-[10px] text-slate-400">Configure the fields used by quotations and billing.</p></div><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">{section.fields.map(([name, label, type = 'text']) => {
        if (name === 'billingCycle' && form.billingType !== 'RECURRING') return null
        if (type === 'billingType') return <SelectField key={name} label={label} name={name} value={form[name]} options={[['ONE_TIME', 'One-time'], ['RECURRING', 'Recurring']]} onChange={value => setForm(current => ({ ...current, billingType: value }))} />
        if (type === 'billingCycle') return <SelectField key={name} label={label} name={name} value={form[name]} options={[['MONTHLY', 'Monthly']]} onChange={value => setForm(current => ({ ...current, billingCycle: value }))} />
        return <label key={name} className="text-[10px] font-semibold">{label}<input required={name !== 'description' && name !== 'location'} name={name} type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.01' : undefined} value={form[name]} onChange={event => setForm(current => ({ ...current, [name]: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-slate-200 p-2.5 outline-none focus:border-violet-500" /></label>
      })}<div className="sm:col-span-2">{notice && <p role="status" className="mb-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">{notice}</p>}{createMutation.isError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{getApiError(createMutation.error, `Unable to create ${section.label.toLowerCase()}`)}</p>}<button disabled={createMutation.isPending} className="rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{createMutation.isPending ? 'Creating…' : `Create ${section.label.toLowerCase().slice(0, -1)}`}</button></div></form></section>
      <section className="min-h-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-5"><h2 className="font-display text-base font-bold">{section.label}</h2><button onClick={() => query.refetch()} className="text-[10px] font-semibold text-violet-600">Refresh</button></div>{query.isLoading && <ConfigMessage>Loading…</ConfigMessage>}{query.isError && <ConfigMessage error>{getApiError(query.error, `Unable to load ${section.label.toLowerCase()}`)}</ConfigMessage>}{query.isSuccess && <><ConfigList type={active} items={query.data.items} /><Pagination pagination={query.data.pagination} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1) }} disabled={query.isFetching} /></>}</section>
    </div>
  </div>
}

function ConfigList({ type, items }) {
  if (!items.length) return <ConfigMessage>No records configured yet.</ConfigMessage>
  return <div className="divide-y divide-slate-100">{items.map(item => <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4 text-xs"><div><strong>{item.name || item.tierName}</strong><p className="mt-1 text-[10px] text-slate-400">{detail(type, item)}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] text-slate-600">{type === 'products' ? item.category : type === 'warehouses' ? `${item._count.stockLevels} stock lines` : type === 'priceLists' ? item.currency : 'active'}</span></div>)}</div>
}

function detail(type, item) {
  if (type === 'products') return `${formatMoney(Number(item.price))} per ${item.unit} · ${item.billingType === 'RECURRING' ? 'Monthly recurring' : 'One-time'} · ${item.tax}% tax`
  if (type === 'priceLists') return `Customer tier: ${item.customerTier}`
  if (type === 'warehouses') return item.location || 'No location set'
  return `Maximum discount: ${item.maxDiscountPercent}%`
}

function SelectField({ label, name, value, options, onChange }) {
  return <label className="text-[10px] font-semibold">{label}<select name={name} value={value} onChange={event => onChange(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white p-2.5 outline-none focus:border-violet-500">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>
}

function ConfigMessage({ children, error = false }) {
  return <div role={error ? 'alert' : undefined} className={`grid min-h-52 place-items-center text-xs ${error ? 'text-red-600' : 'text-slate-400'}`}>{children}</div>
}

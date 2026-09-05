import Icon from './Icon'

function Stage({ label, state }) {
  const styles = state === 'Approved'
    ? 'bg-emerald-50 text-emerald-700'
    : state === 'Pending' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
  return <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
    <span className="flex items-center gap-2 text-xs font-semibold"><Icon name={state === 'Approved' ? 'check' : 'clock'} size={16} />{label}</span>
    <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${styles}`}>{state}</span>
  </li>
}

export default function ApprovalChain({ quotation, history = [] }) {
  const managerApproved = history.some(entry => entry.action === 'APPROVED' && entry.actor?.role === 'MANAGER')
  const financeApproved = history.some(entry => entry.action === 'APPROVED' && entry.actor?.role === 'FINANCE')
  let stages = []

  if (quotation.status === 'PENDING_MANAGER_APPROVAL') {
    stages = [{ label: 'Sales Manager', state: 'Pending' }]
  } else if (quotation.status === 'PENDING_FINANCE_APPROVAL') {
    stages = [
      { label: 'Sales Manager', state: managerApproved ? 'Approved' : 'Pending' },
      { label: 'Finance', state: managerApproved ? 'Pending' : 'Upcoming' },
    ]
  } else if (quotation.status === 'APPROVED' && (managerApproved || financeApproved)) {
    stages = [
      ...(managerApproved ? [{ label: 'Sales Manager', state: 'Approved' }] : []),
      ...(financeApproved ? [{ label: 'Finance', state: 'Approved' }] : []),
    ]
  }

  if (!stages.length) return <p className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">No approval is currently required.</p>
  return <ol className="space-y-2">{stages.map(stage => <Stage key={stage.label} {...stage} />)}</ol>
}

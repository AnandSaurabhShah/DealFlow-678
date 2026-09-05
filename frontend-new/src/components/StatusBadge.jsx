const styles = {
  DRAFT: 'bg-slate-100 text-slate-500',
  PENDING_MANAGER_APPROVAL: 'bg-amber-50 text-amber-700',
  PENDING_FINANCE_APPROVAL: 'bg-orange-50 text-orange-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-700',
  CONFIRMED: 'bg-emerald-50 text-emerald-700',
  FULFILLED: 'bg-cyan-50 text-cyan-700',
}

const statusLabels = {
  DRAFT: 'Draft',
  PENDING_MANAGER_APPROVAL: 'Pending Manager',
  PENDING_FINANCE_APPROVAL: 'Pending Finance',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CONFIRMED: 'Confirmed',
  FULFILLED: 'Fulfilled',
}

export default function StatusBadge({ value }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-semibold ${styles[value] || styles.DRAFT}`}>
    <span className="size-1.5 rounded-full bg-current" />{statusLabels[value] || value || 'Unknown'}
  </span>
}

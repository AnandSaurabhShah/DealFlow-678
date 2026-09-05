function productFor(row, quotationLines) {
  return row.product || quotationLines.find(line => line.productId === row.productId)?.product
}

export default function FulfillmentPlanTable({ rows, quotationLines, manual = false, disabled = false, onQuantityChange }) {
  if (!rows.length) return <div className="grid min-h-40 place-items-center rounded-lg bg-slate-50 px-5 text-center text-xs text-slate-500">No fulfillment suggestion rows were returned.</div>

  return <div className="overflow-x-auto rounded-lg border border-slate-100">
    <table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
      <thead><tr className="border-b border-slate-100 bg-slate-50 text-[9px] tracking-wide text-slate-400">
        <th className="px-4 py-3 font-semibold">PRODUCT</th>
        <th className="px-4 py-3 font-semibold">WAREHOUSE</th>
        <th className="px-4 py-3 font-semibold">QTY FULFILLED</th>
        <th className="px-4 py-3 font-semibold">QTY BACKORDERED</th>
      </tr></thead>
      <tbody>{rows.map((row, index) => {
        const product = productFor(row, quotationLines)
        const unassigned = !row.warehouseId
        return <tr key={`${row.productId}-${row.warehouseId || 'unassigned'}-${index}`} className="border-b border-slate-100 last:border-0">
          <td className="px-4 py-3"><strong>{product?.name || 'Unknown product'}</strong><p className="mt-0.5 text-[9px] text-slate-400">{product?.category || row.productId}</p></td>
          <td className="px-4 py-3"><strong className={unassigned ? 'text-amber-700' : ''}>{unassigned ? 'Unassigned — backordered' : row.warehouse?.name || 'Unknown warehouse'}</strong>{row.warehouse?.location && <p className="mt-0.5 text-[9px] text-slate-400">{row.warehouse.location}</p>}</td>
          <td className="px-4 py-3">{manual && !unassigned
            ? <input aria-label={`${product?.name || 'Product'} quantity at ${row.warehouse?.name || 'warehouse'}`} disabled={disabled} inputMode="numeric" min="0" step="1" type="number" value={row.qtyFulfilled} onChange={event => onQuantityChange(index, event.target.value)} className="w-24 rounded-md border border-slate-200 px-2.5 py-2 font-semibold outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:bg-slate-50" />
            : <strong>{row.qtyFulfilled}</strong>}</td>
          <td className="px-4 py-3">{manual ? <span className="text-[10px] text-slate-400">Server derived</span> : <strong className={row.qtyBackordered ? 'text-amber-700' : ''}>{row.qtyBackordered}</strong>}</td>
        </tr>
      })}</tbody>
    </table>
  </div>
}

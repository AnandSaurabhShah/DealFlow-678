function assertNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative integer`);
  }
}

function normalizeStockLevels(stockLevels, productId) {
  return stockLevels
    .filter((stock) => stock.productId === productId)
    .map((stock) => {
      assertNonNegativeInteger(stock.qty, `Stock for product ${productId}`);
      if (!stock.warehouseId) throw new TypeError("stockLevel.warehouseId is required");
      return { warehouseId: stock.warehouseId, qty: stock.qty };
    })
    .sort((left, right) => right.qty - left.qty || left.warehouseId.localeCompare(right.warehouseId));
}

function splitQuotationLine(line, stockLevels, quotationId) {
  if (!line?.productId) throw new TypeError("line.productId is required");
  assertNonNegativeInteger(line.qty, `Quantity for product ${line.productId}`);
  if (line.qty === 0) return [];

  const available = normalizeStockLevels(stockLevels, line.productId);
  if (!available.length) {
    return [{ quotationId, warehouseId: null, productId: line.productId, qtyFulfilled: 0, qtyBackordered: line.qty }];
  }

  const singleWarehouse = available.find((stock) => stock.qty >= line.qty);
  if (singleWarehouse) {
    return [{
      quotationId,
      warehouseId: singleWarehouse.warehouseId,
      productId: line.productId,
      qtyFulfilled: line.qty,
      qtyBackordered: 0,
    }];
  }

  let remaining = line.qty;
  const splits = [];
  for (const stock of available) {
    if (remaining === 0) break;
    const qtyFulfilled = Math.min(stock.qty, remaining);
    if (qtyFulfilled === 0) continue;
    splits.push({ quotationId, warehouseId: stock.warehouseId, productId: line.productId, qtyFulfilled, qtyBackordered: 0 });
    remaining -= qtyFulfilled;
  }

  if (remaining > 0) {
    if (splits.length) splits[splits.length - 1].qtyBackordered = remaining;
    else splits.push({ quotationId, warehouseId: available[0].warehouseId, productId: line.productId, qtyFulfilled: 0, qtyBackordered: remaining });
  }
  return splits;
}

function proposeFulfillmentSplits(quotation, stockLevels) {
  if (!quotation?.id) throw new TypeError("quotation.id is required");
  if (!Array.isArray(quotation.lines)) throw new TypeError("quotation.lines must be an array");
  if (!Array.isArray(stockLevels)) throw new TypeError("stockLevels must be an array");

  return quotation.lines.flatMap((line) => splitQuotationLine(line, stockLevels, quotation.id));
}

module.exports = { normalizeStockLevels, splitQuotationLine, proposeFulfillmentSplits };

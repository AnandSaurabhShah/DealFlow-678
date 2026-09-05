const ApiError = require("../utils/apiError");
const { proposeFulfillmentSplits } = require("./fulfillmentSplitter");

function buildFulfillmentRecords(quotationLines, allocations) {
  const orderedByProduct = new Map(
    quotationLines.map((line) => [line.productId, line.qty]),
  );
  const allocationsByProduct = new Map();

  for (const allocation of allocations) {
    if (!orderedByProduct.has(allocation.productId)) {
      throw new ApiError(
        400,
        "INVALID_FULFILLMENT_SPLIT",
        `Product ${allocation.productId} is not on this quotation`,
      );
    }
    const productAllocations = allocationsByProduct.get(allocation.productId) || [];
    productAllocations.push(allocation);
    allocationsByProduct.set(allocation.productId, productAllocations);
  }

  const records = [];
  for (const [productId, orderedQty] of orderedByProduct) {
    const productAllocations = allocationsByProduct.get(productId);
    if (!productAllocations?.length) {
      throw new ApiError(
        400,
        "INVALID_FULFILLMENT_SPLIT",
        `A fulfillment allocation is required for product ${productId}`,
      );
    }

    const totalFulfilled = productAllocations.reduce(
      (total, allocation) => total + allocation.qtyFulfilled,
      0,
    );
    if (totalFulfilled > orderedQty) {
      throw new ApiError(
        409,
        "FULFILLMENT_OVER_ALLOCATION",
        `Allocated quantity for product ${productId} exceeds the ordered quantity`,
        { productId, orderedQty, requestedQty: totalFulfilled },
      );
    }

    const backordered = orderedQty - totalFulfilled;
    productAllocations.forEach((allocation, index) => {
      records.push({
        ...allocation,
        qtyBackordered: index === productAllocations.length - 1 ? backordered : 0,
      });
    });
  }

  return records;
}

function buildBackorderCheck(quotationId, fulfillmentSplits, stockLevels) {
  const backordersByProduct = new Map();
  for (const split of fulfillmentSplits) {
    if (split.qtyBackordered > 0) {
      backordersByProduct.set(
        split.productId,
        (backordersByProduct.get(split.productId) || 0) + split.qtyBackordered,
      );
    }
  }

  const outstandingBackorders = [...backordersByProduct].map(
    ([productId, qtyBackordered]) => ({ productId, qtyBackordered }),
  );
  if (!outstandingBackorders.length) {
    return {
      canConsolidate: false,
      fullyCoverable: false,
      outstandingBackorders: [],
      suggestedAllocations: [],
    };
  }

  const suggestedAllocations = proposeFulfillmentSplits(
    {
      id: quotationId,
      lines: outstandingBackorders.map(({ productId, qtyBackordered }) => ({
        productId,
        qty: qtyBackordered,
      })),
    },
    stockLevels,
  );
  const qtyAvailableNow = suggestedAllocations.reduce(
    (total, allocation) => total + allocation.qtyFulfilled,
    0,
  );
  const qtyStillBackordered = suggestedAllocations.reduce(
    (total, allocation) => total + allocation.qtyBackordered,
    0,
  );

  return {
    canConsolidate: qtyAvailableNow > 0,
    fullyCoverable: qtyStillBackordered === 0,
    outstandingBackorders,
    suggestedAllocations,
  };
}

module.exports = { buildFulfillmentRecords, buildBackorderCheck };

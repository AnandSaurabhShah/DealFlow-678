import apiClient from './client'

async function list(path) {
  const { data } = await apiClient.get(path)
  return data.data
}

async function create(path, body) {
  const { data } = await apiClient.post(path, body)
  return data.data
}

export const configApi = {
  listProducts: () => list('/api/products'),
  createProduct: body => create('/api/products', body),
  listPriceLists: () => list('/api/pricelists'),
  createPriceList: body => create('/api/pricelists', body),
  listWarehouses: () => list('/api/warehouses'),
  createWarehouse: body => create('/api/warehouses', body),
  listDiscountTiers: () => list('/api/discount-tiers'),
  createDiscountTier: body => create('/api/discount-tiers', body),
}

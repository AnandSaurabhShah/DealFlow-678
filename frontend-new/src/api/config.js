import apiClient from './client'

async function list(path, params) {
  const { data } = await apiClient.get(path, { params })
  return { items: data.data, pagination: data.pagination }
}

async function create(path, body) {
  const { data } = await apiClient.post(path, body)
  return data.data
}

export const configApi = {
  listProducts: params => list('/api/products', params),
  createProduct: body => create('/api/products', body),
  listPriceLists: params => list('/api/pricelists', params),
  createPriceList: body => create('/api/pricelists', body),
  listWarehouses: params => list('/api/warehouses', params),
  createWarehouse: body => create('/api/warehouses', body),
  listDiscountTiers: params => list('/api/discount-tiers', params),
  createDiscountTier: body => create('/api/discount-tiers', body),
}

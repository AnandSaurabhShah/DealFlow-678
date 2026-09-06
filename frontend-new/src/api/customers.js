import apiClient from './client'

export const customerApi = {
  async list(params) {
    const { data } = await apiClient.get('/api/customers', { params })
    return { items: data.data, pagination: data.pagination }
  },
}

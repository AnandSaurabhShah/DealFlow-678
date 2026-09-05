import apiClient from './client'

export const quotationApi = {
  async list(params) {
    const { data } = await apiClient.get('/api/quotations', { params })
    return { items: data.data, pagination: data.pagination }
  },
  async get(id) {
    const { data } = await apiClient.get(`/api/quotations/${id}`)
    return data.data
  },
  async create(body) {
    const { data } = await apiClient.post('/api/quotations', body)
    return data.data
  },
  async replaceLines(id, lines) {
    const { data } = await apiClient.put(`/api/quotations/${id}`, { lines })
    return data.data
  },
  async confirm(id) {
    const { data } = await apiClient.post(`/api/quotations/${id}/confirm`)
    return data.data
  },
  async pending(params) {
    const { data } = await apiClient.get('/api/quotations/pending', { params })
    return { items: data.data, pagination: data.pagination }
  },
  async history(id) {
    const { data } = await apiClient.get(`/api/quotations/${id}/history`)
    return data.data
  },
  async approve(id) {
    const { data } = await apiClient.post(`/api/quotations/${id}/approve`)
    return data.data
  },
  async reject(id, reason) {
    const { data } = await apiClient.post(`/api/quotations/${id}/reject`, { reason })
    return data.data
  },
  async returnForRevision(id, reason) {
    const { data } = await apiClient.post(`/api/quotations/${id}/return`, { reason })
    return data.data
  },
  async suggestFulfillment(id) {
    const { data } = await apiClient.get(`/api/quotations/${id}/fulfillment/suggest`)
    return data.data
  },
  async confirmFulfillment(id, allocations) {
    const { data } = await apiClient.post(`/api/quotations/${id}/fulfillment/confirm`, allocations)
    return data.data
  },
  async checkFulfillmentBackorder(id) {
    const { data } = await apiClient.get(`/api/quotations/${id}/fulfillment/backorder-check`)
    return data.data
  },
  async sendToCustomer(id, { customerId, customerEmail } = {}) {
    const body = customerId ? { customerId } : customerEmail ? { customerEmail } : {}
    const { data } = await apiClient.post(`/api/quotations/${id}/send-to-customer`, body)
    return { quotation: data.data, emailDelivery: data.emailDelivery }
  },
  async negotiationThread(id) {
    const { data } = await apiClient.get(`/api/quotations/${id}/comments`)
    return data.data
  },
  async addNegotiationComment(id, body) {
    const { data } = await apiClient.post(`/api/quotations/${id}/comments`, body)
    return data.data
  },
}

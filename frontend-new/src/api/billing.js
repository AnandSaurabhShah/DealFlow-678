import apiClient from './client'

export const billingApi = {
  async get(quotationId) {
    const { data } = await apiClient.get(`/api/quotations/${quotationId}/billing`)
    return data.data
  },
  async generate(quotationId) {
    const { data } = await apiClient.post(`/api/quotations/${quotationId}/billing/generate`)
    return data.data
  },
  async updateQuantity(quotationId, lineId, qty) {
    const { data } = await apiClient.put(
      `/api/quotations/${quotationId}/lines/${lineId}/quantity`,
      { qty },
    )
    return data.data
  },
  async cancel(quotationId, lineId) {
    const { data } = await apiClient.post(`/api/quotations/${quotationId}/lines/${lineId}/cancel`)
    return data.data
  },
  async payInvoice(invoiceId) {
    const { data } = await apiClient.post(`/api/invoices/${invoiceId}/pay`)
    return data.data
  },
}

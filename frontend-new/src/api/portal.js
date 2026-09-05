import portalClient from './portalClient'

export const customerAuthApi = {
  async login(body) {
    const { data } = await portalClient.post('/api/customer-auth/login', body)
    return data
  },
  async signup(body) {
    const { data } = await portalClient.post('/api/customer-auth/signup', body)
    return data
  },
}

export const portalApi = {
  async getQuotation(id) {
    const { data } = await portalClient.get(`/api/portal/quotations/${id}`)
    return data.data
  },
  async addComment(id, body) {
    const { data } = await portalClient.post(`/api/portal/quotations/${id}/comments`, body)
    return data.data
  },
  async updateDiscount(id, lineId, discountPercent) {
    const { data } = await portalClient.put(`/api/portal/quotations/${id}/lines/${lineId}/discount`, { discountPercent })
    return data.data
  },
  async confirm(id) {
    const { data } = await portalClient.post(`/api/portal/quotations/${id}/confirm`)
    return data.data
  },
}

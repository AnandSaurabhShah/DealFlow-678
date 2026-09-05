import apiClient from './client'

export const quotationApi = {
  async list() {
    const { data } = await apiClient.get('/api/quotations')
    return data.data
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
  async pending() {
    const { data } = await apiClient.get('/api/quotations/pending')
    return data.data
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
}

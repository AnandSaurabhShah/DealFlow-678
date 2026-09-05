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
}

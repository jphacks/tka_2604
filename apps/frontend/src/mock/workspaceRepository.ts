import type { WorkspaceRepository } from '../shared/repositories/types'
import { delay } from './delay'
import { mockWorkspaceStore as store } from './workspaceStore'

export const mockWorkspaceRepository: WorkspaceRepository = {
  async getSession() {
    await delay(0)
    return store.getSession()
  },
  async signIn(email) {
    await delay(400)
    return store.signIn(email)
  },
  async signOut() {
    await delay(0)
    store.signOut()
  },
  async listEvents(signal) {
    await delay(150, signal)
    return store.listEvents()
  },
  async createEvent(draft) {
    await delay(250)
    return store.createEvent(draft)
  },
  async updateDetails(id, patch) {
    await delay(0)
    return store.updateDetails(id, patch)
  },
  async deleteEvent(id) {
    await delay(0)
    store.deleteEvent(id)
  },
  async getRegistration(id, signal) {
    await delay(150, signal)
    return store.getRegistration(id)
  },
  async updateForm(id, settings) {
    await delay(250)
    store.updateForm(id, settings)
  },
  async addPerformance(id, draft) {
    await delay(0)
    return store.addPerformance(id, draft)
  },
  async submitPerformance(id, draft) {
    await delay(350)
    return store.submitPerformance(id, draft)
  },
  async updatePerformance(id, performanceId, draft) {
    await delay(0)
    store.updatePerformance(id, performanceId, draft)
  },
  async deletePerformance(id, performanceId) {
    await delay(0)
    store.deletePerformance(id, performanceId)
  },
  rememberEvent(event) {
    store.rememberEvent(event)
  },
}

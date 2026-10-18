export const dataSource =
  import.meta.env.VITE_DATA_SOURCE === 'mock' ? 'mock' : 'api'

export function unavailable(): Promise<never> {
  return Promise.reject(new Error('この操作のAPI接続は準備中です。'))
}

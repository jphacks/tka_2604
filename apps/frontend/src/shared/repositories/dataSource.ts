export const dataSource =
  import.meta.env.VITE_DATA_SOURCE === 'api' ? 'api' : 'mock'

export function unavailable(): Promise<never> {
  return Promise.reject(new Error('この操作のAPI接続は準備中です。'))
}

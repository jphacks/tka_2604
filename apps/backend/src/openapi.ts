import { swaggerUI } from '@hono/swagger-ui'

export { default as openApiDocument } from '../docs/api/openapi.json'

export const apiDocs = swaggerUI({
  url: '/api/openapi.json',
  version: '5.33.3',
  title: 'Setly API ドキュメント',
  validatorUrl: '',
})

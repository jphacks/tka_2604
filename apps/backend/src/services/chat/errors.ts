export type AIChatErrorCode =
  | 'ai_chat_invalid_input'
  | 'ai_chat_invalid_output'
  | 'ai_chat_missing_api_key'
  | 'ai_chat_invalid_timeout'
  | 'ai_chat_provider_error'
  | 'ai_chat_timeout'
  | 'ai_chat_refused'
  | 'ai_chat_incomplete_response'
  | 'ai_chat_invalid_provider_response'

export class AIChatError extends Error {
  readonly code: AIChatErrorCode

  constructor(code: AIChatErrorCode) {
    super(code)
    this.name = 'AIChatError'
    this.code = code
  }
}

export class ChatMessageError extends Error {
  readonly code = 'chat_message_conflict'

  constructor() {
    super('chat_message_conflict')
    this.name = 'ChatMessageError'
  }
}

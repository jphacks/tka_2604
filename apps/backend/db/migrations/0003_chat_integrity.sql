CREATE TRIGGER bands_request_state_insert
BEFORE INSERT ON bands
WHEN NOT ((NEW.request_text IS NULL AND NEW.request_status IS NULL) OR
    (NEW.request_text IS NOT NULL AND length(trim(NEW.request_text)) > 0
      AND NEW.request_status IS NOT NULL
      AND NEW.request_status IN ('pending', 'needs_confirmation', 'converted', 'failed')))
BEGIN
  SELECT RAISE(ABORT, 'invalid_request_state');
END;
--> statement-breakpoint
CREATE TRIGGER constraints_source_same_event_insert
BEFORE INSERT ON constraints
WHEN NEW.source_band_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM bands WHERE band_id = NEW.source_band_id AND event_id = NEW.event_id
)
BEGIN
  SELECT RAISE(ABORT, 'cross_event_constraint_source');
END;
--> statement-breakpoint
CREATE TRIGGER chat_messages_valid_reply_insert
BEFORE INSERT ON chat_messages
WHEN NEW.reply_to_message_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM chat_messages
  WHERE message_id = NEW.reply_to_message_id AND event_id = NEW.event_id
    AND role = 'user' AND seq < NEW.seq
)
BEGIN
  SELECT RAISE(ABORT, 'invalid_chat_reply');
END;
--> statement-breakpoint
CREATE TRIGGER bands_request_state_update
BEFORE UPDATE ON bands
WHEN NOT ((NEW.request_text IS NULL AND NEW.request_status IS NULL) OR
    (NEW.request_text IS NOT NULL AND length(trim(NEW.request_text)) > 0
      AND NEW.request_status IS NOT NULL
      AND NEW.request_status IN ('pending', 'needs_confirmation', 'converted', 'failed')))
BEGIN
  SELECT RAISE(ABORT, 'invalid_request_state');
END;
--> statement-breakpoint
CREATE TRIGGER constraints_source_same_event_update
BEFORE UPDATE ON constraints
WHEN NEW.source_band_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM bands WHERE band_id = NEW.source_band_id AND event_id = NEW.event_id
)
BEGIN
  SELECT RAISE(ABORT, 'cross_event_constraint_source');
END;
--> statement-breakpoint
CREATE TRIGGER chat_messages_valid_reply_update
BEFORE UPDATE ON chat_messages
WHEN NEW.reply_to_message_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM chat_messages
  WHERE message_id = NEW.reply_to_message_id AND event_id = NEW.event_id
    AND role = 'user' AND seq < NEW.seq
)
BEGIN
  SELECT RAISE(ABORT, 'invalid_chat_reply');
END;
--> statement-breakpoint
CREATE TRIGGER chat_messages_immutable_context
BEFORE UPDATE OF event_id, seq, role, reply_to_message_id ON chat_messages
WHEN NEW.event_id IS NOT OLD.event_id OR NEW.seq IS NOT OLD.seq
  OR NEW.role IS NOT OLD.role OR NEW.reply_to_message_id IS NOT OLD.reply_to_message_id
BEGIN
  SELECT RAISE(ABORT, 'chat_context_is_immutable');
END;

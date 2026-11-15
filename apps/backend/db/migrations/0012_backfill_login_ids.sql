-- Preserve existing logins, including users provisioned by the management command.
UPDATE users SET login_id = user_id WHERE is_registered = 1 AND login_id IS NULL;
--> statement-breakpoint
CREATE TRIGGER users_default_login_id AFTER INSERT ON users
WHEN NEW.is_registered = 1 AND NEW.login_id IS NULL
BEGIN
  UPDATE users SET login_id = NEW.user_id WHERE user_id = NEW.user_id;
END;

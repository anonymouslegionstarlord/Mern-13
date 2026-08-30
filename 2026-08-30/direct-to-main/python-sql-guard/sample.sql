SELECT * FROM users;
UPDATE subscriptions SET status = 'expired';
DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;
INSERT INTO audit_log VALUES (1, 'manual');
SELECT id, name FROM teams;


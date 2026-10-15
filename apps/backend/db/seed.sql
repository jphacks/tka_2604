-- Local-only fixtures. The placeholder hash cannot be used for authentication.
INSERT INTO users (user_id, password_hash)
VALUES ('demo-owner', 'not-a-valid-password-hash') ON CONFLICT DO NOTHING;
INSERT INTO events (event_id, created_user_id, title)
VALUES ('demo-event', 'demo-owner', 'デモライブ') ON CONFLICT DO NOTHING;
INSERT INTO parts (part_id, event_id, sort_order, comment) VALUES
('demo-part-1', 'demo-event', 0, '前半'),
('demo-part-2', 'demo-event', 1, NULL) ON CONFLICT DO NOTHING;
INSERT INTO bands (band_id, event_id, band_name) VALUES
('demo-band-a', 'demo-event', 'バンドA'),
('demo-band-b', 'demo-event', 'バンドB'),
('demo-band-c', 'demo-event', '未配置バンド') ON CONFLICT DO NOTHING;
INSERT INTO members (member_id, event_id, member_name) VALUES
('demo-member-1', 'demo-event', '同名の出演者'),
('demo-member-2', 'demo-event', '同名の出演者') ON CONFLICT DO NOTHING;
INSERT INTO band_members (band_id, member_id) VALUES
('demo-band-a', 'demo-member-1'),
('demo-band-b', 'demo-member-1'),
('demo-band-b', 'demo-member-2') ON CONFLICT DO NOTHING;
INSERT INTO band_order (band_id, part_id, "order") VALUES
('demo-band-a', 'demo-part-1', 0),
('demo-band-b', 'demo-part-1', 1) ON CONFLICT DO NOTHING;
INSERT INTO constraints (constraint_id, event_id, constraint_json) VALUES (
'demo-constraint', 'demo-event',
'{"schema_version":"1.0.0","constraint_id":"demo-constraint","event_id":"demo-event","type":"at_position","hardness":"hard","priority":null,"enabled":true,"targets":{"band_id":"demo-band-a"},"params":{"position":0}}'
) ON CONFLICT DO NOTHING;

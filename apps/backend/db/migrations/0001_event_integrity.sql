CREATE TRIGGER band_members_same_event_insert
BEFORE INSERT ON band_members
WHEN (SELECT event_id FROM bands WHERE band_id = NEW.band_id)
  IS NOT (SELECT event_id FROM members WHERE member_id = NEW.member_id)
BEGIN
  SELECT RAISE(ABORT, 'cross_event_reference');
END;
--> statement-breakpoint
CREATE TRIGGER band_members_same_event_update
BEFORE UPDATE ON band_members
WHEN (SELECT event_id FROM bands WHERE band_id = NEW.band_id)
  IS NOT (SELECT event_id FROM members WHERE member_id = NEW.member_id)
BEGIN
  SELECT RAISE(ABORT, 'cross_event_reference');
END;
--> statement-breakpoint
CREATE TRIGGER band_order_same_event_insert
BEFORE INSERT ON band_order
WHEN (SELECT event_id FROM bands WHERE band_id = NEW.band_id)
  IS NOT (SELECT event_id FROM parts WHERE part_id = NEW.part_id)
BEGIN
  SELECT RAISE(ABORT, 'cross_event_reference');
END;
--> statement-breakpoint
CREATE TRIGGER band_order_same_event_update
BEFORE UPDATE ON band_order
WHEN (SELECT event_id FROM bands WHERE band_id = NEW.band_id)
  IS NOT (SELECT event_id FROM parts WHERE part_id = NEW.part_id)
BEGIN
  SELECT RAISE(ABORT, 'cross_event_reference');
END;
--> statement-breakpoint
CREATE TRIGGER bands_immutable_event
BEFORE UPDATE OF event_id ON bands
WHEN NEW.event_id <> OLD.event_id
BEGIN
  SELECT RAISE(ABORT, 'event_id_is_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER members_immutable_event
BEFORE UPDATE OF event_id ON members
WHEN NEW.event_id <> OLD.event_id
BEGIN
  SELECT RAISE(ABORT, 'event_id_is_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER parts_immutable_event
BEFORE UPDATE OF event_id ON parts
WHEN NEW.event_id <> OLD.event_id
BEGIN
  SELECT RAISE(ABORT, 'event_id_is_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER parts_keep_last
BEFORE DELETE ON parts
WHEN (SELECT count(*) FROM parts WHERE event_id = OLD.event_id) <= 1
BEGIN
  SELECT RAISE(ABORT, 'last_part_cannot_be_deleted');
END;
--> statement-breakpoint
CREATE TRIGGER parts_keep_referenced
BEFORE DELETE ON parts
WHEN EXISTS (
  SELECT 1 FROM constraints AS c,
    json_each(json_extract(c.constraint_json, '$.params.part_ids')) AS reference
  WHERE c.event_id = OLD.event_id AND reference.value = OLD.sort_order
)
BEGIN
  SELECT RAISE(ABORT, 'part_is_referenced_by_constraint');
END;

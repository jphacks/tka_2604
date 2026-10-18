-- Custom SQL migration file, put your code below! --
-- Preserve the legacy visible size once. Later saves and solver results never derive counts.
UPDATE `parts` SET `band_count` = max(4, coalesce((SELECT max(`order`) + 1 FROM `band_order` WHERE `band_order`.`part_id` = `parts`.`part_id`), 0));
--> statement-breakpoint
CREATE TRIGGER parts_band_count_insert BEFORE INSERT ON parts
WHEN typeof(NEW.band_count) <> 'integer' OR NEW.band_count < 1
BEGIN SELECT RAISE(ABORT, 'invalid_part_band_count'); END;
--> statement-breakpoint
CREATE TRIGGER parts_band_count_update BEFORE UPDATE OF band_count ON parts
WHEN typeof(NEW.band_count) <> 'integer' OR NEW.band_count < 1
BEGIN SELECT RAISE(ABORT, 'invalid_part_band_count'); END;

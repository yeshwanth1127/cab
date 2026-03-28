ALTER TABLE bookings ADD COLUMN service_type TEXT DEFAULT 'local' CHECK (service_type IN ('local', 'airport', 'outstation'));

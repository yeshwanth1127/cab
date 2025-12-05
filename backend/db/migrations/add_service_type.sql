-- Migration: Add service_type to bookings table
ALTER TABLE bookings ADD COLUMN service_type TEXT DEFAULT 'local' CHECK (service_type IN ('local', 'airport', 'outstation'));

-- Migration: Add service_type multipliers to cab_types (optional, for future use)
-- For now, we'll handle service type pricing in the fare calculation logic





const db = require('../database');

async function addCancellationReasonColumn() {
  try {
    await db.runAsync('ALTER TABLE bookings ADD COLUMN cancellation_reason TEXT');
    console.log('✓ Added cancellation_reason column to bookings table');
  } catch (error) {
    if (error.message && error.message.includes('duplicate column')) {
      console.log('✓ cancellation_reason column already exists');
    } else {
      console.error('Error adding cancellation_reason column:', error.message);
      throw error;
    }
  }
}

(async () => {
  try {
    await addCancellationReasonColumn();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
})();

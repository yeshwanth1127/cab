# Booking Cancellation Feature - Implementation Guide

## Overview
Added a booking cancellation feature to the Admin Dashboard with a reason modal and email notification system via n8n webhooks.

## Changes Made

### Backend Changes

#### 1. Database Migration (`backend/db/migrations/add-cancellation-reason.js`)
- Added `cancellation_reason` column to the `bookings` table
- Automatically runs during `npm run migrate` or server startup

#### 2. Updated Services (`backend/services/n8nWebhooks.js`)
- Added new `triggerBookingCancellation()` function
- Triggers the booking cancellation webhook via n8n

#### 3. Updated Admin Routes (`backend/routes/admin.js`)
- Modified `PUT /api/admin/bookings/:id` endpoint to:
  - Accept `cancellation_reason` parameter from request body
  - Store the cancellation reason in the database
  - Trigger the cancellation webhook when booking is cancelled
  - Send email to customer with cancellation reason via n8n

### Frontend Changes

#### 1. Admin Dashboard State (`frontend/src/pages/AdminDashboard.js`)
- Added `cancelBookingModal` state to track modal visibility
- Added `cancelReason` state to store the reason input
- Added `cancelSubmitting` state for loading indicator

#### 2. New Handler Functions
- `handleCancelBookingClick(booking)`: Opens the cancellation modal
- `handleSubmitCancellation()`: Submits the cancellation with reason
- Updated `handleUpdateBookingStatus()` to accept optional `cancellationReason` parameter

#### 3. Modal UI
- Added a modal form with:
  - Booking ID display
  - Customer name
  - Route information (From → To)
  - Textarea for entering cancellation reason (required field)
  - Cancel and Confirm Cancel buttons

#### 4. Updated Cancel Buttons
- Changed all cancel buttons to open the modal instead of directly cancelling
- Buttons now call `handleCancelBookingClick()` instead of `handleUpdateBookingStatus(..., 'cancelled')`

### n8n Workflow Updates (`n8n-driver-info-workflow.json`)

#### New Webhook: Booking Cancellation
- **Webhook Path**: `/booking-cancellation`
- **Environment Variable**: `N8N_WEBHOOK_BOOKING_CANCELLATION_URL`

#### New Email Node: Send Cancellation Email to Customer
- Sends email to customer when booking is cancelled
- Includes:
  - Booking ID
  - Customer name
  - Cancellation reason
  - Original booking details (pickup, drop)
  - Professional email template

## Environment Variables

Add to your `.env` file:

```env
# n8n Booking Cancellation Webhook
N8N_WEBHOOK_BOOKING_CANCELLATION_URL=http://your-n8n-instance/webhook/booking-cancellation
```

Or use the base URL:
```env
N8N_WEBHOOK_BASE_URL=http://your-n8n-instance/webhook
```

## Workflow in n8n

The updated workflow now includes:

1. **Driver Info Webhook** (existing)
   - Sends driver assignment emails

2. **Booking Cancellation Webhook** (new)
   - Receives cancellation request with reason
   - Extracts customer email and details
   - Sends professional cancellation email with reason

## How It Works

### User Flow (Admin)
1. Admin clicks "Cancel" button on a booking in Enquiries tab
2. Cancellation modal appears with booking details
3. Admin enters reason for cancellation
4. Admin clicks "Confirm Cancel"
5. Reason is sent to backend with cancellation request

### Backend Flow
1. Backend receives cancellation with reason
2. Updates booking status to "cancelled"
3. Stores cancellation reason in database
4. Triggers n8n webhook with booking and reason details

### n8n Flow
1. n8n webhook receives cancellation event
2. Extracts customer information
3. Sends email to customer with:
   - Professional cancellation notice
   - Reason for cancellation
   - Original booking details

### Customer Experience
1. Admin cancels booking with reason
2. Customer receives email immediately
3. Email includes cancellation reason
4. Customer can contact support if needed

## Database Schema

```sql
ALTER TABLE bookings ADD COLUMN cancellation_reason TEXT;
```

The column stores the reason provided by the admin when cancelling a booking.

## API

### PUT /api/admin/bookings/:id
**New Request Body Field**:
```json
{
  "booking_status": "cancelled",
  "cancellation_reason": "Customer requested cancellation due to schedule change"
}
```

**Response**: Updated booking object including cancellation_reason

## Testing

### Local Testing
```bash
# Run migration
npm run migrate

# Start admin dashboard
npm run dev

# Click cancel on any booking in Enquiries tab
# Should see modal with reason input
# Should see cancellation email sent (check n8n logs)
```

### Test Payload (for n8n testing)
```json
{
  "bookingId": "NC123",
  "customerEmail": "customer@example.com",
  "customerName": "Test Customer",
  "cancellationReason": "Test cancellation reason",
  "pickup": "Downtown",
  "drop": "Airport"
}
```

## Troubleshooting

### Webhook Not Triggering
- Check `N8N_WEBHOOK_BOOKING_CANCELLATION_URL` or `N8N_WEBHOOK_BASE_URL` is set in .env
- Check n8n instance is running and accessible
- Check firewall/network connectivity

### Email Not Sending
- Verify n8n email node has SMTP credentials configured
- Check email provider settings (Gmail requires app-specific password)
- Check spam folder for test emails
- Review n8n logs for errors

### Modal Not Appearing
- Check browser console for JavaScript errors
- Verify CSS classes exist (admin-btn-danger, admin-modal-*, etc.)
- Clear browser cache

## Performance Notes
- Cancellation reason is stored in database for audit trail
- Email send is asynchronous via n8n (fire-and-forget)
- Modal is lightweight with minimal database impact

## Security Considerations
- Only admins with proper permissions can cancel bookings
- Cancellation reason is stored but cannot be edited (audit trail)
- Email uses n8n's existing SMTP security

## Future Enhancements
- Predefined cancellation reasons dropdown
- Auto-refund integration
- Cancellation analytics dashboard
- Customer notification preferences
- Multiple language templates

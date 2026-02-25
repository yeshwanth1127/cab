# Environment Configuration for Booking Cancellation Feature

## Required Environment Variables

Add these to your `.env` file to enable the booking cancellation feature with n8n email notifications.

### Option 1: Using Base URL (Recommended)

```env
# n8n Base Webhook URL
N8N_WEBHOOK_BASE_URL=https://your-n8n-instance.com/webhook

# Optional: Specific webhook URLs (if different from base)
# If not set, these will use: N8N_WEBHOOK_BASE_URL + /path
# N8N_WEBHOOK_BOOKING_CANCELLATION_URL=https://your-n8n-instance.com/webhook/booking-cancellation
```

### Option 2: Using Full URLs

```env
N8N_WEBHOOK_BOOKING_CANCELLATION_URL=https://your-n8n-instance.com/webhook/booking-cancellation
```

## Email Configuration (for n8n SMTP)

These should already be configured for the existing email features, but ensure they are set:

```env
# SMTP Email Configuration (used by n8n for sending emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
EMAIL_FROM_NAME=Namma Cabs
```

## n8n Integration Setup

### In n8n:

1. **Create/Activate Webhook**:
   - Path: `booking-cancellation`
   - Method: POST
   - Response: Immediately (onReceived)

2. **Configure SMTP Email Node**:
   - Provider: Gmail or your SMTP provider
   - Username: EMAIL_USER from .env
   - Password: EMAIL_PASSWORD from .env
   - From Email: `info@namma-cabs.com` or your domain

3. **Import Workflow**:
   - Use the updated `n8n-driver-info-workflow.json` which includes both:
     - Driver Info webhook (existing)
     - Booking Cancellation webhook (new)

## Testing the Configuration

### 1. Verify Webhook URL is Accessible

```bash
curl -X POST https://your-n8n-instance.com/webhook/booking-cancellation \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "NC123",
    "customerEmail": "test@example.com",
    "customerName": "Test User",
    "cancellationReason": "Test reason",
    "pickup": "Location A",
    "drop": "Location B"
  }'
```

### 2. Test in Admin Dashboard

1. Go to Admin Dashboard → Enquiries tab
2. Click "Cancel" on any pending or confirmed booking
3. A modal should appear asking for cancellation reason
4. Enter a reason and click "Confirm Cancel"
5. Check n8n execution logs to verify webhook was called
6. Check customer email for cancellation notification

### 3. Check Server Logs

```bash
# If using fire-and-forget webhooks, check for these logs:
grep -i "n8n" logs/app.log | grep -i "booking"
```

## Troubleshooting

### Issue: Modal doesn't appear
- **Solution**: Clear browser cache, check browser console for errors

### Issue: Webhook not triggered
- **Solution**: Verify `N8N_WEBHOOK_BOOKING_CANCELLATION_URL` is set correctly
- **Solution**: Check n8n instance is running: `curl https://your-n8n-instance.com/ping`

### Issue: Email not received
- **Solution**: Check n8n execution logs for email sending errors
- **Solution**: Verify SMTP credentials are correct
- **Solution**: Check Gmail spam folder if using Gmail
- **Solution**: If using Gmail, ensure "Less secure app access" is enabled or use App Password

### Issue: Database migration error
- **Solution**: Manually run: `npm run migrate` from backend directory
- **Solution**: Check database permissions and connectivity

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `N8N_WEBHOOK_BASE_URL` | No | - | Base URL for all n8n webhooks |
| `N8N_WEBHOOK_BOOKING_CANCELLATION_URL` | No | `${N8N_WEBHOOK_BASE_URL}/booking-cancellation` | Specific URL for booking cancellation webhook |
| `SMTP_HOST` | Yes | `smtp.gmail.com` | SMTP server hostname |
| `SMTP_PORT` | Yes | `587` | SMTP server port |
| `SMTP_SECURE` | No | `false` | Use TLS/SSL (true for port 465) |
| `EMAIL_USER` | Yes | - | Email address for sending |
| `EMAIL_PASSWORD` | Yes | - | Email password or app-specific password |
| `EMAIL_FROM_NAME` | No | `Namma Cabs` | Display name for emails |

## Production Deployment Checklist

- [ ] Environment variables configured in production `.env`
- [ ] n8n instance deployed and accessible
- [ ] SMTP credentials configured in n8n
- [ ] Booking cancellation workflow imported in n8n
- [ ] Database migration run: `npm run migrate`
- [ ] Frontend and backend rebuilt/restarted
- [ ] Test cancellation on non-production booking first
- [ ] Verify email received by test customer
- [ ] Monitor logs for any webhook errors

## Example .env Configuration

```env
# n8n Configuration
N8N_WEBHOOK_BASE_URL=https://n8n.yourcompany.com/webhook
DEBUG_N8N=false

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_USER=nammacabs@yourcompany.com
EMAIL_PASSWORD=your-app-specific-password
EMAIL_FROM_NAME=Namma Cabs

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cab_booking

# Server
PORT=5000
NODE_ENV=production
JWT_SECRET=your-secret-key
```

## Support

For issues or questions:
1. Check logs in n8n execution history
2. Verify webhook is receiving requests
3. Confirm email settings in n8n SMTP node
4. Review admin dashboard console for errors

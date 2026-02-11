# n8n Driver Info Workflow

**Important:** Re-import this workflow if you have an older version. The flow now includes an "Extract Body" node so the webhook payload is read correctly, and IF nodes route to the correct email based on `sendDriverInfoToCustomer` vs `sendTripToDriver`. The Webhook node uses `responseMode: "onReceived"` (respond immediately); if you see **"The response mode 'immediately' is not valid!"** from n8n, re-import this workflow—newer n8n expects the value `onReceived` instead of `immediately`.

## 500 error but no execution in n8n?

If the backend gets `Webhook returned 500` but **no execution appears in n8n**, the workflow is likely **not activated**:

1. Open the workflow in n8n
2. Click the **Activate** toggle (top right) so it turns **ON** (green)
3. The production webhook (`/webhook/driver-info`) is only registered when the workflow is active

Without activation, n8n has no handler for the URL and may return 500.

**URL must match n8n exactly:** In n8n, open the Webhook node and copy the **Production URL** shown there. Set `N8N_WEBHOOK_DRIVER_INFO_URL` in `.env` to that exact value. Some n8n setups (or versions) use a different path (e.g. with workflow id); if no execution appears, the backend might be calling a different URL than the one this workflow registered.

**Test URL (development):** For quick testing without activating, use the Test URL. In n8n: click the Webhook node → copy the **Test URL** (e.g. `https://n8n.exora.solutions/webhook-test/driver-info`). Set in `.env`:

```
N8N_WEBHOOK_DRIVER_INFO_URL=https://n8n.exora.solutions/webhook-test/driver-info
```

Then in n8n click **Listen for test event** and trigger from the backend within 120 seconds.

---

This workflow receives driver/cab assignment data from the Namma Cabs backend and sends:
1. **Driver details to customer** – when a driver is assigned (customer gets driver name, phone, cab number)
2. **Trip details to driver** – when admin clicks "Send email to driver" (driver gets pickup/drop info)

## Backend payload (driver-info webhook)

The backend sends this JSON to `POST /webhook/driver-info`:

| Field | Description |
|-------|-------------|
| `bookingId` | e.g. "NC123" |
| `customerEmail` | Customer email (from `passenger_email`) for driver info email |
| `driverEmail` | Driver email for trip details email |
| `driverName` | Driver name |
| `driverPhone` | Driver phone |
| `cabNumber` | Vehicle number |
| `pickup` | From location |
| `drop` | To location |
| `pickupTime` | Travel date/time |
| `sendDriverInfoToCustomer` | `true` when assigning driver, `false` when sending to driver only |
| `sendTripToDriver` | `true` when admin clicks "Send email to driver", `false` otherwise |

## Backend configuration

Ensure `.env` has:

```
N8N_WEBHOOK_BASE_URL=https://n8n.exora.solutions/webhook
```

Or set the full URL:

```
N8N_WEBHOOK_DRIVER_INFO_URL=https://n8n.exora.solutions/webhook/driver-info
```

## Import the workflow

1. In n8n: **Workflows** → **Import from File** → select `n8n-driver-info-workflow.json`
2. Re-attach your SMTP credentials to the email nodes
3. **Activate the workflow** – toggle the switch in the top-right to ON. Production webhooks only work when the workflow is active.

## Flow

1. **Webhook** receives the POST from the backend
2. **Extract Body** – n8n places the JSON body in `item.json.body`; this node flattens it to the root so `$json.customerEmail`, `$json.sendDriverInfoToCustomer` etc. work
3. **IF Send to Customer** – runs only when `sendDriverInfoToCustomer` is true and `customerEmail` is not empty
4. **IF Send to Driver** – runs only when `sendTripToDriver` is true and `driverEmail` is not empty

## If n8n returns 500 (checklist)

1. **Workflow must be active**  
   The production URL `/webhook/driver-info` is only registered when the workflow is **Activated**. In n8n: open the workflow → toggle **Activate** (top right) to **ON**. If it’s off, n8n often returns 500 and no execution is created.

2. **Check n8n Executions**  
   In n8n go to **Executions**. When you click “Send email to driver”, do you see a new execution for this workflow?
   - **No execution** → URL not registered; ensure the workflow is active and the path is exactly `driver-info`.
   - **Execution with error** → Open it and read the failed node’s error (e.g. SMTP credentials, missing field).

3. **Response body in backend logs**  
   When the webhook returns 500, the backend now logs n8n’s response body. Look for a line like `[n8n] Response body: ...` in your backend logs; it often contains n8n’s error message.

4. **No execution but workflow is active and URL “correct”**
   - The URL n8n **registers** is the **Production URL** shown in the Webhook node. In n8n: open the workflow → double‑click the Webhook node → copy the **Production URL** and set `N8N_WEBHOOK_DRIVER_INFO_URL` in `.env` to that exact value. Restart the backend.
   - Run from the server: `cd cab/backend && node scripts/test-driver-info-webhook.js` to see the HTTP status and response body. Or call `POST /api/debug/n8n-driver-info-test` on your backend to see what n8n returns.
   - If n8n is behind a reverse proxy, set `WEBHOOK_URL` in n8n’s env to the public base (e.g. `https://n8n.exora.solutions/`) so the registered URL matches what the backend calls.

5. **Other common causes**
   - **Extract Body** – Re-import the workflow if you have an old version (handles empty/malformed input).
   - **Email node** – Fails when `toEmail` is empty or SMTP credentials are missing/invalid. In n8n open each email node → **Settings** (gear) → **On Error** → **Continue** so the workflow doesn’t fail when the email node errors. Re-attach SMTP credentials to both email nodes.

## Conditional logic

The workflow uses IF nodes so that:
- **Send Driver Info to Customer** runs only when `sendDriverInfoToCustomer` is true and `customerEmail` is not empty
- **Send Trip Info to Driver** runs only when `sendTripToDriver` is true and `driverEmail` is not empty

This avoids sending to an empty customer email when only notifying the driver.

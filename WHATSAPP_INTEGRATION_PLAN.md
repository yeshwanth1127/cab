# WhatsApp Integration Plan – Namma Cabs

## 1. What you already have

Your app is already set up to use **Meta WhatsApp Cloud API**:

| Feature | Status | Where |
|--------|--------|--------|
| Booking confirmation to customer (optional) | Ready | `whatsappService.sendBookingConfirmation()` |
| Driver info to customer when admin assigns | Ready | `sendDriverInfoToCustomerWhatsApp()` |
| Admin: “WhatsApp (customer)” button | Ready | Admin Dashboard → Confirmed / Driver Assigned |
| Admin: “Chat driver” (opens wa.me) | Ready | Admin Dashboard |
| Env vars | Set | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` in `.env` |

So the **backend and frontend integration** is done. What’s left is making sure **Meta (Business Suite / Developer)** is configured correctly and that your app has the right permissions and tokens.

---

## 2. Meta side – what you need

From Meta you need:

1. **WhatsApp Business Account** linked to “Namma Cabs Business portfolio”.
2. **A WhatsApp “app”** (Meta App) that uses WhatsApp Business API – this may show under **Business Integrations** even if “Connected apps” is empty.
3. **Phone Number ID** → you already use this as `WHATSAPP_PHONE_NUMBER_ID` (e.g. `9620267516`).
4. **Access token** (System User or App token) → you already use this as `WHATSAPP_ACCESS_TOKEN`.

The screenshot shows **“No Connected apps added”** under **Connected apps**. The warning says some integrations may be under **Business Integrations**. So we’ll use both **WhatsApp accounts** and **Business Integrations** in the steps below.

---

## 3. Step-by-step: Meta web (from your screenshot)

### Step 1: Stay in Settings

You are in **Settings** for **Namma Cabs Business portfolio**. Keep this as the starting point.

### Step 2: Open “WhatsApp accounts” (sidebar)

- In the **left sidebar**, under **“Accounts”**, click **“WhatsApp accounts”**.
- Here you can:
  - See which WhatsApp Business Account(s) are linked to this business.
  - Open the **phone number** used for sending (the one whose **Phone Number ID** you use in `.env`).
  - Confirm the number is **verified** and **approved** for the Cloud API.

If you don’t see a WhatsApp account, you’ll need to add/link one (Meta will guide you through adding a number or migrating from another product).

### Step 3: Where the “app” lives – Business Integrations

- The yellow banner says: *“You may have shared business information … with apps that aren’t listed here. To view them, go to **Business Integrations**.”*
- So:
  - **Connected apps** (current page) = one list of connected apps.
  - **Business Integrations** = another place where your WhatsApp‑enabled app may appear.

**How to open Business Integrations:**

- In the same **left sidebar**, look for **“Business Integrations”** or **“Integrations”** (sometimes under a different section, e.g. “Settings” or “Security”).
- Or: click your **business name / profile** (top) and see if there’s a link like **“Business settings”** or **“Integrations”**.
- Or: go to **Meta for Developers**: [developers.facebook.com](https://developers.facebook.com) → **My Apps** → select the app that uses WhatsApp → there you’ll see **WhatsApp** in the product list and **Business Integrations**-related settings.

In **Business Integrations** you can see which **Meta App** has access to your business and WhatsApp. That app is what generates the **Phone Number ID** and **Access Token** you use in `.env`.

### Step 4: Get / confirm Phone Number ID and Token (Developers)

- Go to **[developers.facebook.com](https://developers.facebook.com)** → **My Apps**.
- Open the **app** that is connected to your WhatsApp Business Account (might be named after Namma Cabs or “WhatsApp”).
- In the app:
  - Go to **WhatsApp** → **API Setup** (or **Getting started**).
  - You’ll see:
    - **Phone number** and next to it the **Phone number ID** (numeric). This is `WHATSAPP_PHONE_NUMBER_ID` in your `.env`.
    - **Temporary** or **permanent access token**. For production use a **permanent** token (System User or App token). This is `WHATSAPP_ACCESS_TOKEN` in your `.env`.

So:

- **Meta Business Suite (your screenshot)** → use for: **WhatsApp accounts**, **Connected apps**, **Business Integrations** (to see what’s connected).
- **Meta for Developers** → use for: **Phone Number ID**, **Access Token**, and API configuration.

---

## 4. Checklist

- [ ] In **Meta Business Suite** → **Accounts** → **WhatsApp accounts**: confirm a WhatsApp Business Account and the sending number are linked.
- [ ] In **Business Integrations** (from Business Suite or Developers): confirm the app that sends WhatsApp is connected to “Namma Cabs Business portfolio”.
- [ ] In **developers.facebook.com** → Your App → **WhatsApp** → **API Setup**: confirm **Phone Number ID** matches `WHATSAPP_PHONE_NUMBER_ID` in `.env`.
- [ ] Use a **permanent** access token for production; put it in `WHATSAPP_ACCESS_TOKEN` in `.env`.
- [ ] (Optional) In **Connected apps**, if you want your own “Namma Cabs” app to appear there, add it via the **“Add”** / **“Connect app”** flow; the actual sending still uses the same Phone Number ID and token from Developers.

---

## 5. Optional: enable/disable behaviours via .env

Already supported in code; you only need to set in `cab/backend/.env` if you want to change defaults:

- `SEND_WHATSAPP_ON_BOOKING=1` – send WhatsApp when a booking is confirmed (set to `0` to disable).
- `SEND_WHATSAPP_DRIVER_INFO=1` – send driver details to customer when admin assigns (set to `0` to disable).
- `DEBUG_WHATSAPP=1` – log API requests/responses for debugging.

---

## 6. Summary

- **App side:** Integration is implemented; `.env` already has `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN`.
- **Meta side:** Use **WhatsApp accounts** in Business Suite to verify the number and account; use **Business Integrations** to see which app is connected; use **Meta for Developers** to get/confirm **Phone Number ID** and **Access Token** and to create a permanent token for production.

Once the Meta app and Business Account are correctly linked and the token is in `.env`, your existing “Send WhatsApp” and driver-info flows will work without further code changes.

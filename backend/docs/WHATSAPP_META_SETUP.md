# WhatsApp via Meta (Facebook) Developers – Setup

This app can send WhatsApp messages using **Meta’s WhatsApp Cloud API** (developers.facebook.com). Booking confirmations and driver-assignment messages use this when configured.

## 1. Create a Meta App and get WhatsApp access

1. Go to [developers.facebook.com](https://developers.facebook.com) and sign in.
2. **My Apps** → **Create App** → choose **Business** (or **Other** if Business isn’t available).
3. After the app is created, open it and in the left sidebar go to **WhatsApp** → **Get started** (or **API Setup**).
4. Follow the steps to add **WhatsApp Business** to your app. You can use the **Meta-hosted** test number for development.

## 2. Get the credentials

- **Phone number ID**  
  In **WhatsApp** → **API Setup** you’ll see a **Phone number ID**. Copy it (numeric ID).  
  This goes in `WHATSAPP_PHONE_NUMBER_ID`.

- **Access token** — see **Section 2a** (testing) and **Section 2b** (production) below.

### 2a. Temporary access token (for testing)

**Where:** In your Meta app dashboard.

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → open your app.
2. In the left sidebar click **WhatsApp** → **API Setup** (or **Get started**).
3. On the **API Setup** page you’ll see:
   - **Phone number ID** (use for `WHATSAPP_PHONE_NUMBER_ID`).
   - **Temporary access token** — a “Copy” button or token string. Use this as `WHATSAPP_ACCESS_TOKEN`.

This token usually expires in **24 hours**. For production, use a permanent token (Section 2b).

### 2b. Permanent access token (for production)

**Where:** Meta Business Suite → Business Settings → System Users.

You need a **Meta Business account** (business.facebook.com) linked to your app.

1. Go to [business.facebook.com](https://business.facebook.com) and open **Business Settings** (gear icon).
2. In the left menu go to **Users** → **System users**.
3. Click **Add** and create a system user (e.g. name: “WhatsApp API”). Role: **Admin**. Save.
4. Open the new system user → **Assign assets** (or **Add assets**).
   - Under **Apps**, add your WhatsApp app and set **Full control**.
   - If your WhatsApp Business Account appears, assign it with full access. Save.
5. **Generate the token:** In the same system user page, click **Generate new token**.
   - **App:** choose your app (the one with WhatsApp).
   - **Permissions:** select:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
   - **Expiration:** choose **Never** (or “No expiration”) so the token does not expire.
   - Click **Generate token**, then **Copy** the token and store it securely.

Use this copied value as `WHATSAPP_ACCESS_TOKEN` in your `.env`. You will not see it again after closing the dialog.

**References:**  
- [Meta – Access tokens (WhatsApp)](https://developers.facebook.com/docs/whatsapp/access-tokens)  
- [Meta – System users](https://developers.facebook.com/docs/whatsapp/embedded-signup/manage-accounts/system-users/)

## 3. Configure your backend

In your backend `.env` (same folder as your Node app), set:

```env
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=your_access_token_here
```

Optional:

```env
WHATSAPP_API_VERSION=v21.0
DEBUG_WHATSAPP=1
```

The app uses **only** the official **WhatsApp Business API** (Meta Cloud API) when these variables are set.

## 4. Message templates (production / 24h rule)

- **Within 24 hours** of a user’s last message to you: you can send **free-form text** (what this app does).
- **After 24 hours**: you must use **pre-approved message templates** and request approval in Meta Business Manager. For “booking confirmed” and “driver assigned” you’d create templates and then call the Cloud API with `type: "template"` instead of `type: "text"`. The current code uses text messages; for template messages you’d extend `whatsappService.js` to use the [template message](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/template-messages) format.

## 5. Test

1. Restart your backend after changing `.env`.
2. Create a test booking that includes a valid `passenger_phone`.
3. Check server logs for `WhatsApp message sent to ...` or any API error.
4. With `DEBUG_WHATSAPP=1`, full API responses are logged.

## Reference

- [WhatsApp Cloud API – Send messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages)
- [Text messages](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages)
- [Phone number ID](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers)

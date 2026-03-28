# Frontend Routes & Admin Dashboard — Analysis Report

**Date:** 2025-02-01  
**Scope:** `cab/frontend/` (routing, pages, admin flow)

---

## Executive summary

- **Homepage:** `HomePage.js` exists but is **not mounted**; `/` redirects to `/corporate` instead.
- **Admin dashboard:** **No admin dashboard page exists** in the frontend. After admin login, users are sent to `/admin`, which redirects back to `/admin/login` (login loop).
- **ProtectedRoute:** Implemented and imported in `App.js` but **never used** in any route.

---

## 1. Route configuration (`src/App.js`)

| Path           | Current behavior                          | Issue |
|----------------|--------------------------------------------|--------|
| `/`            | `<Navigate to="/corporate" replace />`     | HomePage is never shown; "Home" in nav goes to corporate. |
| `/admin`       | `<Navigate to="/admin/login" replace />`   | Logged-in admins hitting `/admin` are sent back to login. |
| `/admin/login` | `<AdminLogin />`                           | OK. |
| `*`            | `<Navigate to="/" replace />`              | OK (after `/` is fixed, this will send to homepage). |

**Missing:**

- A route that renders `HomePage` (e.g. at `/` or `/home`).
- A protected route for the admin area (e.g. `/admin` or `/admin/dashboard`) that uses `ProtectedRoute` and renders an admin dashboard component.

---

## 2. HomePage

- **File:** `src/pages/HomePage.js`
- **Content:** Hero, “namma cabs” branding, CTAs for Book a cab, Corporate, Events, About, Contact, Check booking.
- **Problem:** `HomePage` is **not imported** in `App.js` and **not used** in any `<Route>`.
- **Effect:** Navbar “Home” (`href: '/'`) and logo link go to `/` → immediate redirect to `/corporate` → users never see the real homepage.

---

## 3. Admin flow

**Existing pieces:**

- **Backend:**  
  - `POST /api/auth/login` (used by AdminLogin).  
  - `POST /api/admin/bookings` (admin create booking).  
  - Auth middleware and roles (`admin`, `manager`).
- **Frontend:**  
  - `AdminLogin.js` / `AdminLogin.css`.  
  - `ProtectedRoute.js` (checks `user` and `user.role === 'admin' || user.role === 'manager'`).  
  - Navbar: admins get link to `/admin`; others get “Admin” → `/admin/login`.

**Missing:**

- **Admin dashboard page:** There is **no** `AdminDashboard.js` (or similar) under `src/pages/`.
- **Route for dashboard:** No route like:
  - `<Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />`
- **Post-login redirect:** `AdminLogin.js` does `navigate('/admin')`. Because `/admin` only redirects to `/admin/login`, the user ends up back on the login page (or in a redirect loop).

**Conclusion:** Backend is ready for admin usage; frontend is missing the dashboard page and a protected route that uses `ProtectedRoute`.

---

## 4. ProtectedRoute

- **File:** `src/components/ProtectedRoute.js`
- **Behavior:** If not loading and (`!user` or role not `admin`/`manager`), redirects to `/admin/login`; otherwise renders `children`.
- **Usage:** Imported in `App.js` but **never used** as a wrapper in any `<Route>`.

---

## 5. File inventory (relevant)

**Pages:**

- `HomePage.js` — exists, unused in routing.
- `AdminLogin.js` — used at `/admin/login`.
- No `AdminDashboard.js` or any `*Dashboard*` in `src/`.

**Routing / auth:**

- `App.js` — defines all routes; missing HomePage and protected admin route.
- `ProtectedRoute.js` — implemented but unused in routes.

---

## 6. Recommended changes

1. **Homepage**
   - Mount `HomePage` at `/`.
   - Change current `/` redirect: either make `/` render `HomePage` and use a separate path (e.g. `/corporate`) for the corporate redirect, or use `/home` for HomePage and keep `/` → `/corporate` only if that is the desired default.

2. **Admin dashboard**
   - Add a new page component, e.g. `src/pages/AdminDashboard.js`, as the main admin UI (e.g. links to create booking, future list of bookings, etc.).
   - Add a protected route in `App.js`, e.g.  
     `<Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />`  
     so that `/admin` shows the dashboard when logged in and redirects to `/admin/login` when not.
   - Keep `/admin` → “redirect to login” only when the user is not authenticated (handled by `ProtectedRoute`); remove the unconditional `<Navigate to="/admin/login" />` for `/admin` and replace it with the protected dashboard route.

3. **AdminLogin**
   - Keep `navigate('/admin')` after successful login so the user lands on the new admin dashboard.

4. **Optional**
   - If you want `/` to always be “corporate” and HomePage elsewhere: add `<Route path="/home" element={<HomePage />} />` and point navbar “Home” to `/home`.

---

## 7. Summary table

| Item              | Status   | Action |
|-------------------|----------|--------|
| HomePage in routes| Missing  | Add route for HomePage (e.g. at `/` or `/home`). |
| Admin dashboard   | Missing  | Create `AdminDashboard.js` and protect `/admin` with `ProtectedRoute`. |
| ProtectedRoute    | Unused   | Use in `/admin` route. |
| Post-login redirect | Broken | Fix by adding dashboard route at `/admin`. |

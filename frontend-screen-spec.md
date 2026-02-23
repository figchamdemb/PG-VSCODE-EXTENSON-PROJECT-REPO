# Frontend Screen + Flow Specification (Web App)

This document enumerates **every screen**, its **fields**, **buttons**, and **popups/alerts**, plus **navigation flows** so a React Native CLI build can match the existing web app behavior exactly.

---

## Global / Shared UI

### Page Header (used on many screens)
- **Back button** (left arrow): navigates to the `backUrl` passed into the header component; defaults to `/` if not specified.
- **Title text**: screen title.

### Bottom Navigation (Home, Recent Transactions, Transaction Reports)
- **Gift** (route: `/paygam-wallet/charity`)
- **Link** (route: `/exchange-rate`)
- **Home** (route: `/`)
- **Receipt** (route: `/recent-transactions`)
- **Chart** (route: `/transaction-reports`)

---

## 1) Home Screen (`/`)
**Components**: Header, Advert Banner, Function Grid, Bottom Nav.

### Header
- **Avatar (profile image)**: tap to go to **Profile** (`/profile`).
- **View** badge (appears on avatar hover): also navigates to **Profile**.
- **Scan** icon button (no action defined in code; currently just a button).
- **More menu** button → dropdown with **Sign out** (logs out and navigates to `/auth/login`).

### Advert Banner
- **Balance visibility toggle** (eye icon): show/hide balance.
- **Copy wallet number** (copy icon): copies wallet number to clipboard.
  - **Inline feedback**: “Copied to clipboard!” appears for ~2 seconds.
- **Quick actions**:
  - **Add Money** button (no route wired).
  - **Send Money** button (no route wired).

### Function Grid (6 tiles)
- **Send Money** → `/remittance`
- **Mobile Recharge** → `/mobile-recharge`
- **Cash Power** → `/cash-power`
- **PayGam Wallet** → `/paygam-wallet`
- **Recipients** → `/recipients`
- **Exchange Rate** → `/exchange-rate`

---

## 2) Auth Screens

### 2.1 Login (`/auth/login`)
**Tabs**: **Email** and **Phone**.

**Email Tab**
- **Email** input (with mail icon).
- **Password** input with **show/hide** eye button.
- **Forgot password?** link → `/auth/forgot-password`.
- **Sign In** button.

**Phone Tab**
- **Phone Number** input (with phone icon).
- **Send OTP** button → navigates to `/auth/verify-otp`.

**Social Login Buttons**
- **Google** button.
- **Facebook** button.
- **Apple** button.

**Footer Links**
- **Sign up** → `/auth/register`.
- **Use Dummy Login** → `/auth/dummy-login` (test link; not implemented elsewhere).

### 2.2 Register (`/auth/register`)
- **Full Name** input.
- **Email** input.
- **Address** input (optional).
- **Password** input with **show/hide** eye button.
- **Confirm Password** input.
- **Terms checkbox** (required to enable Create Account).
  - Links: **Terms of Service** (`/terms`), **Privacy Policy** (`/privacy`).
- **Create Account** button → navigates to `/auth/verify-otp` after register.

**Social Signup Buttons**
- **Google**, **Facebook**, **Apple**.

**Footer Link**
- **Sign in** → `/auth/login`.

### 2.3 Forgot Password (`/auth/forgot-password`)
- **Back** arrow → `/auth/login`.
- **Reset method tabs**: **Email** or **Phone Number**.
- **Email** input (if Email tab).
- **Phone Number** input (if Phone tab).
- **Send Reset Link / Send OTP** button.

**Submitted State**
- Success icon.
- Message shows target email or phone.
- **Back to Login** link.

### 2.4 Verify OTP (`/auth/verify-otp`)
- **Back** arrow → `/auth/login`.
- **6 OTP fields** (auto-advance, supports paste 6 digits).
- **Verify** button.
- **Resend OTP** button (appears when 60s timer finishes).

---

## 3) Remittance Flow

### 3.1 Remittance Form (`/remittance`)
- **Sending Country** dropdown.
- **Receiving Country** dropdown.
- **Receiving Method** dropdown (cash pickup/bank deposit/mobile wallet).
- **Recipient** dropdown + **View All Recipients** link → `/recipients`.
- **Add Recipient** button → `/remittance/add-recipient`.
- **Reason for sending** dropdown with **Add** button for custom reason.
  - **Custom Reason** input (if Add clicked) with **Cancel** + **Add Reason** buttons.
- **Source of funding** dropdown with **Add** button for custom source.
  - **Custom Funding** input with **Cancel** + **Add Source** buttons.
- **Amount** input + currency badge (USD).
- **Fees & Charges** summary block.
- **Recipient Amount** input + currency badge (GMD).
- **Next** button → `/payment/preview?flow=external`.

### 3.2 Add Recipient (`/remittance/add-recipient`)
- **Transaction Type** select (Bank Transfer / Cash Pickup / Mobile Wallet).
- **Select Country** select.
- **Email Address** input (optional).
- **Phone Number** input with **country code** select.
- **First Name** input.
- **Last Name** input.
- **City** input.
- **Post Code** input.
- **Full Address of Recipient** textarea.
- **Save & Continue** button → returns to `/remittance`.

---

## 4) Recipients

### 4.1 Recipients List (`/recipients`)
**Header**
- Avatar (static) + welcome text.
- **Two ghost icon buttons** (no routes wired).

**Main**
- **Back** arrow → `/`.
- **Add New Recipient** banner button → `/remittance/add-recipient`.
- **Recipient cards**:
  - **Send Again** button → `/remittance?recipient=<id>`.
  - **More (⋮)** menu:
    - **Edit** → `/recipients/edit/<id>`.
    - **Delete** (removes from list).

**Bottom Nav**
- Custom icon-only nav bar; **Home** icon links to `/`. Other icons have no route wired.

### 4.2 Edit Recipient (`/recipients/edit/:id`)
- **Back** arrow → `/recipients`.
- **Transaction Type** select.
- **Full Name** input.
- **Email Address** input (optional).
- **Phone Number** input.
- **Country** select.
- **City** input.
- **Address** input.
- **Cancel** button → `/recipients`.
- **Save Changes** button → `/recipients`.

---

## 5) Mobile Recharge (`/mobile-recharge`)
**Multi-step flow (1 → 4)**

### Step 1: Top-Up Details
- **Select Country** dropdown.
- **Select Provider** grid (tap to select provider).
- **Processing Method** radio (only shown if provider supports both API/manual).
- **Recipient Phone Number** input.
- **Amount** input + **Sending Currency** dropdown.
- **Converted Amount / Mobile Credit / Exchange Rate** summary (shown after entering amount).
- **Payment Method** radio: Internal Balance or Credit/Debit Card.
- **Continue** button.

### Step 2: Confirm
- Summary card (provider, phone, amount, converted amount, credit, processing method, payment method, fee, total).
- **Back** button.
- **Proceed to Payment** button.

### Step 3: Payment Method
**Select Payment Method**
- **Pay with Stripe** button.
- **Bank Transfer / Wire** button.

**Stripe Payment Form**
- **Card Number**, **Expiry Date**, **CVV**, **Cardholder Name** inputs.
- **Back** button.
- **Pay Now** button.

**Bank Transfer**
- Bank account list (tap to select).
- **Back** button.
- **Confirm Transfer** button.
- **Popup/Alert**: If confirm without selecting a bank → `alert("Please select a bank account")`.

### Step 4: Result
- Success/failure icon + message.
- Transaction summary (on success).
- **Done** button → `/`.

---

## 6) Cash Power / Electricity (`/cash-power`)
**Multi-step flow (1 → 4)** — same pattern as Mobile Recharge with electricity-specific fields.

### Step 1: Payment Details
- **Select Country** dropdown.
- **Select Electricity Provider** grid.
- **Processing Method** radio (if provider supports both API/manual).
- **Receiver Name** input.
- **Receiver Phone Number** input.
- **Meter Number** input.
- **Amount** input + **Sending Currency** dropdown.
- **Converted Amount / Estimated Units / Exchange Rate** summary.
- **Payment Method** radio: Internal Balance or Credit/Debit Card.
- **Continue** button.

### Step 2: Confirm
- Summary card (provider, receiver details, meter, amount, converted amount, estimated units, processing, payment method, fee, total).
- **Back** button.
- **Proceed to Payment** button.

### Step 3: Payment Method
- **Pay with Stripe** or **Bank Transfer / Wire** buttons.
- **Stripe**: card number, expiry, CVV, cardholder name; **Back** + **Pay Now**.
- **Bank Transfer**: bank list, **Back**, **Confirm Transfer**.
- **Popup/Alert**: If confirm without bank → `alert("Please select a bank account")`.

### Step 4: Result
- Success/failure message + transaction details.
- **Done** button → `/`.

---

## 7) PayGam Wallet Transfers

### 7.1 Select Transfer Type (`/paygam-wallet/select-type`)
- **Send to Users** card → `/paygam-wallet`.
- **Donate to Charity** card → `/paygam-wallet/charity`.

### 7.2 Wallet Transfer Form (`/paygam-wallet`)
- **Partner Sender details** (static summary card).
- **Paygam receiver Number** input + **Check Number** button.
- **User Found** success banner appears after check.

**When user is found:**
- **Select Source of Fund** dropdown.
- **Select Purpose** dropdown.
- **Exchange Rate** display.
- **Sending Amount** input + currency dropdown.
- **Fees & Charges** text.
- **Recipient will received** (read-only) input + receiving currency dropdown.
- **Next** button → `/payment/preview?flow=wallet`.

### 7.3 Wallet Transfer Confirm (`/paygam-wallet/confirm`)
- **Back** arrow → `/paygam-wallet`.
- **Paygam receiver Number** read-only + **Search user** button (no action wired).
- **Recipient details summary** card.
- **Confirm and Continue to Payment Screen** button → `/` (placeholder submit).

---

## 8) Charity Donation

### 8.1 Charity List & Search (`/paygam-wallet/charity`)
**List View**
- **Search bar** for charity name/keyword.
- **Direct receiver number input** + **Search** button (opens donation flow for custom charity if number provided).
- **Category carousel** with left/right buttons and slide indicators.
- **Popular Charities carousel** with left/right buttons and indicators.
- **Charity list** buttons (tap charity to open donation details).

### 8.2 Donation Details (within same route)
- **Back** button returns to list.
- **Charity info** (logo, name, description).
- **Receiver Number** input + **Search** button.
- **You Send** amount input + currency select.
- **They Receive** calculated amount + currency select.
- **Exchange Rate** display.
- **Preset amount buttons** (5, 10, 20, 50, 100, Other).
- **Donate Now** button (disabled until receiver number is entered).
- **About Charity** info card.

### 8.3 Confirm Donation (within same route)
- **Back** button (returns to details).
- Summary card with donation amount, receiver gets, processing fee, total.
- **Message to charity** textarea (max 100 words) with word counter.
- **Confirm Donation** button → `/payment/preview?flow=charity`.
- **Change amount** link.

### 8.4 All Charities (`/paygam-wallet/charity/organizations`)
- **Back** arrow → `/paygam-wallet/charity`.
- **Search bar**.
- **Charity list** buttons (tapping opens `/paygam-wallet/charity?organization=<id>`).

---

## 9) Exchange Rate

### 9.1 Exchange Rate Main (`/exchange-rate`)
**Tabs**: Converter, Favorites, History.

**Converter Tab**
- **From currency** dropdown.
- **Amount** input.
- **Swap** button.
- **To currency** dropdown.
- **Converted Amount** read-only input.
- **Exchange Rate card** + **Star** button to add to favorites.
- **Historical Rates** mini bar chart.
- **Detailed Chart** button → `/exchange-rate/chart`.
- **Currency Info** button → `/exchange-rate/info`.

**Favorites Tab**
- Favorite exchange rate cards (tap to switch to converter with selected pair).

**History Tab**
- Recent rate cards (tap to switch to converter with selected pair).

### 9.2 Detailed Chart (`/exchange-rate/chart`)
- **Back** arrow → `/exchange-rate`.
- **From** currency select.
- **To** currency select.
- **Time Range** buttons: 1W, 1M, 3M, 6M, 1Y, 5Y.
- **Line chart** with data points.
- **Stats cards**: Highest, Lowest, Average, Volatility.

### 9.3 Currency Info (`/exchange-rate/info`)
- **Back** arrow → `/exchange-rate`.
- **Search** input.
- **Tabs**: All, Strong, Volatile.
- **Currency cards** with description, central bank, strength, volatility, optional notes.
- **More Information** button opens Wikipedia in a new tab.

---

## 10) Recent Transactions (`/recent-transactions`)
- **Back** arrow → `/`.
- **Search** input.
- **Type filter** dropdown (All, Send, Mobile, Power, Wallet).
- **Recent Transactions list** (tap an item to open transaction details).
- **View All** button → `/transaction-reports`.
- **Transaction Summary** cards (Total Sent, Completed, Pending, Failed).
- **Bottom Nav** (Receipt tab active).

---

## 11) Transaction Details (`/transaction-details/:id`)
- **Back** arrow → `/recent-transactions`.
- **Status badge**, **amount**, **date/time**.
- **Transaction Details** card (type, reference, amount, fee, total).
- **Recipient Details** card (name, phone, received amount, exchange rate when available).
- **Sender Details** card (name, phone, notes).
- **Share** button → **Popup/Alert**: `alert("Receipt shared!")`.
- **Download** button → **Popup/Alert**: `alert("Receipt downloaded!")`.

---

## 12) Transaction Reports (`/transaction-reports`)
- **Back** arrow → `/`.
- **Filters card**:
  - **Search** input.
  - **Date Range** select.
  - **Type** select.
- **Filter** button (UI only; no action wired).
- **Export Report** button (exports CSV file download).
- **Status tabs**: All, Completed, Pending, Failed.
- **Transactions list**.
- **Bottom Nav** (Chart tab active).

---

## 13) Payment Flow (Shared)

### 13.1 Preview (`/payment/preview?flow=<external|wallet|charity>`)
**Step A: Preview**
- Summary cards (Recipient Info, Amount Info).
- **Confirm & Go to Payment** button.

**Step B: Payment Method**
- **Pay with Stripe** button → `/payment/methods?flow=<flow>`.
- **Bank Transfer / Wire** button → bank list.
- **Back** button → preview.

**Step C: Bank List**
- Bank account cards (tap to select).
- **Back** button.
- **Confirm** button (disabled until a bank is selected) → `/payment/success?flow=<flow>`.

### 13.2 Select Payment Method (`/payment/methods`)
- List of methods (Visa, Mastercard, Amex, PayPal, Apple Pay, Google Pay).
- **Continue** button (disabled until a method selected) → `/payment/details`.

### 13.3 Payment Details (`/payment/details`)
- **Card Number**, **Cardholder Name**, **Expiry Month**, **Expiry Year**, **CVV**.
- **Pay Now** button → `/payment/processing`.

### 13.4 Processing (`/payment/processing`)
- Loading spinner and message.
- Auto-navigates to `/payment/success` after ~3 seconds.

### 13.5 Payment Success (`/payment/success`)
- Receipt details with reference, amounts, sender/recipient info, etc.
- If **charity flow**, shows donation message from local storage.
- **Share Receipt** button → **Popup/Alert**: `alert("Receipt shared!")`.
- **Done** button → `/`.

---

## 14) Profile (`/profile`)

### Tabs
- **Profile**, **KYC**, **Accounts**, **Activity**, **Alerts**.

### Profile Tab
- **Profile image** (tap overlay to upload new image).
- **Full Name**, **Email**, **Phone**, **Address** inputs.
- **Change Password** section:
  - **Send Email Link** button → **Popup/Alert**: `Password reset link sent to <email>`.
  - **Send OTP to Phone** button → **Popup/Alert**: `OTP sent to <phone>`.
- **Save Changes** button.
- **Sign Out** button → logs out and navigates to `/auth/login`.

### KYC Tab
- KYC status banner (Pending/Verified/etc.).
- Placeholder message for document upload.

### Accounts / Activity / Alerts Tabs
- Placeholder text only.

---

## 15) Miscellaneous Alerts / Popups Summary
- **Profile** → “Password reset link sent to …” (alert).
- **Profile** → “OTP sent to …” (alert).
- **Mobile Recharge** → “Please select a bank account” (alert).
- **Cash Power** → “Please select a bank account” (alert).
- **Transaction Details** → “Receipt shared!” and “Receipt downloaded!” (alerts).
- **Payment Success** → “Receipt shared!” (alert).
- **Advert Banner** → “Copied to clipboard!” (inline message).

---

## 16) Key Navigation Flows (High-Level)

1. **Home → Remittance → Payment Preview → Payment Method → Payment Details → Processing → Success → Home**
2. **Home → PayGam Wallet → Payment Preview (wallet flow) → Payment Method → Success**
3. **Home → PayGam Wallet → Charity → Donation → Confirm → Payment Preview (charity flow) → Payment Method → Success**
4. **Home → Mobile Recharge (multi-step) → Result → Home**
5. **Home → Cash Power (multi-step) → Result → Home**
6. **Home → Recent Transactions → Transaction Details**
7. **Home → Transaction Reports → Export CSV**

---

If you need a version of this spec tailored for **React Native screen names** or navigation routes, let me know and I can map each web route to your RN stack names.

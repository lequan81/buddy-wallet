# UX Flow, Logic, and Business Scenarios

This document details the user experience flows, business logic, and case scenarios for the Buddy Wallet API backend.

---

## Table of Contents

1. [Authentication & User Management](#authentication--user-management)
2. [Debt Management](#debt-management)
3. [Bank Account Management](#bank-account-management)
4. [File & Storage Management](#file--storage-management)
5. [Import/Export Data](#importexport-data)
6. [Push Notifications](#push-notifications)
7. [Activity & Audit Logging](#activity--audit-logging)
8. [Public API](#public-api)

---

## Authentication & User Management

### UX Flow Chart

```
┌─────────────┐
│  Register   │
└──────┬──────┘
       │
       ├── Validate phone format
       ├── Validate password complexity
       ├── Check phone uniqueness
       ├── Check email uniqueness (if provided)
       ├── Hash password (Argon2)
       ├── Create user record
       ├── Link existing debts by phone
       ├── Send OTP verification email (if email provided)
       └── Return user data (safe user)

┌─────────────┐
│    Login    │
└──────┬──────┘
       │
       ├── Find user by email OR phone
       ├── Check account lockout status
       ├── Verify password
       ├── Track failed attempts (lock after 5)
       ├── Parse device info (user agent, IP, location)
       ├── Generate access token (JWT)
       ├── Generate refresh token
       ├── Create session record
       └── Return tokens + user data

┌─────────────┐
│  Refresh    │
└──────┬──────┘
       │
       ├── Validate refresh token
       ├── Check session exists & active
       ├── Check refresh token not expired
       ├── Verify user exists & active
       ├── Generate new access token
       ├── Generate new refresh token
       ├── Update session
       └── Return new tokens

┌─────────────┐
│   Logout    │
└──────┬──────┘
       │
       ├── Validate refresh token
       ├── Find session
       ├── Verify session belongs to user
       ├── Revoke session
       └── Return success

┌─────────────┐
│ Verify OTP  │
└──────┬──────┘
       │
       ├── Verify OTP code
       ├── Check OTP not expired
       ├── Check max attempts not exceeded
       ├── Mark email as verified
       └── Return success

┌─────────────┐
│ Resend OTP  │
└──────┬──────┘
       │
       ├── Check user exists
       ├── Check user has email
       ├── Check email not already verified
       ├── Rate limit (3 per hour)
       ├── Generate new OTP
       ├── Send email
       └── Return success

┌───────────────┐
│Change Password│
└──────┬────────┘
       │
       ├── Find user
       ├── Verify current password
       ├── Validate new password complexity
       ├── Check not common password
       ├── Hash new password
       ├── Increment session version (invalidates all sessions)
       ├── Revoke all other sessions
       └── Return success

┌───────────────┐
│Forgot Password│
└──────┬────────┘
       │
       ├── Find user by email
       ├── Verify phone matches (if provided)
       ├── Rate limit (3 per hour)
       ├── Generate OTP
       ├── Send password reset email
       └── Return success (always, to prevent enumeration)

┌──────────────┐
│Reset Password│
└──────┬───────┘
       │
       ├── Find user by email
       ├── Verify OTP as reset token
       ├── Hash new password
       ├── Update password
       ├── Revoke all sessions
       └── Return success
```

### Business Logic Details

#### Registration
- **Phone Validation**: Must be valid Vietnamese phone format (normalized)
- **Password Requirements**:
  - Minimum 8 characters
  - Must contain uppercase, lowercase, number, special character
  - Cannot be a common password (checked against list)
- **Uniqueness Checks**: Phone and email must be unique across all users
- **Debt Linking**: Automatically links existing debts created by phone number before account existed
- **Email Verification**: Optional - if email provided, sends OTP for verification

#### Login
- **Identifier**: Can login with email OR phone number
- **Account Lockout**: After 5 failed attempts, account locked for 15 minutes
- **Password Verification**: Uses Argon2 with timing-safe comparison
- **Session Management**: Creates session with device info, IP, location
- **Token Lifetime**: Access token (15 min), Refresh token (30 days)

#### Session Refresh
- **Token Rotation**: New refresh token generated on each refresh
- **Session Validation**: Checks session exists, not expired, user active
- **Device Tracking**: Updates device info on refresh

#### Password Change
- **Current Password**: Must verify current password before allowing change
- **Session Invalidation**: All other sessions revoked when password changes
- **Session Version**: Incremented to invalidate all existing JWTs

#### Password Reset
- **Security**: Always returns success to prevent email enumeration
- **Phone Verification**: Optional phone verification to prevent account takeover
- **Rate Limiting**: 3 attempts per hour per user
- **Token**: Uses OTP as reset token (expires in 15 minutes)

### Case Scenarios

1. **User registers with phone only**
   - Account created without email
   - Email verification skipped
   - Can login with phone + password

2. **User registers with email**
   - OTP sent to email
   - Email marked unverified
   - Cannot enable push notifications until verified
   - Can resend OTP if expired (rate limited)

3. **User forgets password**
   - Requests reset with email
   - Receives OTP via email
   - Uses OTP to reset password
   - All sessions invalidated

4. **Account locked due to failed attempts**
   - User tries login 5+ times
   - Account locked for 15 minutes
   - Must wait or contact support
   - Failed attempts reset on successful login

5. **User changes password**
   - Must provide current password
   - New password validated for complexity
   - All other devices logged out
   - Must re-login on all devices

6. **Session refresh**
   - Access token expired
   - Client uses refresh token
   - New tokens generated
   - Session updated with device info

---

## Debt Management

### UX Flow Chart

```
┌─────────────┐
│ Create Debt │
└──────┬──────┘
       │
       ├── Validate input (amount, description, direction)
       ├── Validate phone numbers (user & counterparty)
       ├── Check user has phone number
       ├── Check pending debt limit (max 10)
       ├── Check for duplicate debts (amount tolerance ±10%)
       ├── Validate via Debt Model (amount > 0, creditor ≠ debtor)
       ├── Create debt record
       ├── Log activity
       ├── Emit DebtCreatedEvent
       ├── Send push notification to counterparty
       └── Return debt details

┌─────────────┐
│  List Debts │
└──────┬──────┘
       │
       ├── Apply filters (status, direction, date range)
       ├── Apply pagination
       ├── Check permissions (own debts or admin)
       ├── Return paginated list
       └── Include summary (total owed, total to receive)

┌─────────────┐
│ Update Debt │
└──────┬──────┘
       │
       ├── Find debt
       ├── Check ownership or admin
       ├── Check status (only pending/disputed editable)
       ├── Update description/amount
       ├── Log activity
       └── Return updated debt

┌─────────────┐
│ Delete Debt │
└──────┬──────┘
       │
       ├── Find debt
       ├── Check ownership or admin
       ├── Soft delete (set deletedAt)
       ├── Log activity
       └── Return success

┌─────────────┐
│Update Status│
└──────┬──────┘
       │
       ├── Find debt
       ├── Check user involved (creditor/debtor) or admin
       ├── Validate transition via Debt Model
       ├── Perform transition
       ├── Persist update
       ├── Log activity
       ├── Emit DebtStatusChangedEvent
       ├── Send notifications to involved parties
       └── Return debt with previous/new status

┌─────────────┐
│Confirm Debt │
└──────┬──────┘
       │
       ├── Find debt
       ├── Check user is counterparty (not creator)
       ├── Mark as confirmed by user
       ├── If both parties confirmed → mark fully confirmed
       ├── Log activity
       ├── Send notification to creator
       └── Return confirmation status

┌─────────────┐
│Suggest Edit │
└──────┬──────┘
       │
       ├── Find debt
       ├── Check user involved (not creator)
       ├── Check debt not finalized (paid/cancelled)
       ├── Provide at least amount or description
       ├── Store suggestion
       ├── Log activity
       ├── Send notification to creator
       └── Return suggestion status

┌─────────────┐
│Respond to   │
│ Suggestion  │
└──────┬──────┘
       │
       ├── Find debt
       ├── Check user is creator
       ├── Check pending suggestion exists
       ├── Accept: Apply suggestion to debt
       ├── Reject: Clear suggestion
       ├── Log activity
       ├── Send notification to suggester
       └── Return response status
```

### Business Logic Details

#### Debt Creation
- **Direction**: LEND (someone owes you) or BORROW (you owe someone)
- **Validation**: Amount must be > 0, creditor and debtor must be different
- **Pending Limit**: Max 10 unconfirmed debts per user
- **Duplicate Detection**: Checks for debts with similar amount (±10%) within last 30 days
- **Auto-Link**: Links counterparty by phone number if they have an account
- **Confirmation**: Requires counterparty confirmation for full validity

#### Debt Status Transitions
- **Valid States**: PENDING, CONFIRMED, DISPUTED, PAID, CANCELLED
- **Transitions**: Validated by Debt Model (canTransitionTo)
- **Permissions**: Only creditor/debtor can change status (except admin)
- **Notifications**: Both parties notified on status change

#### Debt Confirmation
- **Two-Party Confirmation**: Both creditor and debtor must confirm
- **Creator Restriction**: Creator cannot confirm their own debt
- **Finalization**: Once confirmed, debt is considered valid

#### Edit Suggestions
- **Dispute Resolution**: Counterparty can suggest corrections
- **Creator Approval**: Creator must accept/reject suggestions
- **Scope**: Can suggest amount, description, due date changes
- **Finalized Debts**: Cannot suggest edits on paid/cancelled debts

### Case Scenarios

1. **User creates debt for someone without account**
   - Debt created with phone number
   - Counterparty not linked
   - When counterparty registers, debt auto-linked
   - Counterparty receives notification

2. **Duplicate debt warning**
   - User tries to create debt similar to existing
   - System warns about potential duplicate
   - User can confirm to proceed anyway
   - Duplicate check: amount ±10%, same parties, 30 days

3. **Debt confirmation flow**
   - Creator creates debt (PENDING)
   - Counterparty receives notification
   - Counterparty confirms (CONFIRMED)
   - Debt now valid and trackable

4. **Dispute resolution**
   - Counterparty disagrees with debt details
   - Suggests edit (amount, description)
   - Creator receives notification
   - Creator accepts → debt updated
   - Creator rejects → suggestion cleared

5. **Debt payment**
   - Debtor marks as PAID
   - Creditor can dispute if not actually paid
   - If disputed → status DISPUTED
   - Can upload payment proof as evidence

6. **Pending debt limit**
   - User has 10 unconfirmed debts
   - Cannot create more until some confirmed
   - Encourages confirmation from counterparties

---

## Bank Account Management

### UX Flow Chart

```
┌─────────────┐
│ List Banks  │
└──────┬──────┘
       │
       ├── Fetch from VietQR API
       ├── Return supported banks
       └── Public endpoint (no auth required)

┌─────────────┐
│ Add Account │
└──────┬──────┘
       │
       ├── Validate bank code (from supported list)
       ├── Validate account number format
       ├── If set as default → unset other defaults
       ├── Create account record
       ├── Log activity
       └── Return account details

┌─────────────┐
│List Accounts│
└──────┬──────┘
       │
       ├── Fetch user's accounts
       ├── Check permissions (own accounts or admin)
       ├── Return accounts list
       └── Mask sensitive info if viewing other user

┌──────────────┐
│Update Account│
└──────┬───────┘
       │
       ├── Find account
       ├── Check ownership
       ├── If setting as default → unset others
       ├── Update account details
       ├── Log activity
       └── Return updated account

┌──────────────┐
│Delete Account│
└──────┬──────┘
       │
       ├── Find account
       ├── Check ownership
       ├── Delete account
       ├── Log activity
       └── Return success

┌─────────────┐
│Generate QR  │
└──────┬──────┘
       │
       ├── Find debt
       ├── Check user involved (creditor/debtor)
       ├── Get creditor's bank accounts
       ├── Use default account or first available
       ├── Generate VietQR URL
       ├── Include amount, debt ID
       └── Return QR URL
```

### Business Logic Details

#### Bank Account Management
- **VietQR Integration**: Uses VietQR API for supported banks list and QR generation
- **Default Account**: Only one account can be default per user
- **Ownership**: Users can only manage their own accounts
- **Privacy**: Admins can view other users' accounts (for support)

#### QR Code Generation
- **Purpose**: Generate payment QR for debt settlement
- **Includes**: Bank info, account number, amount, debt ID
- **Security**: Only involved parties can generate QR for a debt
- **Default Account**: Uses user's default bank account

### Case Scenarios

1. **User adds first bank account**
   - Account automatically set as default
   - No other accounts to unset
   - Ready for QR generation

2. **User adds second account as default**
   - Previous default unset
   - New account set as default
   - QR generation uses new account

3. **Generating payment QR**
   - Creditor generates QR for debtor
   - QR includes debt amount
   - Debtor scans QR to pay
   - Payment marks debt as paid

4. **Admin viewing user accounts**
   - Admin can view any user's accounts
   - Used for support/troubleshooting
   - Account numbers visible to admin

---

## File & Storage Management

### UX Flow Chart

```
┌─────────────┐
│ Upload QR   │
└──────┬──────┘
       │
       ├── Validate file type (image)
       ├── Validate file size (max 5MB)
       ├── Validate image format (magic bytes)
       ├── Process image (resize, compress)
       ├── Convert to WebP
       ├── Upload to S3/storage
       ├── Create file record
       ├── Log activity
       └── Return file URL

┌─────────────┐
│Upload Proof │
└──────┬──────┘
       │
       ├── Find debt
       ├── Check user involved (creditor/debtor)
       ├── Validate file
       ├── Process image
       ├── Upload to storage
       ├── Create file record (type: payment_proof)
       ├── Link to debt
       ├── Notify creditor
       ├── Log activity
       └── Return file details

┌─────────────┐
│ Download    │
└──────┬──────┘
       │
       ├── Find file
       ├── Check ownership or admin
       ├── Check file not deleted
       ├── Fetch from storage
       ├── Set cache headers
       └── Return file data

┌─────────────┐
│List My QRs  │
└──────┬──────┘
       │
       ├── Fetch user's QR codes
       ├── Return list
       └── Include URLs and metadata

┌──────────────┐
│Pending Proofs│
└──────┬───────┘
       │
       ├── Find debt
       ├── Check user is creditor
       ├── Fetch pending proofs for debt
       ├── Return proofs list
       └── Include uploader info

┌─────────────┐
│Approve Proof│
└──────┬──────┘
       │
       ├── Find proof
       ├── Check user is creditor
       ├── Check proof status (pending)
       ├── Mark as approved
       ├── Check if all proofs approved
       ├── If all approved → mark debt as PAID
       ├── Notify uploader
       ├── Log activity
       └── Return approval status

┌─────────────┐
│Reject Proof │
└──────┬──────┘
       │
       ├── Find proof
       ├── Check user is creditor
       ├── Check proof status (pending)
       ├── Mark as rejected
       ├── Store rejection reason
       ├── Notify uploader
       ├── Log activity
       └── Return success

┌─────────────┐
│Delete File  │
└──────┬──────┘
       │
       ├── Find file
       ├── Check ownership
       ├── Delete from storage
       ├── Mark file as deleted
       ├── Log activity
       └── Return success
```

### Business Logic Details

#### File Upload
- **Validation**: File type, size, magic bytes validation
- **Processing**: Resize to max 2048px, compress, convert to WebP
- **Storage**: S3 or local storage
- **Types**: QR codes, payment proofs
- **Rate Limiting**: Upload rate limited per user

#### Payment Proof Workflow
- **Upload**: Debtor or creditor can upload proof
- **Review**: Creditor must approve/reject
- **Completion**: All proofs approved → debt marked PAID
- **Notifications**: Both parties notified at each step

#### File Access
- **Ownership**: Users can only access their own files
- **Admin Access**: Admins can access any file
- **Caching**: Files cached for 1 hour
- **Privacy**: Payment proofs only visible to involved parties

### Case Scenarios

1. **Uploading QR code for debt**
   - User uploads QR screenshot
   - Image processed and compressed
   - Stored as WebP
   - URL returned for display

2. **Payment proof flow**
   - Debtor pays via bank transfer
   - Uploads screenshot as proof
   - Creditor receives notification
   - Creditor reviews and approves
   - Debt marked as PAID

3. **Rejecting payment proof**
   - Creditor reviews proof
   - Proof unclear or incorrect
   - Creditor rejects with reason
   - Debtor notified to upload new proof

4. **Multiple proofs for single debt**
   - Debtor uploads multiple proofs
   - Creditor must approve all
   - Only when all approved → debt PAID
   - Partial approval not sufficient

---

## Import/Export Data

### UX Flow Chart

```
┌─────────────┐
│ Preview File│
└──────┬──────┘
       │
       ├── Validate file (Excel/CSV)
       ├── Parse file
       ├── Extract headers
       ├── Map columns
       ├── Preview first 10 rows
       ├── Return preview data
       └── Return column mapping options

┌─────────────┐
│ Import Debts│
└──────┬──────┘
       │
       ├── Validate file
       ├── Create import job (background)
       ├── Process rows in batches
       ├── Validate each row
       ├── Create debts
       ├── Link users by phone
       ├── Track progress
       ├── Log errors
       └── Return job ID for progress tracking

┌───────────────┐
│ Track Progress│
└──────┬────────┘
       │
       ├── Poll job status
       ├── Return progress percentage
       ├── Return processed count
       ├── Return error count
       └── Support SSE for real-time updates

┌────────────────┐
│ Get Import Logs│
└──────┬─────────┘
       │
       ├── Fetch user's import logs
       ├── Apply pagination
       ├── Return logs with status
       └── Include error details

┌─────────────┐
│ Export Debts│
└──────┬──────┘
       │
       ├── Fetch user's debts
       ├── Generate Excel/CSV
       ├── Format data
       ├── Return file buffer
       └── Set download headers

┌─────────────┐
│Admin Export │
└──────┬──────┘
       │
       ├── Check admin permission
       ├── Fetch all debts
       ├── Generate export
       ├── Return file buffer
       └── Log admin action
```

### Business Logic Details

#### Import Process
- **File Formats**: Excel (.xlsx, .xls) and CSV
- **Background Processing**: Large files processed asynchronously
- **Batch Processing**: Processes in batches to avoid memory issues
- **Error Handling**: Continues on row errors, logs all errors
- **Progress Tracking**: Real-time progress via SSE or polling
- **User Linking**: Links debts to users by phone number

#### Export Process
- **Formats**: Excel (default) or CSV
- **Scope**: User's own debts or all debts (admin)
- **Data**: Includes all debt details
- **Performance**: Streams large exports

### Case Scenarios

1. **Importing debts from Excel**
   - User uploads Excel file
   - System previews data
   - User confirms column mapping
   - Import starts in background
   - User tracks progress via SSE
   - Import completes with summary

2. **Import with errors**
   - Some rows have invalid data
   - System skips invalid rows
   - Logs errors for each row
   - Valid rows still imported
   - User can fix and re-import

3. **Exporting debts**
   - User requests export
   - System generates Excel
   - File downloaded immediately
   - Includes all debt details

4. **Admin bulk export**
   - Admin exports all debts
   - Used for analytics/backup
   - Action logged for audit

---

## Push Notifications

### UX Flow Chart

```
┌─────────────┐
│Get VAPID Key│
└──────┬──────┘
       │
       ├── Return public VAPID key
       └── Public endpoint (no auth)

┌─────────────┐
│ Subscribe   │
└──────┬──────┘
       │
       ├── Validate subscription data
       ├── Store subscription
       ├── Link to user
       ├── Store device info
       └── Return subscription ID

┌─────────────┐
│ Unsubscribe │
└──────┬──────┘
       │
       ├── Find subscription by endpoint
       ├── Check ownership
       ├── Delete subscription
       └── Return success

┌─────────────┐
│ List Subs   │
└──────┬──────┘
       │
       ├── Fetch user's subscriptions
       ├── Return list
       └── Include device info

┌─────────────┐
│ Send Test   │
└──────┬──────┘
       │
       ├── Fetch user's subscriptions
       ├── Send test notification
       ├── Return sent/failed count
       └── Used for testing push setup

┌─────────────┐
│ Broadcast   │
└──────┬──────┘
       │
       ├── Check admin permission
       ├── Fetch all subscriptions
       ├── Send in batches (100 at a time)
       ├── Return sent/failed count
       └── Rate limited
```

### Business Logic Details

#### Subscription Management
- **VAPID**: Uses Web Push with VAPID authentication
- **Device Tracking**: Stores device name, type for targeting
- **Multiple Devices**: User can have multiple subscriptions
- **Expiration**: Handles subscription expiration

#### Sending Notifications
- **Batching**: Sends in chunks of 100 to avoid timeouts
- **Error Handling**: Logs failed sends, continues with rest
- **Rate Limiting**: Broadcast rate limited to prevent spam
- **Payload**: Title, body, icon, URL, tag

### Case Scenarios

1. **User subscribes on desktop**
   - Browser generates subscription
   - Subscription sent to server
   - Stored for user
   - User receives notifications on desktop

2. **User subscribes on mobile**
   - Same flow as desktop
   - Separate subscription stored
   - User receives on both devices

3. **Debt created notification**
   - Creator creates debt
   - System sends notification to debtor
   - Debtor sees notification
   - Can click to view debt

4. **Admin broadcast**
   - Admin sends system announcement
   - Sent to all users
   - Rate limited
   - Used for maintenance notices, etc.

---

## Activity & Audit Logging

### UX Flow Chart

```
┌─────────────┐
│ Log Activity│
└──────┬──────┘
       │
       ├── Create activity record
       ├── Include user, action, resource
       ├── Include changes (before/after)
       ├── Include metadata
       ├── Include IP, user agent, location
       └── Store in database

┌─────────────┐
│ User Logs   │
└──────┬──────┘
       │
       ├── Fetch user's activities
       ├── Apply filters (action, resource, date)
       ├── Apply pagination
       └── Return paginated list

┌─────────────┐
│ All Logs    │
└──────┬──────┘
       │
       ├── Check admin permission
       ├── Fetch all activities
       ├── Apply filters
       ├── Apply pagination
       └── Return paginated list

┌─────────────┐
│Resource Logs│
└──────┬──────┘
       │
       ├── Fetch logs for specific resource
       ├── Include all actions on resource
       └── Return chronological list

┌───────────────┐
│Recent Activity│
└──────┬────────┘
       │
       ├── Fetch recent activities for user
       ├── Limit to 10
       └── Return for dashboard
```

### Business Logic Details

#### Activity Logging
- **Automatic**: Most actions automatically logged
- **Manual**: Can be manually triggered for custom events
- **Data**: User, action, resource, changes, metadata, IP, UA, location
- **Retention**: Configurable retention period

#### Activity Queries
- **Filters**: By user, action, resource, date range
- **Pagination**: Efficient pagination for large datasets
- **Permissions**: Users see own logs, admins see all

### Case Scenarios

1. **Audit trail for debt**
   - Debt created → logged
   - Debt updated → logged with changes
   - Debt status changed → logged
   - Debt deleted → logged
   - Full history available

2. **Security investigation**
   - Admin views all activities
   - Filters by suspicious user
   - Checks IP, location patterns
   - Identifies unauthorized access

3. **User activity summary**
   - Dashboard shows recent activity
   - Last 10 actions
   - Quick overview of account usage

---

## Public API

### UX Flow Chart

```
┌─────────────┐
│Check Debt   │
└──────┬──────┘
       │
       ├── Validate phone format
       ├── Check captcha (if enabled)
       ├── Count active debts for phone
       ├── Return found status
       ├── Return count (if authorized)
       └── Mask phone number in response
```

### Business Logic Details

#### Debt Check
- **Purpose**: Allow public check if phone has debts
- **Security**: 
  - Captcha required to prevent enumeration
  - Phone masked in response
  - Count only shown with special token
- **Rate Limiting**: Strict rate limiting
- **Privacy**: Doesn't reveal debt details, just existence

### Case Scenarios

1. **Public debt check**
   - User enters phone number
   - Completes captcha
   - System checks for debts
   - Returns: has debts or not
   - Phone masked: 0123***678

2. **Count with authorization**
   - Special token required
   - Returns actual count
   - Used by authorized systems
   - Prevents enumeration

---

## Error Handling

All services use standardized error codes from `@repo/errors`:

- **BE_001 - BE_099**: Backend-specific errors
- **Auth Errors**: BE_010 - BE_019, BE_095 - BE_096
- **Email Errors**: BE_050 - BE_054
- **Debt Errors**: BE_035 - BE_039, BE_090 - BE_094
- **File Errors**: BE_060 - BE_066
- **Bank Errors**: BE_080 - BE_083
- **Session Errors**: BE_097 - BE_098

All errors follow the pattern:
```typescript
{ code: 'BE_XXX', error: 'Human readable message' }
```

---

## Security Features

1. **Password Security**
   - Argon2 hashing
   - Complexity requirements
   - Common password rejection
   - Timing-safe comparison

2. **Session Security**
   - JWT with short-lived access tokens
   - Refresh token rotation
   - Session invalidation on password change
   - Device tracking

3. **Rate Limiting**
   - Per-endpoint rate limits
   - IP-based limiting
   - User-based limiting
   - Strict limits on sensitive operations

4. **Input Validation**
   - Schema validation with Valibot
   - Phone number normalization
   - File type validation (magic bytes)
   - SQL injection prevention (parameterized queries)

5. **Access Control**
   - Permission-based authorization
   - Resource ownership checks
   - Admin role for elevated access
   - Row-level security

---

## Summary

The Buddy Wallet API provides a comprehensive debt management system with:

- **User Management**: Registration, authentication, profile management
- **Debt Lifecycle**: Create, track, confirm, pay debts
- **Bank Integration**: Manage accounts, generate payment QRs
- **File Management**: Upload proofs, QR codes
- **Data Portability**: Import/export debts
- **Notifications**: Real-time push notifications
- **Audit Trail**: Complete activity logging
- **Public API**: Limited public access for debt checking

All flows include proper error handling, security measures, and user feedback through notifications.

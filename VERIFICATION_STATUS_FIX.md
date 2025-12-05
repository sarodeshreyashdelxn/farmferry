# Verification Status Fix

## Issue Description

The supplier verification status was showing as "pending" even when the supplier was already verified. This was caused by a disconnect between two verification systems:

1. **Document-level verification**: Each document has an `isVerified` field
2. **Supplier-level verification**: The supplier has a `status` field that can be "pending", "approved", or "rejected"

The `getVerificationStatus` function was only checking document verification status but not considering the supplier's overall `status` field.

## Changes Made

### 1. Fixed `getVerificationStatus` Function
**File**: `farmferry-backend-revised/controllers/supplier.controller.js`

- Updated the function to check supplier's `status` field first
- If supplier status is "approved", show as "verified"
- If supplier status is "rejected", show as "rejected"
- Only fall back to document verification status if supplier status is "pending"

### 2. Fixed Auth Middleware
**File**: `farmferry-backend-revised/middlewares/auth.middleware.js`

- Changed `req.user.status !== "verified"` to `req.user.status !== "approved"`
- The supplier model uses "approved" status, not "verified"

### 3. Enhanced Document Verification
**File**: `farmferry-backend-revised/controllers/admin.controller.js`

- Added automatic supplier status update when all documents are verified
- When all documents are approved, automatically set supplier status to "approved"
- When any document is rejected, automatically set supplier status to "rejected"

### 4. Enhanced Manual Status Update
**File**: `farmferry-backend-revised/controllers/admin.controller.js`

- When manually approving a supplier, also mark all documents as verified
- Added more detailed response information

### 5. Added Debug Information
**File**: `farmferry_supplier/src/screens/main/VerificationStatusScreen.js`

- Added debug information display showing supplier status, verification date, and notes
- Added test buttons for development (can be removed in production)

### 6. Created Utility Script
**File**: `farmferry-backend-revised/utils/fixVerificationStatus.js`

- Script to fix verification status for all suppliers
- Script to manually approve specific suppliers
- Script to list all suppliers with their verification status

## How to Fix Existing Data

### Option 1: Use the Utility Script

```bash
# Navigate to the backend directory
cd farmferry-backend-revised

# List all suppliers and their current status
node utils/fixVerificationStatus.js list

# Fix verification status for all suppliers based on document verification
node utils/fixVerificationStatus.js fix

# Manually approve a specific supplier
node utils/fixVerificationStatus.js approve <supplierId>
```

### Option 2: Use Admin API

Use the admin API endpoint to update supplier status:

```bash
PUT /admin/suppliers/:id/status
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "status": "approved",
  "verificationNotes": "Manually approved"
}
```

### Option 3: Use Frontend Test Buttons

The verification status screen now includes test buttons (in debug mode) that can:
- Approve the current supplier
- Reset the supplier to pending status

## Verification Flow

1. **Supplier Registration**: Status set to "pending"
2. **Document Upload**: Documents uploaded with `isVerified: false`
3. **Admin Review**: Admin verifies individual documents
4. **Auto-Approval**: When all documents are verified, supplier status automatically changes to "approved"
5. **Manual Override**: Admin can manually approve/reject supplier regardless of document status

## Status Mapping

| Supplier Status | Verification Status | Description |
|----------------|-------------------|-------------|
| `approved` | `verified` | Supplier is fully verified |
| `rejected` | `rejected` | Supplier verification was rejected |
| `pending` | `pending` | Supplier verification is in progress |

## Testing

1. **Check Current Status**: Use the utility script to list all suppliers
2. **Test Auto-Approval**: Upload and verify all required documents
3. **Test Manual Approval**: Use admin API to manually approve a supplier
4. **Verify Frontend**: Check that the verification status screen shows correct status

## Production Notes

- Remove debug information and test buttons from the frontend before production
- The utility script should only be used for data migration, not regular operations
- Consider adding logging for verification status changes
- Consider adding notifications when supplier status changes

## API Endpoints

### Supplier Endpoints
- `GET /suppliers/verification-status` - Get verification status
- `POST /suppliers/verification-document` - Upload verification document

### Admin Endpoints
- `PUT /admin/suppliers/:id/status` - Update supplier status
- `PUT /admin/suppliers/:supplierId/documents/:documentId/verify` - Verify individual document

## Database Schema

### Supplier Model
```javascript
{
  status: { 
    type: String, 
    enum: ["pending", "approved", "rejected"], 
    default: "pending" 
  },
  verifiedAt: { type: Date },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  verificationNotes: { type: String },
  documents: [{
    type: String,
    url: String,
    publicId: String,
    isVerified: Boolean,
    verifiedAt: Date,
    verifiedBy: mongoose.Schema.Types.ObjectId,
    verificationNotes: String
  }]
}
``` 
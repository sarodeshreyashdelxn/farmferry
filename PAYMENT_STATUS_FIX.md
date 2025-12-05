# Payment Status Fix for UPI Orders

## Issue Description

The issue is that UPI orders are being created with `paymentStatus: "pending"` even when the payment is successful. This happens because:

1. The frontend sends `paymentStatus: 'paid'` in the order creation request
2. The backend `createOrder` function was not handling the `paymentStatus`, `transactionId`, and `paymentDetails` fields from the request body
3. Orders were being created with hardcoded `status: "pending"` and default `paymentStatus: "pending"`

## Changes Made

### 1. Updated Order Controller (`controllers/order.controller.js`)

- **Modified `createOrder` function**: Now accepts and uses `paymentStatus`, `transactionId`, and `paymentDetails` from the request body
- **Added `updateOrderPaymentStatus` function**: New endpoint to update payment status for existing orders
- **Updated exports**: Added the new function to the exports

### 2. Updated Order Routes (`routes/order.routes.js`)

- **Added new route**: `PUT /:id/payment-status` for updating payment status
- **Authorization**: Only customers and admins can update payment status

### 3. Created Webhook Handler (`controllers/paymentWebhook.controller.js`)

- **Razorpay webhook handler**: Processes payment success/failure events
- **Stripe webhook handler**: Processes Stripe payment events
- **UPI payment status handler**: Manual endpoint for UPI payment status updates

### 4. Created Webhook Routes (`routes/paymentWebhook.routes.js`)

- **Razorpay webhook**: `POST /webhooks/razorpay`
- **Stripe webhook**: `POST /webhooks/stripe`
- **UPI status update**: `POST /webhooks/upi-status`

### 5. Updated Main Routes (`routes/index.js`)

- **Added webhook routes**: Registered the new webhook routes

## Fix Scripts

### Script 1: Fix Specific Order (`fixPaymentStatus.js`)

This script fixes the specific order mentioned in the issue:

```bash
cd farmferry-backend-revised
node fixPaymentStatus.js
```

### Script 2: Fix All UPI Orders (`fixAllUPIPayments.js`)

This script fixes all UPI orders with pending payment status:

```bash
cd farmferry-backend-revised
node fixAllUPIPayments.js
```

## API Endpoints

### Update Payment Status
```
PUT /api/v1/orders/:id/payment-status
Authorization: Bearer <token>
Content-Type: application/json

{
  "paymentStatus": "paid",
  "transactionId": "TXN_123456789",
  "paymentDetails": {
    "method": "upi",
    "amount": 72,
    "timestamp": "2024-01-20T10:30:00.000Z"
  }
}
```

### UPI Payment Status Webhook
```
POST /api/v1/webhooks/upi-status
Content-Type: application/json

{
  "orderId": "7XN41Z",
  "paymentStatus": "paid",
  "transactionId": "TXN_123456789",
  "paymentDetails": {
    "method": "upi",
    "amount": 72,
    "timestamp": "2024-01-20T10:30:00.000Z"
  }
}
```

## How to Fix the Current Issue

### Option 1: Run the Fix Script (Recommended)

1. Navigate to the backend directory:
   ```bash
   cd farmferry-backend-revised
   ```

2. Run the specific order fix script:
   ```bash
   node fixPaymentStatus.js
   ```

3. Or run the comprehensive fix script:
   ```bash
   node fixAllUPIPayments.js
   ```

### Option 2: Use the API Endpoint

1. Get the order ID from the database: `68a83d8ccc4255fe5f18b10e`
2. Make a PUT request to update the payment status:

```bash
curl -X PUT \
  http://localhost:8000/api/v1/orders/68a83d8ccc4255fe5f18b10e/payment-status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentStatus": "paid",
    "transactionId": "TXN_123456789",
    "paymentDetails": {
      "method": "upi",
      "amount": 72,
      "timestamp": "2024-01-20T10:30:00.000Z"
    }
  }'
```

### Option 3: Use the Webhook Endpoint

```bash
curl -X POST \
  http://localhost:8000/api/v1/webhooks/upi-status \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "7XN41Z",
    "paymentStatus": "paid",
    "transactionId": "TXN_123456789",
    "paymentDetails": {
      "method": "upi",
      "amount": 72,
      "timestamp": "2024-01-20T10:30:00.000Z"
    }
  }'
```

## Prevention

To prevent this issue in the future:

1. **Frontend**: Ensure that successful payments always send the correct `paymentStatus`, `transactionId`, and `paymentDetails`
2. **Backend**: The updated `createOrder` function now properly handles these fields
3. **Webhooks**: Set up proper webhook endpoints for payment gateways to automatically update payment status
4. **Monitoring**: Add logging to track payment status updates

## Testing

After applying the fix, you can verify the order status by:

1. Checking the database directly
2. Using the API endpoint: `GET /api/v1/orders/:id`
3. Checking the order in the admin panel

The order should now show:
- `paymentStatus: "paid"`
- `transactionId: "TXN_..."` (or the actual transaction ID)
- `paymentDetails` with the payment information


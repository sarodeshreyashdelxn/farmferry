# 🚚 Advanced Delivery Features - Farm Ferry Backend

This document outlines the advanced delivery features implemented in the Farm Ferry backend, including Google Maps integration, QR code generation, OTP verification, and order replacement functionality.

## 📋 Table of Contents

- [Features Overview](#features-overview)
- [Google Maps Integration](#google-maps-integration)
- [QR Code System](#qr-code-system)
- [OTP Verification](#otp-verification)
- [Order Replacement](#order-replacement)
- [API Endpoints](#api-endpoints)
- [Environment Variables](#environment-variables)
- [Installation & Setup](#installation--setup)
- [Usage Examples](#usage-examples)

## 🎯 Features Overview

### ✅ **Implemented Features**

1. **Google Maps Route Optimization**
   - Multi-point route optimization
   - Distance and time calculation
   - Cost optimization based on fuel and maintenance
   - Real-time traffic consideration

2. **QR Code Generation & Verification**
   - Delivery QR codes with unique tokens
   - Replacement order QR codes
   - QR code validation and expiration
   - Secure token generation

3. **OTP-Based Delivery Verification**
   - 6-digit OTP generation
   - SMS and email delivery
   - OTP validation and expiration
   - Secure delivery confirmation

4. **Order Replacement System**
   - Complete replacement workflow
   - Admin approval system
   - Replacement tracking
   - Financial calculations

## 🗺️ Google Maps Integration

### **Features**
- **Route Optimization**: Optimizes delivery routes for multiple orders
- **Distance Matrix**: Calculates accurate distances and travel times
- **Cost Optimization**: Estimates fuel and maintenance costs
- **Real-time Updates**: Considers traffic and road conditions

### **Configuration**
```javascript
// Add to your .env file
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### **Usage Example**
```javascript
// Get optimized route for multiple orders
const optimizedRoute = await GoogleMapsService.getOptimizedRoute(waypoints, {
  mode: 'driving',
  avoid: ['tolls', 'highways']
});

// Calculate delivery time estimate
const timeEstimate = await GoogleMapsService.getDeliveryTimeEstimate(
  origin, 
  destination, 
  pickupTime
);
```

## 📱 QR Code System

### **Features**
- **Delivery QR Codes**: Generated when delivery associate starts delivery
- **Replacement QR Codes**: Generated for replacement order verification
- **Secure Tokens**: Unique tokens for each QR code
- **Expiration**: QR codes expire after 24 hours

### **QR Code Types**

1. **Delivery QR Code**
   ```json
   {
     "orderId": "ORD123456",
     "deliveryToken": "abc123def456",
     "customerPhone": "+1234567890",
     "deliveryAssociateId": "DA123",
     "timestamp": "2024-01-01T10:00:00Z",
     "type": "delivery_verification"
   }
   ```

2. **Replacement QR Code**
   ```json
   {
     "originalOrderId": "ORD123456",
     "replacementOrderId": "REP789012",
     "replacementToken": "xyz789abc123",
     "customerPhone": "+1234567890",
     "timestamp": "2024-01-01T10:00:00Z",
     "type": "replacement_verification"
   }
   ```

## 🔐 OTP Verification

### **Features**
- **6-Digit OTP**: Secure 6-digit verification codes
- **Dual Delivery**: SMS and email delivery
- **Expiration**: 10-minute expiration time
- **Retry Limits**: Maximum 3 attempts per OTP

### **OTP Flow**
1. **Generation**: OTP generated when delivery associate starts delivery
2. **Delivery**: Sent via SMS and email to customer
3. **Verification**: Delivery associate enters OTP to complete delivery
4. **Confirmation**: Order status updated to "delivered"

### **Usage Example**
```javascript
// Generate delivery OTP
const otpData = await DeliveryVerificationService.generateDeliveryOTP(
  orderId,
  customerPhone,
  customerEmail,
  deliveryAssociateId
);

// Verify OTP
const verification = await DeliveryVerificationService.verifyDeliveryOTP(
  orderId,
  otp,
  customerPhone
);
```

## 🔄 Order Replacement

### **Features**
- **Replacement Request**: Customers can request order replacements
- **Admin Approval**: Admin approval workflow
- **Replacement Tracking**: Complete replacement order lifecycle
- **Financial Management**: Refund and additional charge handling

### **Replacement Reasons**
- Damaged product
- Wrong product
- Expired product
- Missing items
- Quality issues
- Customer request
- Other

### **Replacement Flow**
1. **Request**: Customer requests replacement with reason
2. **Approval**: Admin reviews and approves/rejects
3. **Processing**: Replacement order created and processed
4. **Delivery**: Replacement delivered with OTP verification
5. **Completion**: Replacement marked as delivered

## 🌐 API Endpoints

### **Google Maps Route Optimization**
```
POST /api/v1/advanced-delivery/route/optimize
POST /api/v1/advanced-delivery/route/estimate/:orderId
```

### **QR Code Generation**
```
POST /api/v1/advanced-delivery/qr/delivery/:orderId
POST /api/v1/advanced-delivery/qr/replacement/:replacementOrderId
```

### **OTP Verification**
```
POST /api/v1/advanced-delivery/verify/delivery/:orderId
POST /api/v1/advanced-delivery/verify/replacement/:replacementOrderId
POST /api/v1/advanced-delivery/otp/resend/:orderId
```

### **Order Replacement**
```
POST /api/v1/advanced-delivery/replacement/request/:orderId
GET /api/v1/advanced-delivery/replacement/customer
GET /api/v1/advanced-delivery/replacement/admin
PUT /api/v1/advanced-delivery/replacement/:replacementId/status
```

### **Analytics**
```
GET /api/v1/advanced-delivery/analytics
```

## 🔧 Environment Variables

Add these to your `.env` file:

```env
# Google Maps Configuration
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Twilio Configuration (for SMS)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Advanced Delivery Configuration
DELIVERY_OTP_EXPIRY_MINUTES=10
MAX_DELIVERY_ATTEMPTS=3
DEFAULT_DELIVERY_RADIUS_KM=10
FUEL_PRICE_PER_LITER=1.2
VEHICLE_MAINTENANCE_COST_PER_KM=0.05
```

## 📦 Installation & Setup

### **1. Install Dependencies**
```bash
npm install @googlemaps/google-maps-services-js qrcode node-cron axios
```

### **2. Configure Environment Variables**
Copy the environment variables above to your `.env` file.

### **3. Get Google Maps API Key**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Maps JavaScript API and Directions API
4. Create API key with appropriate restrictions

### **4. Configure Twilio (for SMS)**
1. Sign up for [Twilio](https://www.twilio.com/)
2. Get Account SID and Auth Token
3. Get a Twilio phone number

## 💡 Usage Examples

### **1. Route Optimization**
```javascript
// Request optimized route
const response = await fetch('/api/v1/advanced-delivery/route/optimize', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    orderIds: ['order1', 'order2', 'order3']
  })
});

const { optimizedRoute, costOptimization } = await response.json();
```

### **2. Generate Delivery QR Code**
```javascript
// Generate QR code for delivery
const response = await fetch('/api/v1/advanced-delivery/qr/delivery/order123', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { qrCode, deliveryToken } = await response.json();
```

### **3. Verify Delivery OTP**
```javascript
// Verify OTP to complete delivery
const response = await fetch('/api/v1/advanced-delivery/verify/delivery/order123', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    otp: '123456',
    qrCodeData: 'scanned_qr_data'
  })
});
```

### **4. Request Order Replacement**
```javascript
// Request replacement order
const response = await fetch('/api/v1/advanced-delivery/replacement/request/order123', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    reason: 'damaged_product',
    description: 'Product arrived damaged',
    priority: 'high'
  })
});
```

## 🔒 Security Considerations

### **QR Code Security**
- Unique tokens for each QR code
- 24-hour expiration time
- Encrypted data in QR codes
- Validation of QR code authenticity

### **OTP Security**
- 6-digit random OTP
- 10-minute expiration
- Maximum 3 attempts
- Rate limiting on OTP generation

### **API Security**
- JWT authentication required
- Role-based access control
- Input validation and sanitization
- Rate limiting on sensitive endpoints

## 📊 Analytics & Monitoring

### **Delivery Analytics**
- Total deliveries completed
- Average delivery time
- On-time delivery percentage
- Customer ratings
- Earnings analysis

### **Cost Optimization**
- Fuel cost calculations
- Maintenance cost tracking
- Route efficiency metrics
- Cost savings analysis

## 🚀 Future Enhancements

### **Planned Features**
- Real-time GPS tracking
- Push notifications
- Advanced analytics dashboard
- Machine learning route optimization
- Weather-based route adjustments
- Dynamic pricing based on demand

### **Integration Possibilities**
- Third-party delivery services
- Advanced payment gateways
- Customer feedback systems
- Inventory management integration
- Supplier notification systems

## 🐛 Troubleshooting

### **Common Issues**

1. **Google Maps API Errors**
   - Check API key configuration
   - Verify API quotas and billing
   - Ensure required APIs are enabled

2. **QR Code Generation Issues**
   - Check QR code library installation
   - Verify data format for QR codes
   - Check file permissions for image generation

3. **OTP Delivery Issues**
   - Verify Twilio configuration
   - Check phone number format
   - Ensure SMS credits are available

4. **Route Optimization Failures**
   - Check waypoint data format
   - Verify location coordinates
   - Ensure Google Maps API is accessible

### **Debug Mode**
Enable debug logging by setting:
```env
NODE_ENV=development
DEBUG=advanced-delivery:*
```

## 📞 Support

For technical support or questions about the advanced delivery features:

1. Check the troubleshooting section above
2. Review API documentation
3. Check server logs for error details
4. Contact the development team

---

**Note**: This implementation provides a production-ready foundation for advanced delivery features. Additional customization may be required based on specific business requirements and local regulations. 
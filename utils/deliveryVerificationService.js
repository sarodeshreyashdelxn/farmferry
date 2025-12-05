import crypto from 'crypto';
import smsUtils from './sms.js';
import QRCodeService from './qrCodeService.js';
import Order from '../models/order.model.js';
import DeliveryAssociate from '../models/deliveryAssociate.model.js';

/**
 * Delivery Verification Service for OTP-based delivery confirmation
 */
export class DeliveryVerificationService {
  constructor() {
    this.otpExpiryMinutes = 10; // OTP expires in 10 minutes
  }

  /**
   * Generate delivery OTP and send to customer
   * @param {string} orderId - Order ID
   * @param {string} phone - Customer phone number
   * @param {string} deliveryAssociateId - Delivery associate ID
   * @returns {Promise<Object>} OTP data
   */
  async generateDeliveryOTP(orderId, phone, deliveryAssociateId) {
    try {
      // Generate 6-digit OTP
      const otp = this.generateOTP();

      // Create delivery verification record
      const verificationData = {
        orderId: orderId,
        phone: phone,
        deliveryAssociateId: deliveryAssociateId,
        otp: otp,
        otpExpiresAt: new Date(Date.now() + (this.otpExpiryMinutes * 60 * 1000)),
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date()
      };

      // Save OTP and expiry to Order
      await Order.findByIdAndUpdate(orderId, {
        otp,
        otpExpiresAt: new Date(Date.now() + (this.otpExpiryMinutes * 60 * 1000))
      });

      // Send OTP via SMS only
      if (phone) {
        try {
          await this.sendDeliveryOTPSMS(phone, otp, orderId);
        } catch (smsError) {
          console.log('⚠️ SMS sending failed, but OTP generation continues');
          // Continue with the process even if SMS fails
        }
      }

      // Generate QR code for delivery
      const qrCodeData = await QRCodeService.generateDeliveryQRCode(
        orderId,
        phone,
        deliveryAssociateId
      );

      return {
        ...verificationData,
        qrCode: qrCodeData.qrCodeDataURL,
        deliveryToken: qrCodeData.deliveryToken
      };
    } catch (error) {
      console.error('Delivery OTP generation error:', error);
      throw new Error('Failed to generate delivery OTP');
    }
  }

  /**
   * Generate replacement OTP and send to customer
   * @param {string} orderId - Original order ID
   * @param {string} replacementOrderId - Replacement order ID
   * @param {string} phone - Customer phone number
   * @returns {Promise<Object>} OTP data
   */
  async generateReplacementOTP(orderId, replacementOrderId, phone) {
    try {
      // Generate 6-digit OTP
      const otp = this.generateOTP();

      // Create replacement verification record
      const verificationData = {
        originalOrderId: orderId,
        replacementOrderId: replacementOrderId,
        phone: phone,
        otp: otp,
        otpExpiresAt: new Date(Date.now() + (this.otpExpiryMinutes * 60 * 1000)),
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        type: 'replacement',
        createdAt: new Date()
      };

      // Send OTP via SMS only
      if (phone) {
        await this.sendReplacementOTPSMS(phone, otp, replacementOrderId);
      }

      // Generate QR code for replacement
      const qrCodeData = await QRCodeService.generateReplacementQRCode(
        orderId,
        replacementOrderId,
        phone
      );

      return {
        ...verificationData,
        qrCode: qrCodeData.qrCodeDataURL,
        replacementToken: qrCodeData.replacementToken
      };
    } catch (error) {
      console.error('Replacement OTP generation error:', error);
      throw new Error('Failed to generate replacement OTP');
    }
  }

  /**
   * Verify delivery OTP
   * @param {string} orderId - Order ID
   * @param {string} otp - OTP entered by delivery associate
   * @param {string} phone - Customer phone number
   * @returns {Promise<Object>} Verification result
   */
  async verifyDeliveryOTP(orderId, otp, phone) {
    try {
      // Validate OTP format
      if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        throw new Error('Invalid OTP format');
      }

      // Get order to check OTP expiry
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Check if OTP is expired
      const currentTime = new Date();
      if (order.otpExpiresAt && currentTime > order.otpExpiresAt) {
        throw new Error('OTP has expired');
      }

      // Verify OTP (compare with stored OTP)
      const isValidOTP = await this.validateStoredOTP(orderId, otp);

      if (!isValidOTP) {
        throw new Error('Invalid OTP');
      }

      return {
        success: true,
        message: 'OTP verified successfully',
        orderId: orderId,
        verifiedAt: new Date()
      };
    } catch (error) {
      console.error('Delivery OTP verification error:', error);
      throw error;
    }
  }

  /**
   * Verify replacement OTP
   * @param {string} replacementOrderId - Replacement order ID
   * @param {string} otp - OTP entered by customer
   * @param {string} phone - Customer phone number
   * @returns {Promise<Object>} Verification result
   */
  async verifyReplacementOTP(replacementOrderId, otp, phone) {
    try {
      // Validate OTP format
      if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        throw new Error('Invalid OTP format');
      }

      // Check if OTP is expired
      const currentTime = new Date();
      const otpExpiresAt = new Date(); // This would come from database

      if (currentTime > otpExpiresAt) {
        throw new Error('OTP has expired');
      }

      // Verify OTP (in real implementation, compare with stored OTP)
      const isValidOTP = await this.validateStoredReplacementOTP(replacementOrderId, otp, phone);

      if (!isValidOTP) {
        throw new Error('Invalid OTP');
      }

      return {
        success: true,
        message: 'Replacement OTP verified successfully',
        replacementOrderId: replacementOrderId,
        verifiedAt: new Date()
      };
    } catch (error) {
      console.error('Replacement OTP verification error:', error);
      throw error;
    }
  }

  /**
   * Send delivery OTP via SMS
   * @param {string} phone - Customer phone number
   * @param {string} otp - OTP code
   * @param {string} orderId - Order ID
   */
  async sendDeliveryOTPSMS(phone, otp, orderId) {
    try {
      console.log(`📱 Attempting to send SMS to: ${phone}`);
      console.log(`📱 OTP: ${otp}, Order ID: ${orderId}`);

      // Get order details to fetch the actual orderId field
      const order = await Order.findById(orderId);
      const actualOrderId = order?.orderId || orderId;

      const message = `Your FarmFerry delivery OTP is: ${otp}. Valid for ${this.otpExpiryMinutes} minutes. Order ID: ${actualOrderId}. Do not share this OTP with anyone.`;

      console.log(`📱 SMS Message: ${message}`);

      await smsUtils.sendSMS(phone, message);

      console.log(`✅ SMS sent successfully to ${phone}`);
    } catch (error) {
      console.error('❌ SMS sending error:', error);
      console.error('❌ Error details:', {
        phone,
        otp,
        orderId,
        errorMessage: error.message,
        errorStack: error.stack
      });

      // Don't throw error for SMS failures - just log them
      // This prevents the entire delivery process from failing due to SMS issues
      console.log('⚠️ SMS failed but continuing with delivery process');
      return false;
    }
  }
  /**
 * Send delivery completion notifications to customer and delivery associate
 * @param {string} orderId - Order ID
 * @param {string} customerPhone - Customer phone number
 * @param {string} customerName - Customer name
 * @param {string} deliveryAssociateId - Delivery associate ID
 * @returns {Promise<Object>} Notification results
 */
  async sendDeliveryCompletionNotifications(orderId, customerPhone, customerName, deliveryAssociateId) {
    try {
      console.log(`📱 Preparing delivery completion notifications for order: ${orderId}`);

      // Get order details to fetch the actual orderId field
      const order = await Order.findById(orderId);
      const actualOrderId = order?.orderId || orderId; // Use the orderId field from database

      // Get delivery associate details (model already imported at top)
      const deliveryAssociate = await DeliveryAssociate.findById(deliveryAssociateId);

      const notificationResults = {
        customerSMS: { success: false, error: null },
        associateSMS: { success: false, error: null }
      };

      // Send notification to customer
      if (customerPhone) {
        try {
          const customerMessage = `Hi ${customerName}, your order has been delivered successfully. Thank you for shopping with FarmFerry!`;
          await smsUtils.sendSmsThroughWhatsapp(customerPhone, customerMessage);
          notificationResults.customerSMS.success = true;
          console.log(`✅ Delivery confirmation SMS sent to customer: ${customerPhone}`);
        } catch (customerError) {
          notificationResults.customerSMS.error = customerError.message;
          console.error(`❌ Failed to send SMS to customer ${customerPhone}:`, customerError.message);
        }
      }

      // Send notification to delivery associate
      if (deliveryAssociate && deliveryAssociate.phone) {
        try {
          const associateMessage = `Hi ${deliveryAssociate.name || 'Delivery Associate'}, order ${actualOrderId} has been delivered successfully. Great job!`;
          await smsUtils.sendSMS(deliveryAssociate.phone, associateMessage);
          notificationResults.associateSMS.success = true;
          console.log(`✅ Delivery completion SMS sent to associate: ${deliveryAssociate.phone}`);
        } catch (associateError) {
          notificationResults.associateSMS.error = associateError.message;
          console.error(`❌ Failed to send SMS to associate ${deliveryAssociate.phone}:`, associateError.message);
        }
      }

      return notificationResults;
    } catch (error) {
      console.error('❌ Error sending delivery completion notifications:', error);
      throw new Error('Failed to send delivery completion notifications');
    }
  }
  /**
   * Enhanced verifyDeliveryOTP with notifications
   * @param {string} orderId - Order ID
   * @param {string} otp - OTP entered by delivery associate
   * @param {string} phone - Customer phone number
   * @param {string} deliveryAssociateId - Delivery associate ID
   * @returns {Promise<Object>} Verification result with notifications
   */
  async verifyDeliveryOTPWithNotifications(orderId, otp, phone, deliveryAssociateId) {
    try {
      // First verify the OTP using existing logic
      const verificationResult = await this.verifyDeliveryOTP(orderId, otp, phone);

      if (verificationResult.success) {
        // Get customer details for notification (models already imported at top)
        const order = await Order.findById(orderId).populate('customer');
        let customerName = 'Customer';
        let customerPhoneForNotification = phone;

        if (order && order.customer) {
          customerName = order.customer.firstName || 'Customer';
          customerPhoneForNotification = order.customer.phone || phone;
        }

        // Send delivery completion notifications (non-blocking)
        this.sendDeliveryCompletionNotifications(
          orderId,
          customerPhoneForNotification,
          customerName,
          deliveryAssociateId
        ).catch(notificationError => {
          console.error('❌ Notification sending failed (non-critical):', notificationError);
          // Don't throw - notifications are secondary to OTP verification
        });

        // Update order status to delivered
        await Order.findByIdAndUpdate(orderId, {
          status: 'delivered',
          deliveredAt: new Date(),
          // Clear OTP after successful verification
          otp: undefined,
          otpExpiresAt: undefined
        });
      }

      return verificationResult;
    } catch (error) {
      console.error('❌ Delivery OTP verification with notifications error:', error);
      throw error;
    }
  }
  /**
   * Send replacement OTP via SMS
   * @param {string} phone - Customer phone number
   * @param {string} otp - OTP code
   * @param {string} replacementOrderId - Replacement order ID
   */
  async sendReplacementOTPSMS(phone, otp, replacementOrderId) {
    try {
      const message = `Your FarmFerry replacement order OTP is: ${otp}. Valid for ${this.otpExpiryMinutes} minutes. Replacement Order ID: ${replacementOrderId}. Do not share this OTP with anyone.`;

      await smsUtils.sendSMS(phone, message);
    } catch (error) {
      console.error('SMS sending error:', error);
      throw new Error('Failed to send replacement OTP via SMS');
    }
  }



  /**
   * Generate 6-digit OTP
   * @returns {string} 6-digit OTP
   */
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Validate stored OTP using Order model
   * @param {string} orderId - Order ID
   * @param {string} otp - OTP to validate
   * @returns {Promise<boolean>} Validation result
   */
  async validateStoredOTP(orderId, otp) {
    const order = await Order.findById(orderId);
    if (!order) return false;
    if (order.otp !== otp) return false;
    if (order.otpExpiresAt < new Date()) return false;
    return true;
  }

  /**
   * Validate stored replacement OTP (placeholder for database integration)
   * @param {string} replacementOrderId - Replacement order ID
   * @param {string} otp - OTP to validate
   * @param {string} phone - Customer phone number
   * @returns {Promise<boolean>} Validation result
   */
  async validateStoredReplacementOTP(replacementOrderId, otp, phone) {
    // In real implementation, fetch from database and compare
    // For now, return true for demonstration
    return true;
  }

  /**
   * Resend delivery OTP
   * @param {string} orderId - Order ID
   * @param {string} phone - Customer phone number
   * @returns {Promise<Object>} New OTP data
   */
  async resendDeliveryOTP(orderId, phone) {
    try {
      // Generate new OTP
      const newOtp = this.generateOTP();
      // Update OTP and expiry in Order
      await Order.findByIdAndUpdate(orderId, {
        otp: newOtp,
        otpExpiresAt: new Date(Date.now() + (this.otpExpiryMinutes * 60 * 1000))
      });

      return {
        ...verificationData,
        message: 'OTP resent successfully'
      };
    } catch (error) {
      console.error('OTP resend error:', error);
      throw new Error('Failed to resend OTP');
    }
  }
}

export default new DeliveryVerificationService();
import QRCode from 'qrcode';
import crypto from 'crypto';

/**
 * QR Code Service for order delivery verification
 */
export class QRCodeService {
  /**
   * Generate QR code for order delivery
   * @param {string} orderId - Order ID
   * @param {string} customerPhone - Customer phone number
   * @param {string} deliveryAssociateId - Delivery associate ID
   * @returns {Promise<Object>} QR code data
   */
  async generateDeliveryQRCode(orderId, customerPhone, deliveryAssociateId) {
    try {
      // Create unique delivery token
      const deliveryToken = this.generateDeliveryToken(orderId, customerPhone, deliveryAssociateId);
      
      // Create QR code data
      const qrData = {
        orderId: orderId,
        deliveryToken: deliveryToken,
        customerPhone: customerPhone,
        deliveryAssociateId: deliveryAssociateId,
        timestamp: new Date().toISOString(),
        type: 'delivery_verification'
      };

      // Generate QR code as data URL
      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Generate QR code as buffer for storage
      const qrCodeBuffer = await QRCode.toBuffer(JSON.stringify(qrData), {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.92,
        margin: 1
      });

      return {
        qrCodeDataURL: qrCodeDataURL,
        qrCodeBuffer: qrCodeBuffer,
        deliveryToken: deliveryToken,
        qrData: qrData
      };
    } catch (error) {
      console.error('QR Code generation error:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Generate QR code for order replacement
   * @param {string} orderId - Original order ID
   * @param {string} replacementOrderId - Replacement order ID
   * @param {string} customerPhone - Customer phone number
   * @returns {Promise<Object>} QR code data
   */
  async generateReplacementQRCode(orderId, replacementOrderId, customerPhone) {
    try {
      // Create unique replacement token
      const replacementToken = this.generateReplacementToken(orderId, replacementOrderId, customerPhone);
      
      // Create QR code data
      const qrData = {
        originalOrderId: orderId,
        replacementOrderId: replacementOrderId,
        replacementToken: replacementToken,
        customerPhone: customerPhone,
        timestamp: new Date().toISOString(),
        type: 'replacement_verification'
      };

      // Generate QR code as data URL
      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      return {
        qrCodeDataURL: qrCodeDataURL,
        replacementToken: replacementToken,
        qrData: qrData
      };
    } catch (error) {
      console.error('Replacement QR Code generation error:', error);
      throw new Error('Failed to generate replacement QR code');
    }
  }

  /**
   * Verify QR code data
   * @param {string} qrCodeData - Scanned QR code data
   * @returns {Object} Verified QR code data
   */
  verifyQRCode(qrCodeData) {
    try {
      const data = JSON.parse(qrCodeData);
      
      // Validate required fields
      if (!data.orderId || !data.deliveryToken || !data.customerPhone) {
        throw new Error('Invalid QR code data');
      }

      // Validate timestamp (QR code should not be older than 24 hours)
      const qrTimestamp = new Date(data.timestamp);
      const currentTime = new Date();
      const timeDifference = currentTime - qrTimestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

      if (timeDifference > maxAge) {
        throw new Error('QR code has expired');
      }

      return data;
    } catch (error) {
      console.error('QR Code verification error:', error);
      throw new Error('Invalid QR code');
    }
  }

  /**
   * Generate unique delivery token
   * @param {string} orderId - Order ID
   * @param {string} customerPhone - Customer phone number
   * @param {string} deliveryAssociateId - Delivery associate ID
   * @returns {string} Delivery token
   */
  generateDeliveryToken(orderId, customerPhone, deliveryAssociateId) {
    const data = `${orderId}-${customerPhone}-${deliveryAssociateId}-${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Generate unique replacement token
   * @param {string} orderId - Original order ID
   * @param {string} replacementOrderId - Replacement order ID
   * @param {string} customerPhone - Customer phone number
   * @returns {string} Replacement token
   */
  generateReplacementToken(orderId, replacementOrderId, customerPhone) {
    const data = `${orderId}-${replacementOrderId}-${customerPhone}-${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Generate QR code for order tracking
   * @param {string} orderId - Order ID
   * @param {string} trackingUrl - Tracking URL
   * @returns {Promise<Object>} QR code data
   */
  async generateTrackingQRCode(orderId, trackingUrl) {
    try {
      const qrData = {
        orderId: orderId,
        trackingUrl: trackingUrl,
        timestamp: new Date().toISOString(),
        type: 'order_tracking'
      };

      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1
      });

      return {
        qrCodeDataURL: qrCodeDataURL,
        qrData: qrData
      };
    } catch (error) {
      console.error('Tracking QR Code generation error:', error);
      throw new Error('Failed to generate tracking QR code');
    }
  }

  /**
   * Generate QR code for payment
   * @param {string} orderId - Order ID
   * @param {number} amount - Payment amount
   * @param {string} paymentUrl - Payment URL
   * @returns {Promise<Object>} QR code data
   */
  async generatePaymentQRCode(orderId, amount, paymentUrl) {
    try {
      const qrData = {
        orderId: orderId,
        amount: amount,
        paymentUrl: paymentUrl,
        timestamp: new Date().toISOString(),
        type: 'payment'
      };

      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      return {
        qrCodeDataURL: qrCodeDataURL,
        qrData: qrData
      };
    } catch (error) {
      console.error('Payment QR Code generation error:', error);
      throw new Error('Failed to generate payment QR code');
    }
  }
}

export default new QRCodeService(); 
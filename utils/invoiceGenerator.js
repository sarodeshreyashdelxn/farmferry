import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock PDF generation function (will be replaced with actual PDFKit implementation)
export const generateInvoicePDF = async (order, customer, supplier) => {
  try {
    // Create invoices directory if it doesn't exist
    const invoicesDir = path.join(__dirname, '../public/invoices');
    await fs.ensureDir(invoicesDir);

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `invoice-${order.orderId}-${timestamp}.txt`;
    const filepath = path.join(invoicesDir, filename);

    // For now, create a simple text-based invoice
    // This will be replaced with actual PDF generation
    const invoiceContent = generateInvoiceContent(order, customer, supplier);
    
    // Write to file (temporary solution until PDFKit is installed)
    await fs.writeFile(filepath, invoiceContent);

    // Verify file was created
    const fileExists = await fs.pathExists(filepath);
    if (!fileExists) {
      throw new Error('Invoice file was not created successfully');
    }

    console.log('Invoice file created successfully:', {
      filepath,
      filename,
      url: `/invoices/${filename}`
    });

    // Return the relative URL for the invoice
    return `/invoices/${filename}`;
  } catch (error) {
    console.error('Error generating invoice:', error);
    throw new Error('Failed to generate invoice');
  }
};

const generateInvoiceContent = (order, customer, supplier) => {
  const invoiceDate = new Date().toLocaleDateString('en-IN');
  const deliveryDate = order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString('en-IN') : 'N/A';
  
  let content = `
FARM FERRY - INVOICE
===============================================

Invoice Number: ${order.orderId}
Invoice Date: ${invoiceDate}
Delivery Date: ${deliveryDate}

CUSTOMER DETAILS:
-----------------
Name: ${customer.firstName} ${customer.lastName}
Email: ${customer.email}
Phone: ${customer.phone}
Address: ${order.deliveryAddress.street}, ${order.deliveryAddress.city}, ${order.deliveryAddress.state} ${order.deliveryAddress.postalCode}

SUPPLIER DETAILS:
-----------------
Business Name: ${supplier.businessName}
Email: ${supplier.email}
Phone: ${supplier.phone}

ORDER DETAILS:
--------------
Order Status: ${order.status.toUpperCase()}
Payment Method: ${order.paymentMethod.replace(/_/g, ' ').toUpperCase()}
Payment Status: ${order.paymentStatus.toUpperCase()}

ITEMS:
------`;

  // Add items
  order.items.forEach((item, index) => {
    content += `
${index + 1}. ${item.product.name || 'Product'}
   Quantity: ${item.quantity}
   Price: ₹${item.price}
   Discounted Price: ₹${item.discountedPrice}
   Total: ₹${item.totalPrice}`;
    
    if (item.variation) {
      content += `
   Variation: ${item.variation.name}: ${item.variation.value}`;
    }
  });

  content += `

PRICE BREAKDOWN:
----------------
Subtotal: ₹${order.subtotal}
Discount: ₹${order.discountAmount}
GST: ₹${order.gst}
Delivery Charge: ₹${order.deliveryCharge}
===============================================
TOTAL AMOUNT: ₹${order.totalAmount}
===============================================

Payment Terms: ${order.paymentMethod === 'cash_on_delivery' ? 'Cash on Delivery' : 'Prepaid'}
Delivery Address: ${order.deliveryAddress.street}, ${order.deliveryAddress.city}, ${order.deliveryAddress.state} ${order.deliveryAddress.postalCode}

Thank you for choosing Farm Ferry!
For any queries, please contact our support team.

Generated on: ${new Date().toLocaleString('en-IN')}
`;

  return content;
};

// Function to check if invoice should be generated
export const shouldGenerateInvoice = (order) => {
  // Generate invoice for delivered orders
  if (order.status === 'delivered') {
    return true;
  }
  
  // Generate invoice for online payments that are paid
  if (order.paymentMethod !== 'cash_on_delivery' && order.paymentStatus === 'paid') {
    return true;
  }
  
  return false;
};

// Function to get invoice URL
export const getInvoiceUrl = (order) => {
  if (!order.invoiceUrl) {
    return null;
  }
  
  // Return full URL if it's already a complete URL
  if (order.invoiceUrl.startsWith('http')) {
    return order.invoiceUrl;
  }
  
  // Return relative URL
  return order.invoiceUrl;
}; 
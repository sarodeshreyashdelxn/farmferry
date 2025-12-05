# Invoice Generation Feature

## Overview

The invoice generation feature automatically creates invoices for orders that meet specific criteria. Invoices are generated as PDF files and stored in the system for easy access.

## When Invoices Are Generated

Invoices are automatically generated for:

1. **Delivered Orders**: Any order with status "delivered"
2. **Paid Online Payments**: Orders with online payment methods (credit_card, debit_card, upi, bank_transfer) that have payment status "paid"

## Invoice Generation Logic

### Automatic Generation
- Invoices are automatically generated when an order status is updated to "delivered"
- Invoices are automatically generated when an online payment is marked as "paid"

### Manual Generation
- Users can manually generate invoices through the API endpoints
- Invoice generation is available for customers, suppliers, and admins

## API Endpoints

### Generate Invoice
```
POST /api/v1/orders/:orderId/invoice
```

**Authorization**: Customer (order owner), Supplier (order supplier), Admin

**Response**:
```json
{
  "statusCode": 200,
  "data": {
    "invoiceUrl": "/invoices/invoice-ORDER123-2024-01-15T10-30-00-000Z.pdf"
  },
  "message": "Invoice generated successfully"
}
```

### Get Invoice URL
```
GET /api/v1/orders/:orderId/invoice
```

**Authorization**: Customer (order owner), Supplier (order supplier), Admin

**Response**:
```json
{
  "statusCode": 200,
  "data": {
    "invoiceUrl": "/invoices/invoice-ORDER123-2024-01-15T10-30-00-000Z.pdf"
  },
  "message": "Invoice URL retrieved successfully"
}
```

## Invoice Content

The generated invoice includes:

### Header Information
- Invoice number (order ID)
- Invoice date
- Delivery date (if delivered)

### Customer Details
- Full name
- Email address
- Phone number
- Delivery address

### Supplier Details
- Business name
- Email address
- Phone number

### Order Information
- Order status
- Payment method
- Payment status

### Items List
- Product name
- Quantity
- Price per unit
- Discounted price
- Total price per item
- Product variations (if any)

### Price Breakdown
- Subtotal
- Discount amount
- Taxes
- Delivery charge
- **Total amount**

### Additional Information
- Payment terms
- Delivery address
- Generation timestamp

## File Storage

- Invoices are stored in `/public/invoices/` directory
- File naming convention: `invoice-{orderId}-{timestamp}.pdf`
- Files are accessible via HTTP at `/invoices/{filename}`

## Frontend Integration

### Orders Screen
- Invoice button appears for delivered orders
- Button shows loading state during generation
- Success alert with option to view invoice

### Order Details Screen
- "Generate Invoice" button for delivered orders
- Full-width button with loading state
- Success message with invoice URL

## Error Handling

- Invoice generation fails gracefully
- Error messages are logged for debugging
- Users receive appropriate error alerts
- Duplicate invoice generation is prevented

## Security

- Only authorized users can generate/view invoices
- Invoice URLs are validated against user permissions
- File access is restricted to authenticated users

## Testing

Run the test script to verify invoice generation:

```bash
node testInvoiceGeneration.js
```

## Future Enhancements

1. **PDF Generation**: Replace text-based invoices with proper PDF generation using PDFKit
2. **Email Integration**: Automatically email invoices to customers
3. **Invoice Templates**: Customizable invoice templates
4. **Digital Signatures**: Add digital signatures to invoices
5. **Tax Calculations**: Advanced tax calculation based on location
6. **Multi-language Support**: Support for multiple languages
7. **Invoice Numbering**: Sequential invoice numbering system

## Dependencies

- `fs-extra`: File system operations
- `path`: Path manipulation
- `url`: URL utilities

## Installation

The invoice generation feature is included by default. No additional installation required.

## Configuration

No additional configuration is needed. The feature works with the existing order system. 
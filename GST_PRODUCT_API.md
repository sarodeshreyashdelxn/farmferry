# GST Product API Documentation

## Overview
The product API now supports GST (Goods and Services Tax) fields, allowing suppliers to specify GST percentage for each product. GST is stored as a percentage value and can be set during product creation or updated later.

## Database Schema Changes

### Product Model - New GST Field
```javascript
gst: {
  type: Number,
  default: 0,
  min: [0, "GST cannot be negative"],
  max: [100, "GST cannot exceed 100%"]
}
```

## API Endpoints

### 1. Create Product with GST
**Endpoint**: `POST /api/v1/products`

**Request Body**:
```json
{
  "name": "Product Name",
  "description": "Product description",
  "price": 100,
  "gst": 18,                    // GST percentage (0-100)
  "stockQuantity": 50,
  "categoryId": "category_id",
  "unit": "kg",
  "sku": "PRODUCT-SKU-001",
  "barcode": "1234567890123"
}
```

**Response**:
```json
{
  "statusCode": 201,
  "data": {
    "product": {
      "_id": "product_id",
      "name": "Product Name",
      "description": "Product description",
      "price": 100,
      "gst": 18,
      "stockQuantity": 50,
      "categoryId": "category_id",
      "unit": "kg",
      "sku": "PRODUCT-SKU-001",
      "barcode": "1234567890123",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  },
  "message": "Product created successfully"
}
```

### 2. Update Product GST
**Endpoint**: `POST /api/v1/products/:id`

**Request Body**:
```json
{
  "gst": 12,                    // Update GST to 12%
  "price": 120                  // Optionally update other fields
}
```

**Response**:
```json
{
  "statusCode": 200,
  "data": {
    "product": {
      "_id": "product_id",
      "name": "Product Name",
      "price": 120,
      "gst": 12,
      "updatedAt": "2024-01-15T11:00:00.000Z"
    }
  },
  "message": "Product updated successfully"
}
```

## Validation Rules

### GST Validation
1. **Range**: GST must be between 0 and 100 (inclusive)
2. **Type**: Must be a number
3. **Default**: If not provided, defaults to 0
4. **Negative values**: Not allowed
5. **Over 100%**: Not allowed

### Common GST Rates in India
- **0%**: Essential goods, fresh vegetables, etc.
- **5%**: Packaged food items, some medicines
- **12%**: Processed foods, some services
- **18%**: Most goods and services (standard rate)
- **28%**: Luxury items, some specific goods

## Example Usage

### cURL Examples

#### Create Product with GST
```bash
curl -X POST \
  http://localhost:8000/api/v1/products \
  -H 'Authorization: Bearer YOUR_SUPPLIER_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Organic Tomatoes",
    "description": "Fresh organic tomatoes",
    "price": 80,
    "gst": 5,
    "stockQuantity": 100,
    "categoryId": "64f8a1b2c3d4e5f6a7b8c9d0",
    "unit": "kg"
  }'
```

#### Update Product GST
```bash
curl -X POST \
  http://localhost:8000/api/v1/products/64f8a1b2c3d4e5f6a7b8c9d0 \
  -H 'Authorization: Bearer YOUR_SUPPLIER_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "gst": 18
  }'
```

### JavaScript/Axios Examples

#### Create Product with GST
```javascript
const response = await axios.post(
  'http://localhost:8000/api/v1/products',
  {
    name: 'Premium Rice',
    description: 'High-quality basmati rice',
    price: 120,
    gst: 18,
    stockQuantity: 50,
    categoryId: '64f8a1b2c3d4e5f6a7b8c9d0',
    unit: 'kg'
  },
  {
    headers: {
      'Authorization': 'Bearer YOUR_SUPPLIER_JWT_TOKEN',
      'Content-Type': 'application/json'
    }
  }
);
```

#### Update Product GST
```javascript
const response = await axios.post(
  'http://localhost:8000/api/v1/products/64f8a1b2c3d4e5f6a7b8c9d0',
  {
    gst: 12,
    price: 110
  },
  {
    headers: {
      'Authorization': 'Bearer YOUR_SUPPLIER_JWT_TOKEN',
      'Content-Type': 'application/json'
    }
  }
);
```

## Error Responses

### 400 - Bad Request (Invalid GST)
```json
{
  "statusCode": 400,
  "message": "GST cannot be negative"
}
```

```json
{
  "statusCode": 400,
  "message": "GST cannot exceed 100%"
}
```

### 403 - Forbidden
```json
{
  "statusCode": 403,
  "message": "You are not authorized to update this product"
}
```

### 404 - Not Found
```json
{
  "statusCode": 404,
  "message": "Product not found"
}
```

## Testing

Use the provided test script `testGSTProduct.js` to test the GST functionality:

1. Update the test data with your actual supplier token and category ID
2. Run: `node testGSTProduct.js`

The test script includes:
- Basic GST functionality testing
- Validation testing (negative values, over 100%)
- Update functionality testing
- Various GST rate scenarios

## Business Logic Notes

1. **GST Calculation**: The GST field stores the percentage rate. Actual GST amount calculation should be done at the order/invoice level
2. **Price Display**: The base price and GST are stored separately for transparency
3. **Tax Compliance**: Suppliers are responsible for setting correct GST rates according to tax regulations
4. **Default Value**: Products without explicit GST will default to 0%
5. **Update Flexibility**: GST can be updated independently of other product fields

## Integration Considerations

- **Frontend**: Display GST rate alongside product price
- **Order Processing**: Calculate GST amount based on product GST rate and quantity
- **Invoice Generation**: Include GST breakdown in invoices
- **Reporting**: Generate GST reports for tax compliance 
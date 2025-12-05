# Add Offer API Documentation

## Endpoint
`POST /api/v1/products/:id/offer`

## Description
Allows suppliers to add offer percentages to their products. The API calculates the discounted price automatically and updates the product with offer details.

## Authentication
- Requires JWT token with supplier role
- Only the product owner (supplier) can add offers to their products

## Request Parameters

### Path Parameters
- `id` (string, required): Product ID

### Request Body
```json
{
  "offerPercentage": 15,                    // Required: Discount percentage (0-100)
  "offerStartDate": "2024-01-15T00:00:00.000Z",  // Optional: Offer start date
  "offerEndDate": "2024-02-15T23:59:59.000Z"     // Optional: Offer end date
}
```

## Response

### Success Response (200)
```json
{
  "statusCode": 200,
  "data": {
    "product": {
      "_id": "product_id",
      "name": "Product Name",
      "originalPrice": 100,
      "offerPercentage": 15,
      "discountedPrice": 85,
      "offerStartDate": "2024-01-15T00:00:00.000Z",
      "offerEndDate": "2024-02-15T23:59:59.000Z",
      "hasActiveOffer": true
    }
  },
  "message": "Offer added successfully"
}
```

### Error Responses

#### 400 - Bad Request
```json
{
  "statusCode": 400,
  "message": "Offer percentage is required"
}
```

#### 403 - Forbidden
```json
{
  "statusCode": 403,
  "message": "You are not authorized to add offers to this product"
}
```

#### 404 - Not Found
```json
{
  "statusCode": 404,
  "message": "Product not found"
}
```

## Validation Rules

1. **offerPercentage**: Must be between 0 and 100
2. **offerStartDate**: Must be a valid date (if provided)
3. **offerEndDate**: Must be a valid date and after start date (if both provided)
4. **Authorization**: Only the product owner can add offers

## Example Usage

### cURL
```bash
curl -X POST \
  http://localhost:8000/api/v1/products/64f8a1b2c3d4e5f6a7b8c9d0/offer \
  -H 'Authorization: Bearer YOUR_SUPPLIER_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "offerPercentage": 20,
    "offerStartDate": "2024-01-15T00:00:00.000Z",
    "offerEndDate": "2024-02-15T23:59:59.000Z"
  }'
```

### JavaScript/Axios
```javascript
const response = await axios.post(
  'http://localhost:8000/api/v1/products/64f8a1b2c3d4e5f6a7b8c9d0/offer',
  {
    offerPercentage: 15
  },
  {
    headers: {
      'Authorization': 'Bearer YOUR_SUPPLIER_JWT_TOKEN',
      'Content-Type': 'application/json'
    }
  }
);
```

## Database Changes

The following fields are added/updated in the Product model:

- `offerPercentage`: Number (0-100)
- `offerStartDate`: Date
- `offerEndDate`: Date
- `hasActiveOffer`: Boolean (auto-calculated)
- `discountedPrice`: Number (auto-calculated)

## Testing

Use the provided test script `testAddOffer.js` to test the API:

1. Update the test data with your actual supplier token and product ID
2. Run: `node testAddOffer.js`

## Notes

- The discounted price is automatically calculated as: `originalPrice - (originalPrice * offerPercentage / 100)`
- If offer dates are provided, the `hasActiveOffer` field is automatically updated based on current date
- The API rounds the discounted price to 2 decimal places
- Only suppliers can add offers to their own products 
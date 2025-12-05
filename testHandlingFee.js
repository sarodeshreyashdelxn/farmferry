import mongoose from 'mongoose';
import Category from './models/category.model.js';
import Product from './models/product.model.js';

// Connect to MongoDB (update with your connection string)
mongoose.connect('mongodb://localhost:27017/farmferry', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testHandlingFee() {
  try {
    console.log('=== Testing Handling Fee ===');
    
    // Check all categories
    const categories = await Category.find({});
    console.log('\nAll Categories:');
    categories.forEach(cat => {
      console.log(`- ${cat.name}: handlingFee = ${cat.handlingFee}`);
    });
    
    // Check products with categories
    const products = await Product.find({}).populate('categoryId', 'name handlingFee').limit(5);
    console.log('\nSample Products with Categories:');
    products.forEach(product => {
      console.log(`- Product: ${product.name}`);
      console.log(`  Category: ${product.categoryId ? product.categoryId.name : 'No category'}`);
      console.log(`  Handling Fee: ${product.categoryId ? product.categoryId.handlingFee : 'N/A'}`);
    });
    
    // Test specific product
    if (products.length > 0) {
      const testProduct = products[0];
      console.log('\nTesting specific product:');
      console.log(`Product ID: ${testProduct._id}`);
      console.log(`Product Name: ${testProduct.name}`);
      console.log(`Category ID: ${testProduct.categoryId}`);
      
      if (testProduct.categoryId) {
        console.log(`Category Name: ${testProduct.categoryId.name}`);
        console.log(`Handling Fee: ${testProduct.categoryId.handlingFee}`);
        
        // Calculate handling fee
        const handlingFee = testProduct.categoryId.handlingFee * 2; // for 2 quantity
        console.log(`Handling Fee for 2 quantity: ${handlingFee}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

testHandlingFee(); 
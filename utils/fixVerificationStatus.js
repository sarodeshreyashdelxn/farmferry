import mongoose from 'mongoose';
import Supplier from '../models/supplier.model.js';
import dotenv from 'dotenv';

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Function to fix verification status for all suppliers
const fixVerificationStatus = async () => {
  try {
    console.log('🔧 Starting verification status fix...');
    
    // Get all suppliers
    const suppliers = await Supplier.find({});
    console.log(`📊 Found ${suppliers.length} suppliers`);
    
    let updatedCount = 0;
    
    for (const supplier of suppliers) {
      console.log(`\n👤 Processing supplier: ${supplier.businessName} (${supplier._id})`);
      console.log(`   Current status: ${supplier.status}`);
      console.log(`   Documents count: ${supplier.documents?.length || 0}`);
      
      // Check if supplier has documents
      if (supplier.documents && supplier.documents.length > 0) {
        const allDocumentsVerified = supplier.documents.every(doc => doc.isVerified === true);
        const anyDocumentRejected = supplier.documents.some(doc => doc.isVerified === false);
        
        console.log(`   All documents verified: ${allDocumentsVerified}`);
        console.log(`   Any document rejected: ${anyDocumentRejected}`);
        
        // Update status based on document verification
        let newStatus = supplier.status;
        let shouldUpdate = false;
        
        if (allDocumentsVerified && supplier.status !== 'approved') {
          newStatus = 'approved';
          shouldUpdate = true;
          console.log(`   ✅ Will update to: ${newStatus}`);
        } else if (anyDocumentRejected && supplier.status !== 'rejected') {
          newStatus = 'rejected';
          shouldUpdate = true;
          console.log(`   ❌ Will update to: ${newStatus}`);
        } else if (!allDocumentsVerified && !anyDocumentRejected && supplier.status !== 'pending') {
          newStatus = 'pending';
          shouldUpdate = true;
          console.log(`   ⏳ Will update to: ${newStatus}`);
        }
        
        if (shouldUpdate) {
          supplier.status = newStatus;
          if (newStatus === 'approved') {
            supplier.verifiedAt = new Date();
            supplier.verificationNotes = 'Auto-fixed by verification status script';
          }
          await supplier.save();
          updatedCount++;
          console.log(`   ✅ Updated successfully`);
        } else {
          console.log(`   ℹ️  No update needed`);
        }
      } else {
        console.log(`   ℹ️  No documents found, keeping current status`);
      }
    }
    
    console.log(`\n🎉 Fix completed! Updated ${updatedCount} suppliers out of ${suppliers.length}`);
    
  } catch (error) {
    console.error('❌ Error fixing verification status:', error);
  } finally {
    mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Function to manually approve a specific supplier
const approveSupplier = async (supplierId) => {
  try {
    console.log(`🔧 Approving supplier: ${supplierId}`);
    
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      console.log('❌ Supplier not found');
      return;
    }
    
    console.log(`👤 Found supplier: ${supplier.businessName}`);
    console.log(`   Current status: ${supplier.status}`);
    
    // Update status to approved
    supplier.status = 'approved';
    supplier.verifiedAt = new Date();
    supplier.verificationNotes = 'Manually approved by admin';
    
    // Also mark all documents as verified
    if (supplier.documents && supplier.documents.length > 0) {
      supplier.documents.forEach(doc => {
        doc.isVerified = true;
        doc.verifiedAt = new Date();
        doc.verificationNotes = 'Auto-verified with manual approval';
      });
    }
    
    await supplier.save();
    console.log('✅ Supplier approved successfully');
    
  } catch (error) {
    console.error('❌ Error approving supplier:', error);
  } finally {
    mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Function to list all suppliers with their verification status
const listSuppliers = async () => {
  try {
    console.log('📋 Listing all suppliers and their verification status...\n');
    
    const suppliers = await Supplier.find({}).select('businessName email status documents verifiedAt verificationNotes');
    
    suppliers.forEach((supplier, index) => {
      console.log(`${index + 1}. ${supplier.businessName} (${supplier.email})`);
      console.log(`   Status: ${supplier.status}`);
      console.log(`   Documents: ${supplier.documents?.length || 0}`);
      if (supplier.verifiedAt) {
        console.log(`   Verified: ${supplier.verifiedAt.toLocaleDateString()}`);
      }
      if (supplier.verificationNotes) {
        console.log(`   Notes: ${supplier.verificationNotes}`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error listing suppliers:', error);
  } finally {
    mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'fix':
    fixVerificationStatus();
    break;
  case 'approve':
    const supplierId = args[1];
    if (!supplierId) {
      console.log('❌ Please provide supplier ID: node fixVerificationStatus.js approve <supplierId>');
      process.exit(1);
    }
    approveSupplier(supplierId);
    break;
  case 'list':
    listSuppliers();
    break;
  default:
    console.log(`
🔧 Verification Status Fix Utility

Usage:
  node fixVerificationStatus.js <command>

Commands:
  fix     - Fix verification status for all suppliers based on document verification
  approve <supplierId> - Manually approve a specific supplier
  list    - List all suppliers with their verification status

Examples:
  node fixVerificationStatus.js fix
  node fixVerificationStatus.js approve 507f1f77bcf86cd799439011
  node fixVerificationStatus.js list
    `);
    process.exit(0);
} 
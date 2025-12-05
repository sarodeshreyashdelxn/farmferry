import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const superAdminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  avatar: { type: String },
  phone: { type: String },
  location: { type: String },
  company: { type: String },
  lastLogin: { type: Date },
}, { timestamps: true });

superAdminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

superAdminSchema.methods.isPasswordCorrect = async function (password) {
  return bcrypt.compare(password, this.password);
};

superAdminSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { id: this._id, role: 'superadmin' },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '1d' }
  );
};

superAdminSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { id: this._id, role: 'superadmin' },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );
};

const SuperAdmin = mongoose.model('SuperAdmin', superAdminSchema);
export default SuperAdmin; 
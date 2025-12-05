import mongoose from "mongoose";

const excelFileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  fileData: { type: Buffer, required: true },
  contentType: { 
    type: String, 
    default: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
  },
  uploadedAt: { type: Date, default: Date.now }
});

const ExcelFile = mongoose.model("ExcelFile", excelFileSchema);
export default ExcelFile;

import nodemailer from "nodemailer";

const sendEmail = async (options) => {
  // Check if email configuration is available
  if (!process.env.EMAIL_SERVICE || !process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
    console.log("📧 EMAIL CONFIGURATION MISSING - Logging email content instead:");
    console.log("To:", options.to);
    console.log("Subject:", options.subject);
    console.log("Content:", options.html);
    console.log("📧 END EMAIL LOG");
    
    // In development, we'll just log the email instead of sending it
    if (process.env.NODE_ENV === 'development') {
      return Promise.resolve();
    } else {
      throw new Error("Email configuration is missing. Please set up EMAIL_SERVICE, EMAIL_USERNAME, and EMAIL_PASSWORD environment variables.");
    }
  }

  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USERNAME,
    to: options.to,
    subject: options.subject,
    html: options.html,
  };

  await transporter.sendMail(mailOptions);
};

export default sendEmail;
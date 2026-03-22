import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables from the .env file
dotenv.config();

/**
 * Sends a welcome email with temporary credentials to a newly created user.
 */
export async function sendWelcomeEmail(userEmail: string, userName: string, temporaryPassword: string) {
  // Create the transporter INSIDE the function so env vars are guaranteed to be loaded
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true, 
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const loginUrl = `${process.env.FRONTEND_URL}/login`;

  const mailOptions = {
    from: `"Compass Cashroom" <${process.env.SMTP_USER}>`,
    to: userEmail,
    subject: 'CashRoom Login Credentials',
    text: `Hello ${userName},\n\nYour CashRoom account has been created.\n\nLogin details:\nEmail: ${userEmail}\nTemporary Password: ${temporaryPassword}\n\nPlease log in and change your password after first login.\nLogin here: ${loginUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #0d3320;">Welcome to Compass Cashroom</h2>
        <p>Hello <strong>${userName}</strong>,</p>
        <p>Your CashRoom account has been successfully created.</p>
        
        <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; border: 1px solid #bae6fd; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0369a1;">Login Details:</h3>
          <p><strong>Email:</strong> ${userEmail}</p>
          <p><strong>Temporary Password:</strong> <span style="font-family: monospace; font-size: 16px; font-weight: bold; padding: 2px 6px; background: #fff; border-radius: 4px;">${temporaryPassword}</span></p>
        </div>

        <p><em>ℹ️ Please log in and change your password immediately after your first login.</em></p>
        
        <div style="margin-top: 30px;">
          <a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0d3320; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">Log In to CashRoom</a>
        </div>
      </div>
    `,
  };

  try {
    // Verify connection configuration before sending
    await transporter.verify();
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent successfully to ${userEmail}`);
    console.log(`Message ID: ${info.messageId}`);
  } catch (error) {
    console.error(`❌ Failed to send welcome email to ${userEmail}:`, error);
  }
}
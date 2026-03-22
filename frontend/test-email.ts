import dotenv from 'dotenv';
// Load the variables from the .env file FIRST
dotenv.config(); 

import { sendWelcomeEmail } from './src/services/emailService'; 

async function runTest() {
  console.log('Attempting to send test email...');
  // Pass a test email address and name here
  await sendWelcomeEmail('priyer@damcogroup.com', 'Priye Rakshakar');
  console.log('Test complete.');
}

runTest();
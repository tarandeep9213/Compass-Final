import type { Request, Response } from 'express';
import { sendWelcomeEmail } from '../services/emailService';
// import { User } from '../models/User'; // Your DB model

export async function createUser(req: Request, res: Response) {
  try {
    const { name, email, password } = req.body;
    
    // 1. Insert user into the database (with hashed 'demo1234')
    // const newUser = await User.create({ ... });

    // 2. Send the welcome email (do not await if you want a faster API response, 
    //    but awaiting ensures you catch SMTP errors if needed)
    await sendWelcomeEmail(email, name, password);

    // 3. Return success response
    return res.status(201).json({ 
      message: 'User created and email sent successfully',
      // user: newUser 
    });
    
  } catch {
    return res.status(500).json({ error: 'Failed to create user' });
  }
}
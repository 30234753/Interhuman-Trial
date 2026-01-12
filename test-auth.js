// Load environment variables from .env.local
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local file
dotenv.config({ path: join(__dirname, '.env.local') });

// Test authentication
const testAuth = async () => {
  const keyId = process.env.INTERHUMAN_API_KEY_ID;
  const keySecret = process.env.INTERHUMAN_API_KEY_SECRET;
  const apiUrl = process.env.INTERHUMAN_API_URL || 'https://api.interhuman.ai';

  if (!keyId || !keySecret) {
    console.error('❌ Missing environment variables!');
    console.error('Make sure INTERHUMAN_API_KEY_ID and INTERHUMAN_API_KEY_SECRET are set in .env.local');
    return;
  }

  console.log('Testing authentication with:', apiUrl);
  console.log('Key ID:', keyId.substring(0, 8) + '...');

  try {
    const response = await fetch(`${apiUrl}/v0/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key_id: keyId,
        key_secret: keySecret,
        scopes: ['interhumanai.upload'],
      }),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Authentication successful!');
      console.log('Token expires in:', data.expires_in, 'seconds');
      console.log('Scope:', data.scope);
      console.log('Token type:', data.token_type);
    } else {
      console.error('❌ Authentication failed:', data);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
};

testAuth();
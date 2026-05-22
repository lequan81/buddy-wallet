import { s3Client } from './providers/storage';
import { STORAGE_CONFIG } from '@repo/config';

async function test() {
  console.log('STORAGE_CONFIG:', JSON.stringify(STORAGE_CONFIG));
  try {
    const nonexistent = s3Client.file('nonexistent-key-12345');
    console.log('Checking nonexistent file exists...');
    const exists = await nonexistent.exists();
    console.log('Exists result:', exists);
  } catch (err) {
    console.error('Nonexistent error:', err);
  }

  try {
    const nonexistent = s3Client.file('nonexistent-key-12345');
    console.log('Reading nonexistent file buffer...');
    await nonexistent.arrayBuffer();
  } catch (err) {
    console.error('Buffer read error:', err);
  }
}

test();

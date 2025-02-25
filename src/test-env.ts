import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
console.log('Loading environment variables...');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Function to safely log sensitive information
function logSensitiveValue(value: string | undefined, name: string) {
    if (!value) {
        console.log(`${name}: Not set`);
        return;
    }
    console.log(`${name}:`);
    console.log(`  Length: ${value.length}`);
    console.log(`  Prefix: ${value.substring(0, 8)}...`);
    console.log(`  Suffix: ...${value.slice(-4)}`);
}

// Log environment variables
console.log('\nEnvironment Variables:');
console.log('=====================');

// OpenAI Configuration
logSensitiveValue(process.env.OPENAI_API_KEY, 'OPENAI_API_KEY');
console.log('\nOPENAI_PROJECT_ID:', process.env.OPENAI_PROJECT_ID);
console.log('OPENAI_ORG_ID:', process.env.OPENAI_ORG_ID);
console.log('OPENAI_API_BASE_PATH:', process.env.OPENAI_API_BASE_PATH);
console.log('OPENAI_MODEL:', process.env.OPENAI_MODEL);

// Verify API key format
const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) {
    console.error('\nError: OPENAI_API_KEY is not set');
} else if (!apiKey.startsWith('sk-proj-')) {
    console.error('\nError: API key does not start with sk-proj-');
} else {
    console.log('\nAPI key format is valid (starts with sk-proj-)');
}

// Log environment info
console.log('\nEnvironment Info:');
console.log('================');
console.log('Current working directory:', process.cwd());
console.log('NODE_ENV:', process.env.NODE_ENV);

// Exit with appropriate code
if (!apiKey || !apiKey.startsWith('sk-proj-')) {
    process.exit(1);
} 
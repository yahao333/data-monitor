import { chromium } from 'playwright';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

async function loginToVercelAndGetKV() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to Vercel login page...');
    await page.goto('https://vercel.com/login');

    await page.waitForLoadState('networkidle');

    console.log('Please log in to Vercel...');

    await page.waitForSelector('button[type="submit"]', { timeout: 0 });

    console.log('Login successful!');

    console.log('Navigating to KV (Redis) storage...');
    await page.goto('https://vercel.com/dashboard/stores/kv');

    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(2000);

    const envVars = {
      KV_URL: '',
      KV_REST_API_URL: '',
      KV_REST_API_TOKEN: '',
      KV_REST_API_READ_ONLY_TOKEN: ''
    };

    const pageContent = await page.content();
    console.log('Page loaded. Looking for KV configuration...');

    try {
      const kvUrlElement = await page.locator('text=KV_URL').first().locator('xpath=../..').locator('code').first();
      const kvUrl = await kvUrlElement.textContent();
      if (kvUrl) envVars.KV_URL = kvUrl;
    } catch (e) {
      console.log('Could not find KV_URL');
    }

    try {
      const restApiUrl = await page.locator('text=KV_REST_API_URL').first().locator('xpath=../..').locator('code').first().textContent();
      if (restApiUrl) envVars.KV_REST_API_URL = restApiUrl;
    } catch (e) {
      console.log('Could not find KV_REST_API_URL');
    }

    try {
      const restApiToken = await page.locator('text=KV_REST_API_TOKEN').first().locator('xpath=../..').locator('code').first().textContent();
      if (restApiToken) envVars.KV_REST_API_TOKEN = restApiToken;
    } catch (e) {
      console.log('Could not find KV_REST_API_TOKEN');
    }

    try {
      const readOnlyToken = await page.locator('text=KV_REST_API_READ_ONLY_TOKEN').first().locator('xpath=../..').locator('code').first().textContent();
      if (readOnlyToken) envVars.KV_REST_API_READ_ONLY_TOKEN = readOnlyToken;
    } catch (e) {
      console.log('Could not find KV_REST_API_READ_ONLY_TOKEN');
    }

    console.log('\nFound KV configuration:');
    console.log('KV_URL:', envVars.KV_URL || 'Not found');
    console.log('KV_REST_API_URL:', envVars.KV_REST_API_URL || 'Not found');
    console.log('KV_REST_API_TOKEN:', envVars.KV_REST_API_TOKEN ? '***' : 'Not found');
    console.log('KV_REST_API_READ_ONLY_TOKEN:', envVars.KV_REST_API_READ_ONLY_TOKEN ? '***' : 'Not found');

    return envVars;

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    // Keep browser open for manual inspection if needed
    console.log('\nBrowser will remain open for 10 seconds for inspection...');
    await page.waitForTimeout(10000);
    await browser.close();
  }
}

loginToVercelAndGetKV().catch(console.error);

/**
 * Vercel KV 配置获取脚本
 *
 * 使用方法:
 *   bun run vercel-kv           # 使用现有 .env 配置（不登录）
 *   bun run vercel-kv --force   # 强制重新从浏览器获取配置
 *   bun run vercel-kv --env .env.local  # 指定环境文件
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

// 配置常量
const STORAGE_STATE_PATH = path.join(process.cwd(), '.vercel-storage-state.json');
const KV_CONFIG_KEYS = ['KV_URL', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'KV_REST_API_READ_ONLY_TOKEN'];

/**
 * 解析命令行参数
 */
function parseArguments() {
  const args = {
    force: false,
    env: '.env',
    help: false
  };

  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--force' || arg === '-f') {
      args.force = true;
    } else if (arg === '--env' || arg === '-e') {
      args.env = argv[i + 1] || '.env';
      i++;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }

  return args;
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
用法: bun run vercel-kv [选项]

选项:
  -f, --force    强制重新从浏览器获取配置
  -e, --env      指定环境文件路径 (默认: .env)
  -h, --help     显示帮助信息

示例:
  bun run vercel-kv                    # 使用现有配置
  bun run vercel-kv --force            # 强制刷新配置
  bun run vercel-kv --env .env.local   # 使用自定义环境文件
`);
}

/**
 * 从 .env 文件读取配置
 */
function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    console.log(`⚠️ 环境文件不存在: ${envPath}`);
    return null;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const config = {};

  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex);
      const value = trimmed.substring(eqIndex + 1);
      config[key] = value;
    }
  });

  return config;
}

/**
 * 从 .env 获取已保存的 KV 配置
 */
function getSavedKVConfig(envPath) {
  const envConfig = readEnvFile(envPath);
  if (!envConfig) return null;

  const kvConfig = {};
  let hasAnyConfig = false;

  KV_CONFIG_KEYS.forEach(key => {
    if (envConfig[key]) {
      kvConfig[key] = envConfig[key];
      hasAnyConfig = true;
    }
  });

  return hasAnyConfig ? kvConfig : null;
}

/**
 * 保存 KV 配置到 .env 文件
 */
function saveKVConfig(envPath, newConfig) {
  let envConfig = readEnvFile(envPath) || {};

  // 更新配置
  Object.assign(envConfig, newConfig);

  // 生成新的 .env 内容
  const sections = {
    clerk: [],
    vercel: [],
    other: []
  };

  let currentSection = 'other';

  const content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const lines = content.split('\n');

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      if (trimmed.startsWith('#')) {
        if (trimmed.includes('Clerk')) currentSection = 'clerk';
        else if (trimmed.includes('Vercel')) currentSection = 'vercel';
        else currentSection = 'other';
      }
      sections[currentSection].push(line);
    } else {
      sections[currentSection].push(line);
    }
  });

  // 更新 Vercel KV 配置部分
  const kvLines = ['# ============================================', '# Vercel KV (Redis) - 从 Vercel 控制台获取', '# ============================================'];
  if (envConfig.KV_URL) kvLines.push(`KV_URL=${envConfig.KV_URL}`);
  if (envConfig.KV_REST_API_URL) kvLines.push(`KV_REST_API_URL=${envConfig.KV_REST_API_URL}`);
  if (envConfig.KV_REST_API_READ_ONLY_TOKEN) kvLines.push(`KV_REST_API_READ_ONLY_TOKEN=${envConfig.KV_REST_API_READ_ONLY_TOKEN}`);
  if (envConfig.KV_REST_API_TOKEN) kvLines.push(`KV_REST_API_TOKEN=${envConfig.KV_REST_API_TOKEN}`);

  // 重建文件内容
  const newContent = [
    ...sections.clerk.filter(l => !l.includes('Vercel')),
    '',
    ...kvLines,
    ''
  ].join('\n');

  fs.writeFileSync(envPath, newContent.trim() + '\n');
  console.log(`✅ KV 配置已保存到 ${envPath}`);
}

/**
 * 等待用户完成登录
 */
async function waitForLogin(page, timeout = 300000) {
  const startTime = Date.now();
  console.log('\n=== 请在浏览器中完成登录 ===');
  console.log('1. 使用 GitHub 或 Email 登录');
  console.log('2. 登录成功后，浏览器会自动跳转');
  console.log('3. 脚本会自动检测登录状态...\n');

  while (Date.now() - startTime < timeout) {
    const currentUrl = page.url();
    const bodyText = await page.evaluate(() => document.body.textContent || '');

    // 检测登录成功
    if (!currentUrl.includes('/login') &&
        (bodyText.includes('Dashboard') || currentUrl.includes('vercel.com/dashboard'))) {
      console.log('✅ 检测到登录成功!\n');
      return true;
    }

    // 检测 "Something went wrong"
    if (bodyText.includes('Something went wrong')) {
      console.log('⚠️ 检测到登录错误页面');
      await page.waitForTimeout(2000);
    }

    console.log(`⏳ 等待登录中... (${Math.round((timeout - (Date.now() - startTime)) / 1000)}s)`);
    await page.waitForTimeout(3000);
  }

  console.log('❌ 登录超时\n');
  return false;
}

/**
 * 从浏览器获取 KV 配置
 */
async function fetchKVFromBrowser() {
  let browser;
  let page;

  try {
    console.log('🚀 启动浏览器获取 KV 配置...');

    browser = await chromium.launch({
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--exclude-switches=enable-automation',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    const contextOptions = {
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    // 尝试加载保存的登录状态
    if (fs.existsSync(STORAGE_STATE_PATH)) {
      console.log('📂 加载已保存的登录状态...');
      try {
        const storageState = JSON.parse(fs.readFileSync(STORAGE_STATE_PATH, 'utf8'));
        if (storageState.cookies && storageState.cookies.length > 0) {
          contextOptions.storageState = storageState;
          console.log('✅ 已加载登录状态');
        }
      } catch (e) {
        console.log('⚠️ 登录状态无效，将重新登录');
        fs.unlinkSync(STORAGE_STATE_PATH);
      }
    }

    const context = await browser.newContext(contextOptions);
    page = await context.newPage();

    // 反检测脚本
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en-US', 'en'] });
    });

    // 访问 Vercel Dashboard
    console.log('🌐 导航到 Vercel Dashboard...');
    await page.goto('https://vercel.com/dashboard', { timeout: 60000, waitUntil: 'domcontentloaded' });

    // 检查是否需要登录
    const currentUrl = page.url();
    let isLoggedIn = false;

    if (currentUrl.includes('/login')) {
      console.log('🔐 需要登录，正在等待...');
      isLoggedIn = await waitForLogin(page);
    } else {
      const bodyText = await page.evaluate(() => document.body.textContent);
      if (bodyText.includes('Dashboard') || currentUrl.includes('vercel.com/dashboard')) {
        console.log('✅ 已登录\n');
        isLoggedIn = true;
      } else {
        await page.goto('https://vercel.com/login', { timeout: 60000, waitUntil: 'domcontentloaded' });
        isLoggedIn = await waitForLogin(page);
      }
    }

    if (!isLoggedIn) {
      throw new Error('登录失败');
    }

    // 保存登录状态
    console.log('💾 保存登录状态...');
    await page.context().storageState({ path: STORAGE_STATE_PATH });

    // 访问 KV 页面
    console.log('📦 打开 KV Storage 页面...');
    await page.goto('https://vercel.com/dashboard/stores/kv', { timeout: 60000, waitUntil: 'domcontentloaded' });

    // 等待页面基本加载
    await page.waitForTimeout(5000);

    // 尝试等待网络空闲，但设置较短超时
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch (e) {
      console.log('⚠️ 网络未完全空闲，继续执行...');
    }

    // 提取配置信息
    console.log('🔍 查找 KV 配置...');
    const result = await page.evaluate(() => {
      const data = {};
      const text = document.body.textContent;
      const lines = text.split('\n');

      const patterns = [
        { key: 'KV_URL', pattern: /^KV_URL=(.+)$/ },
        { key: 'KV_REST_API_URL', pattern: /^KV_REST_API_URL=(.+)$/ },
        { key: 'KV_REST_API_TOKEN', pattern: /^KV_REST_API_TOKEN=(.+)$/ },
        { key: 'KV_REST_API_READ_ONLY_TOKEN', pattern: /^KV_REST_API_READ_ONLY_TOKEN=(.+)$/ }
      ];

      lines.forEach(line => {
        patterns.forEach(({ key, pattern }) => {
          const match = line.match(pattern);
          if (match) data[key] = match[1].trim();
        });
      });

      return data;
    });

    // 过滤空值
    Object.keys(result).forEach(key => {
      if (!result[key]) delete result[key];
    });

    console.log('\n📋 获取到的配置:');
    Object.keys(result).forEach(key => {
      const value = result[key];
      console.log(`  ${key}: ${value.length > 20 ? value.substring(0, 10) + '...' + value.slice(-10) : value}`);
    });

    return result;

  } finally {
    if (browser) {
      console.log('\n⏳ 浏览器将在 30 秒后关闭...');
      await page?.waitForTimeout(30000);
      await browser.close();
    }
  }
}

/**
 * 主函数
 */
async function main() {
  const args = parseArguments();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const envPath = path.resolve(process.cwd(), args.env);
  const forceRefresh = args.force;

  console.log('═══════════════════════════════════════');
  console.log('   Vercel KV 配置管理脚本');
  console.log('═══════════════════════════════════════');
  console.log(`环境文件: ${envPath}`);
  console.log(`强制刷新: ${forceRefresh ? '是' : '否'}`);
  console.log('═══════════════════════════════════════\n');

  // 如果不强制刷新，尝试使用现有配置
  if (!forceRefresh) {
    const savedConfig = getSavedKVConfig(envPath);
    if (savedConfig) {
      console.log('📄 发现已保存的 KV 配置:\n');
      Object.keys(savedConfig).forEach(key => {
        const value = savedConfig[key];
        console.log(`  ${key}: ${value.length > 30 ? value.substring(0, 12) + '...' + value.slice(-12) : value}`);
      });
      console.log('\n✅ 使用现有配置（如需刷新，使用 --force 参数）\n');
      process.exit(0);
    }
    console.log('⚠️ 未找到现有配置，将从浏览器获取...\n');
  }

  // 从浏览器获取配置
  try {
    const newConfig = await fetchKVFromBrowser();

    if (Object.keys(newConfig).length === 0) {
      console.log('\n❌ 未找到 KV 配置，请确保已创建 KV Store');
      process.exit(1);
    }

    // 保存到 .env
    saveKVConfig(envPath, newConfig);
    console.log('\n✨ 完成！');

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    process.exit(1);
  }
}

main();

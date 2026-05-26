import https from 'https';
import http from 'http';

/**
 * AI Provider Gateway - supports Ollama, OpenAI, and Anthropic
 */

interface AIChatOptions {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Chat with Ollama (local)
 */
async function chatOllama(messages: AIMessage[], options: AIChatOptions): Promise<string> {
  const body = JSON.stringify({
    model: options.model || 'llama3.2',
    messages,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.7,
    },
  });

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 11434,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 60000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.message?.content || 'AI 未返回内容');
        } catch {
          resolve('AI 返回格式异常');
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Ollama request timeout')); });
    req.write(body);
    req.end();
  });
}

/**
 * Chat with OpenAI-compatible API
 */
async function chatOpenAI(messages: AIMessage[], options: AIChatOptions, apiKey: string, baseUrl: string = 'https://api.openai.com'): Promise<string> {
  const body = JSON.stringify({
    model: options.model || 'gpt-4o-mini',
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
  });

  return new Promise((resolve, reject) => {
    const url = new URL('/v1/chat/completions', baseUrl);
    const client = url.protocol === 'https:' ? https : http;

    const reqBody = JSON.stringify({
      model: options.model || 'gpt-4o-mini',
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    });

    const req = client.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(reqBody),
      },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.choices?.[0]?.message?.content || 'AI 未返回内容');
        } catch {
          resolve('AI 返回格式异常');
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('OpenAI request timeout')); });
    req.write(reqBody);
    req.end();
  });
}

/**
 * Chat with Anthropic API
 */
async function chatAnthropic(messages: AIMessage[], options: AIChatOptions, apiKey: string): Promise<string> {
  // Anthropic requires system message separately
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const chatMsgs = messages.filter(m => m.role !== 'system');

  const body = JSON.stringify({
    model: options.model || 'claude-3-haiku-20240307',
    system: systemMsg || 'You are a helpful academic research assistant.',
    messages: chatMsgs,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.content?.[0]?.text || 'AI 未返回内容');
        } catch {
          resolve('AI 返回格式异常');
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Anthropic request timeout')); });
    req.write(body);
    req.end();
  });
}

/**
 * Main chat function - routes to the appropriate provider
 */
export async function chat(messages: AIMessage[], options: AIChatOptions, settings: Record<string, string>): Promise<string> {
  const provider = options.provider || settings['ai.provider'] || 'ollama';
  const model = options.model || settings['ai.model'] || 'llama3.2';

  switch (provider) {
    case 'ollama':
      return chatOllama(messages, { ...options, model });

    case 'openai': {
      const apiKey = settings['ai.openai.apiKey'] || process.env.OPENAI_API_KEY || '';
      const baseUrl = settings['ai.openai.baseUrl'] || 'https://api.openai.com';
      if (!apiKey) return '请先在设置中配置 OpenAI API Key';
      return chatOpenAI(messages, { ...options, model }, apiKey, baseUrl);
    }

    case 'anthropic': {
      const apiKey = settings['ai.anthropic.apiKey'] || process.env.ANTHROPIC_API_KEY || '';
      if (!apiKey) return '请先在设置中配置 Anthropic API Key';
      return chatAnthropic(messages, { ...options, model }, apiKey);
    }

    default:
      return `不支持的 AI 提供商: ${provider}`;
  }
}

/**
 * Summarize paper - use AI to generate summary
 */
export async function summarizePaper(paperId: string, db: any, settings: Record<string, string>): Promise<string> {
  const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId);
  if (!paper) return '未找到论文';

  const abstract = (paper as any).abstract || '';
  const title = (paper as any).title || '';
  const prompt = abstract
    ? `请总结以下论文的核心内容，包括研究背景、方法、主要发现和结论。标题：${title}\n\n摘要：${abstract}`
    : `请总结论文「${title}」的核心内容（暂无摘要数据）`;

  return chat(
    [{ role: 'user', content: prompt }],
    { provider: settings['ai.provider'] || 'ollama', model: settings['ai.model'] || 'llama3.2' },
    settings,
  );
}

/**
 * Extract key findings from paper
 */
export async function extractKeyFindings(paperId: string, db: any, settings: Record<string, string>): Promise<string[]> {
  const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId);
  if (!paper) return [];

  const abstract = (paper as any).abstract || '';
  const title = (paper as any).title || '';
  const prompt = `从以下论文中提取3-5个关键发现，每个发现用一行表示，以"•"开头。标题：${title}\n\n摘要：${abstract || '（无摘要）'}`;

  const response = await chat(
    [{ role: 'user', content: prompt }],
    { provider: settings['ai.provider'] || 'ollama', model: settings['ai.model'] || 'llama3.2' },
    settings,
  );

  return response.split('\n').filter(l => l.trim().startsWith('•') || l.trim().startsWith('-') || l.trim().startsWith('*')).map(l => l.replace(/^[•\-*]\s*/, '').trim());
}

/**
 * Translate abstract to target language
 */
export async function translateAbstract(paperId: string, targetLang: string, db: any, settings: Record<string, string>): Promise<string> {
  const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId);
  if (!paper) return '未找到论文';

  const abstract = (paper as any).abstract || '';
  const title = (paper as any).title || '';
  if (!abstract) return '该论文无摘要数据';

  const langName = targetLang === 'zh' ? '中文' : targetLang === 'en' ? 'English' : targetLang;
  const prompt = `请将以下论文摘要翻译为${langName}，保持学术风格。标题：${title}\n\n摘要：${abstract}`;

  return chat(
    [{ role: 'user', content: prompt }],
    { provider: settings['ai.provider'] || 'ollama', model: settings['ai.model'] || 'llama3.2' },
    settings,
  );
}

require('dotenv').config();

const config = {
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },
  api: {
    externalApiUrl: process.env.EXTERNAL_API_URL,
    externalApiKey: process.env.EXTERNAL_API_KEY,
  },
};

// Validate required environment variables
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'EXTERNAL_API_URL',
];

const missingEnvVars = requiredEnvVars.filter(
  (envVar) => !process.env[envVar]
);

if (missingEnvVars.length > 0 && config.server.nodeEnv === 'production') {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}`
  );
}

module.exports = config;

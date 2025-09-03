# Intraday Bot

A minimal Node.js Express backend application that fetches data from external APIs and sends notifications to Telegram.

## 🚀 Features

- **Express.js Backend**: Clean and minimal API structure
- **Telegram Integration**: Send "Hello from bot" messages
- **External API Integration**: Direct API calls to fetch stock data
- **Error Handling**: Basic error handling and logging
- **Security**: Helmet and CORS protection
- **Logging**: Winston-based structured logging

## 📁 Project Structure

```
intraday-bot/
├── src/
│   ├── config/          # Configuration files
│   │   ├── index.js     # Main configuration
│   │   └── logger.js    # Winston logger configuration
│   ├── services/        # Business logic services
│   │   └── TelegramService.js
│   ├── routes/          # Express routes
│   │   └── index.js     # Main routes (/ and /fetch-stock-data)
│   ├── middleware/      # Custom middleware
│   │   ├── errorHandler.js
│   │   └── notFound.js
│   ├── app.js           # Express app configuration
│   └── server.js        # Server entry point
├── logs/                # Log files
├── package.json
├── .gitignore
├── env.example
└── README.md
```

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd intraday-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file with your actual values:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Telegram Bot Configuration
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   TELEGRAM_CHAT_ID=your_chat_id_here

   # API Configuration
   EXTERNAL_API_URL=https://api.example.com
   EXTERNAL_API_KEY=your_api_key_here

   # Logging
   LOG_LEVEL=info
   ```

4. **Create log directory**
   ```bash
   mkdir -p logs
   ```

## 🚦 Getting Started

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## 📋 API Endpoints

### Main Routes
- `GET /` - Sends "Hello from bot" message to Telegram
- `GET /fetch-stock-data` - Fetches data from external API

### Example API Calls

**Send Telegram message:**
```bash
curl http://localhost:3000/
```

**Fetch stock data:**
```bash
curl http://localhost:3000/fetch-stock-data
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 3000 |
| `NODE_ENV` | Environment mode | No | development |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | Yes | - |
| `TELEGRAM_CHAT_ID` | Default chat ID | Yes | - |
| `EXTERNAL_API_URL` | External API base URL | Yes | - |
| `EXTERNAL_API_KEY` | External API key | No | - |
| `LOG_LEVEL` | Logging level | No | info |
| `ENABLE_CRON_JOBS` | Enable scheduled jobs | No | true |
| `FETCH_INTERVAL` | Cron schedule for data fetching | No | */5 * * * * |

### Telegram Bot Setup

1. **Create a bot:**
   - Message @BotFather on Telegram
   - Use `/newbot` command
   - Follow instructions to get your bot token

2. **Get Chat ID:**
   - Add your bot to a chat or group
   - Send a message to the bot
   - Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Find the chat ID in the response

## 🔄 Scheduled Jobs

The application includes a job scheduler that can run automated tasks:

- **Data Fetch Job**: Fetches data from external API and sends to Telegram (configurable interval)
- **Health Check Job**: Sends system health reports (every 6 hours)
- **Cleanup Job**: Performs maintenance tasks (daily at 2 AM)

Jobs are automatically started when `ENABLE_CRON_JOBS=true` and can be customized in `src/jobs/JobScheduler.js`.

## 📊 Logging

Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- Console (development mode)

Log levels: error, warn, info, http, verbose, debug, silly

## 🧪 Testing

The project includes comprehensive test coverage:

- **Unit Tests**: Test individual functions and modules
- **Integration Tests**: Test API endpoints and services
- **Coverage Reports**: Generated in `coverage/` directory

Test configuration is in `jest.config.js`.

## 🔧 Development

### Adding New Features

1. **Controllers**: Add business logic in `src/controllers/`
2. **Services**: Add external integrations in `src/services/`
3. **Routes**: Define new endpoints in `src/routes/`
4. **Middleware**: Add custom middleware in `src/middleware/`
5. **Jobs**: Add scheduled tasks in `src/jobs/`

### Code Style

- ESLint configuration in `.eslintrc.js`
- Airbnb base style guide
- Automatic formatting and linting

## 🐳 Docker Support (Optional)

Create a `Dockerfile` for containerization:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
EXPOSE 3000
CMD ["npm", "start"]
```

## 📈 Scaling Considerations

The application is designed to be scalable:

- **Horizontal Scaling**: Stateless design allows multiple instances
- **Database Ready**: Easy to add MongoDB, PostgreSQL, or Redis
- **Microservices**: Services can be extracted to separate applications
- **Load Balancing**: Works with load balancers and reverse proxies
- **Monitoring**: Built-in health checks and logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the logs in `logs/` directory
2. Review the health check endpoints
3. Verify environment variables are set correctly
4. Check Telegram bot token and chat ID

## 🔮 Future Enhancements

- Database integration (MongoDB/PostgreSQL)
- User authentication and authorization
- Web dashboard for monitoring
- Advanced trading algorithms
- Multiple chat/channel support
- Rate limiting and quotas
- Metrics and analytics
- Docker and Kubernetes deployment
- CI/CD pipeline configuration

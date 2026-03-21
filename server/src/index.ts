import 'dotenv/config';
import app from './app';
import prisma from './config/database';
import flowExecutorService from './services/flow-executor.service';

const PORT = process.env.PORT || 3001;
const parsedExecutorInterval = Number.parseInt(process.env.FLOW_EXECUTOR_INTERVAL_MS || '5000', 10);
const FLOW_EXECUTOR_INTERVAL_MS = Number.isFinite(parsedExecutorInterval) && parsedExecutorInterval > 0
  ? parsedExecutorInterval
  : 5000;

async function main() {
  try {
    // Test database connection
    await prisma.$connect();
    flowExecutorService.startPoller(FLOW_EXECUTOR_INTERVAL_MS);
    console.log('✅ Connected to database');

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📚 API available at http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  flowExecutorService.stopPoller();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  flowExecutorService.stopPoller();
  await prisma.$disconnect();
  process.exit(0);
});

main();


import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { MongoSanitizePipe } from './common/pipes/mongo-sanitize.pipe';
import { EmailService } from './email/email.service';
import { MemoryMonitorService } from './utils/memory-monitor.service';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  // rawBody: the Stripe webhook signature is computed over the exact bytes sent.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Security middleware
  app.use(helmet());
  app.use(cookieParser());

  // nginx sits in front of this process and sets X-Forwarded-For. Without
  // trusting it, every request looks like it comes from the proxy, so the rate
  // limiter would count the whole internet as one client — one attacker could
  // lock out all the guests at once, and would never hit the login limit alone.
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));

  // Request logging + keep the API out of search indexes.
  // Only the path is logged: query strings carry Stripe session ids, reset
  // tokens and guest email addresses, and these logs are not a safe place for
  // them.
  //
  // Health checks are skipped: the uptime monitor hits /health continuously and
  // one line per probe buried the lines that matter in `docker logs`.
  const requestLogger = new Logger('Request');
  app.use((req, res, next) => {
    const path = req.url.split('?')[0];
    if (path !== '/health' && !path.startsWith('/health/')) {
      requestLogger.log(`${req.method} ${path} - Origin: ${req.headers.origin || 'none'}`);
    }
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });

  // Handle favicon.ico requests to prevent 404 errors
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/favicon.ico', (req: any, res: any) => {
    res.status(204).end();
  });

  // Serve static assets from public/ (logo, review photos, etc.)
  app.useStaticAssets(join(process.cwd(), 'public'));

  // CORS configuration.
  // The localhost origins were allowed in production too, so anything served
  // from a developer's machine — or any page that can get the browser to a
  // localhost origin — was a trusted caller against the live API.
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedOrigins = configuredOrigins.length
    ? configuredOrigins
    : isProduction
      ? ['https://asteriashome.gr', 'https://www.asteriashome.gr']
      : ['http://localhost:3000', 'http://localhost:3001'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });

  // Global pipes
  // Order matters: the sanitizer runs first, so Mongo operators are refused
  // even on handlers whose body or query is untyped and which ValidationPipe
  // therefore cannot whitelist.
  app.useGlobalPipes(
    new MongoSanitizePipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global filters and interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // API prefix (health excluded so it stays at /health for uptime monitors)
  app.setGlobalPrefix('api', { exclude: ['health'] });

  // Swagger documentation — development only
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Asterias Homes API')
      .setDescription('Backend API for Asterias Homes hotel booking system')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Initialize services.
  // The email transporter is built here rather than in the module so a bad SMTP
  // config fails the boot instead of being discovered on the first booking.
  const emailService = app.get(EmailService);
  const memoryMonitorService = app.get(MemoryMonitorService, { strict: false });

  emailService.initializeTransporter();
  await emailService.verifyTransporter();

  // Memory monitoring is a development diagnostic: it samples RSS and reports
  // suspected leaks, and nothing downstream acts on its findings.
  if (process.env.NODE_ENABLE_MEMORY_MONITOR === 'true' || process.env.NODE_ENV === 'development') {
    const thresholdMB = parseInt(process.env.MEMORY_WARNING_THRESHOLD) || 500;
    const checkIntervalMs = parseInt(process.env.MEMORY_CHECK_INTERVAL) || 60000;
    memoryMonitorService?.start(thresholdMB, checkIntervalMs);
  }

  // Scheduled tasks start themselves from OnModuleInit — see
  // ScheduledTasksService. They used to need a startTasks() call from here, and
  // reordering this function silently disabled all five cron jobs.

  const port = process.env.PORT || 5000;
  await app.listen(port, '0.0.0.0');

  logger.log(`Server running on port ${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`Health check: http://0.0.0.0:${port}/health`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`API documentation: http://0.0.0.0:${port}/api/docs`);
  }

  // Graceful shutdown handling
  setupGracefulShutdown(app, memoryMonitorService);
}

function setupGracefulShutdown(app: any, memoryMonitorService?: MemoryMonitorService) {
  const gracefulShutdown = async (signal: string) => {
    logger.log(`${signal} received, shutting down gracefully`);
    try {
      memoryMonitorService?.stop();

      // app.close() runs every OnModuleDestroy, which is what stops the cron
      // jobs and closes the Mongo connection and the Puppeteer browser.
      await app.close();

      logger.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error instanceof Error ? error.stack : error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught errors
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason instanceof Error ? reason.stack : String(reason));
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error.stack);
    gracefulShutdown('uncaughtException');
  });
}

bootstrap();

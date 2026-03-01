import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { EmailService } from './email/email.service';
import { ScheduledTasksService } from './scheduled-tasks/scheduled-tasks.service';
import { MemoryMonitorService } from './utils/memory-monitor.service';
import { KeepAliveService } from './keep-alive/keep-alive.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security middleware
  app.use(helmet());
  app.use(cookieParser());

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`🔍 ${req.method} ${req.url} - Origin: ${req.headers.origin || 'No origin'}`);
    next();
  });

  // CORS configuration
  app.enableCors({
    origin: ['http://localhost:3000', 'https://asteriashome.gr', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global filters and interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Asterias Homes API')
    .setDescription('Backend API for Asterias Homes hotel booking system')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Initialize services
  const emailService = app.get(EmailService);
  const scheduledTasksService = app.get(ScheduledTasksService);
  const memoryMonitorService = app.get(MemoryMonitorService, { strict: false });
  const keepAliveService = app.get(KeepAliveService, { strict: false });

  // Initialize email service
  emailService.initializeTransporter();
  console.log('📧 Email service initialized');

  // Start memory monitoring if enabled
  if (process.env.NODE_ENABLE_MEMORY_MONITOR === 'true' || process.env.NODE_ENV === 'development') {
    const thresholdMB = parseInt(process.env.MEMORY_WARNING_THRESHOLD) || 500;
    const checkIntervalMs = parseInt(process.env.MEMORY_CHECK_INTERVAL) || 60000;
    memoryMonitorService?.start(thresholdMB, checkIntervalMs);
  }

  // Start scheduled tasks
  scheduledTasksService.startTasks();

  // Start keep-alive service in production
  if (process.env.NODE_ENV === 'production') {
    keepAliveService?.startKeepAlive();
    console.log('💓 Keep-alive service started');
  }
  
  const port = process.env.PORT || 5000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Server running on port ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health check: http://0.0.0.0:${port}/health`);
  console.log(`📚 API Documentation: http://0.0.0.0:${port}/api/docs`);

  // Graceful shutdown handling
  setupGracefulShutdown(app, scheduledTasksService, memoryMonitorService, keepAliveService);
}

function setupGracefulShutdown(app: any, scheduledTasksService: ScheduledTasksService, memoryMonitorService?: MemoryMonitorService, keepAliveService?: KeepAliveService) {
  const gracefulShutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down gracefully`);
    try {
      // Stop memory monitoring
      memoryMonitorService?.stop();
      
      // Stop scheduled tasks
      scheduledTasksService.stopTasks();
      
      // Stop keep-alive service
      keepAliveService?.stopKeepAlive();
      
      // Close app
      await app.close();
      
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught errors
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });
}

bootstrap();

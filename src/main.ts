import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppLogger } from './common/config/elk.config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new GlobalExceptionFilter());
  const logger = app.get(AppLogger);
  app.useLogger(logger);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('RAG Platform API')
    .setDescription('')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.listen(process.env.APP_PORT ?? 4000);
  logger.log(
    `Server is running on port http://localhost:${process.env.APP_PORT ?? 4000}`,
  );
  logger.log(
    `Swagger is running on http://localhost:${process.env.APP_PORT ?? 4000}/docs`,
  );
}

void bootstrap();

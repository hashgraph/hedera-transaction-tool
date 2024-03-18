import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Only saves values from the body that are listed in the dtos
      transform: true, // Allows the @Transform validation checks to save the transformed value
    })
  );

  const config = new DocumentBuilder()
    .setTitle("Hedera Transaction Tool Backend API")
    .setDescription(
      "The Backend API module is used for authorization, authentication, pulling and saving transaction data."
    )
    .setVersion("1.0")
    .addServer("http://localhost:8080/", "Local environment")
    // .addServer('https://staging.yourapi.com/', 'Staging')
    // .addServer('https://production.yourapi.com/', 'Production')
    .addTag("what is this for")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api-docs", app, document);

  await app.listen(8080);
}
bootstrap();

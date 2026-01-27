# Agent Guidelines for WhatsApp Bot (Propietas 2025)

## Project Overview

This is a **NestJS TypeScript** WhatsApp bot integrated with Google Gemini AI for the Propietas 2025 real estate platform. The bot provides AI-powered responses, property search, and customer support through WhatsApp integration using the Baileys library.

## Build & Development Commands

### Primary Commands

```bash
# Development
pnpm start:dev          # Start with hot reload (recommended)
pnpm start:debug        # Start with debugger
pnpm start              # Standard start
pnpm start:prod         # Production mode (requires build)

# Build & Deploy
pnpm build              # Compile TypeScript to dist/
pnpm format             # Format code with Prettier
pnpm lint               # Run ESLint with auto-fix

# Testing
pnpm test               # Run unit tests
pnpm test:watch         # Run tests in watch mode
pnpm test:cov           # Run with coverage report
pnpm test:debug         # Debug test runner
pnpm test:e2e           # Run E2E tests
```

### Running Single Tests

```bash
# Run specific test file
pnpm test src/whatsapp/whatsapp.service.spec.ts

# Run tests matching pattern
pnpm test --testNamePattern="should connect"
pnpm test:watch --testPathPattern="whatsapp"

# Debug specific test
pnpm test:debug --testNamePattern="specific test name"
```

### Utility Scripts

```bash
./restart.sh           # Kill port 3000, clean dist, restart dev server
./diagnostics.sh       # Run diagnostic utilities
```

## Code Style Guidelines

### Formatting & Linting

- **Prettier**: Single quotes, trailing commas
- **ESLint**: TypeScript recommended + Prettier integration
- **File naming**: kebab-case for files, PascalCase for classes
- **Run linting**: Always fix with `pnpm lint` before committing

### TypeScript Configuration

```typescript
// Target: ES2021, decorators enabled, strict checks relaxed for flexibility
// Key settings: experimentalDecorators, emitDecoratorMetadata
// Relaxed: strictNullChecks: false, noImplicitAny: false
```

### Import Organization

```typescript
// 1. Node.js/External libraries
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as qrcode from 'qrcode';

// 2. Internal modules (relative paths)
import { WhatsappGateway } from './whatsapp.gateway';
import { BrainService } from '../brain/brain.service';

// 3. Type-only imports last
import type { AuthenticationState } from '@whiskeysockets/baileys';
```

### Naming Conventions

```typescript
// Classes: PascalCase
export class WhatsappService {}
export class SendMessageDto {}

// Properties/Methods: camelCase
private readonly instanceName: string;
async onModuleInit() {}

// Constants: UPPER_SNAKE_CASE
const API_KEY_HEADER = 'x-api-key';

// Files: kebab-case
whatsapp-client.service.ts
send-message.dto.ts
api-key.guard.ts
```

### Type Definitions

```typescript
// Prefer interfaces for object shapes
interface MessageData {
  jid: string;
  text: string;
  timestamp: number;
}

// Use DTOs for API validation
export class SendMessageDto {
  to: string;
  text: string;
}

// Mongoose schemas with proper decorators
@Schema({ timestamps: true, collection: 'chats' })
export class Chat extends Document {
  @Prop({ unique: true, required: true })
  jid: string;
}
```

## Architecture Patterns

### NestJS Module Structure

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forFeature([{ name: Chat.name, schema: ChatSchema }]),
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
```

### Dependency Injection

```typescript
@Injectable()
export class WhatsappService {
  constructor(
    @InjectModel(Chat.name) private readonly chatModel: Model<Chat>,
    private readonly brainService: BrainService,
    private readonly logger = new Logger(WhatsappService.name),
  ) {}
}
```

### Controller Patterns

```typescript
@Controller('whatsapp')
export class WhatsappController {
  @Post('message')
  @UseGuards(ApiKeyGuard)
  async sendMessage(@Body() dto: SendMessageDto) {
    return this.whatsappService.sendMessage(dto);
  }
}
```

## Error Handling

### Service Layer

```typescript
// Use NestJS Logger
private readonly logger = new Logger(ClassName.name);

// Handle errors gracefully
try {
  await this.processMessage(message);
} catch (error) {
  this.logger.error(`Failed to process message: ${error.message}`, error.stack);
  throw new HttpException('Processing failed', HttpStatus.INTERNAL_SERVER_ERROR);
}
```

### Controller Layer

```typescript
// Let NestJS exception filters handle HTTP errors
@Post('endpoint')
async endpoint(@Body() dto: Dto) {
  try {
    return await this.service.process(dto);
  } catch (error) {
    // Log and rethrow - let global filter handle HTTP response
    this.logger.error('Endpoint failed', error);
    throw error;
  }
}
```

### MongoDB Operations

```typescript
// Handle Mongoose errors
try {
  const chat = await this.chatModel.findOne({ jid });
  if (!chat) {
    throw new NotFoundException(`Chat ${jid} not found`);
  }
} catch (error) {
  if (error.name === 'CastError') {
    throw new BadRequestException('Invalid chat ID format');
  }
  throw error;
}
```

## Database Patterns

### Schema Design

```typescript
@Schema({ timestamps: true, collection: 'chats' })
export class Chat extends Document {
  @Prop({ unique: true, required: true, index: true })
  jid: string;

  @Prop({ default: true })
  isBotActive: boolean;

  @Prop({ default: 'BOT', enum: ['BOT', 'HUMAN'] })
  mode: string;
}
```

### Service Operations

```typescript
// Use proper error handling and validation
async updateChatMode(jid: string, mode: 'BOT' | 'HUMAN') {
  const chat = await this.chatModel.findOneAndUpdate(
    { jid },
    { mode, updatedAt: new Date() },
    { new: true, upsert: true }
  );
  return chat;
}
```

## Testing Guidelines

### Unit Test Structure

```typescript
describe('WhatsappService', () => {
  let service: WhatsappService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [WhatsappService],
    }).compile();

    service = module.get<WhatsappService>(WhatsappService);
  });

  it('should connect to WhatsApp', async () => {
    // Arrange
    const expectedStatus = 'connected';

    // Act
    const result = await service.connect();

    // Assert
    expect(result.status).toBe(expectedStatus);
  });
});
```

### E2E Test Patterns

```typescript
describe('WhatsApp (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/whatsapp/status (GET)', () => {
    return request(app.getHttpServer()).get('/whatsapp/status').expect(200);
  });
});
```

## Security Guidelines

### API Security

- All protected endpoints use `@UseGuards(ApiKeyGuard)`
- API key validation through `x-api-key` header
- CORS configured for specific origins only

### Environment Variables

- Store sensitive data in `.env` file
- Use `ConfigService` for accessing environment variables
- Never commit `.env` files

### Data Validation

```typescript
// Use class-validator for DTOs
export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  to: string;

  @IsString()
  @MinLength(1)
  text: string;
}
```

## Performance Guidelines

### Database Optimization

- Use indexes on frequently queried fields
- Implement proper pagination for large datasets
- Use `lean()` for read-only operations

### Memory Management

- Clean up WhatsApp session data periodically
- Use streaming for large file uploads/downloads
- Implement proper connection pooling

## Key Technologies & Integration

### WhatsApp Integration

- **Baileys** 7.0.0-rc.9 for WhatsApp Web API
- QR code generation for authentication
- Media handling (images, documents, audio)
- Session persistence in MongoDB

### AI Integration

- **Google Gemini AI** for intelligent responses
- **LangChain** for AI workflow management
- Custom tools for property search and complaints
- System prompts for context-aware responses

### Real-time Features

- **Socket.IO** for WebSocket communication
- Live chat updates and status notifications
- Real-time QR code updates during authentication

## File Structure Conventions

```
src/
├── app.module.ts           # Root module
├── main.ts                 # Application bootstrap
├── whatsapp/              # WhatsApp functionality
│   ├── controllers/       # REST API endpoints
│   ├── services/          # Business logic
│   ├── schemas/           # MongoDB schemas
│   ├── dto/               # Data transfer objects
│   └── guards/            # Authentication guards
├── brain/                 # AI integration
└── utils/                 # Shared utilities
```

Always follow these patterns to maintain consistency and code quality across the WhatsApp bot codebase.

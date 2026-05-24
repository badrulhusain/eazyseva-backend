# EzySeva — Backend Documentation
> For AI coding agents. NestJS + TypeORM + PostgreSQL (Supabase).

---

## 1. Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| NestJS | 10 | Backend framework |
| TypeScript | 5 | Type safety |
| TypeORM | 0.3 | ORM |
| PostgreSQL | 16 | Database (via Supabase) |
| passport-jwt | 4 | JWT authentication |
| bcrypt | 5 | Password hashing |
| Multer | 1.4 | File upload handling |
| Cloudinary | 2 | File storage |
| Razorpay | 2 | Payment gateway |
| Resend | 3 | Email notifications |
| Groq SDK | 0.7 | AI chat |
| Socket.io | 4 | Real-time WebSocket |
| class-validator | 0.14 | DTO validation |
| class-transformer | 0.5 | DTO transformation |
| helmet | 7 | Security headers |
| @nestjs/throttler | 5 | Rate limiting |

---

## 2. Setup Commands

```bash
nest new ezyseva-backend
cd ezyseva-backend

npm install @nestjs/typeorm typeorm pg
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install @nestjs/platform-socket.io @nestjs/websockets socket.io
npm install @nestjs/throttler
npm install bcrypt @types/bcrypt
npm install class-validator class-transformer
npm install multer @types/multer
npm install cloudinary
npm install razorpay
npm install resend
npm install groq-sdk
npm install helmet
npm install @types/passport-jwt
```

---

## 3. Environment Variables

```env
# .env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# Database (Supabase)
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

# JWT
JWT_SECRET=your-very-long-random-secret-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=another-very-long-random-secret
JWT_REFRESH_EXPIRES_IN=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Resend (email)
RESEND_API_KEY=re_xxxxxxxxxx
RESEND_FROM_EMAIL=EzySeva <noreply@yourdomain.com>

# Groq (AI)
GROQ_API_KEY=gsk_xxxxxxxxxx
```

---

## 4. Folder Structure

```
src/
├── main.ts                        # Bootstrap, helmet, CORS, validation pipe
├── app.module.ts                  # Root module
├── database/
│   └── database.module.ts         # TypeORM config from DATABASE_URL
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── roles.decorator.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── filters/
│   │   └── all-exceptions.filter.ts
│   ├── interceptors/
│   │   └── response.interceptor.ts  # Wraps all responses in { success, data }
│   └── pipes/
│       └── parse-paise.pipe.ts
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts     # register, login, refresh, logout, me
│   │   ├── auth.service.ts
│   │   ├── jwt.strategy.ts
│   │   └── dto/
│   │       ├── register.dto.ts
│   │       └── login.dto.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.service.ts
│   │   └── entities/
│   │       └── user.entity.ts
│   ├── services/
│   │   ├── services.module.ts
│   │   ├── services.controller.ts  # GET /services, GET /services/:slug
│   │   ├── services.service.ts
│   │   ├── services.seed.ts        # Seed all 20 services
│   │   └── entities/
│   │       └── service.entity.ts
│   ├── orders/
│   │   ├── orders.module.ts
│   │   ├── orders.controller.ts
│   │   ├── orders.service.ts
│   │   └── entities/
│   │       ├── order.entity.ts
│   │       ├── order-document.entity.ts
│   │       └── order-status-history.entity.ts
│   ├── uploads/
│   │   ├── uploads.module.ts
│   │   ├── uploads.controller.ts   # POST /orders/:id/documents
│   │   └── uploads.service.ts      # Cloudinary integration
│   ├── payment/
│   │   ├── payment.module.ts
│   │   ├── payment.controller.ts   # create-order, verify, webhook
│   │   └── payment.service.ts      # Razorpay logic
│   ├── notifications/
│   │   ├── notifications.module.ts
│   │   └── notifications.service.ts # Resend emails
│   ├── ai/
│   │   ├── ai.module.ts
│   │   └── ai.controller.ts        # POST /ai/chat (SSE stream)
│   └── gateway/
│       └── events.gateway.ts       # Socket.io WebSocket gateway
└── entities/                       # Re-exports for TypeORM entity list
```

---

## 5. `main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Required for Razorpay webhook signature verification
  });

  app.use(helmet());

  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,         // Allow cookies (refresh token)
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,             // Strip fields not in DTO
    forbidNonWhitelisted: true,  // Throw if unknown fields sent
    transform: true,             // Auto-transform types (string → number)
  }));

  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
```

---

## 6. Database Config

### `database/database.module.ts`
```typescript
import { TypeOrmModule } from '@nestjs/typeorm';

TypeOrmModule.forRoot({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Required for Supabase
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: process.env.NODE_ENV === 'development', // true in dev only
  logging: process.env.NODE_ENV === 'development',
})
```

---

## 7. Entities

### `users/entities/user.entity.ts`
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';

export enum UserRole { USER = 'USER', ADMIN = 'ADMIN' }

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true, transformer: { to: v => v?.toLowerCase(), from: v => v } })
  email: string;

  @Column({ unique: true, length: 15 })
  phone: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'refresh_token_hash', nullable: true })
  refreshTokenHash: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Order, order => order.user)
  orders: Order[];
}
```

### `services/entities/service.entity.ts`
```typescript
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum ServiceCategory {
  ID_CARD = 'ID_CARD', CERTIFICATE = 'CERTIFICATE',
  TRAVEL = 'TRAVEL', FINANCIAL = 'FINANCIAL',
  VEHICLE = 'VEHICLE', PROPERTY = 'PROPERTY',
}

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true, length: 100 })
  slug: string;

  @Column({ type: 'enum', enum: ServiceCategory })
  category: ServiceCategory;

  @Column({ type: 'int' })
  price: number;          // in paise

  @Column({ type: 'int', name: 'govt_fee', default: 0 })
  govtFee: number;

  @Column({ type: 'int', name: 'processing_fee', default: 0 })
  processingFee: number;

  @Column({ type: 'int', name: 'delivery_days_min' })
  deliveryDaysMin: number;

  @Column({ type: 'int', name: 'delivery_days_max' })
  deliveryDaysMax: number;

  @Column({ type: 'jsonb', name: 'required_docs', default: [] })
  requiredDocs: string[];

  @Column({ name: 'is_popular', default: false })
  isPopular: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ length: 10, default: '📋' })
  icon: string;
}
```

### `orders/entities/order.entity.ts`
```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, JoinColumn, Index } from 'typeorm';

export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAYMENT_FAILED  = 'PAYMENT_FAILED',
  DOCS_PENDING    = 'DOCS_PENDING',
  DOCS_VERIFIED   = 'DOCS_VERIFIED',
  PROCESSING      = 'PROCESSING',
  COMPLETED       = 'COMPLETED',
  REJECTED        = 'REJECTED',
  REFUNDED        = 'REFUNDED',
}

@Entity('orders')
@Index(['userId'])
@Index(['status'])
@Index(['orderNumber'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_number', unique: true, length: 20 })
  orderNumber: string;          // ES-XXXXX

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'service_id' })
  serviceId: string;

  @ManyToOne(() => Service, { eager: true })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING_PAYMENT })
  status: OrderStatus;

  @Column({ name: 'applicant_name', length: 100 })
  applicantName: string;

  @Column({ name: 'applicant_phone', length: 15 })
  applicantPhone: string;

  @Column({ name: 'applicant_dob', type: 'date' })
  applicantDob: string;

  @Column({ name: 'applicant_address', type: 'text' })
  applicantAddress: string;

  @Column({ name: 'total_amount', type: 'int' })
  totalAmount: number;          // in paise (snapshot at creation)

  @Column({ name: 'payment_method', nullable: true })
  paymentMethod: string;

  @Column({ name: 'admin_notes', type: 'text', nullable: true })
  adminNotes: string;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ name: 'idempotency_key', unique: true, length: 64 })
  idempotencyKey: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => OrderDocument, doc => doc.order, { cascade: true })
  documents: OrderDocument[];

  @OneToMany(() => OrderStatusHistory, h => h.order, { cascade: true })
  statusHistory: OrderStatusHistory[];
}
```

### `orders/entities/order-document.entity.ts`
```typescript
export enum DocType { PHOTO = 'PHOTO', AADHAAR = 'AADHAAR', ADDRESS_PROOF = 'ADDRESS_PROOF', EXTRA = 'EXTRA' }

@Entity('order_documents')
@Index(['orderId'])
export class OrderDocument {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'order_id' }) orderId: string;
  @ManyToOne(() => Order, order => order.documents) @JoinColumn({ name: 'order_id' }) order: Order;
  @Column({ type: 'enum', enum: DocType, name: 'doc_type' }) docType: DocType;
  @Column({ name: 'file_url', type: 'text' }) fileUrl: string;
  @Column({ name: 'file_key' }) fileKey: string;      // Cloudinary public_id
  @Column({ name: 'original_name' }) originalName: string;
  @Column({ name: 'mime_type', length: 50 }) mimeType: string;
  @Column({ name: 'size_bytes', type: 'int' }) sizeBytes: number;
  @Column({ name: 'is_verified', default: false }) isVerified: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
```

### `orders/entities/order-status-history.entity.ts`
```typescript
@Entity('order_status_history')
@Index(['orderId'])
export class OrderStatusHistory {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'order_id' }) orderId: string;
  @ManyToOne(() => Order, o => o.statusHistory) @JoinColumn({ name: 'order_id' }) order: Order;
  @Column({ name: 'from_status', type: 'enum', enum: OrderStatus, nullable: true }) fromStatus: OrderStatus;
  @Column({ name: 'to_status', type: 'enum', enum: OrderStatus }) toStatus: OrderStatus;
  @Column({ name: 'changed_by', nullable: true }) changedBy: string;  // userId
  @Column({ type: 'text', nullable: true }) note: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
```

### `payment/entities/payment.entity.ts`
```typescript
export enum PaymentStatus { CREATED='CREATED', CAPTURED='CAPTURED', FAILED='FAILED', REFUNDED='REFUNDED' }

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'order_id' }) orderId: string;
  @OneToOne(() => Order) @JoinColumn({ name: 'order_id' }) order: Order;
  @Column({ name: 'razorpay_order_id', unique: true }) razorpayOrderId: string;
  @Column({ name: 'razorpay_payment_id', unique: true, nullable: true }) razorpayPaymentId: string;
  @Column({ type: 'int' }) amount: number;   // paise
  @Column({ default: 'INR' }) currency: string;
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.CREATED }) status: PaymentStatus;
  @Column({ nullable: true }) method: string;
  @Column({ name: 'webhook_verified', default: false }) webhookVerified: boolean;
  @Column({ name: 'raw_webhook', type: 'jsonb', nullable: true }) rawWebhook: any;
  @Column({ name: 'refund_id', nullable: true }) refundId: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
```

---

## 8. Auth Module

### `auth/dto/register.dto.ts`
```typescript
import { IsEmail, IsString, MinLength, Matches, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  @IsString() @IsNotEmpty() @MinLength(3)
  name: string;

  @IsEmail()
  email: string;

  @Matches(/^[6-9]\d{9}$/, { message: 'Enter valid 10-digit Indian mobile number' })
  phone: string;

  @IsString() @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}
```

### `auth/dto/login.dto.ts`
```typescript
export class LoginDto {
  @IsEmail() email: string;
  @IsString() @IsNotEmpty() password: string;
}
```

### `auth/auth.service.ts`
```typescript
async register(dto: RegisterDto) {
  // 1. Check email + phone uniqueness
  const existing = await this.usersService.findByEmail(dto.email);
  if (existing) throw new ConflictException({ code: 'EMAIL_ALREADY_EXISTS' });

  // 2. Hash password
  const passwordHash = await bcrypt.hash(dto.password, 12);

  // 3. Create user
  const user = await this.usersService.create({ ...dto, passwordHash });

  // 4. Generate tokens
  const { accessToken, refreshToken } = await this.generateTokens(user);

  // 5. Hash + save refresh token
  const refreshHash = await bcrypt.hash(refreshToken, 10);
  await this.usersService.updateRefreshToken(user.id, refreshHash);

  // 6. Send welcome email
  await this.notificationsService.sendWelcomeEmail(user);

  return { user: this.sanitizeUser(user), accessToken };
  // refreshToken goes in HttpOnly cookie (set in controller)
}

async login(dto: LoginDto) {
  const user = await this.usersService.findByEmail(dto.email);
  // Use same error for invalid email AND invalid password (prevent enumeration)
  if (!user) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });

  const valid = await bcrypt.compare(dto.password, user.passwordHash);
  if (!valid) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });

  const { accessToken, refreshToken } = await this.generateTokens(user);
  const refreshHash = await bcrypt.hash(refreshToken, 10);
  await this.usersService.updateRefreshToken(user.id, refreshHash);

  return { user: this.sanitizeUser(user), accessToken, refreshToken };
}

private async generateTokens(user: User) {
  const payload = { sub: user.id, email: user.email, role: user.role };
  return {
    accessToken:  this.jwtService.sign(payload, { expiresIn: '15m' }),
    refreshToken: this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET, expiresIn: '7d'
    }),
  };
}

private sanitizeUser(user: User) {
  const { passwordHash, refreshTokenHash, ...safe } = user;
  return safe;
}
```

### `auth/auth.controller.ts`
```typescript
@Post('register')
async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
  const result = await this.authService.register(dto);
  // Set refresh token as HttpOnly cookie
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return result; // { user, accessToken }
}

@Post('refresh')
async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
  const token = req.cookies['refreshToken'];
  if (!token) throw new UnauthorizedException();
  const result = await this.authService.refreshTokens(token);
  res.cookie('refreshToken', result.refreshToken, { httpOnly: true, secure: true });
  return { accessToken: result.accessToken };
}

@Post('logout')
@UseGuards(JwtAuthGuard)
async logout(@CurrentUser() user: User, @Res({ passthrough: true }) res: Response) {
  await this.authService.logout(user.id);
  res.clearCookie('refreshToken');
  return { message: 'Logged out' };
}

@Get('me')
@UseGuards(JwtAuthGuard)
getMe(@CurrentUser() user: User) {
  return user;
}
```

---

## 9. Services Module

### `services/services.controller.ts`
```typescript
@Controller('services')
export class ServicesController {
  @Get()
  findAll(@Query('category') category?: ServiceCategory) {
    return this.servicesService.findAll(category);
    // Returns only is_active=true services
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.servicesService.findBySlug(slug);
  }
}
```

### `services/services.service.ts`
```typescript
async findAll(category?: ServiceCategory): Promise<Service[]> {
  const where: FindOptionsWhere<Service> = { isActive: true };
  if (category) where.category = category;
  return this.servicesRepo.find({ where, order: { isPopular: 'DESC', name: 'ASC' } });
}
```

---

## 10. Orders Module

### `orders/orders.controller.ts`
```typescript
@Controller('orders')
export class OrdersController {
  // Create order — step 1 form data
  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: User,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey) throw new BadRequestException('Idempotency-Key header required');
    return this.ordersService.create(dto, user.id, idempotencyKey);
  }

  // Get current user's orders
  @Get('my')
  @UseGuards(JwtAuthGuard)
  getMyOrders(@CurrentUser() user: User) {
    return this.ordersService.findByUserId(user.id);
  }

  // Get single order (ownership check inside service)
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ordersService.findOne(id, user.id);
  }
}

// Public tracking endpoint (separate controller or same)
@Controller('track')
export class TrackController {
  @Get(':orderNumber')
  track(@Param('orderNumber') orderNumber: string) {
    return this.ordersService.trackByOrderNumber(orderNumber);
    // Returns LIMITED fields: no payment info, no doc URLs, no admin notes
  }
}
```

### `orders/orders.service.ts`
```typescript
async create(dto: CreateOrderDto, userId: string, idempotencyKey: string) {
  // 1. Idempotency check
  const existing = await this.ordersRepo.findOne({ where: { idempotencyKey } });
  if (existing) return existing;  // Return same order on retry

  // 2. Validate service exists and is active
  const service = await this.servicesRepo.findOne({ where: { id: dto.serviceId, isActive: true } });
  if (!service) throw new NotFoundException({ code: 'SERVICE_NOT_FOUND' });

  // 3. Generate order number
  const orderNumber = await this.generateOrderNumber(); // ES-XXXXX

  // 4. Calculate total (snapshot current price)
  const totalAmount = service.price + service.govtFee + service.processingFee;

  // 5. Create order in DB
  const order = this.ordersRepo.create({
    orderNumber, userId, serviceId: dto.serviceId,
    applicantName: dto.applicantName, applicantPhone: dto.applicantPhone,
    applicantDob: dto.applicantDob, applicantAddress: dto.applicantAddress,
    totalAmount, idempotencyKey,
    status: OrderStatus.PENDING_PAYMENT,
  });
  const saved = await this.ordersRepo.save(order);

  // 6. Insert first history entry
  await this.insertHistory(saved.id, null, OrderStatus.PENDING_PAYMENT, 'system', 'Order created');

  return saved;
}

async updateStatus(orderId: string, newStatus: OrderStatus, adminId: string, note?: string, rejectionReason?: string) {
  const order = await this.ordersRepo.findOneOrFail({ where: { id: orderId } });

  // Validate transition
  const VALID_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
    [OrderStatus.DOCS_PENDING]:  [OrderStatus.DOCS_VERIFIED, OrderStatus.REJECTED],
    [OrderStatus.DOCS_VERIFIED]: [OrderStatus.PROCESSING, OrderStatus.REJECTED],
    [OrderStatus.PROCESSING]:    [OrderStatus.COMPLETED, OrderStatus.REJECTED],
  };
  const allowed = VALID_TRANSITIONS[order.status] || [];
  if (!allowed.includes(newStatus))
    throw new BadRequestException({ code: 'INVALID_STATUS_TRANSITION' });

  // Update + history in a transaction
  await this.dataSource.transaction(async (manager) => {
    await manager.update(Order, orderId, {
      status: newStatus,
      ...(rejectionReason && { rejectionReason }),
    });
    await manager.save(OrderStatusHistory, {
      orderId, fromStatus: order.status, toStatus: newStatus,
      changedBy: adminId, note: note || '',
    });
  });

  // Emit WebSocket event
  this.eventsGateway.emitOrderUpdate(order.orderNumber, newStatus);

  // Send notification (non-blocking)
  this.notificationsService.sendStatusUpdateEmail(order, newStatus).catch(console.error);
}

async trackByOrderNumber(orderNumber: string) {
  const order = await this.ordersRepo.findOne({
    where: { orderNumber },
    relations: ['service', 'statusHistory'],
    select: {
      orderNumber: true, status: true, createdAt: true, updatedAt: true,
      service: { name: true },
      statusHistory: { toStatus: true, note: true, createdAt: true },
    },
  });
  if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND' });
  return order;
}

private async generateOrderNumber(): Promise<string> {
  let num: string;
  let exists = true;
  while (exists) {
    num = `ES-${Math.floor(10000 + Math.random() * 90000)}`;
    exists = !!(await this.ordersRepo.findOne({ where: { orderNumber: num } }));
  }
  return num;
}

private async insertHistory(orderId: string, from: OrderStatus | null, to: OrderStatus, changedBy: string, note: string) {
  await this.historyRepo.save({ orderId, fromStatus: from, toStatus: to, changedBy, note });
}
```

### `orders/dto/create-order.dto.ts`
```typescript
export class CreateOrderDto {
  @IsUUID() serviceId: string;
  @IsString() @MinLength(3) applicantName: string;
  @Matches(/^[6-9]\d{9}$/) applicantPhone: string;
  @IsDateString() applicantDob: string;
  @IsString() @MinLength(10) applicantAddress: string;
}
```

---

## 11. Uploads Module

### `uploads/uploads.service.ts`
```typescript
import { v2 as cloudinary } from 'cloudinary';
import * as FileType from 'file-type';

@Injectable()
export class UploadsService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadOrderDocument(
    orderId: string,
    file: Express.Multer.File,
    docType: DocType,
  ) {
    // 1. Validate file type by content (not extension)
    const type = await FileType.fromBuffer(file.buffer);
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!type || !allowed.includes(type.mime))
      throw new BadRequestException({ code: 'INVALID_FILE_TYPE' });

    // 2. Validate size (5MB max)
    if (file.size > 5 * 1024 * 1024)
      throw new BadRequestException({ code: 'DOCUMENT_TOO_LARGE' });

    // 3. Upload to Cloudinary
    const result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: `ezyseva/orders/${orderId}`,
          public_id: `${docType.toLowerCase()}_${Date.now()}`,
          resource_type: 'auto',
        },
        (error, result) => error ? reject(error) : resolve(result)
      ).end(file.buffer);
    });

    // 4. Save to DB
    return this.documentsRepo.save({
      orderId, docType,
      fileUrl: result.secure_url,
      fileKey: result.public_id,
      originalName: file.originalname,
      mimeType: type.mime,
      sizeBytes: file.size,
    });
  }
}
```

### `uploads/uploads.controller.ts`
```typescript
@Post('orders/:id/documents')
@UseGuards(JwtAuthGuard)
@UseInterceptors(FileInterceptor('file', {
  storage: memoryStorage(),   // buffer, not disk
  limits: { fileSize: 6 * 1024 * 1024 },  // 6MB Multer limit (we do 5MB check in service)
}))
async upload(
  @Param('id') orderId: string,
  @UploadedFile() file: Express.Multer.File,
  @Body('docType') docType: DocType,
  @CurrentUser() user: User,
) {
  // Verify order belongs to user
  const order = await this.ordersService.findOne(orderId, user.id);
  return this.uploadsService.uploadOrderDocument(order.id, file, docType);
}
```

---

## 12. Payment Module

### `payment/payment.service.ts`
```typescript
import Razorpay from 'razorpay';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {
  private razorpay: Razorpay;

  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  async createOrder(orderId: string, userId: string) {
    const order = await this.ordersService.findOne(orderId, userId);

    // Prevent double payment
    if (order.status !== OrderStatus.PENDING_PAYMENT)
      throw new BadRequestException({ code: 'ORDER_ALREADY_PAID' });

    const rzpOrder = await this.razorpay.orders.create({
      amount: order.totalAmount,  // already in paise
      currency: 'INR',
      receipt: order.orderNumber,
    });

    // Save payment record
    await this.paymentsRepo.save({
      orderId, razorpayOrderId: rzpOrder.id,
      amount: order.totalAmount, currency: 'INR',
      status: PaymentStatus.CREATED,
    });

    return {
      razorpayOrderId: rzpOrder.id,
      amount: order.totalAmount,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    // 1. Verify signature
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (expected !== signature)
      throw new UnauthorizedException('Invalid webhook signature');

    const event = JSON.parse(rawBody.toString());

    // 2. Idempotency: check if already processed
    const razorpayPaymentId = event.payload?.payment?.entity?.id;
    if (razorpayPaymentId) {
      const existing = await this.paymentsRepo.findOne({
        where: { razorpayPaymentId }
      });
      if (existing?.status === PaymentStatus.CAPTURED)
        return { received: true }; // Already processed
    }

    // 3. Handle events
    if (event.event === 'payment.captured') {
      await this.processSuccess(event.payload.payment.entity);
    } else if (event.event === 'payment.failed') {
      await this.processFailed(event.payload.payment.entity);
    }

    return { received: true };
  }

  private async processSuccess(payment: any) {
    await this.dataSource.transaction(async (manager) => {
      // Update payment record
      await manager.update(Payment, { razorpayOrderId: payment.order_id }, {
        razorpayPaymentId: payment.id,
        status: PaymentStatus.CAPTURED,
        method: payment.method,
        webhookVerified: true,
      });

      // Update order status
      const pay = await manager.findOne(Payment, { where: { razorpayOrderId: payment.order_id } });
      await manager.update(Order, pay.orderId, { status: OrderStatus.DOCS_PENDING });

      // History
      const order = await manager.findOne(Order, { where: { id: pay.orderId } });
      await manager.save(OrderStatusHistory, {
        orderId: pay.orderId,
        fromStatus: OrderStatus.PENDING_PAYMENT,
        toStatus: OrderStatus.DOCS_PENDING,
        changedBy: 'system',
        note: `Payment captured via ${payment.method}`,
      });
    });

    // Notifications (outside transaction)
    const order = await this.ordersRepo.findOne({ where: { /* ... */ }, relations: ['user'] });
    await this.notificationsService.sendOrderConfirmationEmail(order);
  }
}
```

### `payment/payment.controller.ts`
```typescript
@Post('payment/create-order')
@UseGuards(JwtAuthGuard)
createOrder(@Body('orderId') orderId: string, @CurrentUser() user: User) {
  return this.paymentService.createOrder(orderId, user.id);
}

@Post('payment/webhook')
webhook(
  @RawBody() rawBody: Buffer,
  @Headers('x-razorpay-signature') signature: string,
) {
  return this.paymentService.handleWebhook(rawBody, signature);
}
```

---

## 13. Notifications Module

### `notifications/notifications.service.ts`
```typescript
import { Resend } from 'resend';

@Injectable()
export class NotificationsService {
  private resend = new Resend(process.env.RESEND_API_KEY);

  async sendOrderConfirmationEmail(order: Order) {
    await this.resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: order.user.email,
      subject: `Order Confirmed — ${order.orderNumber}`,
      html: this.buildConfirmationTemplate(order),
    });
  }

  async sendStatusUpdateEmail(order: Order, newStatus: OrderStatus) {
    const messages: Partial<Record<OrderStatus, string>> = {
      [OrderStatus.DOCS_VERIFIED]: 'Your documents have been verified. Processing started.',
      [OrderStatus.PROCESSING]:    'Your application is being processed.',
      [OrderStatus.COMPLETED]:     'Your application is complete.',
      [OrderStatus.REJECTED]:      `Your application was rejected. Reason: ${order.rejectionReason}`,
    };
    const message = messages[newStatus];
    if (!message) return; // Don't send for all status changes

    await this.resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: order.user.email,
      subject: `Update on Order ${order.orderNumber}`,
      html: `<p>${message}</p><p>Order: <strong>${order.orderNumber}</strong></p>`,
    });
  }

  private buildConfirmationTemplate(order: Order): string {
    return `
      <h2>Order Confirmed! ✅</h2>
      <p>Hi ${order.applicantName},</p>
      <p>Your order for <strong>${order.service.name}</strong> has been placed.</p>
      <p>Order Number: <strong>${order.orderNumber}</strong></p>
      <p>Expected delivery: ${order.service.deliveryDaysMin}–${order.service.deliveryDaysMax} working days</p>
      <p>Track your order at: https://ezyseva.com/track</p>
    `;
  }
}
```

---

## 14. AI Module

### `ai/ai.controller.ts`
```typescript
import Groq from 'groq-sdk';

@Controller('ai')
export class AiController {
  private groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  @Post('chat')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  async chat(@Body() body: { message: string; history?: any[] }, @Res() res: Response) {
    const messages = [
      { role: 'system', content: EZYSEVA_SYSTEM_PROMPT },
      ...(body.history?.slice(-6) || []),  // Last 6 messages for context
      { role: 'user', content: body.message },
    ];

    const stream = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      stream: true,
      max_tokens: 500,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

const EZYSEVA_SYSTEM_PROMPT = `
You are EzySeva AI, a helpful assistant for a government services platform in India.

SERVICES:
- PAN Card (New): ₹299, 5–7 working days
- PAN Card (Correction): ₹249, 3–5 working days
- Voter ID (New): ₹199, 15–20 working days
- Voter ID (Correction): ₹149, 10–15 working days
- Aadhaar Card Update: ₹99, 7–10 working days
- Ration Card (New): ₹349, 20–30 working days
- Birth Certificate: ₹199, 7–10 working days
- Death Certificate: ₹199, 7–10 working days
- Income Certificate: ₹249, 5–7 working days
- Caste Certificate: ₹249, 7–10 working days
- Passport Assistance: ₹499, 30–45 working days
- Driving License: ₹399, 15–20 working days

RULES:
1. Only answer questions about EzySeva services and government documents
2. When user wants to apply for a service, end your reply with a JSON block:
   {"action":"open_order","service":"PAN Card (New)","price":29900}
3. When user wants to track an order:
   {"action":"scroll_to_track"}
4. Always mention price and delivery time
5. Be friendly, concise, and use simple language
6. Accept Hindi questions — respond in the same language
7. Do not make up prices or services not listed above
`;
```

---

## 15. WebSocket Gateway

### `gateway/events.gateway.ts`
```typescript
import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
})
export class EventsGateway {
  @WebSocketServer() server: Server;

  @SubscribeMessage('track-order')
  handleTrack(@MessageBody() data: { orderNumber: string }, @ConnectedSocket() client: Socket) {
    client.join(`order-${data.orderNumber}`);
  }

  emitOrderUpdate(orderNumber: string, status: string) {
    this.server.to(`order-${orderNumber}`).emit('status-update', {
      status,
      updatedAt: new Date().toISOString(),
    });
  }
}
```

---

## 16. Global Exception Filter

### `common/filters/all-exceptions.filter.ts`
```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as any;
      return res.status(status).json({
        success: false,
        error: {
          code: body?.code || body?.message || 'ERROR',
          message: body?.message || exception.message,
          field: body?.field,
        },
      });
    }

    // PostgreSQL unique violation
    if (exception instanceof QueryFailedError) {
      if ((exception as any).code === '23505') {
        return res.status(409).json({
          success: false,
          error: { code: 'DUPLICATE_ENTRY', message: 'This record already exists.' },
        });
      }
    }

    // Unknown errors — log fully, return generic
    this.logger.error('Unhandled exception', exception);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
    });
  }
}
```

---

## 17. Rate Limiting

```typescript
// app.module.ts — throttler config
ThrottlerModule.forRoot([
  { name: 'default',  ttl: 60000,  limit: 60  },  // 60 req/min globally
  { name: 'auth',     ttl: 900000, limit: 10  },  // 10 req/15 min for auth routes
  { name: 'ai',       ttl: 60000,  limit: 30  },  // 30 req/min for AI chat
  { name: 'payment',  ttl: 60000,  limit: 5   },  // 5 req/min for payment
]),

// On controller:
@Throttle({ auth: { ttl: 900000, limit: 10 } })
@Post('auth/login')
login() { ... }
```

---

## 18. Services Seed Data

```typescript
// services/services.seed.ts — run once on startup in development
export const SERVICES_SEED = [
  { name: 'PAN Card (New)',        slug: 'pan-card-new',        category: 'ID_CARD',     price: 29900, govtFee: 10700, processingFee: 1800, deliveryDaysMin: 5,  deliveryDaysMax: 7,  isPopular: true,  icon: '🪪' },
  { name: 'PAN Card (Correction)', slug: 'pan-card-correction', category: 'ID_CARD',     price: 24900, govtFee: 10700, processingFee: 1800, deliveryDaysMin: 3,  deliveryDaysMax: 5,  isPopular: false, icon: '✏️' },
  { name: 'Voter ID (New)',        slug: 'voter-id-new',        category: 'ID_CARD',     price: 19900, govtFee: 0,     processingFee: 1800, deliveryDaysMin: 15, deliveryDaysMax: 20, isPopular: true,  icon: '🗳️' },
  { name: 'Voter ID (Correction)', slug: 'voter-id-correction', category: 'ID_CARD',     price: 14900, govtFee: 0,     processingFee: 1800, deliveryDaysMin: 10, deliveryDaysMax: 15, isPopular: false, icon: '🔄' },
  { name: 'Aadhaar Card (Update)', slug: 'aadhaar-update',      category: 'ID_CARD',     price: 9900,  govtFee: 5000,  processingFee: 1800, deliveryDaysMin: 7,  deliveryDaysMax: 10, isPopular: false, icon: '🆔' },
  { name: 'Ration Card (New)',     slug: 'ration-card-new',     category: 'ID_CARD',     price: 34900, govtFee: 0,     processingFee: 1800, deliveryDaysMin: 20, deliveryDaysMax: 30, isPopular: false, icon: '🌾' },
  { name: 'Birth Certificate',     slug: 'birth-certificate',   category: 'CERTIFICATE', price: 19900, govtFee: 5000,  processingFee: 1800, deliveryDaysMin: 7,  deliveryDaysMax: 10, isPopular: false, icon: '👶' },
  { name: 'Death Certificate',     slug: 'death-certificate',   category: 'CERTIFICATE', price: 19900, govtFee: 5000,  processingFee: 1800, deliveryDaysMin: 7,  deliveryDaysMax: 10, isPopular: false, icon: '📄' },
  { name: 'Income Certificate',    slug: 'income-certificate',  category: 'CERTIFICATE', price: 24900, govtFee: 0,     processingFee: 1800, deliveryDaysMin: 5,  deliveryDaysMax: 7,  isPopular: false, icon: '💰' },
  { name: 'Caste Certificate',     slug: 'caste-certificate',   category: 'CERTIFICATE', price: 24900, govtFee: 0,     processingFee: 1800, deliveryDaysMin: 7,  deliveryDaysMax: 10, isPopular: false, icon: '📜' },
  { name: 'Passport (Assistance)', slug: 'passport-assistance', category: 'TRAVEL',      price: 49900, govtFee: 150000,processingFee: 1800, deliveryDaysMin: 30, deliveryDaysMax: 45, isPopular: true,  icon: '✈️' },
  { name: 'Driving License',       slug: 'driving-license',     category: 'VEHICLE',     price: 39900, govtFee: 20000, processingFee: 1800, deliveryDaysMin: 15, deliveryDaysMax: 20, isPopular: false, icon: '🚗' },
  { name: 'Vehicle RC Update',     slug: 'vehicle-rc-update',   category: 'VEHICLE',     price: 29900, govtFee: 10000, processingFee: 1800, deliveryDaysMin: 10, deliveryDaysMax: 15, isPopular: false, icon: '🚙' },
];
```

---

## 19. Build & Run

```bash
# Development
npm run start:dev       # http://localhost:3000

# Production build
npm run build
npm run start:prod

# Deploy to Render
# 1. Push to GitHub
# 2. Connect repo in render.com
# 3. Build command: npm run build
# 4. Start command: npm run start:prod
# 5. Add all .env vars in Render dashboard
# 6. Set up cron-job.org to ping /api/v1/health every 10 min (prevent spin-down)

# Add health check endpoint
@Get('health')
health() { return { status: 'ok', timestamp: new Date() }; }
```

---

## 20. Error Codes Reference

| Code | HTTP | When |
|------|------|------|
| `INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `EMAIL_ALREADY_EXISTS` | 409 | Register with existing email |
| `PHONE_ALREADY_EXISTS` | 409 | Register with existing phone |
| `SESSION_EXPIRED` | 401 | JWT expired, refresh failed |
| `SERVICE_NOT_FOUND` | 404 | Service id invalid or inactive |
| `ORDER_NOT_FOUND` | 404 | Order id/number not found |
| `ORDER_NOT_YOURS` | 403 | User accessing another user's order |
| `ORDER_ALREADY_PAID` | 400 | Trying to pay for paid order |
| `INVALID_STATUS_TRANSITION` | 400 | Invalid admin status change |
| `INVALID_FILE_TYPE` | 400 | File not JPG/PNG/PDF |
| `DOCUMENT_TOO_LARGE` | 400 | File over 5MB |
| `PAYMENT_FAILED` | 400 | Razorpay payment failed |
| `DUPLICATE_ENTRY` | 409 | DB unique constraint violation |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
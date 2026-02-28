# CODING STANDARDS ENFORCEMENT — Production-Grade Clean Code

**Directive:** The agent MUST follow these standards for all code generation. Code that violates these rules MUST be rejected, refactored, and resubmitted. No exceptions. The goal: any senior developer reads this code and cannot tell an AI wrote it.

---

## AUTHORITY SOURCES

These standards are derived from the world's most respected coding authorities:

| Authority | Contribution | Reference |
|---|---|---|
| **Robert C. Martin ("Uncle Bob")** | Clean Code, SOLID, file/function size limits | _Clean Code_ (2008), _Clean Architecture_ (2017) |
| **Martin Fowler** | Refactoring, enterprise patterns, code smells | _Refactoring_ (2018), _Patterns of Enterprise Application Architecture_ |
| **Google Java Style Guide** | Line limits, naming, formatting | https://google.github.io/styleguide/javaguide.html |
| **AOSP (Android) Code Style** | Method length limits, Android patterns | https://source.android.com/docs/setup/contribute/code-style |
| **Kamil Myśliwiec** | NestJS architecture, module patterns | https://docs.nestjs.com, NestJS Official Courses |
| **Next.js / Vercel Team** | App Router conventions, React Server Components | https://nextjs.org/docs |
| **Spring Boot Team** | Layered architecture, controller patterns | https://docs.spring.io/spring-boot/reference/ |
| **Effective Dart Guide** | Flutter/Dart coding standards | https://dart.dev/effective-dart |
| **Kotlin Style Guide (JetBrains)** | Android/Kotlin conventions | https://kotlinlang.org/docs/coding-conventions.html |
| **Baeldung** | Java/Spring best practices and tutorials | https://www.baeldung.com |

---

## UNIVERSAL RULES (All Languages, All Frameworks)

### File Size Limits (100% STRICT)

| Component Type | Max LOC | Source Authority |
|---|---|---|
| **Controller / Route Handler** | **80 lines** | Uncle Bob: Controllers only route. Zero business logic. |
| **Service / Use Case** | **200 lines** | Uncle Bob: ~200 lines typical, 500 absolute max |
| **Repository / Data Access** | **150 lines** | Fowler: Single responsibility for data |
| **DTO / Request / Response** | **50 lines** | Pure data structures, no logic |
| **Entity / Model** | **100 lines** | Domain object with minimal behavior |
| **Utility / Helper** | **80 lines** | Each utility does ONE thing |
| **React Component (UI)** | **150 lines** | Extractable if over 150 |
| **Custom Hook** | **80 lines** | Single concern per hook |
| **Config / Module** | **60 lines** | Wiring only, no logic |
| **Test File** | **300 lines** | Can be longer, but group by describe blocks |
| **Any file (absolute max)** | **500 lines** | Uncle Bob hard ceiling. No exceptions. |

### Function / Method Size Limits

| Rule | Limit | Authority |
|---|---|---|
| Function body | **Max 20 lines** (ideal: 5-10) | Uncle Bob: "Functions should be small. Then they should be smaller." |
| Function parameters | **Max 3 parameters** (ideal: 0-2) | Uncle Bob: More than 3 = create an object |
| Nesting depth | **Max 2 levels of indentation** | Google Style: Flatten with early returns and extraction |
| Cyclomatic complexity | **Max 10 per function** | Industry standard. Over 10 = too many branches |
| Line length | **Max 100 characters** (soft: 80) | Google Java Style Guide |

### Naming Conventions (100% STRICT)

```
UNIVERSAL NAMING RULES:
══════════════════════

1. Names must REVEAL INTENT. If you need a comment to explain what it is,
   the name is wrong.
   
   BAD:  const d = 30;          // days until expiry
   GOOD: const daysUntilExpiry = 30;

2. Names must be PRONOUNCEABLE. You should be able to say it out loud
   in a code review without sounding absurd.
   
   BAD:  genDtaRcrd()
   GOOD: generateDataRecord()

3. Names must be SEARCHABLE. Single-letter names are only acceptable
   as loop counters (i, j, k) in very small scopes.

4. Class names = NOUNS (UserService, PaymentGateway, OrderRepository)
   Method names = VERBS (createUser, processPayment, findOrderById)
   Boolean names = IS/HAS/CAN prefix (isActive, hasPermission, canDelete)

5. AVOID meaningless prefixes/suffixes:
   BAD:  IUserService, UserServiceImpl, AbstractUserBase
   GOOD: UserService (interface), PostgresUserService (implementation)
   
   Exception: Java interfaces commonly use this pattern. Follow your
   framework's convention, but prefer descriptive implementation names.

6. CONSISTENCY: If you call it "fetch" in one service, call it "fetch"
   everywhere. Not "get" in one and "retrieve" in another.
```

---

## JAVA / SPRING BOOT STANDARDS

### Authority: Google Java Style Guide + Uncle Bob + Baeldung + Spring Team

### Controller (Max 80 LOC)
```java
// A controller does ONE thing: route HTTP requests to services.
// ZERO business logic. ZERO database access. ZERO complex conditionals.

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
@Tag(name = "Orders")
public class OrderController {

    private final OrderService orderService;

    @GetMapping
    @Operation(summary = "List orders with pagination")
    public ResponseEntity<PagedResponse<OrderResponse>> findAll(
            @Valid PaginationRequest pagination) {
        return ResponseEntity.ok(orderService.findAll(pagination));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get order by ID")
    public ResponseEntity<OrderResponse> findById(
            @PathVariable UUID id) {
        return ResponseEntity.ok(orderService.findById(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create order")
    public ResponseEntity<OrderResponse> create(
            @Valid @RequestBody CreateOrderRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(orderService.create(request));
    }
    
    // THAT'S IT. No try/catch (global handler), no if/else, no mapping.
    // Controller = thin routing shell. Period.
}
```

### DENY in Controllers:
- Business logic (if/else based on data)
- Direct repository/database calls
- Object mapping (use MapStruct in service)
- Try/catch blocks (global @ControllerAdvice handles this)
- More than 1 line per method body (the service call)
- Logging business events (service responsibility)

### Service (Max 200 LOC)
```java
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderMapper orderMapper;
    private final PaymentGateway paymentGateway;
    private final EventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public PagedResponse<OrderResponse> findAll(PaginationRequest pagination) {
        Page<Order> orders = orderRepository.findAll(pagination.toPageable());
        return PagedResponse.from(orders, orderMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public OrderResponse findById(UUID id) {
        Order order = findOrderOrThrow(id);
        return orderMapper.toResponse(order);
    }

    @Transactional
    public OrderResponse create(CreateOrderRequest request) {
        Order order = orderMapper.toEntity(request);
        order.calculateTotal();
        
        Order saved = orderRepository.save(order);
        eventPublisher.publish(new OrderCreatedEvent(saved.getId()));
        
        log.info("Order created: {}", saved.getId());
        return orderMapper.toResponse(saved);
    }

    // PRIVATE helpers — keep each under 10 lines
    private Order findOrderOrThrow(UUID id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order", id));
    }
}
```

### DTO / Request / Response (Max 50 LOC)
```java
// DTOs are pure data carriers. No logic. No behavior.
// Use records (Java 16+) for immutability.

public record CreateOrderRequest(
    @NotBlank String customerId,
    @NotEmpty List<OrderItemRequest> items,
    @NotNull PaymentMethod paymentMethod
) {}

public record OrderResponse(
    UUID id,
    String customerId,
    List<OrderItemResponse> items,
    BigDecimal total,
    OrderStatus status,
    Instant createdAt
) {}

// DENY: No logic in DTOs. No @Entity annotations. No database concerns.
```

### Entity (Max 100 LOC)
```java
@Entity
@Table(name = "orders")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String customerId;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal total = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status = OrderStatus.PENDING;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Version
    private Long version; // Optimistic locking

    // Domain methods — behavior that belongs to the entity
    public void calculateTotal() {
        this.total = items.stream()
                .map(OrderItem::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    // DENY: No service calls. No repository access. No framework imports
    // beyond JPA. Entity = data + domain behavior only.
}
```

---

## NESTJS / TYPESCRIPT STANDARDS

### Authority: Kamil Myśliwiec (NestJS creator) + Official NestJS Docs

### Controller (Max 80 LOC)
```typescript
@ApiTags('users')
@Controller('api/v1/users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('user', 'admin')
  @ApiOkResponse({ type: [UserResponseDto] })
  findAll(@Query() query: PaginationQueryDto): Promise<PaginatedResult<UserResponseDto>> {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @Roles('user', 'admin')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(dto);
  }

  // Controller = routing only. One line per method. No business logic.
}
```

### Service (Max 200 LOC)
```typescript
@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly hasher: HashService,
    private readonly eventBus: EventBus,
  ) {}

  async findAll(query: PaginationQueryDto): Promise<PaginatedResult<UserResponseDto>> {
    const result = await this.usersRepository.findPaginated(query);
    return PaginatedResult.from(result, UserResponseDto.from);
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.findOrThrow(id);
    return UserResponseDto.from(user);
  }

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const hashedPassword = await this.hasher.hash(dto.password);
    const user = await this.usersRepository.create({ ...dto, password: hashedPassword });
    
    this.eventBus.emit(new UserCreatedEvent(user.id));
    return UserResponseDto.from(user);
  }

  // Private helpers
  private async findOrThrow(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }
}
```

### DTO (Max 50 LOC)
```typescript
export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  readonly name: string;

  @IsEmail()
  readonly email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  readonly password: string;
}

// Response DTO — maps from entity, hides sensitive fields
export class UserResponseDto {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly createdAt: Date;

  static from(entity: User): UserResponseDto {
    return { id: entity.id, name: entity.name, email: entity.email, createdAt: entity.createdAt };
  }
}
```

### Module (Max 60 LOC)
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, HashService],
  exports: [UsersService],
})
export class UsersModule {}

// Modules are WIRING only. No logic. No conditionals. Just declarations.
```

---

## NEXT.JS (App Router) STANDARDS

### Authority: Vercel/Next.js Team + Official Docs

### Page Component (Max 80 LOC)
```typescript
// app/dashboard/page.tsx
// Pages are THIN. Fetch data, pass to components. That's it.

import { Suspense } from 'react';
import { DashboardStats } from './_components/dashboard-stats';
import { RecentOrders } from './_components/recent-orders';
import { DashboardSkeleton } from './_components/dashboard-skeleton';

export const metadata = { title: 'Dashboard | MyApp' };

export default async function DashboardPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardStats />
      </Suspense>
      <Suspense fallback={<div>Loading orders...</div>}>
        <RecentOrders />
      </Suspense>
    </div>
  );
}

// DENY: No useEffect. No useState. No fetch() calls.
// Pages are Server Components by default. Keep them that way.
```

### Client Component (Max 150 LOC)
```typescript
// _components/order-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { orderSchema, type OrderFormData } from '@/lib/validations/order';
import { createOrder } from '@/lib/actions/order';

export function OrderForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
  });

  const onSubmit = async (data: OrderFormData) => {
    await createOrder(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Form fields here — each field is a separate component if complex */}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create Order'}
      </button>
    </form>
  );
}

// DENY: No data fetching in client components (use server components).
// DENY: No "use client" on pages or layouts.
// DENY: Business logic here — put it in server actions or lib/.
```

### Server Action (Max 80 LOC)
```typescript
// lib/actions/order.ts
'use server';

import { z } from 'zod';
import { orderSchema } from '@/lib/validations/order';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function createOrder(formData: z.infer<typeof orderSchema>) {
  const validated = orderSchema.parse(formData);

  const order = await db.order.create({
    data: {
      customerId: validated.customerId,
      items: { create: validated.items },
    },
  });

  revalidatePath('/dashboard');
  return { success: true, orderId: order.id };
}

// Server actions = thin. Validate → DB call → revalidate. Done.
```

---

## REACT NATIVE STANDARDS

### Screen Component (Max 150 LOC)
```typescript
// screens/OrderListScreen.tsx
export function OrderListScreen() {
  const { data, isLoading, error, refetch } = useOrders();

  if (isLoading) return <OrderListSkeleton />;
  if (error) return <ErrorState onRetry={refetch} />;
  if (!data?.length) return <EmptyState message="No orders yet" />;

  return (
    <FlashList
      data={data}
      renderItem={({ item }) => <OrderCard order={item} />}
      estimatedItemSize={80}
      keyExtractor={(item) => item.id}
    />
  );
}

// DENY: ScrollView with .map() for lists.
// DENY: Inline styles (use StyleSheet.create).
// DENY: Business logic in screens — extract to hooks.
```

---

## FLUTTER / DART STANDARDS

### Authority: Effective Dart Guide (https://dart.dev/effective-dart)

### Screen / Page (Max 150 LOC)
```dart
class OrderListPage extends StatelessWidget {
  const OrderListPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<OrderListBloc, OrderListState>(
      builder: (context, state) => switch (state) {
        OrderListLoading() => const OrderListSkeleton(),
        OrderListError(:final message) => ErrorView(message: message),
        OrderListLoaded(:final orders) => _OrderList(orders: orders),
      },
    );
  }
}

// Widget = UI ONLY. No business logic. No API calls.
// Logic lives in BLoC/Cubit. Data access in Repository.
```

---

## KOTLIN ANDROID STANDARDS

### Authority: JetBrains Kotlin Style Guide + AOSP Code Style

### ViewModel (Max 150 LOC)
```kotlin
@HiltViewModel
class OrderListViewModel @Inject constructor(
    private val getOrders: GetOrdersUseCase,
) : ViewModel() {

    private val _uiState = MutableStateFlow<OrderListUiState>(OrderListUiState.Loading)
    val uiState: StateFlow<OrderListUiState> = _uiState.asStateFlow()

    init { loadOrders() }

    private fun loadOrders() {
        viewModelScope.launch {
            getOrders()
                .onSuccess { orders -> _uiState.value = OrderListUiState.Success(orders) }
                .onFailure { error -> _uiState.value = OrderListUiState.Error(error.message) }
        }
    }
}

sealed interface OrderListUiState {
    data object Loading : OrderListUiState
    data class Success(val orders: List<OrderUi>) : OrderListUiState
    data class Error(val message: String?) : OrderListUiState
}

// ViewModel = orchestrate use cases + manage state.
// DENY: Direct repository calls. DENY: Android framework imports (Context, Intent).
```

### Use Case (Max 60 LOC)
```kotlin
class GetOrdersUseCase @Inject constructor(
    private val orderRepository: OrderRepository,
) {
    suspend operator fun invoke(): Result<List<Order>> {
        return orderRepository.getOrders()
    }
}

// One Use Case = One operation. Single invoke method. That's it.
```

---

## POSTGRESQL QUERY OPTIMIZATION ENFORCEMENT (MANDATORY)

These rules are enforced for database-facing code and schema files. The agent must reject code that violates them.

### MUST NOT
- Use `SELECT *` in production queries.
- Use deep `OFFSET` pagination for user-facing paths (use cursor/keyset pagination).
- Execute DB calls inside loops (`for`/`while`) causing N+1 patterns.
- Wrap filter columns with functions in `WHERE` in a way that breaks index usage (`LOWER()`, `CAST()`, `DATE()`, etc.) unless expression-index strategy is explicitly applied.
- Leave foreign-key-like Prisma fields (`*Id`) without index coverage.
- Put non-aggregate row filters in `HAVING` when they belong in `WHERE`.

### MUST DO
- Explicitly select needed columns.
- Prefer joins/includes/preload batching over per-row query loops.
- Prefer keyset/cursor pagination for scalable query paths.
- Keep predicates SARGable for index access.
- Ensure Prisma relation scalar keys are indexed (`@@index([...])`) or constrained (`@unique`) where appropriate.
- Keep aggregate-only conditions in `HAVING`; pre-aggregation filters go in `WHERE`.

### Enforcement Rule IDs
- `COD-DBQ-001`: `SELECT *` query usage (blocker).
- `COD-DBQ-002`: N+1 loop + database call pattern (blocker).
- `COD-DBQ-003`: deep `OFFSET` pagination (blocker).
- `COD-DBQ-004`: `OFFSET` pagination usage (warning).
- `COD-DBQ-005`: non-SARGable `WHERE` predicate signal (warning).
- `COD-DBQ-006`: `HAVING` used without aggregate condition signal (warning).
- `COD-DBI-001`: Prisma foreign-key-like field without index signal (blocker).

### Index Maintenance Diagnostics Rule IDs
- `DBM-IND-001`: invalid index detected in PostgreSQL catalog (blocker).
- `DBM-EXT-001`: `pg_stat_statements` extension missing (blocker).
- `DBM-SCAN-001`: high sequential scan pressure on large tables (warning).
- `DBM-IND-002`: unused non-primary indexes detected (warning).
- `DBM-MAINT-001`: VACUUM/ANALYZE lag or high dead tuple pressure detected (warning).

---

## ENFORCEMENT SUMMARY TABLE

| Rule | Limit | Severity |
|---|---|---|
| File exceeds 500 LOC | BLOCKER | Agent must split immediately |
| Controller has business logic | BLOCKER | Extract to service |
| Function exceeds 20 lines | WARNING at 20, BLOCKER at 40 | Extract helper functions |
| More than 3 function parameters | WARNING | Create parameter object |
| Nesting deeper than 2 levels | WARNING | Use early returns or extract |
| DTO contains business logic | BLOCKER | DTOs are pure data only |
| Entity calls external services | BLOCKER | Entity = data + domain behavior |
| Console.log in production code | WARNING | Use structured logger |
| Empty catch block | BLOCKER | Handle or re-throw |
| God class (does multiple things) | BLOCKER | Split by Single Responsibility |
| Duplicated code (>10 lines) | WARNING | Extract to shared function |
| Magic numbers/strings | WARNING | Extract to named constants |
| Non-descriptive variable names | WARNING | Rename to reveal intent |
| Missing input validation | BLOCKER | Validate at every boundary |
| Missing error handling on async | WARNING | Add try/catch or error boundary |

---

## REFERENCE LINKS FOR THE AGENT

The agent must consult these before writing code for the respective framework:

| Framework | Official Style / Architecture Guide |
|---|---|
| Java | https://google.github.io/styleguide/javaguide.html |
| Spring Boot | https://docs.spring.io/spring-boot/reference/ |
| Android/Kotlin | https://developer.android.com/kotlin/style-guide |
| Android (AOSP) | https://source.android.com/docs/setup/contribute/code-style |
| NestJS | https://docs.nestjs.com/ |
| Next.js | https://nextjs.org/docs/app/getting-started/project-structure |
| React | https://react.dev/learn |
| React Native | https://reactnative.dev/docs/getting-started |
| Flutter/Dart | https://dart.dev/effective-dart |
| Python (PEP 8) | https://peps.python.org/pep-0008/ |
| FastAPI | https://fastapi.tiangolo.com/tutorial/ |
| Django | https://docs.djangoproject.com/en/stable/misc/design-philosophies/ |
| TypeScript | https://www.typescriptlang.org/docs/handbook/ |
| Prisma | https://www.prisma.io/docs/orm/prisma-schema |
| GraphQL | https://graphql.org/learn/best-practices/ |
| Docker | https://docs.docker.com/build/building/best-practices/ |
| Kubernetes | https://kubernetes.io/docs/concepts/configuration/overview/ |

**The agent treats clean code as non-negotiable. Every file, every function, every name must meet these standards. Code that a human can't easily read and maintain is rejected.**

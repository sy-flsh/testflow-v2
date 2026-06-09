# Spring Boot Entity 구조 (JPA Entity Convention)

Spring Boot + JPA(Hibernate) 환경에서 가장 보편적으로 쓰이는 Entity 설계 관례 정리.
핵심은 **불변성 지향 + LAZY 로딩 + BaseEntity 공통화**입니다.

---

## 1. 기본 Entity 골격

```java
@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)  // 기본 생성자 보호
public class User extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)  // PostgreSQL: IDENTITY
    private Long id;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Enumerated(EnumType.STRING)   // 절대 ORDINAL 쓰지 말 것
    @Column(nullable = false)
    private UserStatus status;

    @Builder
    private User(String name, String email, UserStatus status) {
        this.name = name;
        this.email = email;
        this.status = status;
    }

    // 의미 있는 변경 메서드 (Setter 대신)
    public void changeEmail(String email) {
        this.email = email;
    }
}
```

---

## 2. 핵심 관례 (실무 정석)

| 항목 | 권장 | 이유 |
|------|------|------|
| 기본 생성자 | `@NoArgsConstructor(access = PROTECTED)` | JPA는 기본 생성자 필요, 외부 무분별 생성 방지 |
| Setter | **사용 안 함** | 무분별한 상태 변경 방지 → 의미있는 메서드(`changeEmail()`) |
| `@Data` | **금지** | `@ToString`/`@EqualsAndHashCode`가 연관관계 순환참조·LAZY 로딩 유발 |
| Enum | `@Enumerated(EnumType.STRING)` | ORDINAL은 순서 바뀌면 데이터 깨짐 |
| 객체 생성 | `@Builder` 또는 정적 팩토리 메서드 | 안전하고 명시적인 생성 |
| PK 타입 | `Long` + `IDENTITY` (PostgreSQL) | |
| `@ToString` | 연관관계 필드 제외하고 제한적으로 | 순환참조·N+1 방지 |

---

## 3. BaseEntity로 공통 필드 분리 (거의 필수)

생성/수정 시각 등 공통 컬럼을 추상 클래스로 분리합니다.

```java
@Getter
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseEntity {

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
```

메인 애플리케이션 클래스에 Auditing 활성화:

```java
@EnableJpaAuditing
@SpringBootApplication
public class MyAppApplication { ... }
```

→ 각 Entity가 `extends BaseEntity` 하면 생성/수정 시각이 자동 관리됩니다.
(생성자/수정자까지 필요하면 `@CreatedBy`, `@LastModifiedBy` + `AuditorAware` 추가)

---

## 4. 연관관계 매핑 관례

```java
@ManyToOne(fetch = FetchType.LAZY)   // ⭐ 항상 LAZY
@JoinColumn(name = "team_id")
private Team team;

@OneToMany(mappedBy = "team", cascade = CascadeType.ALL, orphanRemoval = true)
private List<User> members = new ArrayList<>();  // 컬렉션은 즉시 초기화
```

**핵심 원칙**

1. `@ManyToOne` / `@OneToOne`은 기본이 EAGER → **반드시 `FetchType.LAZY` 명시** (N+1·성능 예방)
2. 연관관계 주인은 **FK를 가진 쪽**(`@JoinColumn`), 반대편은 `mappedBy`
3. **단방향 우선** — 양방향은 꼭 필요할 때만 (양방향 시 연관관계 편의 메서드 작성)
4. 컬렉션 필드는 `new ArrayList<>()`로 **초기화**해 NPE 방지
5. `cascade` / `orphanRemoval`은 생명주기가 부모에 종속될 때만 신중히 사용

### 연관관계 편의 메서드 (양방향일 때)

```java
public void addMember(User user) {
    this.members.add(user);
    user.setTeam(this);   // 양쪽 동기화
}
```

---

## 5. Entity ↔ DTO 분리 (중요)

> **Entity를 Controller 응답으로 직접 노출하지 말 것.**
> 순환참조, LAZY 로딩 예외(`LazyInitializationException`), API 스펙과 도메인 결합 문제가 발생합니다.

```java
public record UserResponse(Long id, String name, String email) {
    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getName(), user.getEmail());
    }
}
```

- 요청/응답은 항상 **DTO(또는 record)** 로 변환
- 변환 위치는 Service 계층 또는 별도 Mapper

---

## 6. 자주 하는 실수 (안티패턴)

| 안티패턴 | 문제 | 대안 |
|----------|------|------|
| `@Data` 사용 | 순환참조, equals/hashCode 오류 | `@Getter` + 필요한 것만 |
| `public` Setter 남발 | 상태 추적 불가, 캡슐화 붕괴 | 의미있는 메서드 |
| EAGER 로딩 | N+1, 불필요한 쿼리 | `LAZY` + fetch join / `@EntityGraph` |
| `EnumType.ORDINAL` | 순서 변경 시 데이터 손상 | `EnumType.STRING` |
| Entity를 API로 직접 반환 | LAZY 예외, 스펙 결합 | DTO 변환 |
| `equals`/`hashCode` 무분별 재정의 | 영속성 컨텍스트 문제 | 비즈니스 키 또는 미정의 |

---

## 요약

> - `@Getter` + `@NoArgsConstructor(PROTECTED)` + `@Builder`, **Setter·`@Data` 지양**
> - 공통 컬럼은 **`BaseEntity` + JPA Auditing**으로 자동화
> - 연관관계는 **항상 `FetchType.LAZY`**, 단방향 우선, 주인은 FK 보유 측
> - **Entity ↔ DTO 분리** — API에 Entity 직접 노출 금지
> - Enum은 **`EnumType.STRING`**, PK는 **`Long` + IDENTITY(PostgreSQL)**

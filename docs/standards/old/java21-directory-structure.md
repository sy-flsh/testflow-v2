# Java 21 디렉토리 구조 (가장 많이 쓰이는 표준)

Java 21 프로젝트의 사실상 표준은 **Maven Standard Directory Layout**입니다.
Gradle도 동일한 구조를 그대로 따르며, Spring Boot도 이 위에서 동작합니다.

---

## 1. 빌드 도구 표준 디렉토리 (Maven / Gradle 공통)

```
my-app/
├── src/
│   ├── main/
│   │   ├── java/                 # 메인 소스 코드 (.java)
│   │   ├── resources/            # 설정 파일, 정적 리소스 (application.yml 등)
│   │   └── webapp/               # (웹앱일 경우) JSP, 정적 웹 리소스
│   └── test/
│       ├── java/                 # 테스트 코드
│       └── resources/            # 테스트용 리소스
├── target/  (Maven) | build/  (Gradle)   # 빌드 산출물 (git 제외)
├── pom.xml  (Maven) | build.gradle (Gradle)  # 빌드 설정
├── .gitignore
└── README.md
```

| 경로 | 용도 |
|------|------|
| `src/main/java` | 애플리케이션 소스 코드 |
| `src/main/resources` | 설정/리소스 (`application.yml`, 정적 파일, 메시지 등) |
| `src/test/java` | 단위/통합 테스트 코드 |
| `src/test/resources` | 테스트 전용 설정/리소스 |
| `target` / `build` | 컴파일 결과·JAR (버전관리 제외) |

---

## 2. 패키지 구조 — 가장 많이 쓰이는 2가지 방식

### (A) 계층형 (Layered) — 가장 보편적, 입문/중소 규모

```
com.example.myapp/
├── MyAppApplication.java        # 메인 클래스 (진입점)
├── config/                      # 설정 클래스 (@Configuration)
├── controller/                  # REST 컨트롤러 (표현 계층)
├── service/                     # 비즈니스 로직
├── repository/                  # 데이터 접근 계층 (JPA Repository 등)
├── domain/  (또는 entity/)       # 엔티티 / 도메인 모델
├── dto/                         # 요청·응답 객체
├── exception/                   # 예외 및 핸들러
└── util/                        # 공통 유틸리티
```

### (B) 도메인형 (Package-by-Feature) — 중대형, 유지보수에 유리

```
com.example.myapp/
├── MyAppApplication.java
├── common/                      # 공통 설정·예외·유틸
│   ├── config/
│   └── exception/
├── user/                        # 사용자 도메인 (한 폴더에 응집)
│   ├── UserController.java
│   ├── UserService.java
│   ├── UserRepository.java
│   ├── User.java
│   └── dto/
└── order/                       # 주문 도메인
    ├── OrderController.java
    ├── OrderService.java
    ├── OrderRepository.java
    ├── Order.java
    └── dto/
```

> **선택 가이드**
> - 소규모·학습용 → **계층형 (A)** 이 직관적
> - 기능이 늘어나는 실무 프로젝트 → **도메인형 (B)** 가 응집도/확장성 우수
> - 최근 실무 트렌드는 **도메인형(Package-by-Feature)** 선호

---

## 3. Java 21 + Spring Boot 전형적 전체 예시

```
my-app/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/example/myapp/
│   │   │       ├── MyAppApplication.java
│   │   │       ├── config/
│   │   │       ├── controller/
│   │   │       ├── service/
│   │   │       ├── repository/
│   │   │       ├── domain/
│   │   │       ├── dto/
│   │   │       └── exception/
│   │   └── resources/
│   │       ├── application.yml
│   │       ├── static/           # 정적 리소스 (css, js, img)
│   │       └── templates/        # 템플릿 (Thymeleaf 등)
│   └── test/
│       └── java/
│           └── com/example/myapp/
│               └── ...Test.java
├── build.gradle                 # 또는 pom.xml
├── settings.gradle
├── gradlew / gradlew.bat        # Gradle Wrapper
└── README.md
```

---

## 4. Java 21 관련 참고 사항

- **JDK 버전 지정**: 빌드 파일에 `21`로 명시
  - Gradle: `java { toolchain { languageVersion = JavaLanguageVersion.of(21) } }`
  - Maven: `<maven.compiler.release>21</maven.compiler.release>`
- **Spring Boot 3.x**는 Java 17+ 필수, **Java 21 (LTS) 권장**
- **모듈 시스템(JPMS)** 사용 시 `src/main/java` 루트에 `module-info.java` 추가
  (단, 대부분의 Spring Boot 앱은 모듈 시스템을 쓰지 않음 — classpath 방식)
- 패키지 명은 **역도메인(reverse-domain)** 규칙: `com.회사명.프로젝트명`

---

## 요약

> - 디렉토리 표준: **Maven/Gradle 공통 `src/main/java`, `src/main/resources`, `src/test/java`**
> - 패키지 구조: **계층형(Layered)** 또는 **도메인형(Package-by-Feature)** — 실무는 도메인형 선호
> - 빌드 파일에 **Java 21 toolchain** 명시, Spring Boot 3.x와 함께 사용

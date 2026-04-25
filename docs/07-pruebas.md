# 07 — Estrategia de Pruebas

---

## 1. Filosofía y política

El proyecto sigue una política de **TDD estricto (Strict TDD)** establecida en la constitución del proyecto: ninguna línea de código de producción se escribe antes de que exista una prueba que falle. Este compromiso es verificable en el historial de commits: los tests siempre preceden a las implementaciones en las ramas de feature.

Los objetivos de la estrategia de pruebas son:
1. **Detectar regresiones temprano:** los tests unitarios se ejecutan en segundos y se corren en cada push.
2. **Documentar el comportamiento esperado:** los nombres de los tests son descripciones en inglés del comportamiento, no del código.
3. **Proteger los invariantes de negocio:** no desactivar el último admin, no crear duplicados de asignaciones, detección de replay de refresh token, etc.

---

## 2. Pirámide de pruebas

```
         /\
        /FE\          36 pruebas de componente
       / E2E \         (Vitest + RTL + MSW)
      /────────\
     /  Integ.  \     pruebas de integración BE
    /  (Supertest)\    (Jest + Supertest + DB real)
   /──────────────\
  /  Unit  (71)    \   pruebas unitarias BE
 /  (Jest + mocks)  \  (servicios + middlewares)
/────────────────────\
```

**Total Feature 001:** 71 pruebas unitarias BE + tests de integración + 36 pruebas de componente FE.

---

## 3. Pruebas unitarias — Backend

**Herramientas:** Jest 29, ts-jest 29

**Configuración:** `apps/api/jest.config.ts`, proyecto `unit`
```
testMatch: ['<rootDir>/src/**/__tests__/**/*.spec.ts']
```

Los tests unitarios prueban servicios y middlewares en aislamiento. Los repositorios se sustituyen por objetos mock creados con `jest.fn()`. No se levanta servidor ni se conecta a una base de datos.

**Archivos de test unitario:**
- `src/modules/auth/__tests__/service.spec.ts` — login, refresh, logout, replay detection
- `src/modules/auth/__tests__/logout.spec.ts` — casos de logout idempotente
- `src/modules/users/__tests__/service.spec.ts` — creación, listado, activación, update
- `src/modules/users/__tests__/service.resetPassword.spec.ts` — reset de contraseña + revocación de tokens
- `src/modules/assignments/__tests__/service.spec.ts` — CRUD de asignaciones, protecciones
- `src/middleware/__tests__/authGuard.spec.ts` — tokens válidos, expirados, malformados
- `src/middleware/__tests__/roleGuard.spec.ts` — admin pass-through, roles de tienda
- `src/middleware/__tests__/errorHandler.spec.ts` — serialización de AppError
- `src/middleware/__tests__/validateBody.spec.ts` — validación Zod
- `src/jobs/__tests__/refreshTokenCleanup.spec.ts` — limpieza por ventana de tiempo

**Ejemplo — `UserService.create`:**
```typescript
it('hashes the password and persists the user via the repository', async () => {
  users.findByEmail.mockResolvedValue(null);
  users.create.mockResolvedValue(buildCreated());

  const result = await service.create({
    email: 'NEW@TEST.LOCAL',
    password: 'Secret1234',
    fullName: 'New User',
    isAdmin: false,
    assignments: [{ storeId: 's1', role: 'vendedora' }],
  });

  expect(users.create).toHaveBeenCalledTimes(1);
  const persistInput = users.create.mock.calls[0]?.[0] as { passwordHash: string };
  expect(persistInput.passwordHash).not.toBe('Secret1234');
  const matches = await bcrypt.compare('Secret1234', persistInput.passwordHash);
  expect(matches).toBe(true);
  expect(result.email).toBe('new@test.local');
});
```

Este test verifica que la contraseña nunca se persiste en claro, y que el hash resultante es válido para la contraseña original.

---

## 4. Pruebas de integración — Backend

**Herramientas:** Jest 29, ts-jest, Supertest 7

**Configuración:** `apps/api/jest.config.ts`, proyecto `integration`
```
testMatch: ['<rootDir>/tests/integration/**/*.spec.ts']
```

Las pruebas de integración levantan la aplicación Express completa con `buildServer()` y realizan requests HTTP reales contra una base de datos PostgreSQL de test (variable `DATABASE_URL_TEST`). Las migraciones se aplican antes de correr las pruebas; la base de datos se limpia entre suites con `prisma.$transaction` para garantizar aislamiento.

**Archivos de integración:**
- `tests/integration/auth.logout.spec.ts` — flujo completo de logout
- `tests/integration/auth.logout.multidevice.spec.ts` — logout de múltiples dispositivos

**CI:** en el pipeline `.github/workflows/ci.yml`, el job `test-be` levanta un servicio PostgreSQL 15 via Docker y corre ambos proyectos (unit + integration).

---

## 5. Pruebas de componente — Frontend

**Herramientas:** Vitest 2, Testing Library React 16, Testing Library user-event 14, MSW 2, jsdom

**Configuración:** `apps/web/vitest.config.ts`
```
environment: 'jsdom'
setupFiles: ['./src/test/setup.ts']
```

Las pruebas de componente montan los componentes React en un entorno jsdom simulado. Los llamados HTTP se interceptan con **Mock Service Worker (MSW)**: un service worker en memoria que responde con datos ficticios definidos en `src/test/handlers.ts`, sin necesidad de una API real en ejecución.

**Archivos de test de componente:**
- `features/auth/components/__tests__/LoginForm.spec.tsx` — formulario de login (validación, submit, error)
- `features/auth/components/__tests__/LogoutButton.spec.tsx` — logout + limpieza de store + redirect
- `features/users/components/__tests__/ResetPasswordModal.spec.tsx` — modal de reset
- `features/users/components/AssignmentsManager/__tests__/AssignmentsManager.spec.tsx` — CRUD de asignaciones
- `features/users/components/UserForm/__tests__/UserForm.spec.tsx` — creación de usuario

**Ejemplo — `LogoutButton` (un caso del describe):**
```typescript
it('still clears auth store even if logout API call fails', async () => {
  logoutSpy.mockRejectedValue(new Error('Network error'));
  renderWithProviders(<LogoutButton />);

  fireEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }));

  await waitFor(() => {
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
  });
  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });
});
```

Este test verifica el invariante de seguridad: incluso si la llamada al servidor falla, el estado local de auth se limpia y el usuario es redirigido al login.

---

## 6. Umbrales de cobertura

Los umbrales se configuran en las herramientas de test y el CI los hace cumplir.

### Backend (Jest)

Configurado en `apps/api/jest.config.ts`:

| Métrica | Umbral mínimo |
|---------|--------------|
| Líneas | 73% |
| Sentencias | 71% |
| Ramas | 65% |
| Funciones | 60% |

La cobertura se recoge de `src/modules/**/{service,repository}.ts`, `src/middleware/**/*.ts` y `src/jobs/**/*.ts`.

### Frontend (Vitest)

Configurado en `apps/web/vitest.config.ts`:

| Métrica | Umbral mínimo |
|---------|--------------|
| Líneas | 60% |
| Sentencias | 60% |
| Ramas | 50% |
| Funciones | 60% |

---

## 7. Convenciones de datos de prueba

- **Factories:** cada suite de test unitario define una función local `buildXxx(overrides?)` que devuelve un objeto de datos válido con defaults razonables y permite sobreescribir campos específicos.
- **Mocks de repositorio:** se crean como objetos literales con `jest.fn()` por campo, tipados contra las interfaces de repositorio. Esto evita el riesgo de que un mock no implemente todos los métodos de la interfaz.
- **MSW handlers:** `apps/web/src/test/handlers.ts` define los endpoints simulados con respuestas válidas para el happy path. Cada test sobreescribe los handlers que necesita simular errores.
- **Setup de entorno:** `apps/api/src/test/setupEnv.ts` fija variables de entorno mínimas para que `loadConfig()` no falle al importar en tests.

---

## 8. Integración continua (CI)

El archivo `.github/workflows/ci.yml` define el pipeline:

```
push/PR a main o dev
    │
    ├── lint (ESLint + Prettier)
    ├── type-check (tsc --noEmit)
    │
    ├── test-fe (Vitest) ← necesita lint + type
    ├── test-be (Jest + Supertest + Postgres) ← necesita lint + type
    │
    ├── build (tsc + vite build) ← necesita test-fe + test-be
    │
    └── migrations apply (prisma migrate deploy) ← necesita build
```

Los jobs `test-fe` y `test-be` corren en paralelo, reduciendo el tiempo total de CI. El job `test-be` levanta un servicio PostgreSQL 15 con Docker y aplica las migraciones antes de ejecutar los tests.

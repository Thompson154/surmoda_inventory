// WHY: shared setup for Supertest integration tests.
// Currently no global hooks needed. As feature 001-auth-roles tests come online,
// add DB reset hooks here (truncate + seed once per file).

beforeAll(() => {
  // place global setup here
});

afterAll(() => {
  // place global teardown here
});

export {};

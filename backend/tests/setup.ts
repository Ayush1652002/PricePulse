// Safety check: tests delete data. Refuse to run unless the database clearly is a test database.
const url = process.env.DATABASE_URL ?? "";

if (!url || !/test/i.test(new URL(url).pathname)) {
  throw new Error(
    "Tests need TEST_DATABASE_URL pointing to a database whose name contains 'test' " +
      "(example: postgresql://user:pass@localhost:5432/pricepulse_test). Aborting to protect your data."
  );
}

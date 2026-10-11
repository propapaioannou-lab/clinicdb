// Runs in each test worker before any app module loads: point the app at the test DB.
const url = new URL(process.env.DATABASE_URL!);
if (!url.pathname.endsWith("_test")) url.pathname = `${url.pathname}_test`;
process.env.DATABASE_URL = url.toString();

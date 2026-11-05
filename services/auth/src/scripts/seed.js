import { logger } from "shared";
import { env } from "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";
import { User } from "../models/user.js";
import { hashPassword } from "../services/password.js";

async function seedAdmin() {
  await connectDB();

  const normalizedEmail = env.ADMIN_EMAIL.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });

  if (existing) {
    logger.info("Admin user already exists, skipping seed", { email: normalizedEmail });
    await disconnectDB();
    process.exit(0);
  }

  const hashedPassword = await hashPassword(env.ADMIN_PASSWORD);

  await User.create({
    name: "System Admin",
    email: normalizedEmail,
    password: hashedPassword,
    role: "admin",
    phone: "+1000000000"
  });

  logger.info("Admin user seeded successfully", {
    email: normalizedEmail,
    role: "admin"
  });

  await disconnectDB();
  process.exit(0);
}

seedAdmin().catch(async (err) => {
  logger.error("Admin seed script failed", { error: err.message });
  await disconnectDB();
  process.exit(1);
});

import bcrypt from "bcrypt";
import { BadRequestError } from "shared";

const BCRYPT_ROUNDS = 12;

const PASSWORD_RULES = {
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  digit: /[0-9]/,
  special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/
};

export function validatePasswordRules(password) {
  if (!password || typeof password !== "string") {
    throw new BadRequestError("Password is required");
  }

  if (password.length < 8) {
    throw new BadRequestError("Password must be at least 8 characters long");
  }

  if (password.length > 100) {
    throw new BadRequestError("Password must not exceed 100 characters");
  }

  if (!PASSWORD_RULES.uppercase.test(password)) {
    throw new BadRequestError("Password must contain at least one uppercase letter");
  }

  if (!PASSWORD_RULES.lowercase.test(password)) {
    throw new BadRequestError("Password must contain at least one lowercase letter");
  }

  if (!PASSWORD_RULES.digit.test(password)) {
    throw new BadRequestError("Password must contain at least one number");
  }

  if (!PASSWORD_RULES.special.test(password)) {
    throw new BadRequestError("Password must contain at least one special character");
  }

  return true;
}

export async function hashPassword(plainPassword) {
  validatePasswordRules(plainPassword);
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

export async function comparePassword(plainPassword, hashedPassword) {
  if (!plainPassword || !hashedPassword) {
    return false;
  }
  return bcrypt.compare(plainPassword, hashedPassword);
}

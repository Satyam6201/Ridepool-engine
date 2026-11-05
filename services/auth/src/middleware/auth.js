import { authenticate as sharedAuthenticate, authorize as sharedAuthorize } from "shared";
import { env } from "../config/env.js";

export const authenticate = sharedAuthenticate(env.JWT_ACCESS_SECRET);
export const authorize = sharedAuthorize;

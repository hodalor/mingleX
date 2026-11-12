import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export type UserRole = "user" | "admin";

export type TokenPayload = {
  sub: string;
  role: UserRole;
};

export function signToken(sub: string, role: UserRole): string {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  };
  return jwt.sign({ sub, role }, env.jwtSecret, options);
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
  if (typeof decoded.sub !== "string") {
    throw new Error("Invalid token");
  }
  if (decoded.role !== "user" && decoded.role !== "admin") {
    throw new Error("Invalid token");
  }
  return { sub: decoded.sub, role: decoded.role };
}

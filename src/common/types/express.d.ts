import { UserRole } from "../constants/role.constant";

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

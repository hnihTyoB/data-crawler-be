import { DashboardRepository } from './dashboard.repository';
import { AuthService } from '../auth/auth.service';

export class DashboardService {
  private readonly repository = new DashboardRepository();
  private readonly authService = new AuthService();

  async getStats(userId: string, role: string) {
    const [counts, usageData] = await Promise.all([
      this.repository.getStats(userId, role),
      this.authService.getUsage(userId),
    ]);

    return {
      ...counts,
      quotaAndUsage: usageData,
    };
  }
}

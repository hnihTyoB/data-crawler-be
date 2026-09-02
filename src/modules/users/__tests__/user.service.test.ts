import { UserService } from '../user.service';

describe('UserService admin role guard', () => {
  const admin = {
    id: 'admin-1',
    email: 'admin@example.com',
    fullName: 'Admin',
    role: 'ADMIN',
    isActive: true,
    maxPagesLimit: 100,
    maxJobsPerDayLimit: 10,
    maxConcurrentJobsLimit: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('rejects changing the role of an existing admin account', async () => {
    const service = new UserService();
    const repository = {
      findById: jest.fn().mockResolvedValue(admin),
      update: jest.fn(),
    };
    (service as unknown as { repository: typeof repository }).repository = repository;

    await expect(
      service.update(admin.id, { role: 'VIEWER' }),
    ).rejects.toThrow('Không thể thay đổi vai trò của tài khoản Admin');
    expect(repository.update).not.toHaveBeenCalled();
  });
});

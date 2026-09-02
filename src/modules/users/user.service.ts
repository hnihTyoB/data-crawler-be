import bcrypt from 'bcryptjs';
import { UserRepository } from './user.repository';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { UserRole } from '@prisma/client';
import { CreateUserDto, UpdateUserDto, UserResponseDto, UserQueryDto } from './user.dto';

export class UserService {
  private readonly repository = new UserRepository();

  private formatUser(user: any): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      maxPagesLimit: user.maxPagesLimit,
      maxJobsPerDayLimit: user.maxJobsPerDayLimit,
      maxConcurrentJobsLimit: user.maxConcurrentJobsLimit,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async findAll(query: UserQueryDto) {
    const { items, total, page, limit } = await this.repository.findAll(query);
    return {
      items: items.map(user => this.formatUser(user)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.repository.findById(id);

    if (!user) {
      throw new AppError('User not found', 404, ERROR_CODE.NOT_FOUND);
    }

    return this.formatUser(user);
  }

  async create(data: CreateUserDto): Promise<UserResponseDto> {
    const existing = await this.repository.findByEmail(data.email);

    if (existing) {
      throw new AppError('Email already exists', 409, ERROR_CODE.DUPLICATE_ENTRY);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await this.repository.create({
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      role: data.role as UserRole | undefined,
      maxPagesLimit: data.maxPagesLimit,
      maxJobsPerDayLimit: data.maxJobsPerDayLimit,
      maxConcurrentJobsLimit: data.maxConcurrentJobsLimit,
    });

    return this.formatUser(user);
  }

  async update(id: string, data: UpdateUserDto): Promise<UserResponseDto> {
    const existingUser = await this.findById(id);

    if (
      existingUser.role === UserRole.ADMIN &&
      data.role !== undefined &&
      data.role !== UserRole.ADMIN
    ) {
      throw new AppError(
        'Không thể thay đổi vai trò của tài khoản Admin.',
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const user = await this.repository.update(id, {
      fullName: data.fullName,
      isActive: data.isActive,
      role: data.role as UserRole | undefined,
      maxPagesLimit: data.maxPagesLimit,
      maxJobsPerDayLimit: data.maxJobsPerDayLimit,
      maxConcurrentJobsLimit: data.maxConcurrentJobsLimit,
    });

    return this.formatUser(user);
  }

  async delete(id: string, currentUserId: string): Promise<void> {
    if (id === currentUserId) {
      throw new AppError(
        "Cannot delete your own account",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    await this.findById(id);
    await this.repository.delete(id, currentUserId);
  }
}


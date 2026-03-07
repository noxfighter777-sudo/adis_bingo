import { PrismaClient } from '@prisma/client';
import prismaClient from '../src/lib/database';
import path from 'path';

export interface AdminUser {
  id?: number;
  username: string;
  password: string;
  name: string;
  accountNumber: string;
  adminGeneratedBalance: string; // Balance admin generated (payment × 10)
  employeePaidAmount: string; // Amount employee paid to admin
  totalRechargeFiles: number; // Number of recharge files generated
  totalRechargeAmount: string; // Total amount of recharge files
  createdAt?: Date;
  shopId?: string;
  isBlocked?: boolean;
  role?: string;
}

export interface AdminRechargeFile {
  id?: number;
  username: string;
  accountNumber: string;
  amount: string;
  filename: string;
  createdAt: string;
  shopId?: string;
}

export class AdminStorage {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = prismaClient;
  }

  // User tracking for admin dashboard
  async createAdminUser(user: Omit<AdminUser, 'id' | 'createdAt' | 'totalRechargeFiles' | 'totalRechargeAmount'>): Promise<AdminUser> {
    const newUser = await this.prisma.user.create({
      data: {
        username: user.username,
        password: user.password,
        name: user.name,
        accountNumber: user.accountNumber,
        role: user.role || 'admin',
        createdAt: new Date()
      }
    });

    return {
      ...user,
      id: newUser.id,
      createdAt: newUser.createdAt,
      totalRechargeFiles: 0,
      totalRechargeAmount: '0'
    };
  }

  async getAdminUserByUsername(username: string): Promise<AdminUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { 
        username,
        role: 'admin'
      }
    });

    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      password: user.password,
      name: user.name,
      accountNumber: user.accountNumber || '',
      adminGeneratedBalance: '0',
      employeePaidAmount: '0',
      totalRechargeFiles: 0,
      totalRechargeAmount: '0',
      createdAt: user.createdAt,
      shopId: undefined,
      isBlocked: user.isBlocked,
      role: user.role
    };
  }

  async createRechargeFile(rechargeFile: Omit<AdminRechargeFile, 'id' | 'createdAt'>): Promise<AdminRechargeFile> {
    const newFile = await this.prisma.adminRechargeFile.create({
      data: {
        username: rechargeFile.username,
        accountNumber: rechargeFile.accountNumber,
        amount: rechargeFile.amount,
        filename: rechargeFile.filename,
        shopId: rechargeFile.shopId,
        createdAt: new Date()
      }
    });

    return {
      ...rechargeFile,
      id: newFile.id,
      createdAt: newFile.createdAt.toISOString()
    };
  }

  async getRechargeFileById(id: number): Promise<AdminRechargeFile | null> {
    const file = await this.prisma.adminRechargeFile.findUnique({
      where: { id }
    });

    if (!file) return null;

    return {
      id: file.id,
      username: file.username,
      accountNumber: file.accountNumber,
      amount: file.amount,
      filename: file.filename,
      createdAt: file.createdAt.toISOString(),
      shopId: file.shopId
    };
  }

  async getAllRechargeFiles(): Promise<AdminRechargeFile[]> {
    const files = await this.prisma.adminRechargeFile.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return files.map(file => ({
      id: file.id,
      username: file.username,
      accountNumber: file.accountNumber,
      amount: file.amount,
      filename: file.filename,
      createdAt: file.createdAt.toISOString(),
      shopId: file.shopId
    }));
  }

  private updateUserRechargeStats(employeeId: string, amount: string): void {
    // This would need to be implemented based on your specific requirements
    // For now, we'll log the action
    console.log(`Updating recharge stats for employee ${employeeId} with amount ${amount}`);
  }
}

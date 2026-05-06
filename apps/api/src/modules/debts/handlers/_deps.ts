import { db } from '@/providers/database';
import { DebtRepository } from '@/repositories/debt/debt.repo';
import { UserRepository } from '@/repositories/user/user.repo';

export const debtRepo = new DebtRepository(db);
export const userRepo = new UserRepository(db);

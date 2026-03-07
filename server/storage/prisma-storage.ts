import { PrismaClient } from '@prisma/client';
import prismaClient from '../src/lib/database';
import type { 
  User, Game, GamePlayer, Transaction, GameHistory, 
  DailyRevenueSummary, Cartela, UsedRecharge 
} from '@prisma/client';

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserByAccountNumber(accountNumber: string): Promise<User | null>;
  createUser(user: any): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | null>;
  updateUserBalance(id: number, balance: string): Promise<User | null>;
  deleteUser(id: number): Promise<boolean>;
  getUsers(): Promise<User[]>;
  generateAccountNumber(): Promise<string>;

  // Game methods
  getGame(id: number): Promise<Game | null>;
  getActiveGameByEmployee(employeeId: number): Promise<Game | null>;
  createGame(game: any): Promise<Game>;
  updateGame(id: number, updates: Partial<Game>): Promise<Game | null>;
  updateGameStatus(gameId: number, status: string): Promise<Game>;
  updateGameNumbers(gameId: number, calledNumbers: string[]): Promise<Game>;
  updateGamePrizePool(gameId: number, additionalAmount: number): Promise<Game>;
  completeGame(gameId: number, winnerId: number, prizeAmount: string): Promise<Game>;

  // Game Player methods
  getGamePlayers(gameId: number): Promise<GamePlayer[]>;
  getGamePlayerCount(gameId: number): Promise<number>;
  createGamePlayer(player: any): Promise<GamePlayer>;
  updateGamePlayer(id: number, updates: Partial<GamePlayer>): Promise<GamePlayer | null>;
  removeGamePlayer(id: number): Promise<boolean>;
  addGamePlayer(player: any): Promise<GamePlayer>;

  // Transaction methods
  createTransaction(transaction: any): Promise<Transaction>;
  getTransactionsByEmployee(employeeId: number, startDate?: Date, endDate?: Date): Promise<Transaction[]>;

  // Game History methods
  createGameHistory(history: any): Promise<GameHistory>;
  recordGameHistory(history: any): Promise<GameHistory>;
  getEmployeeGameHistory(employeeId: number, startDate?: Date, endDate?: Date): Promise<GameHistory[]>;

  // Analytics methods
  getEmployeeStats(employeeId: number, startDate?: Date, endDate?: Date): Promise<{
    totalCollections: string;
    gamesCompleted: number;
    playersRegistered: number;
  }>;
  
  // Financial methods
  processGameProfits(gameId: number, totalCollected: string): Promise<void>;
  
  // Cartela shop methods
  getCartelasByShop(shopId: number): Promise<Cartela[]>;
  resetCartelasForShop(shopId: number): Promise<void>;
  getShop(shopId: number): Promise<any>;
  getUserByShopId(shopId: number): Promise<any>;
  createOrUpdateDailyRevenueSummary(summary: any): Promise<DailyRevenueSummary>;
  getDailyRevenueSummary(date: string): Promise<DailyRevenueSummary | null>;
  getDailyRevenueSummaries(dateFrom?: string, dateTo?: string): Promise<DailyRevenueSummary[]>;

  // Cartela methods
  getCartelaByNumber(employeeId: number, cartelaNumber: number): Promise<Cartela | null>;
  resetCartelasForEmployee(employeeId: number): Promise<void>;

  // Master Float methods
  getMasterFloat(employeeId?: number): Promise<string>;
  getAllUserBalances(): Promise<{ userId: number; username: string; balance: string; role: string }[]>;

  // Used Recharges methods (for replay protection)
  createUsedRecharge(recharge: any): Promise<UsedRecharge>;
  isNonceUsed(nonce: string): Promise<boolean>;
  isSignatureUsed(signature: string): Promise<boolean>;

  // EAT time zone utility methods
  getCurrentEATDate(): string;
  performDailyReset(): Promise<void>;
}

export class PrismaStorage implements IStorage {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = prismaClient;
  }

  // User methods
  async getUser(id: number): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { id }
    });
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { username }
    });
  }

  async getUserByAccountNumber(accountNumber: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { accountNumber }
    });
  }

  async createUser(user: any): Promise<User> {
    return await this.prisma.user.create({
      data: {
        username: user.username,
        password: user.password,
        role: user.role || 'employee',
        name: user.name,
        accountNumber: user.accountNumber,
        balance: user.balance || 0,
        isBlocked: user.isBlocked || false,
        createdAt: new Date()
      }
    });
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | null> {
    return await this.prisma.user.update({
      where: { id },
      data: updates
    });
  }

  async updateUserBalance(id: number, balance: string): Promise<User | null> {
    return await this.prisma.user.update({
      where: { id },
      data: { balance: parseFloat(balance) }
    });
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      await this.prisma.user.delete({
        where: { id }
      });
      return true;
    } catch {
      return false;
    }
  }

  async getUsers(): Promise<User[]> {
    return await this.prisma.user.findMany();
  }

  async generateAccountNumber(): Promise<string> {
    let accountNumber: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      
      const existing = await this.prisma.user.findUnique({
        where: { accountNumber }
      });
      isUnique = !existing;
      attempts++;
    } while (!isUnique && attempts < maxAttempts);

    if (!isUnique) {
      throw new Error("Failed to generate unique account number after multiple attempts");
    }

    return accountNumber;
  }

  // Game methods
  async getGame(id: number): Promise<Game | null> {
    return await this.prisma.game.findUnique({
      where: { id },
      include: {
        employee: true,
        players: true
      }
    });
  }

  async getActiveGameByEmployee(employeeId: number): Promise<Game | null> {
    return await this.prisma.game.findFirst({
      where: {
        employeeId,
        status: 'active'
      },
      orderBy: {
        id: 'desc'
      }
    });
  }

  async createGame(game: any): Promise<Game> {
    return await this.prisma.game.create({
      data: {
        ...game,
        createdAt: new Date()
      }
    });
  }

  async updateGame(id: number, updates: Partial<Game>): Promise<Game> {
    const {  ...validUpdates } = updates as any;
    return await this.prisma.game.update({
      where: { id },
      data: validUpdates
    });
  }

  async updateGameStatus(gameId: number, status: string): Promise<Game> {
    const updateData: any = { status };
    if (status === 'active') {
      updateData.startedAt = new Date();
    }
    
    return await this.prisma.game.update({
      where: { id: gameId },
      data: updateData
    });
  }

  async updateGameNumbers(gameId: number, calledNumbers: string[]): Promise<Game> {
    const currentGame = await this.getGame(gameId);
    if (currentGame && currentGame.status === 'paused' && calledNumbers.length > 0) {
      throw new Error('Cannot add numbers to paused game');
    }
    
    return await this.prisma.game.update({
      where: { id: gameId },
      data: { calledNumbers: JSON.stringify(calledNumbers) }
    });
  }

  async updateGamePrizePool(gameId: number, additionalAmount: number): Promise<Game> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found');
    
    return await this.prisma.game.update({
      where: { id: gameId },
      data: { 
        prizePool: game.prizePool + additionalAmount 
      }
    });
  }

  async completeGame(gameId: number, winnerId: number, prizeAmount: string): Promise<Game> {
    return await this.prisma.game.update({
      where: { id: gameId },
      data: { 
        status: 'completed',
        
        
        prizePool: parseFloat(prizeAmount)
      }
    });
  }

  // Game Player methods
  async getGamePlayers(gameId: number): Promise<GamePlayer[]> {
    return await this.prisma.gamePlayer.findMany({
      where: { id: gameId },
      orderBy: { registeredAt: 'desc' }
    });
  }

  async getGamePlayerCount(gameId: number): Promise<number> {
    return await this.prisma.gamePlayer.count({
      where: { id: gameId }
    });
  }

  async createGamePlayer(player: any): Promise<GamePlayer> {
    return await this.prisma.gamePlayer.create({
      data: {
        ...player,
        registeredAt: new Date()
      }
    });
  }

  async updateGamePlayer(id: number, updates: Partial<GamePlayer>): Promise<GamePlayer | null> {
    return await this.prisma.gamePlayer.update({
      where: { id },
      data: updates
    });
  }

  async removeGamePlayer(id: number): Promise<boolean> {
    try {
      await this.prisma.gamePlayer.delete({
        where: { id }
      });
      return true;
    } catch {
      return false;
    }
  }

  async addGamePlayer(player: any): Promise<GamePlayer> {
    return await this.createGamePlayer(player);
  }

  // Transaction methods
  async createTransaction(transaction: any): Promise<Transaction> {
    return await this.prisma.transaction.create({
      data: {
        ...transaction,
        createdAt: new Date()
      }
    });
  }

  async getTransactionsByEmployee(employeeId: number, startDate?: Date, endDate?: Date): Promise<Transaction[]> {
    const whereClause: any = { userId: employeeId };
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    return await this.prisma.transaction.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });
  }

  // Game History methods
  async createGameHistory(history: any): Promise<GameHistory> {
    return await this.prisma.gameHistory.create({
      data: {
        ...history,
        createdAt: new Date()
      }
    });
  }

  async updateGameHistory(gameId: number, updates: any): Promise<GameHistory> {
    const { completedAt, ...validUpdates } = updates as any;
    await this.prisma.gameHistory.updateMany({
      where: { gameId },
      data: validUpdates
    });
    return await this.prisma.gameHistory.findFirst({ where: { gameId } }) as GameHistory;
  }

  async recordGameHistory(history: any): Promise<GameHistory> {
    return await this.prisma.gameHistory.create({
      data: {
        ...history,
        createdAt: new Date()
      }
    });
  }

  async getEmployeeGameHistory(employeeId: number, startDate?: Date, endDate?: Date): Promise<GameHistory[]> {
    const whereClause: any = { userId: employeeId };
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    return await this.prisma.gameHistory.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });
  }

  // Analytics methods
  async getEmployeeStats(employeeId: number, startDate?: Date, endDate?: Date): Promise<{
    totalCollections: string;
    gamesCompleted: number;
    playersRegistered: number;
  }> {
    const gameWhereClause: any = { userId: employeeId };
    const playerWhereClause: any = { game: { employeeId } };
    
    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) dateFilter.gte = startDate;
      if (endDate) dateFilter.lte = endDate;
      
      gameWhereClause.createdAt = dateFilter;
      playerWhereClause.registeredAt = dateFilter;
    }

    const [gamesCompleted, playersRegistered] = await Promise.all([
      this.prisma.gameHistory.count({ where: gameWhereClause }),
      this.prisma.gamePlayer.count({ where: playerWhereClause })
    ]);

    return {
      totalCollections: "0.00", // Would need additional logic to calculate
      gamesCompleted,
      playersRegistered
    };
  }

  // Financial methods
  async processGameProfits(gameId: number, totalCollected: string): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }

    const employee = await this.getUser(game.employeeId);
    if (!employee) {
      throw new Error(`Employee ${game.employeeId} not found`);
    }

    const totalCollectedNum = parseFloat(totalCollected);
    if (totalCollectedNum <= 0) {
      console.log(`No revenue to process for game ${gameId}`);
      return;
    }

    const systemCut = totalCollectedNum * 0.15;
    const remainingAmount = totalCollectedNum - systemCut;

    console.log(`💰 Processing game profits for game ${gameId}:`, {
      totalCollected: totalCollectedNum,
      systemCut: systemCut,
      remainingAmount: remainingAmount,
      employeeBalance: employee.balance || 0
    });

    const currentBalance = employee.balance || 0;
    if (currentBalance < systemCut) {
      throw new Error(`Insufficient balance to cover 15% system cut. Required: ${systemCut.toFixed(2)} ETB, Available: ${currentBalance.toFixed(2)} ETB. Please recharge to continue.`);
    }

    const newBalance = currentBalance - systemCut;
    await this.updateUserBalance(employee.id, newBalance.toString());

    await this.createTransaction({
      userId: employee.id,
      amount: systemCut,
      type: 'system_cut',
      description: `15% system cut from game revenue (${systemCut.toFixed(2)} ETB)`,
      createdAt: new Date()
    });

    await this.createTransaction({
      userId: employee.id,
      amount: remainingAmount,
      type: 'game_revenue',
      description: `Game revenue after system cut (${remainingAmount.toFixed(2)} ETB)`,
      createdAt: new Date()
    });

    console.log(`✅ Processed game profits for game ${gameId}: System cut ${systemCut.toFixed(2)} ETB deducted, remaining ${remainingAmount.toFixed(2)} ETB recorded as revenue`);
  }

  // Cartela shop methods
  async getCartelasByShop(shopId: number): Promise<Cartela[]> {
    return await this.prisma.cartela.findMany({
      where: { employeeId: shopId },
      orderBy: { cartelaNumber: 'asc' }
    });
  }

  async resetCartelasForShop(shopId: number): Promise<void> {
    await this.prisma.cartela.updateMany({
      where: { employeeId: shopId },
      data: { 
        bookedBy: null,
        gameId: null,
        isBooked: false
      }
    });
  }

  async getShop(shopId: number): Promise<any> {
    return { id: shopId, name: `Shop ${shopId}`, profitMargin: '20' };
  }

  async getUserByShopId(shopId: number): Promise<any> {
    return await this.prisma.user.findFirst({
      where: {
        id: shopId,
        role: 'admin'
      }
    });
  }

  async createOrUpdateDailyRevenueSummary(summary: any): Promise<DailyRevenueSummary> {
    const existingSummary = await this.prisma.dailyRevenueSummary.findUnique({
      where: { date: summary.date }
    });
    
    if (existingSummary) {
      return await this.prisma.dailyRevenueSummary.update({
        where: { id: existingSummary.id },
        data: {
          totalRevenue: existingSummary.totalRevenue + parseFloat(summary.totalRevenue),
          totalGames: existingSummary.totalGames + summary.totalGames,
          totalPlayers: existingSummary.totalPlayers + summary.totalPlayers
        }
      });
    } else {
      return await this.prisma.dailyRevenueSummary.create({
        data: {
          date: summary.date,
          employeeId: summary.employeeId,
          totalRevenue: parseFloat(summary.totalRevenue),
          totalGames: summary.totalGames,
          totalPlayers: summary.totalPlayers,
          createdAt: new Date()
        }
      });
    }
  }

  async getDailyRevenueSummary(date: string): Promise<DailyRevenueSummary | null> {
    return await this.prisma.dailyRevenueSummary.findUnique({
      where: { date }
    });
  }

  async getDailyRevenueSummaries(dateFrom?: string, dateTo?: string): Promise<DailyRevenueSummary[]> {
    const whereClause: any = {};
    if (dateFrom && dateTo) {
      whereClause.date = {
        gte: dateFrom,
        lte: dateTo
      };
    }

    return await this.prisma.dailyRevenueSummary.findMany({
      where: whereClause,
      orderBy: { date: 'desc' }
    });
  }

  // Cartela methods
  async getCartelaByNumber(employeeId: number, cartelaNumber: number): Promise<Cartela | null> {
    return await this.prisma.cartela.findFirst({
      where: {
        employeeId,
        cartelaNumber
      }
    });
  }

  async resetCartelasForEmployee(employeeId: number): Promise<void> {
    await this.prisma.cartela.deleteMany({
      where: { employeeId }
    });
  }

  // Master Float methods
  async getMasterFloat(employeeId?: number): Promise<string> {
    if (employeeId) {
      const employee = await this.getUser(employeeId);
      if (!employee) throw new Error('Employee not found');
      return (employee.balance || 0).toString();
    }
    
    const result = await this.prisma.user.aggregate({
      _sum: {
        balance: true
      }
    });
    
    return (result._sum.balance || 0).toString();
  }

  async getAllUserBalances(): Promise<{ userId: number; username: string; balance: string; role: string }[]> {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        balance: true,
        role: true
      },
      orderBy: { id: 'asc' }
    });
    
    return users.map(user => ({
      userId: user.id,
      username: user.username,
      balance: (user.balance || 0).toString(),
      role: user.role
    }));
  }

  // EAT time zone utility methods
  getCurrentEATDate(): string {
    const now = new Date();
    const eatTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    return eatTime.toISOString().slice(0, 19).replace('T', ' ');
  }

  async performDailyReset(): Promise<void> {
    const today = this.getCurrentEATDate().slice(0, 10);
    
    await this.prisma.dailyRevenueSummary.deleteMany({
      where: {
        date: {
          lt: today
        }
      }
    });
  }

  // Used Recharges methods
  async createUsedRecharge(recharge: any): Promise<UsedRecharge> {
    return await this.prisma.usedRecharge.create({
      data: {
        ...recharge,
        usedAt: new Date()
      }
    });
  }

  async isNonceUsed(nonce: string): Promise<boolean> {
    const existing = await this.prisma.usedRecharge.findUnique({
      where: { nonce }
    });
    return !!existing;
  }

  async isSignatureUsed(signature: string): Promise<boolean> {
    const existing = await this.prisma.usedRecharge.findFirst({
      where: { signature }
    });
    return !!existing;
  }
}

export const storage = new PrismaStorage();

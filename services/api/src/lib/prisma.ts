import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

export const prisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

prisma.$on('warn', (e) => logger.warn({ prismaEvent: e }, 'Prisma warning'));
prisma.$on('error', (e) => logger.error({ prismaEvent: e }, 'Prisma error'));

export async function gracefulShutdown(): Promise<void> {
  logger.info('Closing Prisma connection...');
  await prisma.$disconnect();
}

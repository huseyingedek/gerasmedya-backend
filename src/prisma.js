const { PrismaClient } = require("@prisma/client");

// Neon + Prisma: development'ta hot-reload sırasında çok client açılmasını önle
const globalForPrisma = global;
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

module.exports = prisma;

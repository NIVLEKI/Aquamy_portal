const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('R3ddd1ngt0n4816#', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@aquamy.com' }, // Change this to your preferred admin email
    update: {},
    create: {
      email: 'admin@aquamy.com',
      name: 'Master Admin',
      password: hashedPassword,
      memberNumber: 'AQ-001',
      phone: '0700000000', // Change to your phone
      dateOfBirth: new Date('1990-01-01'),
      role: 'ADMIN',
    },
  });

  console.log('✅ Master Admin created:', admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
/**
 * One-time migration: update CreditTransaction EARN notes from order.id → order.orderNumber
 * Run with: npx ts-node scripts/fix-credit-notes.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const txs = await prisma.creditTransaction.findMany({
    where: { type: "EARN", refId: { not: null } },
    select: { id: true, refId: true, note: true },
  });

  console.log(`Found ${txs.length} EARN transactions to check`);

  let updated = 0;
  for (const tx of txs) {
    if (!tx.refId) continue;
    const order = await prisma.order.findUnique({
      where: { id: tx.refId },
      select: { orderNumber: true },
    });
    if (!order) continue;

    const newNote = `Commission จากออเดอร์ ${order.orderNumber}`;
    if (tx.note === newNote) continue;

    await prisma.creditTransaction.update({
      where: { id: tx.id },
      data: { note: newNote },
    });
    console.log(`  Updated ${tx.id}: "${tx.note}" → "${newNote}"`);
    updated++;
  }

  console.log(`Done — updated ${updated} records`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

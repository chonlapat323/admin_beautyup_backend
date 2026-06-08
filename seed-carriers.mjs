import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const carriers = [
  { name: "ไปรษณีย์ไทย", shortName: "THPOST", color: "#C8102E", textColor: "#FFFFFF", trackingUrl: "https://track.thailandpost.co.th/?trackNumber={tracking}", sortOrder: 1 },
  { name: "Kerry Express", shortName: "KERRY", color: "#FFCC00", textColor: "#000000", trackingUrl: "https://th.kerryexpress.com/en/track/?track={tracking}", sortOrder: 2 },
  { name: "Flash Express", shortName: "FLASH", color: "#F7941D", textColor: "#FFFFFF", trackingUrl: "https://www.flashexpress.co.th/tracking/?se={tracking}", sortOrder: 3 },
  { name: "J&T Express", shortName: "JNT", color: "#E4002B", textColor: "#FFFFFF", trackingUrl: "https://www.jtexpressth.com/service/track/{tracking}", sortOrder: 4 },
  { name: "DHL Express", shortName: "DHL", color: "#FFCC00", textColor: "#CC0000", trackingUrl: "https://www.dhl.com/th-th/home/tracking.html?tracking-id={tracking}", sortOrder: 5 },
];

async function seed() {
  const count = await prisma.carrier.count();
  if (count > 0) { console.log("Carriers already seeded"); return; }
  for (const c of carriers) {
    await prisma.carrier.create({ data: c });
  }
  console.log("Seeded", carriers.length, "carriers");
  await prisma.$disconnect();
}
seed();

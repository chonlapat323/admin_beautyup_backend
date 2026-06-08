#!/usr/bin/env node
/**
 * seed-mock-full.mjs — BeautyUp Full Mock Data Generator
 * สร้าง: 300 products, 200 members, 500 orders, 200 redemptions รวม 2,500+ records
 *
 * ใช้ Brand/Category/Collection จริงจาก DB (ไม่สร้างใหม่)
 * สร้าง mock products โดยอิงโครงสร้างจริง + สร้าง members/orders/redemptions
 *
 * Usage (cd ~/admin_beautyup_backend ก่อน):
 *   node seed-mock-full.mjs          — clean + seed ใหม่
 *   node seed-mock-full.mjs --clean  — clean อย่างเดียว
 *
 * password ของทุก test account: password
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env (no external package needed)
try {
  const lines = readFileSync(resolve(process.cwd(), '.env'), 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
} catch {}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set — run from the backend directory or set env');
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
const IS_CLEAN = process.argv.includes('--clean');

// ─── helpers ──────────────────────────────────────────────────────────────────
const rand   = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick   = a => a[rand(0, a.length - 1)];
const pickN  = (a, n) => [...a].sort(() => .5 - Math.random()).slice(0, Math.min(n, a.length));
const pad    = (n, l = 4) => String(n).padStart(l, '0');
const dAgo   = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const rdDate = (max, min = 0) => dAgo(rand(min, max));
const toSlug = s => s.toLowerCase().replace(/[^\w]+/g, '-').replace(/(^-|-$)/g, '');

function wp(arr, weights) {
  let r = Math.random(), s = 0;
  for (let i = 0; i < arr.length; i++) { s += weights[i]; if (r <= s) return arr[i]; }
  return arr[arr.length - 1];
}

// ─── static data ──────────────────────────────────────────────────────────────
// Product names ตาม category จริงใน DB
const PROD_BY_CAT = {
  // สีย้อมผม
  'color': {
    lines: ['Color Cream','Color Gel','Color Mask','Tinting Cream','Fashion Color'],
    variants: ['NB','NA','N','AB','A','B','W','G','R','V','BV','BR'],
    levels: ['5','6','7','8','9','10','11','12','13'],
    desc: [
      'ครีมสีย้อมผมให้สีที่คงทน เงางาม ติดสีได้ดี พร้อมบำรุงเส้นผมในขั้นตอนเดียว',
      'เจลสีย้อมผมเนื้อเข้มข้น ปิดผมขาวได้ 100% ให้สีสม่ำเสมอตลอดเส้นผม',
      'ครีมสีแฟชั่น ให้สีสดสว่าง ติดทนนานกว่า 6 สัปดาห์ เหมาะสำหรับงานซาลอน',
    ],
    prices: [289,299,309,319,329,349,369,389],
  },
  // แชมพูและทรีตเมนต์
  'shampoo': {
    lines: ['Shampoo','Treatment','Hair Mask','Conditioner','Serum'],
    variants: ['Nourishing','Repair','Color-Safe','Anti-Frizz','Volumizing','Moisturizing','Strengthening'],
    levels: [''],
    desc: [
      'แชมพูบำรุงผมสูตรเข้มข้น ลดการหลุดร่วง เสริมความแข็งแรงให้เส้นผม',
      'ทรีตเมนต์บำรุงผมเสียจากการย้อมหรือดัด ฟื้นฟูผมให้นุ่มลื่น เงางาม',
      'มาสก์ผมสูตรเข้มข้นพิเศษ ให้ความชุ่มชื้นลึกถึงแกนผม ใช้ 1 ครั้ง/สัปดาห์',
      'ครีมนวดผมป้องกันสีซีดจาง เหมาะสำหรับผมย้อมสีทุกเฉด',
    ],
    prices: [290,350,390,450,490,550,590,650,890,990],
  },
  // ลีฟอิน
  'leavein': {
    lines: ['Leave-in Cream','Leave-in Spray','Heat Protector','Hair Serum','Finishing Cream'],
    variants: ['Nourishing','Repair','Smooth','Shine','Frizz-Control'],
    levels: [''],
    desc: [
      'ลีฟอินครีมบำรุงผมที่ไม่ต้องล้างออก ให้ผมนุ่มลื่น จัดทรงง่ายตลอดวัน',
      'สเปรย์ลีฟอินปกป้องผมจากความร้อน เหมาะก่อนใช้เครื่องมือทำผม',
      'เซรั่มลีฟอินให้ประกายเงาและลดความฟูฟ่องของผม ใช้ได้ทุกวัน',
    ],
    prices: [290,350,390,450,490,550],
  },
  // ผงฝอก
  'test': {
    lines: ['Bleach Powder','Lightening Powder','Decolorizing Powder'],
    variants: ['Blue','White','Dust-Free','Extra Lift','Professional'],
    levels: [''],
    desc: [
      'ผงฝอกสูตรพิเศษ ลดการระคาย เคือง ให้ผลการฟอกสีที่สม่ำเสมอ ยกระดับสีได้ถึง 7 ระดับ',
      'ผงฝอกปลอดฝุ่น ป้องกันการแพร่กระจาย เหมาะสำหรับงานซาลอนมืออาชีพ',
    ],
    prices: [290,350,450,590,690,890],
  },
  // เปอร์ออกไซด์
  'per': {
    lines: ['Oxidant','Developer','Peroxide Cream'],
    variants: ['3%','6%','9%','12%'],
    levels: ['10Vol','20Vol','30Vol','40Vol'],
    desc: [
      'ออกซิแดนท์ครีมเนื้อเนียนละเอียด ควบคุมการออกฤทธิ์ได้แม่นยำ เหมาะจับคู่กับสีทุกยี่ห้อ',
      'เปอร์ออกไซด์ครีมสูตรคงตัว ลดการระคายเคือง ให้ผลสีที่สม่ำเสมอและแม่นยำ',
    ],
    prices: [190,220,250,290],
  },
  // default fallback
  'default': {
    lines: ['Professional Formula','Premium Series','Expert Care'],
    variants: ['Classic','Intensive','Advanced'],
    levels: [''],
    desc: ['ผลิตภัณฑ์คุณภาพสูงสำหรับช่างผมมืออาชีพ ใช้ในซาลอนและบ้าน'],
    prices: [290,390,490,590],
  },
};

const SIZES_HAIR = ['50ml','100ml','150ml','200ml','300ml','500ml','1000ml','50g','100g','200g','500g','1kg'];

const FIRST_NAMES = [
  'สมชาย','สมหญิง','นารี','วิชัย','พรทิพย์','สุดา','มานะ','พัชรี','ธนา','รัตนา',
  'กนกวรรณ','ศิริพร','อัมพร','เกศินี','วราภรณ์','ปิยะ','นภา','วันทนา','อรุณ','มาลี',
  'ชัยวัฒน์','สุภา','ดวงใจ','ลัดดา','เพชรา','สายใจ','กมล','นิตยา','ประภา','จิตรา',
  'ทิพวัลย์','ศศิธร','วิไล','ยุพา','จันทร์','แก้ว','ทอง','บุญ','มณี','เสาวลักษณ์',
  'นิภา','สุรีย์','รุ่งนภา','อนงค์','สิริมา','ปัณฑิตา','ชนิดา','พิมพ์ใจ','อาภา',
  'สุวิมล','วิมล','ปรียา','นุชนาถ','จารุวรรณ','สุพรรณี','ณัฐิดา','ปิยนุช','ภาวิณี',
];
const LAST_NAMES = [
  'ใจดี','สุขสันต์','รุ่งเรือง','มั่งมี','สมบูรณ์','ศรีสุข','พันธ์ดี',
  'แสงทอง','บุญมาก','ชูชาติ','วงศ์ดี','ทองดี','ศรีทอง','สุทธิ',
  'นามกร','ปิยะรัตน์','เจริญสุข','มีชัย','ดีงาม','ทองแก้ว','แก้วมณี',
  'เพชรรัตน์','ทองคำ','ศรีวิไล','จันทร์ทอง','บัวงาม','สาคร',
  'เงินทอง','วัฒนา','กาญจนา','ประเสริฐ','สิงห์ทอง','บุญเรือง','รักดี',
];
const PREFIXES  = ['นาย','นางสาว','นางสาว','นาง'];
const PROVINCES = [
  'กรุงเทพมหานคร','เชียงใหม่','ภูเก็ต','ขอนแก่น','นครราชสีมา',
  'อุดรธานี','สงขลา','สมุทรปราการ','นนทบุรี','ปทุมธานี',
  'ชลบุรี','ระยอง','เชียงราย','นครสวรรค์','สุราษฎร์ธานี',
  'นครศรีธรรมราช','พระนครศรีอยุธยา','สระบุรี','ราชบุรี','ลพบุรี',
];
const ROADS = ['สุขุมวิท','พระราม 9','รัชดาภิเษก','ลาดพร้าว','พหลโยธิน','เพชรบุรี','งามวงศ์วาน'];
const BANKS = ['ธนาคารกสิกรไทย','ธนาคารไทยพาณิชย์','ธนาคารกรุงเทพ','ธนาคารกรุงไทย','ธนาคารกรุงศรี'];

const REWARD_NAMES = [
  'แก้วน้ำ BeautyUp Premium 500ml','ถุงผ้า Canvas BeautyUp Tote Bag',
  'ชุดแปรงแต่งหน้า Professional 5 ชิ้น','ผ้าเช็ดหน้า Microfiber (แพ็ค 3)',
  'กระเป๋าเครื่องสำอาง ขนาดกลาง','หมอนรูปตัว B BeautyUp',
  'ร่มพับ ลาย BeautyUp','พัดลมพกพา USB Mini','สมุดโน้ต Premium A5',
  'ยางมัดผม Silicone (เซต 10 ชิ้น)','กระจกพกพา LED แบบพับ',
  'แผ่นมาสก์หน้า BeautyUp (แพ็ค 5)','ลิปบาล์ม BeautyUp SPF15',
  'น้ำหอมสเปรย์ Mini 30ml','คอตตอนแพด กลม (แพ็ค 100)',
];

const ORD_STATUS  = ['PENDING','PAID','PROCESSING','SHIPPED','DELIVERED','CANCELLED'];
const ORD_WEIGHTS = [0.06, 0.10, 0.16, 0.18, 0.40, 0.10];
const MEM_TYPES   = ['REGULAR','REGULAR','REGULAR','REGULAR','REGULAR','SALON','SALES'];
const RED_STATUS  = ['PENDING','PREPARING','SHIPPED','DELIVERED'];
const RED_WEIGHTS = [0.12, 0.18, 0.25, 0.45];
const WD_STATUS   = ['PENDING','APPROVED','APPROVED','REJECTED'];
const PAY_METHODS = ['PROMPTPAY','PROMPTPAY','PROMPTPAY','KBANK'];

const STATUS_TRANSITIONS = {
  PAID:       [['PENDING','PAID']],
  PROCESSING: [['PENDING','PAID'],['PAID','PROCESSING']],
  SHIPPED:    [['PENDING','PAID'],['PAID','PROCESSING'],['PROCESSING','SHIPPED']],
  DELIVERED:  [['PENDING','PAID'],['PAID','PROCESSING'],['PROCESSING','SHIPPED'],['SHIPPED','DELIVERED']],
  CANCELLED:  [['PENDING','CANCELLED']],
};

// ─── cleanup ──────────────────────────────────────────────────────────────────
async function clean() {
  process.stdout.write('🧹 Cleaning previous mock data... ');

  const memberIds = (await prisma.member.findMany({
    where: { email: { endsWith: '@mock.beautyup.test' } }, select: { id: true },
  })).map(m => m.id);

  const orderIds = (await prisma.order.findMany({
    where: { orderNumber: { startsWith: 'MFULL-' } }, select: { id: true },
  })).map(o => o.id);

  const productIds = (await prisma.product.findMany({
    where: { sku: { startsWith: 'MFULL-' } }, select: { id: true },
  })).map(p => p.id);

  const rewardIds = (await prisma.rewardProduct.findMany({
    where: { sku: { startsWith: 'PMFULL-' } }, select: { id: true },
  })).map(r => r.id);

  if (orderIds.length) {
    await prisma.orderStatusLog.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.commission.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  }
  if (memberIds.length) {
    await prisma.rewardRedemption.deleteMany({ where: { memberId: { in: memberIds } } });
    await prisma.withdrawalRequest.deleteMany({ where: { memberId: { in: memberIds } } });
    await prisma.creditTransaction.deleteMany({ where: { memberId: { in: memberIds } } });
    await prisma.memberSession.deleteMany({ where: { memberId: { in: memberIds } } });
    await prisma.memberAddress.deleteMany({ where: { memberId: { in: memberIds } } });
    await prisma.member.deleteMany({ where: { id: { in: memberIds } } });
  }
  if (rewardIds.length) {
    await prisma.rewardProductImage.deleteMany({ where: { rewardProductId: { in: rewardIds } } });
    await prisma.rewardProduct.deleteMany({ where: { id: { in: rewardIds } } });
  }
  if (productIds.length) {
    await prisma.productImage.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.bundleItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  }
  // ลบ mock banners เท่านั้น (ไม่แตะ banners จริง)
  await prisma.banner.deleteMany({ where: { eyebrow: { startsWith: '[MOCK]' } } });

  console.log('✅');
}

// ─── seed functions ───────────────────────────────────────────────────────────

/**
 * สร้าง mock products โดยใช้ Brand/Category/Collection จริงจาก DB
 * ชื่อสินค้าสอดคล้องกับประเภทสินค้าจริง (สีย้อมผม, แชมพู, ลีฟอิน, ฯลฯ)
 */
async function seedProducts() {
  // ดึงข้อมูลจริงจาก DB
  const brands = await prisma.brand.findMany({ where: { isActive: true } });
  const categories = await prisma.category.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, slug: true, brandId: true },
  });
  const collections = await prisma.collection.findMany({
    where: { isActive: true },
    select: { id: true, categoryId: true },
  });

  if (!brands.length || !categories.length) {
    console.log('  ⚠️  ไม่พบ brands หรือ categories ใน DB — seed brands/categories ก่อน');
    return [];
  }

  // Map: brandId → categories[]
  const brandCatMap = {};
  for (const cat of categories) {
    if (cat.brandId) {
      if (!brandCatMap[cat.brandId]) brandCatMap[cat.brandId] = [];
      brandCatMap[cat.brandId].push(cat);
    }
  }
  // Map: categoryId → collections[]
  const catColMap = {};
  for (const col of collections) {
    if (col.categoryId) {
      if (!catColMap[col.categoryId]) catColMap[col.categoryId] = [];
      catColMap[col.categoryId].push(col);
    }
  }

  const products = [], images = [];

  for (let i = 0; i < 300; i++) {
    const brand    = pick(brands);
    const cats     = brandCatMap[brand.id] ?? categories;
    const cat      = pick(cats);
    const catKey   = cat.slug ?? 'default';
    const spec     = PROD_BY_CAT[catKey] ?? PROD_BY_CAT['default'];
    const cols     = catColMap[cat.id] ?? [];
    const col      = cols.length && Math.random() > 0.4 ? pick(cols) : null;

    const line     = pick(spec.lines);
    const variant  = pick(spec.variants);
    const level    = pick(spec.levels);
    const size     = pick(SIZES_HAIR);
    const suffix   = level ? `${level}-${variant}` : variant;
    const name     = `${brand.name} ${line} ${suffix} ${size}`.trim();
    const price    = pick(spec.prices);
    const special  = Math.random() > 0.6 ? price - pick([10,20,30,50]) : null;
    const stock    = pick([0,0,2,3,5,10,15,20,30,50,80,100,150,200]);
    const createdAt = rdDate(400, 7);

    const prodId = `mfull-prd-${pad(i + 1, 5)}`;
    products.push({
      id: prodId,
      sku: `MFULL-${pad(i + 1, 5)}`,
      name,
      slug: `mfull-prd-${toSlug(`${brand.name}-${line}-${suffix}`)}-${pad(i + 1, 5)}`,
      description: pick(spec.desc),
      price, specialPrice: special,
      stock, reserveStock: 0, sellableStock: stock,
      status: 'ACTIVE',
      isFeatured: Math.random() > 0.88,
      tag: Math.random() > 0.75 ? pick(['NEW','SALE','HOT','BEST']) : null,
      brandId: brand.id,
      categoryId: cat.id,
      collectionId: col?.id ?? null,
      createdAt, updatedAt: createdAt,
    });

    // 1–3 รูปต่อสินค้า (ใช้ picsum seed ตาม sku ให้ภาพสม่ำเสมอ)
    const imgCount = rand(1, 3);
    for (let j = 0; j < imgCount; j++) {
      images.push({
        id: `mfull-img-${pad(i + 1, 5)}-${j}`,
        productId: prodId,
        url: `https://picsum.photos/seed/MFULL${pad(i + 1, 5)}-${j}/500/500`,
        sortOrder: j, createdAt, updatedAt: createdAt,
      });
    }
  }

  await prisma.product.createMany({ data: products, skipDuplicates: true });
  await prisma.productImage.createMany({ data: images, skipDuplicates: true });
  console.log(`  ✅ Products: ${products.length} (images: ${images.length})`);
  return products;
}

async function seedBanners() {
  // ดึง collections จริงจาก DB สำหรับ banner links
  const collections = await prisma.collection.findMany({ where: { isActive: true } });

  const defs = [
    { eyebrow:'[MOCK] NEW ARRIVAL', title:'Beauty Up Color Cream Collection', body:'สีย้อมผมโทนธรรมชาติ ให้ผลสีสม่ำเสมอ ปิดผมขาวได้ 100%', tag:'HOT', button:'ช้อปเลย', col:collections[0] },
    { eyebrow:'[MOCK] BEST SELLER', title:'Fanola Professional Series', body:'ผลิตภัณฑ์ซาลอนระดับมืออาชีพ บำรุงผมขณะให้สี', tag:'NEW', button:'ดูสินค้า', col:collections[1] },
    { eyebrow:'[MOCK] SALE', title:'ลดสูงสุด 30%', body:'ผลิตภัณฑ์คัดพิเศษ ราคาพิเศษ จำนวนจำกัด', tag:'SALE', button:'ดูโปรโมชัน', col:null },
    { eyebrow:'[MOCK] EXCLUSIVE', title:'Guwie Repair Treatment', body:'ทรีตเมนต์บำรุงผมเสีย ฟื้นฟูผมให้นุ่มลื่นใน 1 ครั้ง', tag:null, button:'ดูเซต', col:collections[2] ?? null },
    { eyebrow:'[MOCK] REWARD', title:'สะสมแต้มรับของรางวัล', body:'ช้อปทุก 500 บาท รับ 10 แต้ม แลกของรางวัลสุดพิเศษ', tag:null, button:'ดูของรางวัล', col:null },
  ];
  await prisma.banner.createMany({
    data: defs.map((d, i) => ({
      eyebrow: d.eyebrow, title: d.title, body: d.body, tag: d.tag,
      buttonLabel: d.button,
      imageUrl: `https://picsum.photos/seed/mock-banner-${i + 1}/900/450`,
      linkType: d.col ? 'collection' : 'none',
      linkId: d.col?.id ?? null,
      sortOrder: i + 1, isActive: true,
    })),
    skipDuplicates: true,
  });
  console.log(`  ✅ Banners: ${defs.length}`);
}

async function seedMembers(passHash) {
  const members = [], addresses = [];

  for (let i = 0; i < 200; i++) {
    const fn = pick(FIRST_NAMES), ln = pick(LAST_NAMES);
    const fullName = `${pick(PREFIXES)} ${fn} ${ln}`;
    const memId   = `mfull-mem-${pad(i + 1, 5)}`;
    const memType = pick(MEM_TYPES);
    const isSales = memType === 'SALES', isSalon = memType === 'SALON';
    const points  = isSales ? rand(500,10000) : isSalon ? rand(200,5000) : rand(0,1500);
    const credit  = (isSales || isSalon) ? rand(0, 5000) : 0;
    const createdAt = rdDate(730, 30);
    const phone = `0${pick([8,9])}${pad(i + 1, 8)}`;

    members.push({
      id: memId,
      email: `mock.user${pad(i + 1, 5)}@mock.beautyup.test`,
      phone,
      fullName,
      passwordHash: passHash,
      memberType: memType,
      isActive: Math.random() > 0.04,
      pointBalance: points,
      creditBalance: credit,
      bankName: !isSales && !isSalon ? null : pick(BANKS),
      bankAccountNumber: !isSales && !isSalon ? null : `${rand(100,999)}-${rand(1,9)}-${pad(rand(10000,99999), 5)}-${rand(0,9)}`,
      bankAccountName: !isSales && !isSalon ? null : fullName,
      referralCode: `MFULL${pad(i + 1, 5)}`,
      createdAt, updatedAt: createdAt,
    });

    const addrCount = rand(1, 2);
    for (let j = 0; j < addrCount; j++) {
      addresses.push({
        id: `mfull-adr-${pad(i + 1, 5)}-${j}`,
        memberId: memId,
        label: j === 0 ? pick(['บ้าน','ที่อยู่หลัก']) : pick(['ที่ทำงาน','ร้าน','สำรอง']),
        recipient: fullName,
        phone,
        addressLine1: `${rand(1,999)} หมู่ ${rand(1,12)} ถนน${pick(ROADS)}`,
        addressLine2: null,
        district: pick(['ปทุมวัน','ราษฎร์บูรณะ','ลาดกระบัง','บางนา','พระโขนง','ห้วยขวาง','จตุจักร']),
        subdistrict: pick(['บางนา','ลาดพร้าว','สาทร','สีลม','ห้วยขวาง','จตุจักร']),
        province: pick(PROVINCES),
        postalCode: `${rand(10000, 96000)}`,
        isDefault: j === 0,
        createdAt, updatedAt: createdAt,
      });
    }
  }

  await prisma.member.createMany({ data: members, skipDuplicates: true });
  await prisma.memberAddress.createMany({ data: addresses, skipDuplicates: true });
  console.log(`  ✅ Members: ${members.length} (addresses: ${addresses.length})`);
  return members;
}

async function seedOrders(members, mockProducts, carriers) {
  // ใช้ทั้ง products จริง + mock products ใน orders
  const realProducts = await prisma.product.findMany({
    where: { status: 'ACTIVE', sku: { not: { startsWith: 'MFULL-' } } },
    select: { id: true, sku: true, name: true, price: true, specialPrice: true },
  });
  const allProducts = [...realProducts, ...mockProducts];

  if (!allProducts.length) { console.log('  ⚠️  No products found'); return []; }

  const orders = [], items = [], logs = [];
  let oiIdx = 0, slIdx = 0;

  for (let i = 0; i < 500; i++) {
    const member = pick(members);
    const status = wp(ORD_STATUS, ORD_WEIGHTS);
    const createdAt = rdDate(400);
    const year = new Date(createdAt).getFullYear();
    const ordId = `mfull-ord-${pad(i + 1, 5)}`;

    const selProds = pickN(allProducts, rand(1, 4));
    let subtotal = 0;
    for (const prod of selProds) {
      const qty  = rand(1, 3);
      const unit = Number(prod.specialPrice ?? prod.price);
      const total = unit * qty;
      subtotal += total;
      items.push({
        id: `mfull-oi-${pad(++oiIdx, 6)}`,
        orderId: ordId, productId: prod.id,
        sku: prod.sku, name: prod.name,
        quantity: qty, unitPrice: unit, totalPrice: total,
        createdAt, updatedAt: createdAt,
      });
    }

    const shipping = 50;
    const total = subtotal + shipping;
    const carrier = (status === 'SHIPPED' || status === 'DELIVERED') && carriers.length
      ? pick(carriers) : null;

    orders.push({
      id: ordId,
      orderNumber: `MFULL-${year}-${pad(i + 1, 5)}`,
      memberId: member.id, status,
      subtotalAmount: subtotal, shippingAmount: shipping,
      gatewayFee: 0, discountAmount: 0, totalAmount: total,
      pointEarned: status === 'CANCELLED' ? 0 : Math.floor(total / 50),
      shippingName: member.fullName,
      shippingPhone: member.phone,
      shippingAddr: `${rand(1,999)} ถนน${pick(ROADS)} ${pick(PROVINCES)} ${rand(10000,96000)}`,
      trackingNumber: carrier ? `${carrier.shortName}${rand(100000000,999999999)}TH` : null,
      carrierId: carrier?.id ?? null,
      paymentMethod: pick(PAY_METHODS),
      createdAt, updatedAt: createdAt,
    });

    for (const [from, to] of (STATUS_TRANSITIONS[status] ?? [])) {
      logs.push({
        id: `mfull-osl-${pad(++slIdx, 6)}`,
        orderId: ordId, fromStatus: from, toStatus: to,
        changedByName: to === 'PAID' ? 'System' : 'admin@beautyup.co.th',
        createdAt,
      });
    }
  }

  await prisma.order.createMany({ data: orders, skipDuplicates: true });
  await prisma.orderItem.createMany({ data: items, skipDuplicates: true });
  await prisma.orderStatusLog.createMany({ data: logs, skipDuplicates: true });
  console.log(`  ✅ Orders: ${orders.length} | Items: ${items.length} | Logs: ${logs.length}`);
  return orders;
}

async function seedRewardProducts() {
  const rewards = [], images = [];
  for (let i = 0; i < REWARD_NAMES.length; i++) {
    const rwId  = `mfull-rwd-${pad(i + 1)}`;
    const stock = pick([0, 3, 5, 10, 20, 50, 100]);
    rewards.push({
      id: rwId, sku: `PMFULL-${pad(i + 1)}`,
      name: REWARD_NAMES[i],
      description: `${REWARD_NAMES[i]} — ของรางวัลพิเศษสำหรับสมาชิก BeautyUp`,
      imageUrl: `https://picsum.photos/seed/pmfull-${i + 1}-0/400/400`,
      pointCost: pick([100,150,200,300,500,750,1000]),
      stock, isActive: stock > 0,
      createdAt: rdDate(180), updatedAt: new Date(),
    });
    for (let j = 0; j < rand(1, 3); j++) {
      images.push({
        id: `mfull-rwi-${pad(i + 1)}-${j}`,
        rewardProductId: rwId,
        url: `https://picsum.photos/seed/pmfull-${i + 1}-${j}/400/400`,
        sortOrder: j, createdAt: new Date(), updatedAt: new Date(),
      });
    }
  }
  await prisma.rewardProduct.createMany({ data: rewards, skipDuplicates: true });
  await prisma.rewardProductImage.createMany({ data: images, skipDuplicates: true });
  console.log(`  ✅ Reward Products: ${rewards.length} (images: ${images.length})`);
  return rewards;
}

async function seedRedemptions(members, rewardProducts, carriers) {
  const pool = rewardProducts.filter(r => r.isActive);
  const src  = pool.length ? pool : rewardProducts;
  const data = [];

  for (let i = 0; i < 200; i++) {
    const member = pick(members);
    const reward = pick(src);
    const status = wp(RED_STATUS, RED_WEIGHTS);
    const carrier = (status === 'SHIPPED' || status === 'DELIVERED') && carriers.length
      ? pick(carriers) : null;
    const createdAt = rdDate(180);

    data.push({
      id: `mfull-red-${pad(i + 1, 5)}`,
      memberId: member.id, rewardProductId: reward.id,
      pointsSpent: reward.pointCost, status,
      trackingNumber: carrier ? `${carrier.shortName}${rand(100000000,999999999)}TH` : null,
      carrierId: carrier?.id ?? null,
      shippingRecipient: member.fullName,
      shippingPhone: member.phone,
      shippingAddress: `${rand(1,999)} ถนน${pick(ROADS)} ${pick(PROVINCES)} ${rand(10000,96000)}`,
      statusUpdatedAt: status !== 'PENDING' ? createdAt : null,
      createdAt, updatedAt: createdAt,
    });
  }

  await prisma.rewardRedemption.createMany({ data, skipDuplicates: true });
  console.log(`  ✅ Redemptions: ${data.length}`);
}

async function seedCommissionsAndCredits(members, orders) {
  const eligible  = members.filter(m => m.memberType !== 'REGULAR');
  const eligOrders = orders.filter(o => ['DELIVERED','PAID','SHIPPED','PROCESSING'].includes(o.status));
  if (!eligible.length || !eligOrders.length) return;

  const commissions = [], credits = [];
  let comIdx = 0, crdIdx = 0;

  for (const order of eligOrders) {
    if (Math.random() > 0.45) continue;
    const earner = pick(eligible);
    const rate   = earner.memberType === 'SALES' ? pick([5,8,10]) : pick([3,5]);
    const amount = parseFloat((Number(order.totalAmount) * rate / 100).toFixed(2));
    commissions.push({
      id: `mfull-com-${pad(++comIdx, 5)}`,
      earnerId: earner.id, orderId: order.id,
      orderAmount: order.totalAmount, rate, amount,
      status: Math.random() > 0.5 ? 'PENDING' : 'PAID',
      createdAt: order.createdAt, updatedAt: order.createdAt,
    });
    credits.push({
      id: `mfull-crd-${pad(++crdIdx, 5)}`,
      memberId: earner.id, type: 'EARN', amount,
      note: `คอมมิชชัน ${order.orderNumber}`,
      createdAt: order.createdAt,
    });
  }

  const sales = members.filter(m => m.memberType === 'SALES');
  for (let i = 0; i < sales.length * 3; i++) {
    credits.push({
      id: `mfull-crd-bon-${pad(i + 1)}`,
      memberId: pick(sales).id, type: 'EARN',
      amount: pick([500,800,1000,1500,2000]),
      note: `โบนัส${pick(['รายเดือน','ไตรมาส','พิเศษ'])} ${rand(1,4)}/${new Date().getFullYear()}`,
      createdAt: rdDate(365),
    });
  }

  await prisma.commission.createMany({ data: commissions, skipDuplicates: true });
  await prisma.creditTransaction.createMany({ data: credits, skipDuplicates: true });
  console.log(`  ✅ Commissions: ${commissions.length} | Credits: ${credits.length}`);
}

async function seedWithdrawals(members) {
  const eligible = members.filter(m => m.memberType !== 'REGULAR' && m.bankName);
  const data = [];

  for (let i = 0; i < Math.min(40, eligible.length * 3); i++) {
    const member = pick(eligible);
    const status = pick(WD_STATUS);
    const createdAt = rdDate(180);
    data.push({
      id: `mfull-wd-${pad(i + 1)}`,
      memberId: member.id,
      amount: pick([500,1000,1500,2000,3000,5000]),
      status,
      bankName: member.bankName,
      bankAccountNumber: member.bankAccountNumber,
      bankAccountName: member.bankAccountName,
      note: status === 'REJECTED' ? pick(['ข้อมูลบัญชีไม่ถูกต้อง','ยอดถอนไม่ครบขั้นต่ำ']) : null,
      slipUrl: status === 'APPROVED' ? `https://picsum.photos/seed/slip-${i}/400/600` : null,
      processedAt: status !== 'PENDING' ? createdAt : null,
      processedByEmail: status !== 'PENDING' ? 'admin@beautyup.co.th' : null,
      createdAt, updatedAt: createdAt,
    });
  }

  await prisma.withdrawalRequest.createMany({ data, skipDuplicates: true });
  console.log(`  ✅ Withdrawals: ${data.length}`);
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌱 BeautyUp Full Mock Data Generator');
  console.log('=====================================');
  console.log('ใช้ Brand/Category/Collection จาก DB จริง\n');

  await clean();
  if (IS_CLEAN) { console.log('\n✅ Clean complete.\n'); return; }

  // SHA-256 (เหมือนที่ mobile.service.ts ใช้) — ไม่ต้อง install bcrypt
  const passHash = createHash('sha256').update('password').digest('hex');
  console.log('\n📦 Seeding:\n');

  const carriers = await prisma.carrier.findMany({ where: { isActive: true } });
  if (!carriers.length) console.warn('⚠️  No carriers — run seed-carriers.mjs first\n');

  // products ใช้ brand/category/collection จริงจาก DB
  const products = await seedProducts();
  await seedBanners();
  const members  = await seedMembers(passHash);
  const orders   = await seedOrders(members, products, carriers);
  const rewards  = await seedRewardProducts();
  await seedRedemptions(members, rewards, carriers);
  await seedCommissionsAndCredits(members, orders);
  await seedWithdrawals(members);

  console.log('\n🎉 Done! 2,500+ records created.\n');
  console.log('📋 Test accounts (password: "password"):');
  console.log('   mock.user00001@mock.beautyup.test  ถึง');
  console.log('   mock.user00200@mock.beautyup.test\n');
  console.log('💡 Salon/Sales แทรกอยู่แบบสุ่ม ดูได้จาก Admin → Members\n');
}

main()
  .catch(e => { console.error('\n❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { UserRole as UR } from '../src/common/enums/user-role.enum';
import { upsertProjectMembershipInTx } from '../src/users/project-membership.helper';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const DEMO_TENANT = 'tenant-demo-01';
const DEV_PASSWORD = 'ChangeMe123!';

/** 手動登録相当：株式会社AA テナント＋企業管理者＋PJAA用ダミー director2 / IS5（メール全局一致のため太郎は1テナントのみ） */
const TENANT_KABUSHIKI_AA_ID = 'tenant-kabushiki-aa';
const TAROU_WORK_EMAIL = 'tarou.work363@gmail.com';
const TAROU_WORK_PASSWORD = '1234';

/** 再実行しても置き換わる架電リスト（配布UI・条件フィルタの動作確認用） */
const SEED_CALLING_LIST_ID = 'seed-calling-list-distribute-demo';

/** 営業ルーム・架電リストUI用の第2リスト（サンプル件数多め） */
const SEED_CALLING_LIST_KANBAN_ID = 'seed-calling-list-kanban-sample';

/** ダミー明細30件専用リスト（件数固定の動作確認用） */
const SEED_CALLING_LIST_THIRTY_ID = 'seed-calling-list-dummy-30-items';

/** リスト明細と企業詳細APIを紐づけるデモ用法人（固定ID） */
const SEED_LEGAL_ENTITY_IDS = {
  ginza: 'seed-legal-entity-ginza-food',
  shibuya: 'seed-legal-entity-shibuya-cafe',
  shinbashi: 'seed-legal-entity-shinbashi-b2b',
  yokohama: 'seed-legal-entity-yokohama-lead',
  nagoya: 'seed-legal-entity-nagoya-recall',
} as const;

/** 架電リスト明細のシード行（複数リストで共通） */
type ItemSeed = {
  companyName: string;
  phone: string;
  address: string;
  targetUrl: string;
  industryTag: string | null;
  aiListTier: string | null;
  status: string;
  assignedToUserId: string | null;
  assignedAt: string | null;
  assignedByUserId: string | null;
  statusUpdatedAt: string | null;
  completedAt: string | null;
  legalEntityId?: string | null;
};

const demoUsers = [
  { email: 'developer@example.com', name: 'Developer User', role: 'developer' },
  { email: 'isadmin@example.com', name: 'IS Admin User', role: 'is_admin' },
  { email: 'member@example.com', name: 'IS Member User', role: 'is_member' },
  { email: 'director@example.com', name: 'Director User', role: 'director' },
  { email: 'company@example.com', name: 'Company Admin User', role: 'enterprise_admin' },
];

/** 管理BOX用デモ：住所（国旗+都道府県）・携帯 */
const demoUserProfileByEmail: Record<string, { prefecture: string; mobilePhone: string; countryCode: string }> = {
  'developer@example.com': { prefecture: '東京都', mobilePhone: '090-1000-0001', countryCode: 'JP' },
  'director@example.com': { prefecture: '東京都', mobilePhone: '090-2000-0002', countryCode: 'JP' },
  'member@example.com': { prefecture: '大阪府', mobilePhone: '080-3000-0003', countryCode: 'JP' },
  'isadmin@example.com': { prefecture: '神奈川県', mobilePhone: '070-4000-0004', countryCode: 'JP' },
  'company@example.com': { prefecture: '福岡県', mobilePhone: '090-5000-0005', countryCode: 'JP' },
};

async function main(): Promise<void> {
  const hashedPassword = await bcrypt.hash(DEV_PASSWORD, 10);
  const now = new Date().toISOString();

  await seedKabushikiAaTarou(now);
  await seedKabushikiAaPjaaDummyMembers(hashedPassword, now);
  await seedDemoTenant(now);

  for (const u of demoUsers) {
    const prof = demoUserProfileByEmail[u.email] ?? {
      prefecture: '',
      mobilePhone: '',
      countryCode: 'JP',
    };
    await prisma.user.upsert({
      where: {
        tenantId_email: { tenantId: DEMO_TENANT, email: u.email },
      },
      create: {
        tenantId: DEMO_TENANT,
        email: u.email,
        name: u.name,
        role: u.role,
        roles: [u.role],
        passwordHash: hashedPassword,
        countryCode: prof.countryCode,
        prefecture: prof.prefecture || null,
        mobilePhone: prof.mobilePhone || null,
        createdAt: now,
        updatedAt: now,
      },
      update: {
        name: u.name,
        role: u.role,
        roles: [u.role],
        passwordHash: hashedPassword,
        countryCode: prof.countryCode,
        prefecture: prof.prefecture || null,
        mobilePhone: prof.mobilePhone || null,
        updatedAt: now,
      },
    });
  }

  console.log('Seed: demo users upserted.');

  // リスト生成用マスタ（デモ用・選択式で使う）
  const areas = ['東京都', '大阪府', '神奈川県'];
  for (const name of areas) {
    await prisma.listAreaMaster.upsert({
      where: { tenantId_name: { tenantId: DEMO_TENANT, name } },
      create: { tenantId: DEMO_TENANT, name, isActive: true, createdAt: now, updatedAt: now },
      update: { isActive: true, updatedAt: now },
    });
  }
  const industries: { name: string; groupLabel: string }[] = [
    { name: 'SaaS・クラウド', groupLabel: '情報通信業' },
    { name: '受託開発', groupLabel: '情報通信業' },
    { name: '食品製造', groupLabel: '製造業' },
    { name: '金属加工', groupLabel: '製造業' },
    { name: '外食・レストラン', groupLabel: '宿泊・飲食サービス業' },
    { name: '小売（店舗）', groupLabel: '卸売・小売業' },
  ];
  for (const row of industries) {
    await prisma.listIndustryMaster.upsert({
      where: { tenantId_name: { tenantId: DEMO_TENANT, name: row.name } },
      create: {
        tenantId: DEMO_TENANT,
        name: row.name,
        groupLabel: row.groupLabel,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      update: { groupLabel: row.groupLabel, isActive: true, updatedAt: now },
    });
  }
  const keywords = ['BtoB', '従業員50人以上', '上場企業'];
  for (const name of keywords) {
    await prisma.listKeywordMaster.upsert({
      where: { tenantId_name: { tenantId: DEMO_TENANT, name } },
      create: { tenantId: DEMO_TENANT, name, isActive: true, createdAt: now, updatedAt: now },
      update: { isActive: true, updatedAt: now },
    });
  }
  console.log('Seed: list masters (area, industry, keyword) upserted.');

  await seedDummyUsersToThirty(hashedPassword, now);
  await seedLegalEntitiesForListDemo(now);
  await seedCallingListDemo(now);
  await seedCallingListKanbanSample(now);
  await seedCallingListThirtyDummyItems(now);

  await syncAllProjectsAndMemberships();
}

/** 全テナントに既定PJを作り、全ユーザーの project_memberships を User.roles と一致させる */
async function syncAllProjectsAndMemberships(): Promise<void> {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  const roleValues = new Set<string>(Object.values(UR));
  for (const { id: tenantId } of tenants) {
    await prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({ where: { tenantId } });
      for (const u of users) {
        const raw = u.roles && u.roles.length > 0 ? u.roles : [u.role];
        const roles = raw.filter((x): x is UR => typeof x === 'string' && roleValues.has(x));
        if (roles.length === 0) {
          continue;
        }
        await upsertProjectMembershipInTx(tx, { tenantId, userId: u.id, roles });
      }
    });
  }
  console.log('Seed: projects + project_memberships synced for all tenants.');
}

/**
 * 株式会社AA テナントと tarou.work363@gmail.com（開発用短パスワード）。
 * 同一メールが別テナントに残るとログインが不定になるため、当該メールのユーザーは全削除してから再作成する。
 */
/** デモユーザー用テナント（所属企業・PJ名のヘッダー表示用） */
async function seedDemoTenant(now: string): Promise<void> {
  await prisma.tenant.upsert({
    where: { id: DEMO_TENANT },
    create: {
      id: DEMO_TENANT,
      name: 'デモ株式会社',
      companyName: 'デモ株式会社',
      projectDisplayName: 'IS架電デモPJ',
      headOfficeAddress: '東京都千代田区',
      headOfficePhone: '03-0000-0000',
      representativeName: 'デモ 代表',
      accountStatus: 'active',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      name: 'デモ株式会社',
      companyName: 'デモ株式会社',
      projectDisplayName: 'IS架電デモPJ',
      updatedAt: now,
    },
  });
  console.log('Seed: demo tenant (tenant-demo-01) upserted.');
}

async function seedKabushikiAaTarou(now: string): Promise<void> {
  const emailNorm = TAROU_WORK_EMAIL.trim().toLowerCase();
  const hash1234 = await bcrypt.hash(TAROU_WORK_PASSWORD, 10);
  /** ダミー構成は別ユーザーで director×2・IS×5。太郎は企業管理者のみ */
  const rolesAa = ['enterprise_admin'] as string[];

  await prisma.tenant.upsert({
    where: { id: TENANT_KABUSHIKI_AA_ID },
    create: {
      id: TENANT_KABUSHIKI_AA_ID,
      name: '株式会社AA',
      companyName: '株式会社AA',
      projectDisplayName: 'PJAA架電PJ',
      headOfficeAddress: '東京都港区港南1-1-1',
      headOfficePhone: '03-0000-0000',
      representativeName: '代表 太郎',
      accountStatus: 'active',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      name: '株式会社AA',
      companyName: '株式会社AA',
      projectDisplayName: 'PJAA架電PJ',
      accountStatus: 'active',
      isActive: true,
      updatedAt: now,
    },
  });

  const deleted = await prisma.user.deleteMany({ where: { email: emailNorm } });
  if (deleted.count > 0) {
    console.log(`Seed: removed ${deleted.count} user row(s) with email ${emailNorm} (re-bind to 株式会社AA).`);
  }

  await prisma.user.create({
    data: {
      tenantId: TENANT_KABUSHIKI_AA_ID,
      email: emailNorm,
      name: '太郎',
      role: 'enterprise_admin',
      roles: rolesAa,
      passwordHash: hash1234,
      countryCode: 'JP',
      prefecture: '東京都',
      mobilePhone: '090-8888-9999',
      createdAt: now,
      updatedAt: now,
    },
  });

  console.log(
    'Seed: 株式会社AA tenant + tarou.work363@gmail.com (enterprise_adminのみ, dev password per TAROU_WORK_PASSWORD in seed.ts). PJAAダミーは seedKabushikiAaPjaaDummyMembers を参照。',
  );
}

/** 株式会社AA / PJAA架電PJ 用: ディレクター2名・IS5名（ログインは DEV_PASSWORD） */
async function seedKabushikiAaPjaaDummyMembers(
  hashedPassword: string,
  now: string,
): Promise<void> {
  const prefRot = ['東京都', '大阪府', '神奈川県', '愛知県', '福岡県', '北海道'];

  /** 旧シードの1名用メール（2名構成に統一するため削除） */
  await prisma.user.deleteMany({
    where: {
      tenantId: TENANT_KABUSHIKI_AA_ID,
      email: 'pjaa-director@example.com',
    },
  });

  for (let d = 1; d <= 2; d += 1) {
    const dnum = String(d).padStart(2, '0');
    const directorEmail = `pjaa-director-${dnum}@example.com`;
    const prefecture = prefRot[(d - 1) % prefRot.length];
    await prisma.user.upsert({
      where: {
        tenantId_email: { tenantId: TENANT_KABUSHIKI_AA_ID, email: directorEmail },
      },
      create: {
        tenantId: TENANT_KABUSHIKI_AA_ID,
        email: directorEmail,
        name: `PJAA ディレクター${dnum}（ダミー）`,
        role: 'director',
        roles: ['director'],
        passwordHash: hashedPassword,
        countryCode: 'JP',
        prefecture,
        mobilePhone: `090-710${d}-000${d}`,
        createdAt: now,
        updatedAt: now,
      },
      update: {
        name: `PJAA ディレクター${dnum}（ダミー）`,
        role: 'director',
        roles: ['director'],
        passwordHash: hashedPassword,
        countryCode: 'JP',
        prefecture,
        mobilePhone: `090-710${d}-000${d}`,
        updatedAt: now,
      },
    });
  }

  for (let i = 1; i <= 5; i += 1) {
    const num = String(i).padStart(2, '0');
    const email = `pjaa-is-${num}@example.com`;
    const prefecture = prefRot[(i - 1) % prefRot.length];
    await prisma.user.upsert({
      where: {
        tenantId_email: { tenantId: TENANT_KABUSHIKI_AA_ID, email },
      },
      create: {
        tenantId: TENANT_KABUSHIKI_AA_ID,
        email,
        name: `PJAA ISメンバー${num}（ダミー）`,
        role: 'is_member',
        roles: ['is_member'],
        passwordHash: hashedPassword,
        countryCode: 'JP',
        prefecture,
        mobilePhone: `080-72${num}-1000`,
        createdAt: now,
        updatedAt: now,
      },
      update: {
        name: `PJAA ISメンバー${num}（ダミー）`,
        role: 'is_member',
        roles: ['is_member'],
        passwordHash: hashedPassword,
        countryCode: 'JP',
        prefecture,
        mobilePhone: `080-72${num}-1000`,
        updatedAt: now,
      },
    });
  }

  console.log(
    `Seed: 株式会社AA / PJAA架電PJ ダミー director2+IS5 upserted. pjaa-director-01,02@example.com / pjaa-is-01..05@example.com パスワード: ${DEV_PASSWORD}`,
  );
}

/**
 * 既存5名 + ダミー25名 = 同一テナントでユーザー計30件（ログイン用パスワードは DEV_PASSWORD）
 */
async function seedDummyUsersToThirty(hashedPassword: string, now: string): Promise<void> {
  const prefRot = ['東京都', '大阪府', '愛知県', '福岡県', '北海道'];
  for (let i = 1; i <= 25; i += 1) {
    const num = String(i).padStart(2, '0');
    const email = `dummy-is-${num}@example.com`;
    const prefecture = prefRot[(i - 1) % prefRot.length];
    await prisma.user.upsert({
      where: {
        tenantId_email: { tenantId: DEMO_TENANT, email },
      },
      create: {
        tenantId: DEMO_TENANT,
        email,
        name: `Dummy IS Member ${num}`,
        role: 'is_member',
        roles: ['is_member'],
        passwordHash: hashedPassword,
        countryCode: 'JP',
        prefecture,
        mobilePhone: `080-55${num}-1000`,
        createdAt: now,
        updatedAt: now,
      },
      update: {
        name: `Dummy IS Member ${num}`,
        role: 'is_member',
        roles: ['is_member'],
        passwordHash: hashedPassword,
        countryCode: 'JP',
        prefecture,
        mobilePhone: `080-55${num}-1000`,
        updatedAt: now,
      },
    });
  }
  console.log('Seed: dummy is_member users 01–25 upserted (demo tenant users total = 30).');
}

/**
 * 架電リスト明細と GET /companies/:legalEntityId をつなぐデモ用法人
 */
async function seedLegalEntitiesForListDemo(now: string): Promise<void> {
  const rows: {
    id: string;
    name: string;
    headOfficeAddress: string;
    status: string;
  }[] = [
    {
      id: SEED_LEGAL_ENTITY_IDS.ginza,
      name: 'シード飲食 銀座一号店',
      headOfficeAddress: '東京都中央区銀座1-1-1',
      status: '未精査',
    },
    {
      id: SEED_LEGAL_ENTITY_IDS.shibuya,
      name: 'シード飲食 渋谷カフェ',
      headOfficeAddress: '東京都渋谷区道玄坂2-2-2',
      status: '未精査',
    },
    {
      id: SEED_LEGAL_ENTITY_IDS.shinbashi,
      name: 'シード架電サンプル 新橋BtoB',
      headOfficeAddress: '東京都港区新橋1-5-1',
      status: '未精査',
    },
    {
      id: SEED_LEGAL_ENTITY_IDS.yokohama,
      name: 'シードリード 横浜みなとみらい商事',
      headOfficeAddress: '神奈川県横浜市中区海岸通1-1-1',
      status: '未精査',
    },
    {
      id: SEED_LEGAL_ENTITY_IDS.nagoya,
      name: 'シード再架電 名古屋駅前サービス',
      headOfficeAddress: '愛知県名古屋市中村区名駅4-7-1',
      status: '未精査',
    },
  ];

  for (const r of rows) {
    await prisma.legalEntity.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        tenantId: DEMO_TENANT,
        name: r.name,
        headOfficeAddress: r.headOfficeAddress,
        status: r.status,
        createdAt: now,
        updatedAt: now,
      },
      update: {
        name: r.name,
        headOfficeAddress: r.headOfficeAddress,
        status: r.status,
        updatedAt: now,
      },
    });
  }
  console.log('Seed: legal entities for list demo upserted.');
}

/**
 * 担当へ配布・東京×飲食フィルタ・KPIマトリクス確認用のリスト＋明細
 */
async function seedCallingListDemo(now: string): Promise<void> {
  const director = await prisma.user.findFirst({
    where: { tenantId: DEMO_TENANT, email: 'director@example.com' },
    select: { id: true },
  });
  const member = await prisma.user.findFirst({
    where: { tenantId: DEMO_TENANT, email: 'member@example.com' },
    select: { id: true },
  });
  if (!director || !member) {
    console.warn('Seed: skip calling list demo (director or member user missing).');
    return;
  }

  await prisma.listItem.deleteMany({ where: { listId: SEED_CALLING_LIST_ID } });
  await prisma.callingList.deleteMany({ where: { id: SEED_CALLING_LIST_ID } });

  const items: ItemSeed[] = [
    // 東京 + 飲食（条件「東京」「飲食」でヒット）— 均等配布の主対象
    {
      companyName: 'シード飲食 銀座一号店',
      phone: '03-0000-0001',
      address: '東京都中央区銀座1-1-1',
      targetUrl: 'https://seed.local/tokyo-food-001',
      industryTag: '飲食・レストラン',
      aiListTier: 'A',
      status: 'unstarted',
      assignedToUserId: null,
      assignedAt: null,
      assignedByUserId: null,
      statusUpdatedAt: null,
      completedAt: null,
      legalEntityId: SEED_LEGAL_ENTITY_IDS.ginza,
    },
    {
      companyName: 'シード飲食 渋谷カフェ',
      phone: '03-0000-0002',
      address: '東京都渋谷区道玄坂2-2-2',
      targetUrl: 'https://seed.local/tokyo-food-002',
      industryTag: '飲食',
      aiListTier: 'B',
      status: 'unstarted',
      assignedToUserId: null,
      assignedAt: null,
      assignedByUserId: null,
      statusUpdatedAt: null,
      completedAt: null,
      legalEntityId: SEED_LEGAL_ENTITY_IDS.shibuya,
    },
    {
      companyName: 'シード飲食 新宿居酒屋',
      phone: '03-0000-0003',
      address: '東京都新宿区西新宿3-3-3',
      targetUrl: 'https://seed.local/tokyo-food-003',
      industryTag: '飲食店',
      aiListTier: 'C',
      status: 'unstarted',
      assignedToUserId: null,
      assignedAt: null,
      assignedByUserId: null,
      statusUpdatedAt: null,
      completedAt: null,
    },
    {
      companyName: 'シード飲食 港区レストラン',
      phone: '03-0000-0004',
      address: '東京都港区赤坂4-4-4',
      targetUrl: 'https://seed.local/tokyo-food-004',
      industryTag: '飲食 洋食',
      aiListTier: 'A',
      status: 'unstarted',
      assignedToUserId: null,
      assignedAt: null,
      assignedByUserId: null,
      statusUpdatedAt: null,
      completedAt: null,
    },
    {
      companyName: 'シード飲食 品川弁当',
      phone: '03-0000-0005',
      address: '東京都品川区大井5-5-5',
      targetUrl: 'https://seed.local/tokyo-food-005',
      industryTag: '飲食',
      aiListTier: 'B',
      status: 'unstarted',
      assignedToUserId: null,
      assignedAt: null,
      assignedByUserId: null,
      statusUpdatedAt: null,
      completedAt: null,
    },
    // 東京 + IT（住所のみ東京で業種フィルタと組み合わせ確認）
    {
      companyName: 'シードIT 渋谷SaaS',
      phone: '03-1000-0001',
      address: '東京都渋谷区神南1-1-1',
      targetUrl: 'https://seed.local/tokyo-it-001',
      industryTag: 'IT・ソフトウェア',
      aiListTier: 'A',
      status: 'unstarted',
      assignedToUserId: null,
      assignedAt: null,
      assignedByUserId: null,
      statusUpdatedAt: null,
      completedAt: null,
    },
    {
      companyName: 'シードIT 港区クラウド',
      phone: '03-1000-0002',
      address: '東京都港区六本木2-2-2',
      targetUrl: 'https://seed.local/tokyo-it-002',
      industryTag: 'IT',
      aiListTier: 'B',
      status: 'unstarted',
      assignedToUserId: null,
      assignedAt: null,
      assignedByUserId: null,
      statusUpdatedAt: null,
      completedAt: null,
    },
    // 大阪 + 飲食（住所に東京を含まない → 東京フィルタで除外される想定）
    {
      companyName: 'シード飲食 梅田店',
      phone: '06-0000-0001',
      address: '大阪府大阪市北区梅田1-1-1',
      targetUrl: 'https://seed.local/osaka-food-001',
      industryTag: '飲食',
      aiListTier: 'C',
      status: 'unstarted',
      assignedToUserId: null,
      assignedAt: null,
      assignedByUserId: null,
      statusUpdatedAt: null,
      completedAt: null,
    },
    {
      companyName: 'シード飲食 難波店',
      phone: '06-0000-0002',
      address: '大阪府大阪市中央区難波2-2-2',
      targetUrl: 'https://seed.local/osaka-food-002',
      industryTag: '飲食・小売',
      aiListTier: 'A',
      status: 'unstarted',
      assignedToUserId: null,
      assignedAt: null,
      assignedByUserId: null,
      statusUpdatedAt: null,
      completedAt: null,
    },
    // KPIマトリクス用（member に割当済みのバリエーション）
    {
      companyName: 'シード済み 架電中商事',
      phone: '03-2000-0001',
      address: '東京都千代田区丸の内1-1-1',
      targetUrl: 'https://seed.local/member-calling-001',
      industryTag: '卸売',
      aiListTier: 'B',
      status: 'calling',
      assignedToUserId: member.id,
      assignedAt: now,
      assignedByUserId: director.id,
      statusUpdatedAt: now,
      completedAt: null,
    },
    {
      companyName: 'シード済み 完了物流',
      phone: '03-2000-0002',
      address: '東京都江東区豊洲2-2-2',
      targetUrl: 'https://seed.local/member-done-001',
      industryTag: '物流',
      aiListTier: 'C',
      status: 'done',
      assignedToUserId: member.id,
      assignedAt: now,
      assignedByUserId: director.id,
      statusUpdatedAt: now,
      completedAt: now,
    },
    {
      companyName: 'シード除外 テレアポNG',
      phone: '03-2000-0003',
      address: '東京都世田谷区三軒茶屋3-3-3',
      targetUrl: 'https://seed.local/member-excluded-001',
      industryTag: 'サービス',
      aiListTier: 'A',
      status: 'excluded',
      assignedToUserId: member.id,
      assignedAt: now,
      assignedByUserId: director.id,
      statusUpdatedAt: now,
      completedAt: null,
    },
  ];

  await prisma.callingList.create({
    data: {
      id: SEED_CALLING_LIST_ID,
      tenantId: DEMO_TENANT,
      name: '【seed】配布・フィルタ検証リスト',
      sourceType: 'csv',
      createdBy: director.id,
      createdAt: now,
      itemCount: items.length,
      /** IS メンバーが /lists/assigned/me と getAssignedListItems で参照できるようにする */
      assigneeEmail: 'member@example.com',
      assignedBy: 'director@example.com',
      assignedAt: now,
      items: {
        create: items.map((row) => ({
          tenantId: DEMO_TENANT,
          companyName: row.companyName,
          phone: row.phone,
          address: row.address,
          targetUrl: row.targetUrl,
          industryTag: row.industryTag,
          aiListTier: row.aiListTier,
          status: row.status,
          assignedToUserId: row.assignedToUserId,
          assignedAt: row.assignedAt,
          assignedByUserId: row.assignedByUserId,
          statusUpdatedAt: row.statusUpdatedAt,
          completedAt: row.completedAt,
          legalEntityId: row.legalEntityId ?? null,
          createdAt: now,
        })),
      },
    },
  });

  console.log(
    `Seed: calling list demo "${SEED_CALLING_LIST_ID}" (${items.length} items). ` +
      `ログイン例: director@example.com（配布） / member@example.com（IS） パスワード: ${DEV_PASSWORD}`,
  );
}

/**
 * 架電リスト（一覧・カンバン想定）用の第2リスト。ISメンバー向けに件数多め・ステータス混在。
 */
async function seedCallingListKanbanSample(now: string): Promise<void> {
  const director = await prisma.user.findFirst({
    where: { tenantId: DEMO_TENANT, email: 'director@example.com' },
    select: { id: true },
  });
  const member = await prisma.user.findFirst({
    where: { tenantId: DEMO_TENANT, email: 'member@example.com' },
    select: { id: true },
  });
  if (!director || !member) {
    console.warn('Seed: skip kanban calling list (director or member user missing).');
    return;
  }

  /** assignedAt 降順で架電サンプルリストが先に来るよう、第1リストより新しい時刻にする */
  const listAssignedAt = new Date(Date.parse(now) + 5000).toISOString();

  await prisma.listItem.deleteMany({ where: { listId: SEED_CALLING_LIST_KANBAN_ID } });
  await prisma.callingList.deleteMany({ where: { id: SEED_CALLING_LIST_KANBAN_ID } });

  const kanbanItems: ItemSeed[] = [
    {
      companyName: 'シード架電サンプル 新橋BtoB',
      phone: '03-3000-0001',
      address: '東京都港区新橋1-5-1',
      targetUrl: 'https://seed.local/kanban-shinbashi',
      industryTag: '卸売・小売業',
      aiListTier: 'A',
      status: 'unstarted',
      assignedToUserId: member.id,
      assignedAt: listAssignedAt,
      assignedByUserId: director.id,
      statusUpdatedAt: null,
      completedAt: null,
      legalEntityId: SEED_LEGAL_ENTITY_IDS.shinbashi,
    },
    {
      companyName: 'シードリード 横浜みなとみらい商事',
      phone: '045-000-0001',
      address: '神奈川県横浜市中区海岸通1-1-1',
      targetUrl: 'https://seed.local/kanban-yokohama',
      industryTag: '情報通信業',
      aiListTier: 'B',
      status: 'unstarted',
      assignedToUserId: member.id,
      assignedAt: listAssignedAt,
      assignedByUserId: director.id,
      statusUpdatedAt: null,
      completedAt: null,
      legalEntityId: SEED_LEGAL_ENTITY_IDS.yokohama,
    },
    {
      companyName: 'シード再架電 名古屋駅前サービス',
      phone: '052-000-0001',
      address: '愛知県名古屋市中村区名駅4-7-1',
      targetUrl: 'https://seed.local/kanban-nagoya',
      industryTag: 'サービス',
      aiListTier: 'C',
      status: 'calling',
      assignedToUserId: member.id,
      assignedAt: listAssignedAt,
      assignedByUserId: director.id,
      statusUpdatedAt: listAssignedAt,
      completedAt: null,
      legalEntityId: SEED_LEGAL_ENTITY_IDS.nagoya,
    },
    {
      companyName: 'シードサンプル 札幌北ビジネス',
      phone: '011-000-0001',
      address: '北海道札幌市中央区北1条西3-3',
      targetUrl: 'https://seed.local/kanban-sapporo',
      industryTag: '不動産',
      aiListTier: 'A',
      status: 'unstarted',
      assignedToUserId: member.id,
      assignedAt: listAssignedAt,
      assignedByUserId: director.id,
      statusUpdatedAt: null,
      completedAt: null,
    },
    {
      companyName: 'シードサンプル 福岡天神コール',
      phone: '092-000-0001',
      address: '福岡県福岡市中央区天神1-1-1',
      targetUrl: 'https://seed.local/kanban-fukuoka',
      industryTag: '小売（店舗）',
      aiListTier: 'B',
      status: 'done',
      assignedToUserId: member.id,
      assignedAt: listAssignedAt,
      assignedByUserId: director.id,
      statusUpdatedAt: listAssignedAt,
      completedAt: listAssignedAt,
    },
    {
      companyName: 'シードサンプル 広島製造ライン',
      phone: '082-000-0001',
      address: '広島県広島市中区紙屋町1-1-1',
      targetUrl: 'https://seed.local/kanban-hiroshima',
      industryTag: '製造業',
      aiListTier: 'C',
      status: 'excluded',
      assignedToUserId: member.id,
      assignedAt: listAssignedAt,
      assignedByUserId: director.id,
      statusUpdatedAt: listAssignedAt,
      completedAt: null,
    },
    {
      companyName: 'シードサンプル 千葉物流ハブ',
      phone: '043-000-0001',
      address: '千葉県千葉市中央区中央1-1-1',
      targetUrl: 'https://seed.local/kanban-chiba',
      industryTag: '物流',
      aiListTier: 'A',
      status: 'unstarted',
      assignedToUserId: member.id,
      assignedAt: listAssignedAt,
      assignedByUserId: director.id,
      statusUpdatedAt: null,
      completedAt: null,
    },
    {
      companyName: 'シードサンプル さいたま建設事務所',
      phone: '048-000-0001',
      address: '埼玉県さいたま市大宮区桜木町1-1-1',
      targetUrl: 'https://seed.local/kanban-saitama',
      industryTag: '建設',
      aiListTier: 'B',
      status: 'calling',
      assignedToUserId: member.id,
      assignedAt: listAssignedAt,
      assignedByUserId: director.id,
      statusUpdatedAt: listAssignedAt,
      completedAt: null,
    },
  ];

  await prisma.callingList.create({
    data: {
      id: SEED_CALLING_LIST_KANBAN_ID,
      tenantId: DEMO_TENANT,
      name: '【seed】架電リスト・サンプル（一覧・ルーム用）',
      sourceType: 'csv',
      createdBy: director.id,
      createdAt: now,
      itemCount: kanbanItems.length,
      assigneeEmail: 'member@example.com',
      assignedBy: 'director@example.com',
      assignedAt: listAssignedAt,
      items: {
        create: kanbanItems.map((row) => ({
          tenantId: DEMO_TENANT,
          companyName: row.companyName,
          phone: row.phone,
          address: row.address,
          targetUrl: row.targetUrl,
          industryTag: row.industryTag,
          aiListTier: row.aiListTier,
          status: row.status,
          assignedToUserId: row.assignedToUserId,
          assignedAt: row.assignedAt,
          assignedByUserId: row.assignedByUserId,
          statusUpdatedAt: row.statusUpdatedAt,
          completedAt: row.completedAt,
          legalEntityId: row.legalEntityId ?? null,
          createdAt: now,
        })),
      },
    },
  });

  console.log(
    `Seed: kanban calling list "${SEED_CALLING_LIST_KANBAN_ID}" (${kanbanItems.length} items).`,
  );
}

/** リスト明細をちょうど30件入れた架電リスト */
async function seedCallingListThirtyDummyItems(now: string): Promise<void> {
  const director = await prisma.user.findFirst({
    where: { tenantId: DEMO_TENANT, email: 'director@example.com' },
    select: { id: true },
  });
  const member = await prisma.user.findFirst({
    where: { tenantId: DEMO_TENANT, email: 'member@example.com' },
    select: { id: true },
  });
  if (!director || !member) {
    console.warn('Seed: skip 30-item list (director or member user missing).');
    return;
  }

  const listAssignedAt = new Date(Date.parse(now) + 10000).toISOString();

  await prisma.listItem.deleteMany({ where: { listId: SEED_CALLING_LIST_THIRTY_ID } });
  await prisma.callingList.deleteMany({ where: { id: SEED_CALLING_LIST_THIRTY_ID } });

  const industryTags = [
    'SaaS・クラウド',
    '受託開発',
    '食品製造',
    '金属加工',
    '外食・レストラン',
    '小売（店舗）',
    'IT・ソフトウェア',
    '卸売',
    '製造業',
    'サービス',
  ];
  const tiers = ['A', 'B', 'C'] as const;
  const statusesCycle = ['unstarted', 'unstarted', 'calling', 'done', 'excluded'] as const;

  const items: ItemSeed[] = Array.from({ length: 30 }, (_, idx) => {
    const n = idx + 1;
    const num = String(n).padStart(2, '0');
    const ward = (n % 5) + 1;
    const status = statusesCycle[idx % statusesCycle.length];
    const base: ItemSeed = {
      companyName: `ダミー架電先 株式会社サンプル${num}`,
      phone: `03-${String(5000 + n).padStart(4, '0')}-${String(6000 + n).padStart(4, '0')}`,
      address: `東京都港区港南${ward}-${ward}-${ward}`,
      targetUrl: `https://seed.local/dummy-list-item-${num}`,
      industryTag: industryTags[idx % industryTags.length],
      aiListTier: tiers[idx % tiers.length],
      status,
      assignedToUserId: member.id,
      assignedAt: listAssignedAt,
      assignedByUserId: director.id,
      statusUpdatedAt: status === 'unstarted' ? null : listAssignedAt,
      completedAt: status === 'done' ? listAssignedAt : null,
    };
    return base;
  });

  await prisma.callingList.create({
    data: {
      id: SEED_CALLING_LIST_THIRTY_ID,
      tenantId: DEMO_TENANT,
      name: '【seed】ダミー30件リスト',
      sourceType: 'csv',
      createdBy: director.id,
      createdAt: now,
      itemCount: items.length,
      assigneeEmail: 'member@example.com',
      assignedBy: 'director@example.com',
      assignedAt: listAssignedAt,
      items: {
        create: items.map((row) => ({
          tenantId: DEMO_TENANT,
          companyName: row.companyName,
          phone: row.phone,
          address: row.address,
          targetUrl: row.targetUrl,
          industryTag: row.industryTag,
          aiListTier: row.aiListTier,
          status: row.status,
          assignedToUserId: row.assignedToUserId,
          assignedAt: row.assignedAt,
          assignedByUserId: row.assignedByUserId,
          statusUpdatedAt: row.statusUpdatedAt,
          completedAt: row.completedAt,
          legalEntityId: row.legalEntityId ?? null,
          createdAt: now,
        })),
      },
    },
  });

  console.log(
    `Seed: 30-item dummy calling list "${SEED_CALLING_LIST_THIRTY_ID}" (${items.length} items).`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

import path from 'path'
import { config } from 'dotenv'
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { UserRole as UR } from '../src/common/enums/user-role.enum';
import { CALLING_RESULT_VALUES } from '@is-crm/domain';
import { upsertProjectMembershipInTx } from '../src/users/project-membership.helper';
import * as bcrypt from 'bcrypt';

/** ts-node 実行時も cwd に依存せず apps/api/.env */
config({
  path: path.resolve(__dirname, '..', '.env'),
  override: process.env.NODE_ENV === 'production' ? false : true,
})

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
/** 配布・検索・ページング検証用の大規模リスト（100〜300件帯） */
const SEED_CALLING_LIST_BULK_ID = 'seed-calling-list-bulk-220-items';

/** 3ヶ月PJデモ（ディレクター2名・IS20名・10リスト×300件・目標あり） */
const TENANT_PJ_THREE_MONTHS_ID = 'tenant-pj-3m-demo'
const PJ_THREE_MONTHS_LIST_PREFIX = 'seed-pj3m-list'

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
  /** 架電ルームの架電結果（正規名）。未記録は undefined/null */
  callingResult?: string | null;
  legalEntityId?: string | null;
};

/** シード行の進捗に応じた既定の架電結果（★架電ルームと配布フィルタの整合） */
const callingResultForListItemStatus = (status: string, index: number): string | null => {
  if (status === 'unstarted' || status === 'calling') return null;
  if (status === 'done') return CALLING_RESULT_VALUES[index % CALLING_RESULT_VALUES.length]!;
  if (status === 'excluded') return '受付NG';
  return null;
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

  await seedThreeMonthsProjectDemo(hashedPassword, now)

  await seedKabushikiAaTarou(now);
  await seedKabushikiAaPjaaDummyMembers(hashedPassword, now);
  await seedKabushikiAaAiScorecardDemo(now);
  await seedKabushikiAaKpiDemo(now);
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
  await seedCallingListBulkSample(now);
  await seedAiScorecardDemo(now);
  await seedDirectorUnreadRequests(now);

  await syncAllProjectsAndMemberships();
}

const isoDaysAgo = (days: number, atHour = 10): string => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(atHour, 0, 0, 0)
  return d.toISOString()
}

const jitterIso = (baseIso: string, minutesJitter: number): string => {
  const base = new Date(baseIso).getTime()
  if (Number.isNaN(base)) return baseIso
  const sign = Math.random() < 0.5 ? -1 : 1
  const offset = Math.floor(Math.random() * minutesJitter) * 60 * 1000 * sign
  return new Date(base + offset).toISOString()
}

const pickOne = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]!

/**
 * 3ヶ月運用済みPJのリアル寄りダミーデータを格納する。
 * - tenant: TENANT_PJ_THREE_MONTHS_ID
 * - director: 2名
 * - is_member: 20名
 * - calling_lists: 10種類 × 300件
 * - calling_records: 直近30日は濃く、過去60日は薄く（合計およそ1万件）
 * - KPI目標: アポ率 1.2%, 架電 15件/h, キーマン接触 15%
 */
async function seedThreeMonthsProjectDemo(hashedPassword: string, now: string): Promise<void> {
  await prisma.tenant.upsert({
    where: { id: TENANT_PJ_THREE_MONTHS_ID },
    create: {
      id: TENANT_PJ_THREE_MONTHS_ID,
      name: '3ヶ月PJデモ株式会社',
      companyName: '3ヶ月PJデモ株式会社',
      projectDisplayName: '3ヶ月運用PJ（架電）',
      headOfficeAddress: '東京都渋谷区道玄坂1-2-3',
      headOfficePhone: '03-5555-6666',
      representativeName: 'デモ 代表',
      accountStatus: 'active',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      name: '3ヶ月PJデモ株式会社',
      companyName: '3ヶ月PJデモ株式会社',
      projectDisplayName: '3ヶ月運用PJ（架電）',
      updatedAt: now,
    },
  })

  const prefRot = ['東京都', '大阪府', '神奈川県', '愛知県', '福岡県', '北海道', '埼玉県', '千葉県']

  const directors = await Promise.all(
    Array.from({ length: 2 }, async (_, idx) => {
      const num = String(idx + 1).padStart(2, '0')
      const email = `pj3m-director-${num}@example.com`
      const prefecture = prefRot[idx % prefRot.length]
      return prisma.user.upsert({
        where: { tenantId_email: { tenantId: TENANT_PJ_THREE_MONTHS_ID, email } },
        create: {
          tenantId: TENANT_PJ_THREE_MONTHS_ID,
          email,
          name: `PJ3M ディレクター${num}`,
          role: 'director',
          roles: ['director'],
          passwordHash: hashedPassword,
          countryCode: 'JP',
          prefecture,
          mobilePhone: `090-880${idx}-000${idx}`,
          createdAt: now,
          updatedAt: now,
        },
        update: {
          name: `PJ3M ディレクター${num}`,
          role: 'director',
          roles: ['director'],
          passwordHash: hashedPassword,
          countryCode: 'JP',
          prefecture,
          mobilePhone: `090-880${idx}-000${idx}`,
          updatedAt: now,
        },
        select: { id: true, email: true },
      })
    }),
  )

  const isMembers = await Promise.all(
    Array.from({ length: 20 }, async (_, idx) => {
      const num = String(idx + 1).padStart(2, '0')
      const email = `pj3m-is-${num}@example.com`
      const prefecture = prefRot[idx % prefRot.length]
      return prisma.user.upsert({
        where: { tenantId_email: { tenantId: TENANT_PJ_THREE_MONTHS_ID, email } },
        create: {
          tenantId: TENANT_PJ_THREE_MONTHS_ID,
          email,
          name: `PJ3M IS${num}`,
          role: 'is_member',
          roles: ['is_member'],
          passwordHash: hashedPassword,
          countryCode: 'JP',
          prefecture,
          mobilePhone: `080-770${num}-1000`,
          createdAt: now,
          updatedAt: now,
        },
        update: {
          name: `PJ3M IS${num}`,
          role: 'is_member',
          roles: ['is_member'],
          passwordHash: hashedPassword,
          countryCode: 'JP',
          prefecture,
          mobilePhone: `080-770${num}-1000`,
          updatedAt: now,
        },
        select: { id: true, email: true, name: true },
      })
    }),
  )

  const directorId = directors[0]?.id
  if (!directorId || isMembers.length !== 20) {
    console.log('Seed: skip 3ヶ月PJデモ（ユーザー作成に失敗）')
    return
  }

  const listKinds = [
    '製造業（中堅）',
    'IT（SaaS）',
    '物流（全国）',
    '建設（関東）',
    '不動産（投資）',
    '医療（クリニック）',
    '小売（チェーン）',
    '飲食（多店舗）',
    '人材（紹介）',
    '士業（法人向け）',
  ]
  const industryTags = [
    '製造業',
    'IT・ソフトウェア',
    '物流',
    '建設',
    '不動産',
    '医療',
    '小売（店舗）',
    '外食・レストラン',
    '人材',
    '士業',
  ]
  const tiers = ['A', 'B', 'C'] as const

  const listIds = listKinds.map((_, idx) => `${PJ_THREE_MONTHS_LIST_PREFIX}-${String(idx + 1).padStart(2, '0')}`)

  await prisma.listItem.deleteMany({ where: { tenantId: TENANT_PJ_THREE_MONTHS_ID, listId: { in: listIds } } })
  await prisma.callingList.deleteMany({ where: { tenantId: TENANT_PJ_THREE_MONTHS_ID, id: { in: listIds } } })

  const listAssignedAt = jitterIso(now, 120)
  for (let i = 0; i < 10; i += 1) {
    const listId = listIds[i]!
    const listName = `【PJ3M】架電リスト${String(i + 1).padStart(2, '0')} - ${listKinds[i]}`
    const assignee = isMembers[i % isMembers.length]!
    await prisma.callingList.create({
      data: {
        id: listId,
        tenantId: TENANT_PJ_THREE_MONTHS_ID,
        name: listName,
        sourceType: 'csv',
        createdBy: directorId,
        createdAt: now,
        itemCount: 300,
        assigneeEmail: assignee.email,
        assignedBy: directors[0]!.email,
        assignedAt: listAssignedAt,
      },
    })

    const pref = prefRot[i % prefRot.length]!
    const baseIndustry = industryTags[i % industryTags.length]!
    const items = Array.from({ length: 300 }, (_, idx) => {
      const n = idx + 1
      const num = String(n).padStart(3, '0')
      const tier = tiers[idx % tiers.length]
      const city = ['港区', '渋谷区', '中央区', '新宿区', '品川区', '千代田区'][idx % 6]!
      const statusMod = idx % 20
      const status = statusMod < 13 ? 'unstarted' : statusMod < 16 ? 'calling' : statusMod < 19 ? 'done' : 'excluded'
      const shouldAssign = status !== 'unstarted' || idx % 4 !== 0
      const assignedTo = shouldAssign ? isMembers[idx % isMembers.length] : null
      return {
        tenantId: TENANT_PJ_THREE_MONTHS_ID,
        listId,
        companyName: `PJ3M ${listKinds[i]} 法人${num}`,
        phone: `0${(idx % 8) + 2}-${String(3000 + i).padStart(4, '0')}-${String(1000 + n).padStart(4, '0')}`,
        address: `${pref}${city}${(idx % 9) + 1}-${(idx % 7) + 1}-${(idx % 5) + 1}`,
        targetUrl: `https://pj3m-seed.local/${listId}/${num}`,
        industryTag: baseIndustry,
        aiListTier: tier,
        status,
        assignedToUserId: assignedTo?.id ?? null,
        assignedAt: assignedTo ? listAssignedAt : null,
        assignedByUserId: assignedTo ? directorId : null,
        statusUpdatedAt: status === 'unstarted' ? null : listAssignedAt,
        completedAt: status === 'done' ? listAssignedAt : null,
        legalEntityId: null,
        callingResult: callingResultForListItemStatus(status, idx),
        createdAt: now,
      }
    })
    await prisma.listItem.createMany({ data: items })
  }

  const project = await prisma.project.findUnique({
    where: { tenantId: TENANT_PJ_THREE_MONTHS_ID },
    select: { id: true },
  })
  const projectId = project?.id ?? null
  if (projectId) {
    const goals = {
      callPerHour: 15,
      appointmentRate: 1.2,
      materialSendRate: 0,
      redialAcquisitionRate: 0,
      cutContactRate: 0,
      keyPersonContactRate: 15,
    }
    const rows = [
      { scope: 'project', targetUserId: null },
      { scope: 'is_all', targetUserId: null },
    ] as const
    for (const row of rows) {
      const goalKey = `${row.scope}:${row.targetUserId ?? 'all'}`
      await prisma.kpiGoal.upsert({
        where: { tenantId_goalKey: { tenantId: TENANT_PJ_THREE_MONTHS_ID, goalKey } },
        create: {
          tenantId: TENANT_PJ_THREE_MONTHS_ID,
          projectId,
          goalKey,
          scope: row.scope,
          targetUserId: row.targetUserId,
          ...goals,
          updatedBy: directorId,
          updatedAt: now,
        },
        update: {
          ...goals,
          updatedBy: directorId,
          updatedAt: now,
        },
      })
    }
  }

  await prisma.callingRecord.deleteMany({
    where: { tenantId: TENANT_PJ_THREE_MONTHS_ID, callingHistoryId: { startsWith: 'seed-pj3m-' } },
  })

  const totalDays = 90
  const resultsNonConnected = ['不在', '未着電', '番号違い', '受付NG'] as const
  const recallFuture = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

  const monthlyTotalCalls = 30 * 20 * 15
  const monthlyConnectedTarget = Math.round(monthlyTotalCalls * 0.15)
  const monthlyAppointmentTarget = Math.max(1, Math.round(monthlyConnectedTarget * 0.012))
  const appointmentSlots = new Set<number>()
  while (appointmentSlots.size < monthlyAppointmentTarget) {
    appointmentSlots.add(Math.floor(Math.random() * monthlyTotalCalls))
  }

  let monthlyIndex = 0
  const batch: NonNullable<Parameters<typeof prisma.callingRecord.createMany>[0]>['data'] = []
  const flush = async () => {
    if (batch.length === 0) return
    await prisma.callingRecord.createMany({ data: batch })
    batch.length = 0
  }
  for (let dayAgo = totalDays - 1; dayAgo >= 0; dayAgo -= 1) {
    const dense = dayAgo <= 29
    const callsPerMember = dense ? 15 : 2
    const baseDay = isoDaysAgo(dayAgo, dense ? 10 : 11)

    for (let m = 0; m < isMembers.length; m += 1) {
      const member = isMembers[m]!
      for (let c = 0; c < callsPerMember; c += 1) {
        const createdAt = jitterIso(baseDay, 360)
        const id = `seed-pj3m-${String(dayAgo).padStart(3, '0')}-${String(m).padStart(2, '0')}-${String(c).padStart(2, '0')}`

        let result: string
        let nextCallAt: string | null = null

        if (dense && appointmentSlots.has(monthlyIndex)) {
          result = 'アポ'
        } else {
          const r = Math.random()
          if (r < 0.15) {
            result = Math.random() < 0.58 ? '再架電' : '担当NG'
            if (result === '再架電' && Math.random() < 0.18) {
              nextCallAt = recallFuture
            }
          } else if (r < 0.19) {
            result = '資料送付'
          } else {
            result = pickOne([...resultsNonConnected])
          }
        }

        batch.push({
          callingHistoryId: id,
          tenantId: TENANT_PJ_THREE_MONTHS_ID,
          createdBy: member.id,
          companyName: `（PJ3M）架電履歴 ${member.name} ${id.slice(-4)}`,
          companyPhone: `03-77${String(m).padStart(2, '0')}-${String(1000 + c).padStart(4, '0')}`,
          companyAddress: '東京都渋谷区PJ3M 1-1-1',
          targetUrl: `https://pj3m-seed.local/calls/${id}`,
          approved: true,
          approvedAt: createdAt,
          approvedBy: member.id,
          result,
          memo: 'seed: PJ3M realistic demo',
          nextCallAt,
          directorReadAt: null,
          directorReadBy: null,
          resultCapturedAt: createdAt,
          updatedAt: now,
        })
        if (batch.length >= 1000) {
          await flush()
        }
        if (dense) monthlyIndex += 1
      }
    }
  }
  await flush()

  console.log(
    `Seed: PJ3M demo upserted. tenant=${TENANT_PJ_THREE_MONTHS_ID} users=director2+is20 lists=10x300 calls≈${monthlyTotalCalls + 60 * 20 * 2}`,
  )
}

async function seedAiScorecardDemo(now: string): Promise<void> {
  const member = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: DEMO_TENANT, email: 'member@example.com' } },
    select: { id: true, tenantId: true },
  });
  if (!member) {
    console.log('Seed: skip ai-scorecard demo (member@example.com not found).');
    return;
  }

  const recordId = 'seed-calling-record-ai-score-01';
  const evaluatedAt = new Date(Date.now() - 1000 * 60 * 60).toISOString();
  const callAt = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();

  await prisma.callingRecord.upsert({
    where: { callingHistoryId: recordId },
    create: {
      callingHistoryId: recordId,
      tenantId: member.tenantId,
      createdBy: member.id,
      companyName: '（AI評価デモ）株式会社テスト',
      companyPhone: '03-1234-5678',
      companyAddress: '東京都千代田区1-2-3',
      targetUrl: 'https://example.com',
      approved: true,
      approvedAt: callAt,
      approvedBy: member.id,
      result: 'connected',
      memo: 'seed: ai-scorecard demo record',
      nextCallAt: null,
      resultCapturedAt: callAt,
      updatedAt: now,
    },
    update: {
      companyName: '（AI評価デモ）株式会社テスト',
      companyPhone: '03-1234-5678',
      companyAddress: '東京都千代田区1-2-3',
      targetUrl: 'https://example.com',
      approved: true,
      approvedAt: callAt,
      approvedBy: member.id,
      result: 'connected',
      memo: 'seed: ai-scorecard demo record',
      nextCallAt: null,
      resultCapturedAt: callAt,
      updatedAt: now,
    },
  });

  await prisma.callingAiEvaluation.upsert({
    where: { id: 'seed-calling-ai-eval-01' },
    create: {
      id: 'seed-calling-ai-eval-01',
      tenantId: member.tenantId,
      callRecordId: recordId,
      evaluatedAt,
      categoryScores: [
        {
          category: '導入トーク',
          score: 4.2,
          tagCount: 3,
          tags: [
            { tag: 'opening', value: 'good' },
            { tag: 'empathy', value: 'ok' },
            { tag: 'next_step', value: 'weak' },
          ],
        },
        {
          category: 'ヒアリング',
          score: 3.6,
          tagCount: 2,
          tags: [
            { tag: 'needs', value: 'partial' },
            { tag: 'budget', value: 'missed' },
          ],
        },
      ],
      summary: '課題の深掘りは良いが、次アクション合意が弱い。次回は具体日程の打診まで行う。',
      improvementPoints: ['次回アポの具体日程をその場で提案する', '導入事例を1つ挟んで温度感を上げる'],
    },
    update: {
      tenantId: member.tenantId,
      callRecordId: recordId,
      evaluatedAt,
      categoryScores: [
        {
          category: '導入トーク',
          score: 4.2,
          tagCount: 3,
          tags: [
            { tag: 'opening', value: 'good' },
            { tag: 'empathy', value: 'ok' },
            { tag: 'next_step', value: 'weak' },
          ],
        },
        {
          category: 'ヒアリング',
          score: 3.6,
          tagCount: 2,
          tags: [
            { tag: 'needs', value: 'partial' },
            { tag: 'budget', value: 'missed' },
          ],
        },
      ],
      summary: '課題の深掘りは良いが、次アクション合意が弱い。次回は具体日程の打診まで行う。',
      improvementPoints: ['次回アポの具体日程をその場で提案する', '導入事例を1つ挟んで温度感を上げる'],
    },
  });

  console.log('Seed: ai-scorecard demo (callingRecord + callingAiEvaluation) upserted.');
}

async function seedDirectorUnreadRequests(now: string): Promise<void> {
  const member = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: DEMO_TENANT, email: 'member@example.com' } },
    select: { id: true, tenantId: true },
  })
  if (!member) {
    console.log('Seed: skip director unread requests (member@example.com not found).')
    return
  }

  const baseCreatedAt = new Date(Date.now() - 45 * 60 * 1000).toISOString()
  const rows = [
    {
      id: 'seed-calling-record-appointment-01',
      companyName: '（seed）アポ確認株式会社',
      targetUrl: 'https://example.com/appointment-01',
      result: 'アポ',
      memo: 'seed: アポ未読確認用',
    },
    {
      id: 'seed-calling-record-material-01',
      companyName: '（seed）資料請求確認株式会社',
      targetUrl: 'https://example.com/material-01',
      result: '資料送付',
      memo: 'seed: 資料請求未読確認用',
    },
  ] as const

  for (const row of rows) {
    await prisma.callingRecord.upsert({
      where: { callingHistoryId: row.id },
      create: {
        callingHistoryId: row.id,
        tenantId: member.tenantId,
        createdBy: member.id,
        companyName: row.companyName,
        companyPhone: '03-0000-0000',
        companyAddress: '東京都千代田区 seed 1-1-1',
        targetUrl: row.targetUrl,
        approved: true,
        approvedAt: baseCreatedAt,
        approvedBy: member.id,
        result: row.result,
        memo: row.memo,
        nextCallAt: null,
        directorReadAt: null,
        directorReadBy: null,
        resultCapturedAt: baseCreatedAt,
        updatedAt: now,
      },
      update: {
        companyName: row.companyName,
        targetUrl: row.targetUrl,
        result: row.result,
        memo: row.memo,
        approved: true,
        approvedAt: baseCreatedAt,
        approvedBy: member.id,
        nextCallAt: null,
        directorReadAt: null,
        directorReadBy: null,
        resultCapturedAt: baseCreatedAt,
        updatedAt: now,
      },
    })
  }

  console.log('Seed: director unread requests (appointment/material) upserted.')
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
  /** 画面上で「ディレクター・企業アカウント管理者」を確認できるよう2ロールにする */
  const rolesAa = ['director', 'enterprise_admin'] as string[];

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
      role: 'director',
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
    'Seed: 株式会社AA tenant + tarou.work363@gmail.com (director + enterprise_admin, dev password per TAROU_WORK_PASSWORD in seed.ts). PJAAダミーは seedKabushikiAaPjaaDummyMembers を参照。',
  );
}

/**
 * 株式会社AA / 太郎アカウントで AIスコアカード画面の主要分岐を確認できる手製データ。
 * - 通常ケース
 * - summary / improvementPoints なし
 * - tags なし・tagCount補正
 * - 不正 categoryScores（unknown/0 補正）
 * - 同一時刻の並び順タイブレーク（callRecordId 昇順）
 */
async function seedKabushikiAaAiScorecardDemo(now: string): Promise<void> {
  const tarou = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: TENANT_KABUSHIKI_AA_ID, email: TAROU_WORK_EMAIL.trim().toLowerCase() } },
    select: { id: true, tenantId: true },
  })
  if (!tarou) {
    console.log('Seed: skip 株式会社AA AI scorecard demo (太郎ユーザー未作成).')
    return
  }

  /** KPI（月次=直近30日）に混ざらないよう、AI検証用の架電日時は30日より前に固定する */
  const baseCallAt = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
  const tieEvaluatedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const items = [
    {
      recordId: 'seed-aa-ai-record-01',
      evalId: 'seed-aa-ai-eval-01',
      companyName: '株式会社AA 検証A（通常）',
      result: '再架電',
      callDate: baseCallAt,
      evaluatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      summary: '導入トークは良好。次回アクションの合意をもう一段強化したい。',
      improvementPoints: ['次回アポ候補日をその場で提案する', 'ヒアリングで予算確認を追加する'],
      categoryScores: [
        {
          category: '導入トーク',
          score: 4.4,
          tagCount: 2,
          tags: [
            { tag: 'opening', value: 'good' },
            { tag: 'empathy', value: 'ok' },
          ],
        },
        {
          category: 'ヒアリング',
          score: 3.9,
          tagCount: 1,
          tags: [{ tag: 'needs', value: 'partial' }],
        },
      ],
    },
    {
      recordId: 'seed-aa-ai-record-02',
      evalId: 'seed-aa-ai-eval-02',
      companyName: '株式会社AA 検証B（summary/improvementなし）',
      result: '資料送付',
      callDate: new Date(Date.now() - 46 * 24 * 60 * 60 * 1000).toISOString(),
      evaluatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      summary: '   ',
      improvementPoints: [],
      categoryScores: [],
    },
    {
      recordId: 'seed-aa-ai-record-03',
      evalId: 'seed-aa-ai-eval-03',
      companyName: '株式会社AA 検証C（タグ空・tagCount補正）',
      result: 'アポ',
      callDate: new Date(Date.now() - 47 * 24 * 60 * 60 * 1000).toISOString(),
      evaluatedAt: tieEvaluatedAt,
      summary: 'タグが無いカテゴリ表示を確認するケース。',
      improvementPoints: ['タグ未設定時の表示確認'],
      categoryScores: [
        { category: 'クロージング', score: 4.1, tagCount: -1, tags: [] },
      ],
    },
    {
      recordId: 'seed-aa-ai-record-04',
      evalId: 'seed-aa-ai-eval-04',
      companyName: '株式会社AA 検証D（不正カテゴリ補正）',
      result: '担当NG',
      callDate: new Date(Date.now() - 48 * 24 * 60 * 60 * 1000).toISOString(),
      evaluatedAt: tieEvaluatedAt,
      summary: null,
      improvementPoints: ['unknown/score=0補正の確認'],
      categoryScores: [
        { category: 123, score: 'bad', tags: [{ tag: 'x', value: true }] },
      ] as unknown,
    },
  ] as const

  for (const item of items) {
    await prisma.callingRecord.upsert({
      where: { callingHistoryId: item.recordId },
      create: {
        callingHistoryId: item.recordId,
        tenantId: tarou.tenantId,
        createdBy: tarou.id,
        companyName: item.companyName,
        companyPhone: '03-1111-2222',
        companyAddress: '東京都港区AA 1-1-1',
        targetUrl: `https://aa-seed.local/${item.recordId}`,
        approved: true,
        approvedAt: item.callDate,
        approvedBy: tarou.id,
        result: item.result,
        memo: `seed: ${item.companyName}`,
        nextCallAt: null,
        resultCapturedAt: item.callDate,
        updatedAt: now,
      },
      update: {
        companyName: item.companyName,
        result: item.result,
        approved: true,
        approvedAt: item.callDate,
        approvedBy: tarou.id,
        memo: `seed: ${item.companyName}`,
        resultCapturedAt: item.callDate,
        updatedAt: now,
      },
    })

    await prisma.callingAiEvaluation.upsert({
      where: { id: item.evalId },
      create: {
        id: item.evalId,
        tenantId: tarou.tenantId,
        callRecordId: item.recordId,
        evaluatedAt: item.evaluatedAt,
        categoryScores: item.categoryScores as unknown as object,
        summary: item.summary,
        improvementPoints: item.improvementPoints as unknown as object,
      },
      update: {
        tenantId: tarou.tenantId,
        callRecordId: item.recordId,
        evaluatedAt: item.evaluatedAt,
        categoryScores: item.categoryScores as unknown as object,
        summary: item.summary,
        improvementPoints: item.improvementPoints as unknown as object,
      },
    })
  }

  console.log(`Seed: 株式会社AA AI scorecard demo upserted (${items.length} records/evaluations).`)
}

/**
 * KPIページ（/kpi）用: ReportByMember 集計に効く架電履歴サンプル。
 * - 太郎: 当日 100件超（実運用想定）+ 週内・月内に少数（期間切替の差分）
 * - PJAA IS01: 当日は中程度（ランキング差）
 * - resultCapturedAt（架電結果の記録日時）を当日 0時〜現在までに均等分散
 * - 再接続予定は nextCallAt を未来日時に設定（再加電取得率）
 */
async function seedKabushikiAaKpiDemo(now: string): Promise<void> {
  const tarou = await prisma.user.findUnique({
    where: {
      tenantId_email: { tenantId: TENANT_KABUSHIKI_AA_ID, email: TAROU_WORK_EMAIL.trim().toLowerCase() },
    },
    select: { id: true, tenantId: true },
  })
  if (!tarou) {
    console.log('Seed: skip 株式会社AA KPI demo (太郎ユーザー未作成).')
    return
  }

  const isMembers = await prisma.user.findMany({
    where: {
      tenantId: TENANT_KABUSHIKI_AA_ID,
      email: { startsWith: 'pjaa-is-' },
    },
    select: { id: true, email: true, name: true },
    orderBy: { email: 'asc' },
  })
  if (isMembers.length < 5) {
    console.log('Seed: skip 株式会社AA KPI demo (PJAA ISメンバーが不足).')
    return
  }

  /** 再シードで件数が増えないよう、旧 KPI シード行を削除してから入れ直す */
  const deleted = await prisma.callingRecord.deleteMany({
    where: { callingHistoryId: { startsWith: 'seed-kpi-aa-' } },
  })
  if (deleted.count > 0) {
    console.log(`Seed: removed ${deleted.count} previous seed-kpi-aa-* calling records.`)
  }

  const recallFuture = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  interface KpiSeedRow {
    id: string
    createdBy: string
    companyName: string
    companyPhone: string
    createdAtIso: string
    result: string
    nextCallAt: string | null
  }

  const spreadWithinDay = (baseDate: Date, index: number, total: number): string => {
    const d = new Date(baseDate)
    d.setHours(9, 0, 0, 0)
    const t0 = d.getTime()
    const t1 = t0 + 9 * 60 * 60 * 1000
    const pos = total <= 1 ? 0.5 : (index + 0.5) / total
    const ms = Math.floor(t0 + (t1 - t0) * pos)
    return new Date(ms).toISOString()
  }

  const buildMemberDayRows = (args: {
    key: string
    userId: string
    displayName: string
    date: Date
    callsPerDay: number
  }): KpiSeedRow[] => {
    const { key, userId, displayName, date, callsPerDay } = args

    const appointmentCount = 2
    const materialSendCount = 8
    const connectedCount = 42
    const recallCount = 10
    const interestCount = Math.max(Math.floor(connectedCount * 0.62), recallCount)
    const noInterestCount = connectedCount - interestCount
    const unreachableCount = Math.floor((callsPerDay - connectedCount - appointmentCount - materialSendCount) * 0.6)
    const absentCount = callsPerDay - connectedCount - appointmentCount - materialSendCount - unreachableCount

    const blocks: { result: string; count: number }[] = [
      { result: '不在', count: absentCount },
      { result: '未着電', count: unreachableCount },
      { result: '再架電', count: interestCount },
      { result: '担当NG', count: noInterestCount },
      { result: 'アポ', count: appointmentCount },
      { result: '資料送付', count: materialSendCount },
    ]
    const resultPool = blocks.flatMap((b) => Array.from({ length: b.count }, () => b.result))

    const dateKey = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
    let recallSlotsUsed = 0
    return resultPool.map((result, i) => {
      let nextCallAt: string | null = null
      if (result === '再架電' && recallSlotsUsed < recallCount) {
        nextCallAt = recallFuture
        recallSlotsUsed += 1
      }
      const seq = String(i + 1).padStart(3, '0')
      return {
        id: `seed-kpi-aa-${key}-${dateKey}-${seq}`,
        createdBy: userId,
        companyName: `KPI ${displayName} ${dateKey}-${seq}`,
        companyPhone: `03-${key.slice(-2)}${dateKey.slice(-4)}${String(i).padStart(2, '0')}`,
        createdAtIso: spreadWithinDay(date, i, callsPerDay),
        result,
        nextCallAt,
      }
    })
  }

  const members = [
    { key: 'tarou', userId: tarou.id, displayName: '太郎' },
    ...isMembers.slice(0, 5).map((m, idx) => ({
      key: `is${String(idx + 1).padStart(2, '0')}`,
      userId: m.id,
      displayName: m.name,
    })),
  ]

  const days = Array.from({ length: 29 }, (_, i) => i - 14)
  const callsPerDay = 120
  const allRows = days.flatMap((diff) => {
    const d = new Date()
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return members.flatMap((m) => buildMemberDayRows({ ...m, date: d, callsPerDay }))
  })

  for (const row of allRows) {
    const createdAt = row.createdAtIso
    await prisma.callingRecord.upsert({
      where: { callingHistoryId: row.id },
      create: {
        callingHistoryId: row.id,
        tenantId: tarou.tenantId,
        createdBy: row.createdBy,
        companyName: row.companyName,
        companyPhone: row.companyPhone,
        companyAddress: '東京都港区KPI検証 1-1-1',
        targetUrl: `https://kpi-seed.local/${row.id}`,
        approved: true,
        approvedAt: createdAt,
        approvedBy: row.createdBy,
        result: row.result,
        memo: 'seed: KPI page demo',
        nextCallAt: row.nextCallAt,
        resultCapturedAt: createdAt,
        updatedAt: now,
      },
      update: {
        createdBy: row.createdBy,
        companyName: row.companyName,
        companyPhone: row.companyPhone,
        result: row.result,
        approved: true,
        approvedAt: createdAt,
        approvedBy: row.createdBy,
        memo: 'seed: KPI page demo',
        nextCallAt: row.nextCallAt,
        resultCapturedAt: createdAt,
        updatedAt: now,
      },
    })
  }

  console.log(`Seed: 株式会社AA KPI demo upserted (${allRows.length} calling records).`)
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
      callingResult: null,
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
      callingResult: '資料送付',
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
      callingResult: '受付NG',
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
        create: items.map((row, idx) => ({
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
          callingResult: row.callingResult ?? callingResultForListItemStatus(row.status, idx),
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
        create: kanbanItems.map((row, idx) => ({
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
          callingResult: row.callingResult ?? callingResultForListItemStatus(row.status, idx),
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
      callingResult: callingResultForListItemStatus(status, idx),
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
        create: items.map((row, idx) => ({
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
          callingResult: row.callingResult ?? callingResultForListItemStatus(row.status, idx),
          createdAt: now,
        })),
      },
    },
  });

  console.log(
    `Seed: 30-item dummy calling list "${SEED_CALLING_LIST_THIRTY_ID}" (${items.length} items).`,
  );
}

/**
 * 架電リストのページング・配布・検索検証向け大規模サンプル（220件）
 */
async function seedCallingListBulkSample(now: string): Promise<void> {
  const director = await prisma.user.findFirst({
    where: { tenantId: DEMO_TENANT, email: 'director@example.com' },
    select: { id: true },
  });
  const member = await prisma.user.findFirst({
    where: { tenantId: DEMO_TENANT, email: 'member@example.com' },
    select: { id: true, email: true },
  });
  const isMembers = await prisma.user.findMany({
    where: { tenantId: DEMO_TENANT, role: 'is_member' },
    select: { id: true, email: true },
    orderBy: { email: 'asc' },
    take: 12,
  });
  if (!director || !member || isMembers.length === 0) {
    console.warn('Seed: skip bulk calling list (director/member/is_members missing).');
    return;
  }

  const listAssignedAt = new Date(Date.parse(now) + 15000).toISOString();

  await prisma.listItem.deleteMany({ where: { listId: SEED_CALLING_LIST_BULK_ID } });
  await prisma.callingList.deleteMany({ where: { id: SEED_CALLING_LIST_BULK_ID } });

  const prefectures = ['東京都', '大阪府', '神奈川県', '愛知県', '福岡県', '北海道', '埼玉県', '千葉県'];
  const cities = ['港区', '渋谷区', '中央区', '新宿区', '横浜市', '名古屋市', '福岡市', '札幌市'];
  const industryTags = [
    'SaaS・クラウド',
    'IT・ソフトウェア',
    '飲食・レストラン',
    '小売（店舗）',
    '卸売',
    '製造業',
    '物流',
    '建設',
    '不動産',
    'サービス',
  ];
  const tiers = ['A', 'B', 'C'] as const;

  const bulkCount = 220;
  const items: ItemSeed[] = Array.from({ length: bulkCount }, (_, idx) => {
    const n = idx + 1;
    const num = String(n).padStart(3, '0');
    const pref = prefectures[idx % prefectures.length];
    const city = cities[idx % cities.length];
    const industryTag = industryTags[idx % industryTags.length];
    const aiListTier = tiers[idx % tiers.length];

    // unstarted 多め + calling + done + excluded の比率で検証しやすくする
    const mod = idx % 20;
    const status =
      mod < 11 ? 'unstarted' : mod < 15 ? 'calling' : mod < 19 ? 'done' : 'excluded';

    const shouldAssign = status !== 'unstarted' || idx % 3 !== 0;
    const assignedMember = shouldAssign ? isMembers[idx % isMembers.length] : null;

    return {
      companyName: `大規模サンプル法人 ${num}`,
      phone: `0${(idx % 8) + 2}-${String(7000 + n).padStart(4, '0')}-${String(8000 + n).padStart(4, '0')}`,
      address: `${pref}${city}サンプル${(idx % 9) + 1}-${(idx % 7) + 1}-${(idx % 5) + 1}`,
      targetUrl: `https://seed.local/bulk-list-item-${num}`,
      industryTag,
      aiListTier,
      status,
      assignedToUserId: assignedMember?.id ?? null,
      assignedAt: assignedMember ? listAssignedAt : null,
      assignedByUserId: assignedMember ? director.id : null,
      statusUpdatedAt: status === 'unstarted' ? null : listAssignedAt,
      completedAt: status === 'done' ? listAssignedAt : null,
      callingResult: callingResultForListItemStatus(status, idx),
    };
  });

  await prisma.callingList.create({
    data: {
      id: SEED_CALLING_LIST_BULK_ID,
      tenantId: DEMO_TENANT,
      name: '【seed】大規模220件リスト（配布・検索・ページング検証）',
      sourceType: 'csv',
      createdBy: director.id,
      createdAt: now,
      itemCount: items.length,
      assigneeEmail: member.email,
      assignedBy: 'director@example.com',
      assignedAt: listAssignedAt,
      items: {
        create: items.map((row, idx) => ({
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
          callingResult: row.callingResult ?? callingResultForListItemStatus(row.status, idx),
          createdAt: now,
        })),
      },
    },
  });

  console.log(
    `Seed: bulk calling list "${SEED_CALLING_LIST_BULK_ID}" (${items.length} items).`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

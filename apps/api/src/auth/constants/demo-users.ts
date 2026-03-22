import * as bcrypt from 'bcrypt';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../entities/auth-user.entity';

const DEV_PASSWORD = 'ChangeMe123!';

const hashedPassword = bcrypt.hashSync(DEV_PASSWORD, 10);

export const demoUsers: AuthUser[] = [
  {
    id: 'user-dev-01',
    tenantId: 'tenant-demo-01',
    role: UserRole.Developer,
    roles: [UserRole.Developer],
    email: 'developer@example.com',
    name: 'Developer User',
    passwordHash: hashedPassword,
  },
  {
    id: 'user-is-01',
    tenantId: 'tenant-demo-01',
    role: UserRole.IsMember,
    roles: [UserRole.IsMember],
    email: 'member@example.com',
    name: 'IS Member User',
    passwordHash: hashedPassword,
  },
  {
    id: 'user-director-01',
    tenantId: 'tenant-demo-01',
    role: UserRole.Director,
    roles: [UserRole.Director],
    email: 'director@example.com',
    name: 'Director User',
    passwordHash: hashedPassword,
  },
  {
    id: 'user-company-01',
    tenantId: 'tenant-demo-01',
    role: UserRole.EnterpriseAdmin,
    roles: [UserRole.EnterpriseAdmin],
    email: 'company@example.com',
    name: 'Company Admin User',
    passwordHash: hashedPassword,
  },
];

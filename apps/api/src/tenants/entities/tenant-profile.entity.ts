export interface TenantProfile {
  id: string;
  name: string;
  companyName: string | null;
  headOfficeAddress: string | null;
  headOfficePhone: string | null;
  representativeName: string | null;
  accountStatus: string;
  projectDisplayName: string | null;
  accountManagerUserIds: string[];
  createdAt: string;
  updatedAt: string;
}

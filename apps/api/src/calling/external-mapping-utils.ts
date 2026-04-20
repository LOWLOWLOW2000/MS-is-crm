import crypto from 'node:crypto'

const normalizeCompanyName = (nameRaw: string): string =>
  nameRaw
    .replace(/\s+/g, ' ')
    .trim()

const normalizePhone = (phoneRaw: string): string =>
  phoneRaw
    .replace(/[^\d]/g, '')
    .trim()

const createClientRowId = (companyNameNorm: string, phoneNorm: string): string => {
  const base = `${companyNameNorm}|${phoneNorm}`
  const digest = crypto.createHash('sha1').update(base, 'utf8').digest('hex')
  return `cr_${digest.slice(0, 16)}`
}

export const externalMapping = {
  normalizeCompanyName,
  normalizePhone,
  createClientRowId,
}


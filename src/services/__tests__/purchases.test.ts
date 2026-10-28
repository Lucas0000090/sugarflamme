import { entitlementsFromCustomerInfo } from '../purchases';

// jest.mock est remonté automatiquement avant les imports.
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {},
  LOG_LEVEL: { WARN: 'WARN' },
  PACKAGE_TYPE: { ANNUAL: 'ANNUAL', MONTHLY: 'MONTHLY' },
  PURCHASES_ERROR_CODE: {},
}));

const info = (active: Record<string, unknown>) => ({ entitlements: { active, all: {}, verification: 'NOT_REQUESTED' } }) as never;

describe('lecture de l’abonnement', () => {
  it('passe en Premium quand le droit « premium » est actif', () => {
    expect(
      entitlementsFromCustomerInfo(
        info({ premium: { isActive: true, expirationDate: '2026-11-28T10:00:00Z', willRenew: true } }),
      ),
    ).toEqual({ plan: 'premium', expiresAt: '2026-11-28T10:00:00Z', willRenew: true });
  });

  it('reste en gratuit sans droit actif, avec un autre droit ou sans réponse', () => {
    expect(entitlementsFromCustomerInfo(info({}))).toEqual({ plan: 'free' });
    expect(entitlementsFromCustomerInfo(info({ autre: { isActive: true } }))).toEqual({ plan: 'free' });
    expect(entitlementsFromCustomerInfo(null)).toEqual({ plan: 'free' });
  });
});

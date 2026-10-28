import { addDays, diffDays, toDateKey, isDateKey, dateRange, daysInMonth, weekdayIndex } from '../dates';
import { decideRecord, isTodayValidationOpen, pendingValidationDays } from '../validation';

const at = (iso: string) => new Date(iso); // heure locale (TZ=Europe/Paris dans les tests)

describe('dates', () => {
  it('additionne les jours sans dépendre de l’heure d’été', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('calcule le jour local à partir d’un instant', () => {
    expect(toDateKey(at('2026-10-28T23:59:00'))).toBe('2026-10-28');
    expect(toDateKey(at('2026-10-29T00:00:00'))).toBe('2026-10-29');
  });

  it('valide le format des dates', () => {
    expect(isDateKey('2026-02-29')).toBe(false);
    expect(isDateKey('2028-02-29')).toBe(true);
    expect(isDateKey('2026-1-01')).toBe(false);
  });

  it('fournit les outils de calendrier', () => {
    expect(dateRange('2026-01-30', '2026-02-02')).toEqual(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02']);
    expect(daysInMonth('2026-02-10')).toBe(28);
    expect(weekdayIndex('2026-10-26')).toBe(0); // lundi
  });
});

describe('decideRecord', () => {
  const startDate = '2026-10-01';

  it("ouvre la validation du jour à 18 h", () => {
    expect(isTodayValidationOpen(at('2026-10-28T17:59:00'))).toBe(false);
    expect(isTodayValidationOpen(at('2026-10-28T18:00:00'))).toBe(true);
    expect(
      decideRecord({ date: '2026-10-28', status: 'success', existing: null, startDate, now: at('2026-10-28T12:00:00') }),
    ).toEqual({ ok: false, reason: 'too-early' });
    expect(
      decideRecord({ date: '2026-10-28', status: 'success', existing: null, startDate, now: at('2026-10-28T21:00:00') }),
    ).toEqual({ ok: true, kind: 'create' });
  });

  it('une journée ne peut être comptabilisée qu’une fois : un second envoi devient une correction', () => {
    const now = at('2026-10-28T21:00:00');
    expect(decideRecord({ date: '2026-10-28', status: 'success', existing: 'success', startDate, now })).toEqual({
      ok: true,
      kind: 'unchanged',
    });
    expect(decideRecord({ date: '2026-10-28', status: 'failure', existing: 'success', startDate, now })).toEqual({
      ok: true,
      kind: 'correct',
    });
  });

  it('autorise une correction pendant 48 heures après la fin de la journée', () => {
    // Journée du 26/10 : modifiable jusqu’au 28/10 23:59.
    expect(
      decideRecord({ date: '2026-10-26', status: 'failure', existing: 'success', startDate, now: at('2026-10-28T23:59:00') }),
    ).toEqual({ ok: true, kind: 'correct' });
    expect(
      decideRecord({ date: '2026-10-26', status: 'failure', existing: 'success', startDate, now: at('2026-10-29T00:00:00') }),
    ).toEqual({ ok: false, reason: 'expired' });
  });

  it("refuse le futur et les jours précédant le suivi", () => {
    const now = at('2026-10-28T21:00:00');
    expect(decideRecord({ date: '2026-10-29', status: 'success', existing: null, startDate, now })).toEqual({
      ok: false,
      reason: 'future',
    });
    expect(
      decideRecord({ date: '2026-09-30', status: 'success', existing: null, startDate, now: at('2026-10-01T21:00:00') }),
    ).toEqual({ ok: false, reason: 'before-start' });
  });

  it('une réponse tardive (après minuit) reste rattachée à la bonne journée', () => {
    const now = at('2026-10-29T00:30:00');
    expect(decideRecord({ date: '2026-10-28', status: 'success', existing: null, startDate, now })).toEqual({
      ok: true,
      kind: 'create',
    });
    expect(diffDays('2026-10-28', toDateKey(now))).toBe(1);
  });
});

describe('pendingValidationDays', () => {
  it('liste les jours à renseigner dans la fenêtre de 48 h', () => {
    const now = at('2026-10-28T10:00:00');
    expect(pendingValidationDays({ startDate: '2026-10-01', now, recordedDates: new Set(['2026-10-27']) })).toEqual([
      '2026-10-26',
    ]);
  });

  it("inclut aujourd'hui dès l'ouverture du soir", () => {
    const now = at('2026-10-28T20:00:00');
    expect(
      pendingValidationDays({ startDate: '2026-10-01', now, recordedDates: new Set(['2026-10-26', '2026-10-27']) }),
    ).toEqual(['2026-10-28']);
  });

  it('ne remonte pas avant le début du suivi', () => {
    const now = at('2026-10-28T20:00:00');
    expect(pendingValidationDays({ startDate: '2026-10-28', now, recordedDates: new Set() })).toEqual(['2026-10-28']);
  });
});

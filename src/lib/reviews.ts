// Agregat din recenzii aprobate REALE. Fara recenzii reale, se arata valorile din design, marcate DEMO.
export type PublicReview = { rating: number; name: string; text: string };

export const DEMO_AGGREGATE = { average: 4.9, count: 27 } as const;

export function aggregate(approved: PublicReview[]): { average: number; count: number; demo: boolean } {
  if (approved.length === 0) return { ...DEMO_AGGREGATE, demo: true };
  const sum = approved.reduce((s, r) => s + r.rating, 0);
  return { average: Math.round((sum / approved.length) * 10) / 10, count: approved.length, demo: false };
}

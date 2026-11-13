import { describe, it, expect } from 'vitest';
import { calculateFamilyBalances } from './fees';

describe('FIFO Fee Math', () => {
  it('should correctly calculate brought forward and current term balance', () => {
    const charges = [
      { id: '1', amount: 50000, term_id: 'term1' }, // Old debt
      { id: '2', amount: 50000, term_id: 'term2' }, // New debt
    ];
    const payments = [
      { id: 'p1', amount: 60000 }, // Paid 60k total
    ];

    const result = calculateFamilyBalances(charges as any, payments as any);
    
    // It should clear the 50k from term1, leaving 10k to apply to term2.
    // So total balance should be 40k.
    expect(result.currentBalance).toBe(40000);
  });
});
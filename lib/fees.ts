// lib/fees.ts

export interface Charge {
  id?: string;
  amount: number;
  description?: string;
  term_id?: string;
  created_at: string;
  remaining?: number; // added dynamically
  terms?: { name: string };
}

export interface Payment {
  id?: string;
  amount: number;
  created_at: string;
  method?: string;
  reference?: string;
}

export function calculateFamilyBalances(charges: Charge[], payments: Payment[]) {
  // Sort oldest first
  const sortedCharges = [...charges].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const sortedPayments = [...payments].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  let totalPaid = sortedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  let totalCharged = sortedCharges.reduce((sum, c) => sum + Number(c.amount), 0);
  
  // We clone the charges to track what's left
  const remainingCharges = sortedCharges.map(c => ({ ...c, remaining: Number(c.amount) }));
  
  let paymentPool = totalPaid;

  // Apply payments to oldest charges first (FIFO)
  for (const charge of remainingCharges) {
    if (paymentPool <= 0) break;
    if (charge.remaining > 0) {
      const applied = Math.min(charge.remaining, paymentPool);
      charge.remaining -= applied;
      paymentPool -= applied;
    }
  }

  const currentBalance = remainingCharges.reduce((sum, c) => sum + c.remaining, 0);

  return {
    totalCharged,
    totalPaid,
    currentBalance,
    breakdown: remainingCharges 
  };
}
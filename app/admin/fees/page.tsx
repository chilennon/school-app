import { createClient } from '@/lib/supabase/server';
import FeesUI from './FeesUI';

export default async function FeesDashboardPage() {
  const supabase = await createClient();

  // 1. Get current term
  const { data: term } = await supabase.from('terms').select('*').eq('is_current', true).single();
  
  // 2. Get families with their charges and payments
  const { data: families } = await supabase
    .from('families')
    .select(`
      *,
      students(name, classes(name)),
      charges(amount, term_id, created_at, terms(name, sequence)),
      payments(amount, created_at)
    `)
    .order('name');

  return <FeesUI families={families || []} term={term} />;
}
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Investment } from "@/lib/finance/types";
import type { Database } from "@/lib/supabase/database.types";
import { buildInvestmentUpdate } from "@/lib/supabase/mappers";

export class InvestmentsRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async updateAll(userId: string, investments: Investment[]): Promise<void> {
    const timestamp = new Date().toISOString();

    const updates = investments.map((investment) =>
      this.supabase
        .from("investments")
        .update({ ...buildInvestmentUpdate(investment), updated_at: timestamp })
        .eq("id", investment.id)
        .eq("user_id", userId),
    );

    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);

    if (failed?.error) {
      throw failed.error;
    }
  }
}

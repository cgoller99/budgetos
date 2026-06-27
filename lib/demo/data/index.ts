import { christianDemoData } from "@/lib/demo/data/christian";
import { collegeStudentDemoData } from "@/lib/demo/data/collegeStudent";
import { familyDemoData } from "@/lib/demo/data/family";
import { youngProfessionalDemoData } from "@/lib/demo/data/youngProfessional";
import type { FinanceData } from "@/lib/finance/types";
import type { DemoProfileId } from "@/lib/onboarding/types";
import { normalizeRecurringFinanceData } from "@/lib/recurring";

const DEMO_DATA: Record<DemoProfileId, FinanceData> = {
  christian: christianDemoData,
  young_professional: youngProfessionalDemoData,
  family: familyDemoData,
  college_student: collegeStudentDemoData,
};

export function getDemoFinanceData(profileId: DemoProfileId): FinanceData {
  return normalizeRecurringFinanceData(structuredClone(DEMO_DATA[profileId]));
}

export {
  christianDemoData,
  collegeStudentDemoData,
  familyDemoData,
  youngProfessionalDemoData,
};

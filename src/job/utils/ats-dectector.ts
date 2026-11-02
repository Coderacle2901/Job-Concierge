import { AtsType } from '../entities/job.entity';

// Inspects a job URL and determines which submission
// route the Python service should use
export function detectAtsType(applyUrl: string): AtsType {
  const url = applyUrl.toLowerCase();

  if (url.includes('greenhouse.io')) return AtsType.GREENHOUSE;
  if (url.includes('lever.co')) return AtsType.LEVER;
  if (url.includes('myworkdayjobs.com')) return AtsType.WORKDAY;
  if (url.includes('smartrecruiters.com')) return AtsType.SMARTRECRUITERS;
  if (url.includes('icims.com')) return AtsType.ICIMS;

  return AtsType.BROWSER;
}
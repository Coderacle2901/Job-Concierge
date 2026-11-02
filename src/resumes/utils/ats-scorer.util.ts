// src/resumes/utils/ats-scorer.util.ts

export function calculateAtsScore(resumeJson: any, targetRole: string): number {
  let score = 0;

  // 1. SECTION COMPLETENESS (20 Points Max)
  if (resumeJson.personalInfo?.email && resumeJson.personalInfo?.phone) score += 5;
  if (resumeJson.summary?.length > 50) score += 5;
  if (resumeJson.experience?.length > 0) score += 5;
  
  //   FIX: Safely count skills whether it's an object or an array
  let totalSkillsCount = 0;
  if (Array.isArray(resumeJson.skills)) {
    totalSkillsCount = resumeJson.skills.length;
  } else if (typeof resumeJson.skills === 'object' && resumeJson.skills !== null) {
    totalSkillsCount = Object.values(resumeJson.skills).flat().length;
  }
  if (totalSkillsCount >= 5) score += 5;

  // 2. IMPACT METRICS - THE 80% RULE (40 Points Max)
  let totalBullets = 0;
  let metricBullets = 0;
  const metricRegex = /\d+|%|\$/; 

  if (resumeJson.experience) {
    resumeJson.experience.forEach((job: any) => {
      if (job.bullets) {
        job.bullets.forEach((bullet: string) => {
          totalBullets++;
          if (metricRegex.test(bullet)) {
            metricBullets++;
          }
        });
      }
    });
  }

  if (totalBullets > 0) {
    const metricPercentage = metricBullets / totalBullets;
    score += Math.min(40, Math.round((metricPercentage / 0.8) * 40));
  }

  // 3. TARGET ROLE KEYWORD MATCHING (30 Points Max)
  const targetWords = targetRole.toLowerCase().split(' ').filter(w => w.length > 2);
  let keywordHits = 0;
  
  const allResumeText = JSON.stringify(resumeJson).toLowerCase();
  
  targetWords.forEach(word => {
    if (allResumeText.includes(word)) {
      keywordHits++;
    }
  });

  if (targetWords.length > 0) {
    const keywordMatchRatio = keywordHits / targetWords.length;
    score += Math.round(keywordMatchRatio * 30);
  }

  // 4. BULLET POINT LENGTH & READABILITY (10 Points Max)
  let goodBullets = 0;
  if (totalBullets > 0) {
    resumeJson.experience.forEach((job: any) => {
      job.bullets?.forEach((bullet: string) => {
        if (bullet.length > 40 && bullet.length < 200) goodBullets++;
      });
    });
    score += Math.round((goodBullets / totalBullets) * 10);
  }

  return Math.min(100, Math.max(0, score));
}
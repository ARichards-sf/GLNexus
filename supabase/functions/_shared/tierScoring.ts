export interface TierScoreInput {
  // AUM
  householdAum: number;
  bookAverageAum: number;

  // Income
  annualIncome: number | null;

  // Age (primary member)
  primaryMemberAge: number | null;

  // Referrals
  referralsSent: number;
  // count of prospects where
  // referred_by_household_id
  // = this household

  referredByTier: string | null;
  // wealth_tier of the household
  // that referred this client
  // null if not referred
}

export interface TierScoreBreakdown {
  total: number;
  aumScore: number;
  aumDetail: string;
  incomeScore: number;
  incomeDetail: string;
  ageScore: number;
  ageDetail: string;
  referralScore: number;
  referralDetail: string;
  recommendedTier: "platinum" | "gold" | "silver";
  confidence: "high" | "medium" | "low";
  // low when income is missing
  flags: string[];
  // notable observations for
  // Goodie's narrative
}

export function calculateTierScore(
  input: TierScoreInput
): TierScoreBreakdown {
  const flags: string[] = [];

  // ── AUM SCORE (40 pts max) ──
  const ratio = input.bookAverageAum > 0
    ? input.householdAum / input.bookAverageAum
    : 0;

  let aumScore = 0;
  let aumDetail = "";

  if (ratio >= 3) {
    aumScore = 40;
    aumDetail = `${ratio.toFixed(1)}x book average — top tier AUM`;
  } else if (ratio >= 2) {
    aumScore = 32;
    aumDetail = `${ratio.toFixed(1)}x book average — strong AUM`;
  } else if (ratio >= 1) {
    aumScore = 24;
    aumDetail = `${ratio.toFixed(1)}x book average — at or above average`;
  } else if (ratio >= 0.5) {
    aumScore = 16;
    aumDetail = `${ratio.toFixed(1)}x book average — below average`;
  } else {
    aumScore = 8;
    aumDetail = `${ratio.toFixed(1)}x book average — well below average`;
  }

  // ── INCOME SCORE (25 pts max) ──
  let incomeScore = 12; // neutral default
  let incomeDetail = "Income not provided — using neutral score";

  if (input.annualIncome !== null) {
    const inc = input.annualIncome;
    if (inc >= 500000) {
      incomeScore = 25;
      incomeDetail = `$${(inc / 1000).toFixed(0)}k annual income — high earner`;
    } else if (inc >= 250000) {
      incomeScore = 20;
      incomeDetail = `$${(inc / 1000).toFixed(0)}k annual income — strong earner`;
    } else if (inc >= 150000) {
      incomeScore = 15;
      incomeDetail = `$${(inc / 1000).toFixed(0)}k annual income — above average`;
    } else if (inc >= 75000) {
      incomeScore = 10;
      incomeDetail = `$${(inc / 1000).toFixed(0)}k annual income — moderate`;
    } else {
      incomeScore = 5;
      incomeDetail = `$${(inc / 1000).toFixed(0)}k annual income — below average`;
    }
  } else {
    flags.push("Income data missing — adding it may change this recommendation");
  }

  // ── AGE SCORE (15 pts max) ──
  let ageScore = 0;
  let ageDetail = "";
  if (input.primaryMemberAge === null) {
    ageScore = 7; // neutral
    ageDetail = "Age not available — using neutral score";
    flags.push("Primary member date of birth not set");
  } else {
    const age = input.primaryMemberAge;
    if (age < 45) {
      ageScore = 15;
      ageDetail = `Age ${age} — long accumulation runway`;
    } else if (age < 55) {
      ageScore = 12;
      ageDetail = `Age ${age} — strong accumulation phase`;
    } else if (age < 65) {
      ageScore = 9;
      ageDetail = `Age ${age} — approaching peak wealth`;
    } else if (age < 75) {
      ageScore = 6;
      ageDetail = `Age ${age} — distribution phase`;
      if (input.householdAum < input.bookAverageAum) {
        flags.push("Client is 65+ with below-average AUM — limited growth runway");
      }
    } else {
      ageScore = 3;
      ageDetail = `Age ${age} — late distribution phase`;
      flags.push("Client is 75+ — limited future AUM growth expected");
    }
  }

  // ── REFERRAL SCORE (20 pts max) ──
  // Split: 12pts outbound + 8pts inbound

  let referralScore = 0;
  let referralDetail = "";
  const parts: string[] = [];

  // Outbound — referrals they've sent
  let outboundScore = 0;
  if (input.referralsSent >= 3) {
    outboundScore = 12;
    parts.push(`${input.referralsSent} referrals sent — proven source`);
    flags.push(`Sent ${input.referralsSent} referrals — high retention risk`);
  } else if (input.referralsSent === 2) {
    outboundScore = 9;
    parts.push("2 referrals sent");
  } else if (input.referralsSent === 1) {
    outboundScore = 6;
    parts.push("1 referral sent");
  } else {
    outboundScore = 0;
    parts.push("No referrals sent yet");
  }

  // Inbound — who referred them
  let inboundScore = 0;
  if (input.referredByTier === "platinum") {
    inboundScore = 8;
    parts.push("Referred by Platinum client");
    flags.push("Referred by Platinum client — tier affects referrer relationship");
  } else if (input.referredByTier === "gold") {
    inboundScore = 5;
    parts.push("Referred by Gold client");
  } else if (input.referredByTier === "silver") {
    inboundScore = 2;
    parts.push("Referred by Silver client");
  }

  referralScore = outboundScore + inboundScore;
  referralDetail = parts.join(" · ") || "No referral activity";

  // ── TOTAL ──
  const total = aumScore + incomeScore + ageScore + referralScore;

  // ── TIER MAPPING ──
  let recommendedTier: "platinum" | "gold" | "silver";

  if (total >= 75) {
    recommendedTier = "platinum";
  } else if (total >= 50) {
    recommendedTier = "gold";
  } else {
    recommendedTier = "silver";
  }

  // ── CONFIDENCE ──
  const confidence = input.annualIncome === null
    ? "low"
    : input.primaryMemberAge === null
      ? "medium"
      : "high";

  return {
    total,
    aumScore,
    aumDetail,
    incomeScore,
    incomeDetail,
    ageScore,
    ageDetail,
    referralScore,
    referralDetail,
    recommendedTier,
    confidence,
    flags
  };
}

// Helper: get tier thresholds
// for change detection
export function getTierThreshold(tier: string): number {
  if (tier === "platinum") return 75;
  if (tier === "gold") return 50;
  return 0;
}

// Helper: score to tier label
export function scoreToTier(score: number): "platinum" | "gold" | "silver" {
  if (score >= 75) return "platinum";
  if (score >= 50) return "gold";
  return "silver";
}

// Helper: did score cross
// a tier boundary?
export function tierChanged(
  oldScore: number | null,
  newScore: number
): boolean {
  if (oldScore === null) return false;
  return scoreToTier(oldScore) !== scoreToTier(newScore);
}

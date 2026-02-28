export function clampScore(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return Math.round(value);
}

export function resolveGrade(score: number): string {
  if (score >= 95) {
    return "A+";
  }
  if (score >= 90) {
    return "A";
  }
  if (score >= 85) {
    return "B+";
  }
  if (score >= 80) {
    return "B";
  }
  if (score >= 75) {
    return "C+";
  }
  if (score >= 70) {
    return "C";
  }
  if (score >= 65) {
    return "D+";
  }
  if (score >= 60) {
    return "D";
  }
  return "F";
}

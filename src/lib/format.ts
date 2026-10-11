// Numbers the Greek way: 25,8 (not 25.8); up to one decimal for weights and BMI.
export function num1(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : n.toLocaleString("el-GR", { maximumFractionDigits: 1 });
}

/* UI-side number formatting (display only — core values stay exact). */
import { bn, type BigNum } from "../core/bignum";

export function formatMoney(d: BigNum | number): string {
  const v = typeof d === "number" ? bn(d) : d;
  if (v.lt(1000)) {
    const n = v.toNumber();
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }
  if (v.lt(1e6)) {
    return Math.floor(v.toNumber())
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  const e = Math.floor(v.log10());
  const mantissa = v.div(bn(10).pow(e)).toNumber();
  const m = mantissa.toFixed(2).replace(/\.?0+$/, "");
  return `${m}e${e}`;
}

export function formatSeconds(sec: number): string {
  if (sec < 60) return `${Math.floor(sec)} 秒`;
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟`;
  return `${(sec / 3600).toFixed(1)} 小时`;
}

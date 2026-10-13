/* Big-number entry point for the whole game (currency / cardinal side).
 * The ONLY module allowed to import break_infinity.js; everything else
 * imports from here so the library stays swappable (design D1/D4). */
import Decimal from "break_infinity.js";

export type BigNum = Decimal;

export function bn(value: Decimal | number | string): BigNum {
  return new Decimal(value);
}

export const BN_ZERO: BigNum = bn(0);
export const BN_ONE: BigNum = bn(1);

export function bnMax(a: BigNum, b: BigNum): BigNum {
  return a.gte(b) ? a : b;
}

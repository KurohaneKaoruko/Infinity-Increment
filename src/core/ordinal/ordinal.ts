/* Ordinal engine — public surface.
 *
 * One unified representation covers the whole ladder the game climbs:
 *   [0, eps_0)      Cantor Normal Form        (omega heads)
 *   [eps_0, Gam_0)  binary Veblen phi(a,b)   (veblen heads)
 *   [Gam_0, BHO]    Madore's psi             (psi heads, Omega inside args)
 *   [omega_1, ...)  the aleph ladder         (card heads)
 *   beyond          large-cardinal axioms    (card heads, higher tiers)
 *
 * Modules: heads.ts (types/constructors) | order.ts (comparison) |
 * canon.ts (canonicalization) | arith.ts (add/mul/pow) | rank.ts (bridge).
 * See each module header for the exact mathematical rules. */

export type { Head, Ord, OrdResult, OutOfRange, Term } from "./heads";
export {
  ALEPH_TIER,
  CARD_AXIOMS,
  DEPTH_LIMIT,
  MAX_COEF,
  OMEGA,
  ONE,
  OrdinalError,
  OrdinalOverflow,
  ZERO,
  checkCoef,
  checkRange,
  fromNumber,
  headArgs,
  height,
  inRange,
  isNatural,
  omegaPow,
} from "./heads";

export { compare, compareHead, equal, lessThan } from "./order";

export {
  canonicalize,
  termBigomega,
  termCard,
  termOmega,
  termPsi,
  termVeblen,
} from "./canon";

export { add, mul, pow } from "./arith";

export { BRIDGE_C, bridgeLevel, bridgeMultiplierExp, rank } from "./rank";

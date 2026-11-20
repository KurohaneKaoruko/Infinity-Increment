/* Ordinal engine — public surface.
 *
 * One tagged representation covers the notation families shown by the game:
 *   [0, eps_0)      Cantor Normal Form        (omega heads)
 *   [eps_0, Gam_0)  binary Veblen phi(a,b)   (veblen heads)
 *   post-Γ₀ route     selected ψ parameter samples (Omega inside args)
 *   [omega_1, ...)  the aleph ladder         (card heads)
 *   beyond          selected large-cardinal-themed game symbols (card heads)
 *
 * Modules: heads.ts (types/constructors) | order.ts (comparison) |
 * canon.ts (canonicalization) | arith.ts (add/mul/pow) | rank.ts (score).
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

/** `rank` is a leaderboard encoding, not an ordinal-theoretic rank. */
export { BRIDGE_C, bridgeLevel, bridgeMultiplierExp, rank } from "./rank";

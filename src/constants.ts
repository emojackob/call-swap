
// a list of tokens by chain
import {ChainId, Token} from "@swap/sdk";
import { mainnetTokens,} from '../src/tokens'

type ChainTokenList = {
    readonly [chainId in ChainId]: Token[]
}

// used to construct intermediary pairs for trading
export const BASES_TO_CHECK_TRADES_AGAINST: ChainTokenList = {
    [ChainId.MAINNET]: [
        mainnetTokens.whec,
        mainnetTokens.hbtc,
        mainnetTokens.usdt,
    ],
    [ChainId.TESTNET]: [],
}

/**
 * Addittional bases for specific tokens
 * @example { [WBTC.address]: [renBTC], [renBTC.address]: [WBTC] }
 */
export const ADDITIONAL_BASES: { [chainId in ChainId]?: { [tokenAddress: string]: Token[] } } = {
    [ChainId.MAINNET]: {},
}

/**
 * Some tokens can only be swapped via certain pairs, so we override the list of bases that are considered for these
 * tokens.
 * @example [AMPL.address]: [DAI, WETH[ChainId.MAINNET]]
 */
export const CUSTOM_BASES: { [chainId in ChainId]?: { [tokenAddress: string]: Token[] } } = {
    [ChainId.MAINNET]: {},
}
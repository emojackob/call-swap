import {ChainId, Currency, Pair, Token,} from "../swapsdk";
import { Interface, FunctionFragment } from '@ethersproject/abi'
import flatMap from 'lodash/flatMap'
import {wrappedCurrency} from "../src/wrappedCurrency";
import {BASES_TO_CHECK_TRADES_AGAINST,CUSTOM_BASES,ADDITIONAL_BASES} from "../src/constants";

const chainId = ChainId.MAINNET


export enum PairState {
    LOADING,
    NOT_EXISTS,
    EXISTS,
    INVALID,
}


//获取所有交易对地址
export function getAllPairsAddress(currencyA?: Currency, currencyB?: Currency): string[] {
    const [tokenA, tokenB] = chainId
        ? [wrappedCurrency(currencyA, chainId), wrappedCurrency(currencyB, chainId)]
        : [undefined, undefined]
    const bases:Token[] = basesTokens(tokenA,tokenB)
    const basePairs: [Token, Token][] = baPairs(bases)
    const allPairCombinations: [Token, Token][] = allPairCom(tokenA,tokenB,bases,basePairs)
    return pairsAddress(allPairCombinations)
}


//构建交易对地址
export function pairsAddress(currencies: [Currency | undefined, Currency | undefined][]): string[]  {
    const tokens = currencies.map(([currencyA, currencyB]) => [
        wrappedCurrency(currencyA, chainId),
        wrappedCurrency(currencyB, chainId),])
    const pairAddresses = tokens.map(([tokenA, tokenB]) => {
        try {
            return tokenA && tokenB && !tokenA.equals(tokenB) ? Pair.getAddress(tokenA, tokenB) : undefined
        } catch (error: any) {
            // Debug Invariant failed related to this line
            console.error(
                error.msg,
                `- pairAddresses: ${tokenA?.address}-${tokenB?.address}`,
                `chainId: ${tokenA?.chainId}`,
            )

            return undefined
        }
    })
    const pa: string[] = pairAddresses.map(iterm => {
        if (iterm) {
            return iterm
        }
    })

    return pa
}

//构建所有交易对
function allPairCom(tokenA: Token | undefined, tokenB: Token | undefined,bases:Token[],basePairs: [Token, Token][]): [Token, Token][] {
    return  tokenA && tokenB
        ? [
            // the direct pair
            [tokenA, tokenB],
            // token A against all bases
            ...bases.map((base): [Token, Token] => [tokenA, base]),
            // token B against all bases
            ...bases.map((base): [Token, Token] => [tokenB, base]),
            // each base against all bases
            ...basePairs,
        ]
            .filter((tokens): tokens is [Token, Token] => Boolean(tokens[0] && tokens[1]))
            .filter(([t0, t1]) => t0.address !== t1.address)
            .filter(([tokenA_, tokenB_]) => {
                if (!chainId) return true
                const customBases = CUSTOM_BASES[chainId]

                const customBasesA: Token[] | undefined = customBases?.[tokenA_.address]
                const customBasesB: Token[] | undefined = customBases?.[tokenB_.address]

                if (!customBasesA && !customBasesB) return true

                if (customBasesA && !customBasesA.find((base) => tokenB_.equals(base))) return false
                if (customBasesB && !customBasesB.find((base) => tokenA_.equals(base))) return false

                return true
            })
        : []
}

//构建基础交易对
function baPairs(bases:Token[]):[Token, Token][]{
    return flatMap(bases, (base): [undefined, Token][] => bases.map((otherBase) => [base, otherBase]))
}

//获取基础所有token
function basesTokens(currencyA: Token | undefined, currencyB: Token | undefined):Token[]{
    const chainId = ChainId.MAINNET

    const [tokenA, tokenB] = chainId
        ? [wrappedCurrency(currencyA, chainId), wrappedCurrency(currencyB, chainId)]
        : [undefined, undefined]

    const common = BASES_TO_CHECK_TRADES_AGAINST[ChainId.MAINNET] ?? []
    const additionalA = tokenA ? ADDITIONAL_BASES[chainId]?.[tokenA.address] ?? [] : []
    const additionalB = tokenB ? ADDITIONAL_BASES[chainId]?.[tokenB.address] ?? [] : []

    return [...common, ...additionalA, ...additionalB]
}


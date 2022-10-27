import {ChainId, Currency, Pair, Token} from "@swap/sdk";
import {flatMap} from "lodash";
import {wrappedCurrency} from "./utils/wrappedCurrency";
import {BASES_TO_CHECK_TRADES_AGAINST,CUSTOM_BASES,ADDITIONAL_BASES} from "../src/constants";
import {getAllPairs} from "./Pairs";

export enum PairState {
    LOADING,
    NOT_EXISTS,
    EXISTS,
    INVALID,
}


//获取所有交易对
export async function getAllCommonPairs(currencyA?: Currency, currencyB?: Currency): Promise<Pair[]> {
    const chainId = ChainId.MAINNET

    const [tokenA, tokenB] = chainId
        ? [wrappedCurrency(currencyA, chainId), wrappedCurrency(currencyB, chainId)]
        : [undefined, undefined]

    const common = BASES_TO_CHECK_TRADES_AGAINST[ChainId.MAINNET] ?? []
    const additionalA = tokenA ? ADDITIONAL_BASES[chainId]?.[tokenA.address] ?? [] : []
    const additionalB = tokenB ? ADDITIONAL_BASES[chainId]?.[tokenB.address] ?? [] : []

    const bases:Token[] =  [...common, ...additionalA, ...additionalB]

    const basePairs: [Token, Token][] = flatMap(bases, (base): [Token, Token][] => bases.map((otherBase) => [base, otherBase]))

    const allPairCombinations: [Token, Token][] = (tokenA && tokenB
        ? [
            // the direct pair
            [tokenA, tokenB],
            // token A against all bases
            ...bases.map((base): [Token, Token] => [tokenA, base]),
            // token B against all bases
            ...bases.map((base): [Token, Token] => [tokenB, base]),
            // each base against all bases
            ...basePairs,
        ]: basePairs)
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
    const allPairs = await getAllPairs(allPairCombinations)

    return  Object.values(
        allPairs
            // filter out invalid pairs
            .filter((result): result is [PairState.EXISTS, Pair] => Boolean(result[0] === PairState.EXISTS && result[1]))
            // filter out duplicated pairs
            .reduce<{ [pairAddress: string]: Pair }>((memo, [, curr]) => {
                memo[curr.liquidityToken.address] = memo[curr.liquidityToken.address] ?? curr
                return memo
            }, {}),
    )
}

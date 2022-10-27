import {Currency, Pair, ChainId, TokenAmount} from "@swap/sdk";
import { Interface } from '@ethersproject/abi'
import {PairState} from "./Trades";
import {wrappedCurrency} from "./utils/wrappedCurrency";
import {getMultipleContractSingleData} from "./multicall/multicall";
import IPancakePairABI from './config/abi/IPancakePair.json'
const PAIR_INTERFACE = new Interface(IPancakePairABI)

export async function getPair(tokenA?: Currency, tokenB?: Currency): Promise<[PairState, Pair | null]>{
    return (await getAllPairs([[tokenA,tokenB]]))[0]
}

export async function getAllPairs(currencies: [Currency | undefined, Currency | undefined][]): Promise<[PairState, Pair | null][]> {
    const chainId = ChainId.MAINNET
    const tokens = currencies.map(([currencyA, currencyB]) => [
        wrappedCurrency(currencyA, chainId),
        wrappedCurrency(currencyB, chainId),
    ])

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

    const results = await getMultipleContractSingleData(pairAddresses,PAIR_INTERFACE,'getReserves')

    return results.map((result, i) => {
        const { result: reserves, loading } = result
        const tokenA = tokens[i][0]
        const tokenB = tokens[i][1]

        if (loading) return [PairState.LOADING, null]
        if (!tokenA || !tokenB || tokenA.equals(tokenB)) return [PairState.INVALID, null]
        if (!reserves) return [PairState.NOT_EXISTS, null]
        const { reserve0, reserve1 } = reserves
        const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]
        return [
            PairState.EXISTS,
            new Pair(new TokenAmount(token0, reserve0.toString()), new TokenAmount(token1, reserve1.toString())),
        ]
    })
}
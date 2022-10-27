import { BigNumber } from '@ethersproject/bignumber'
import { parseUnits } from '@ethersproject/units'
import {multiCallContract} from "./swapconstract";
import {getSingleCallResult} from "./multicall/multicall";

// gets the current timestamp from the blockchain
export async function currentBlockTimestamp(): Promise<BigNumber | undefined> {
    const multicall = multiCallContract()
    return (await getSingleCallResult(multicall, 'getCurrentBlockTimestamp'))?.result?.[0]
}


export function getGasPrice(): string {
    return GAS_PRICE_GWEI.fast
}


export enum GAS_PRICE {
    default = '5',
    fast = '6',
    instant = '7',
    testnet = '10',
}

export const GAS_PRICE_GWEI = {
    default: parseUnits(GAS_PRICE.default, 'gwei').toString(),
    fast: parseUnits(GAS_PRICE.fast, 'gwei').toString(),
    instant: parseUnits(GAS_PRICE.instant, 'gwei').toString(),
    testnet: parseUnits(GAS_PRICE.testnet, 'gwei').toString(),
}
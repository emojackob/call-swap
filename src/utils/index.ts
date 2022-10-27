import {JsonRpcProvider} from '@ethersproject/providers'
import { getAddress } from '@ethersproject/address'
import {CurrencyAmount, JSBI} from "@swap/sdk";
import {BigNumber} from "@ethersproject/bignumber";

export const provider = new JsonRpcProvider("https://hecrpc.hecchain.com")


// returns the checksummed address if the address is valid, otherwise returns false
export function isAddress(value: any): string | false {
    try {
        return getAddress(value)
    } catch {
        return false
    }
}

export function calculateSlippageAmount(value: CurrencyAmount, slippage: number): [JSBI, JSBI] {
    if (slippage < 0 || slippage > 10000) {
        throw Error(`Unexpected slippage value: ${slippage}`)
    }
    return [
        JSBI.divide(JSBI.multiply(value.raw, JSBI.BigInt(10000 - slippage)), JSBI.BigInt(10000)),
        JSBI.divide(JSBI.multiply(value.raw, JSBI.BigInt(10000 + slippage)), JSBI.BigInt(10000)),
    ]
}

// add 10%
export function calculateGasMargin(value: BigNumber): BigNumber {
    return value.mul(BigNumber.from(10000).add(BigNumber.from(1000))).div(BigNumber.from(10000))
}
import {getGasPrice} from "./chaininfo";
import {TransactionResponse} from "@ethersproject/providers";
import {Contract,CallOverrides} from "@ethersproject/contracts";
import get from 'lodash/get'

//构造合约调用函数
export function callWithGasPriceFunc() {
    const gasPrice = getGasPrice()
    const callWithGasPrice = async (
        contract: Contract,
        methodName: string,
        methodArgs: any[] = [],
        overrides?: CallOverrides,
    ) : Promise<TransactionResponse> => {
        const contractMethod = get(contract, methodName)
        const hasManualGasPriceOverride = overrides?.gasPrice
        const tx = await contractMethod(
            ...methodArgs,
            hasManualGasPriceOverride ? { ...overrides } : { ...overrides, gasPrice },
        )
        return tx
    }
    return callWithGasPrice
}
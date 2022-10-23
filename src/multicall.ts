import {Interface} from "@ethersproject/abi";
import { BigNumber } from '@ethersproject/bignumber'



type MethodArg = string | number | BigNumber
type MethodArgs = Array<MethodArg | MethodArg[]>

type OptionalMethodInputs = Array<MethodArg | MethodArg[] | undefined> | undefined

export interface Call {
    address: string
    callData: string
}

//构造多个calls请求
export function getMultipleCalls(addresses: string[],
                                 contractInterface: Interface,
                                 methodName: string,
                                 callInputs?: OptionalMethodInputs,
) {
    const fragment = contractInterface.getFunction(methodName)

    const callData: string | undefined = fragment && isValidMethodArgs(callInputs)
                ? contractInterface.encodeFunctionData(fragment, callInputs)
                : undefined
    const calls = fragment && addresses && addresses.length > 0 && callData
                ? addresses.map<Call | undefined>((address) => {
                    return address && callData
                        ? {
                            address,
                            callData,
                        }
                        : undefined
                })
                : []

}

function isValidMethodArgs(x: unknown): x is MethodArgs | undefined {
    return (
        x === undefined ||
        (Array.isArray(x) && x.every((xi) => isMethodArg(xi) || (Array.isArray(xi) && xi.every(isMethodArg))))
    )
}
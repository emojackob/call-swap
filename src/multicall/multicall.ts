import { Interface, FunctionFragment } from '@ethersproject/abi'
import {isValidMethodArgs,callsData,OptionalMethodInputs,Call,CallResult} from './fetchdata'
import {Contract} from "@ethersproject/contracts";

export interface Result extends ReadonlyArray<any> {
    readonly [key: string]: any
}

interface CallState {
    readonly valid: boolean
    // the result, or undefined if loading or errored/no data
    readonly result: Result | undefined
    // true if the result has never been fetched
    readonly loading: boolean
    // true if the result is not for the latest block
    readonly syncing: boolean
    // true if the call was made and is synced, but the return data is invalid
    readonly error: boolean
}


const INVALID_CALL_STATE: CallState = { valid: false, result: undefined, loading: false, syncing: false, error: false }
const LOADING_CALL_STATE: CallState = { valid: true, result: undefined, loading: true, syncing: true, error: false }



function toCallState(
    callResult: CallResult | undefined,
    contractInterface: Interface | undefined,
    fragment: FunctionFragment | undefined,
): CallState {
    if (!callResult) return INVALID_CALL_STATE
    const { valid, data,blockNumber } = callResult
    if (!valid) return INVALID_CALL_STATE
    if (valid && !blockNumber) return LOADING_CALL_STATE
    if (!contractInterface || !fragment) return LOADING_CALL_STATE
    const success = data && data.length > 2
    // const syncing = (blockNumber ?? 0) < latestBlockNumber
    let result: Result | undefined
    if (success && data) {
        try {
            result = contractInterface.decodeFunctionResult(fragment, data)
        } catch (error) {
            console.debug('Result data parsing failed', fragment, data)
            return {
                valid: true,
                loading: false,
                error: true,
                syncing: true,
                result,
            }
        }
    }
    return {
        valid: true,
        loading: false,
        syncing: true,
        result,
        error: !success,
    }
}

export async function getSingleContractMultipleData(
    contract: Contract | null | undefined,
    methodName: string,
    callInputs: OptionalMethodInputs[],
): Promise<CallState[]> {
    const fragment = contract?.interface?.getFunction(methodName)
    const calls = contract && fragment && callInputs && callInputs.length > 0
        ? callInputs.map<Call>((inputs) => {
            return {
                address: contract.address,
                callData: contract.interface.encodeFunctionData(fragment, inputs),
            }
        })
        : []
    const results = await callsData(calls)

    return results.map((result) => toCallState(result, contract?.interface, fragment))
}

export async function getSingleCallResult(
    contract: Contract | null | undefined,
    methodName: string,
    inputs?: OptionalMethodInputs,
): Promise<CallState> {
    const fragment = contract?.interface?.getFunction(methodName)
    const calls = contract && fragment && isValidMethodArgs(inputs)
        ? [
            {
                address: contract.address,
                callData: contract.interface.encodeFunctionData(fragment, inputs),
            },
        ]
        : []
    const result = (await callsData(calls))[0]

    return toCallState(result,contract?.interface,fragment)
}

//构造多个calls请求
export async function getMultipleContractSingleData(addresses: (string | undefined)[],
                                 contractInterface: Interface,
                                 methodName: string,
                                 callInputs?: OptionalMethodInputs,
): Promise<CallState[]> {
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

    const results = await callsData(calls)
    return results.map((result) => toCallState(result, contractInterface, fragment))
}




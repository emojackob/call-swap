import {Contract} from "@ethersproject/contracts";
import { RetryableError} from "./retry";
import {BigNumber} from "@ethersproject/bignumber";
import chunkArray from "./chunkArray";
import {multiCallContract} from "../swapconstract";


type MethodArg = string | number | BigNumber
type MethodArgs = Array<MethodArg | MethodArg[]>

export type OptionalMethodInputs = Array<MethodArg | MethodArg[] | undefined> | undefined

export interface Call {
    address: string
    callData: string
}

export interface CallResult {
    readonly valid: boolean
    readonly data: string | undefined
    readonly blockNumber: number | undefined
}


// the lowest level call for subscribing to contract data
export async function callsData(calls: (Call | undefined)[]): Promise<CallResult[]>{
    const multicallContract = multiCallContract()

    const callsFilter = calls?.filter((c): c is Call => Boolean(c))
    const {results,blockNumber} = await fetchChunk(multicallContract, callsFilter)

    const callResult: CallResult[] = results.map((data) => {
        let value
        if (data && data !== '0x') {
            value = data
        }
        return { valid: true, data: value,blockNumber:blockNumber}
    })
    return callResult
    // let data
    // if (result?.data && result?.data !== '0x') {
    //     // eslint-disable-next-line prefer-destructuring
    //     data = result.data
    // }
    //
    // return { valid: true, data, blockNumber: result?.blockNumber }
    return []

    const serializedCallKeys: string = JSON.stringify(
        calls
            ?.filter((c): c is Call => Boolean(c))
            ?.map(toCallKey)
            ?.sort() ?? [],
    )
    const outdatedCallKeys: string[] = JSON.parse(serializedCallKeys)
    const callsAfter = outdatedCallKeys.map((key) => parseCallKey(key))

    const chunkedCalls = chunkArray(callsAfter, 500)


    try {
     const result =  chunkedCalls.map(async (chunk,index) => {
         const {results} = await fetchChunk(multicallContract, chunk)
         console.log(index)
         return new Promise<string[]>((resolve => {
             resolve(results)
         }))
     })
     await Promise.all(result)
    }catch (e) {
        console.log("callsData--err->",e)
    }
    return []
}


/**
 * Fetches a chunk of calls, enforcing a minimum block number constraint
 * @param multicallContract multicall contract to fetch against
 * @param chunk chunk of calls to make
 * @param minBlockNumber minimum block number of the result set
 */
async function fetchChunk(
    multicallContract: Contract,
    chunk: Call[],
): Promise<{ results: string[]; blockNumber: number }> {
    // console.debug('Fetching chunk', multicallContract, chunk, minBlockNumber)
    let resultsBlockNumber
    let returnData
    try {
        // prettier-ignore
        [resultsBlockNumber, returnData] = await multicallContract.aggregate(
            chunk.map((obj) => [obj.address, obj.callData])
        )
    } catch (err) {
        const error = err as any
        if (
            error.code === -32000 ||
            (error?.data?.message && error?.data?.message?.indexOf('header not found') !== -1) ||
            error.message?.indexOf('header not found') !== -1
        ) {
            throw new RetryableError(`header not found for block number`)
        } else if (error.code === -32603 || error.message?.indexOf('execution ran out of gas') !== -1) {
            if (chunk.length > 1) {
                if (process.env.NODE_ENV === 'development') {
                    console.debug('Splitting a chunk in 2', chunk)
                }
                const half = Math.floor(chunk.length / 2)
                const [c0, c1] = await Promise.all([
                    fetchChunk(multicallContract, chunk.slice(0, half)),
                    fetchChunk(multicallContract, chunk.slice(half, chunk.length)),
                ])
                return {
                    results: c0.results.concat(c1.results),
                    blockNumber: c1.blockNumber,
                }
            }
        }
        console.debug('Failed to fetch chunk inside retry', error)
        throw error
    }
    return { results: returnData, blockNumber: resultsBlockNumber.toNumber() }
}

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/
const LOWER_HEX_REGEX = /^0x[a-f0-9]*$/

export function toCallKey(call: Call): string {
    if (!ADDRESS_REGEX.test(call.address)) {
        throw new Error(`Invalid address: ${call.address}`)
    }
    if (!LOWER_HEX_REGEX.test(call.callData)) {
        throw new Error(`Invalid hex: ${call.callData}`)
    }
    return `${call.address}-${call.callData}`
}

export function parseCallKey(callKey: string): Call {
    const pcs = callKey.split('-')
    if (pcs.length !== 2) {
        throw new Error(`Invalid call key: ${callKey}`)
    }
    return {
        address: pcs[0],
        callData: pcs[1],
    }
}

export function isValidMethodArgs(x: unknown): x is MethodArgs | undefined {
    return (
        x === undefined ||
        (Array.isArray(x) && x.every((xi) => isMethodArg(xi) || (Array.isArray(xi) && xi.every(isMethodArg))))
    )
}
function isMethodArg(x: unknown): x is MethodArg {
    return ['string', 'number'].indexOf(typeof x) !== -1
}
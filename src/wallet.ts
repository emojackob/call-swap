import {Currency, CurrencyAmount, Token, JSBI, TokenAmount, HEC} from "@swap/sdk";
import orderBy from 'lodash/orderBy'
import {getMultipleContractSingleData, getSingleContractMultipleData} from "./multicall/multicall";
import {multiCallContract} from "./swapconstract";
import {isAddress} from "./utils";
import {Interface} from "@ethersproject/abi";
import ERC20_ABI from "./config/abi/erc20.json";


export async function getCurrencyBalances(
    account?: string,
    currencies?: (Currency | undefined)[],
): Promise<(CurrencyAmount | undefined)[]> {

    const tokens = currencies?.filter((currency): currency is Token => currency instanceof Token) ?? []
    const tokenBalances = await getTokenBalances(account,tokens)

    const containsHEC: boolean = currencies?.some((currency) => currency === HEC) ?? false
    const hecBalance = await getHECBalances(containsHEC ? [account] : [])

    return currencies?.map((currency) => {
        if (!account || !currency) return undefined
        if (currency instanceof Token) return tokenBalances[currency.address]
        if (currency === HEC) return hecBalance[account]
        return undefined
    }) ?? []
}

export async function getTokenBalances(
    address?: string,
    tokens?: (Token | undefined)[],
): Promise<{ [tokenAddress: string]: TokenAmount | undefined }> {
    return (await getTokenBalancesWithLoadingIndicator(address, tokens))[0]
}

export async function getHECBalances(uncheckedAddresses?: (string | undefined)[]): Promise<{
    [address: string]: CurrencyAmount | undefined
}> {
    const multicallCon = multiCallContract()

    const addresses: string[] = uncheckedAddresses ? orderBy(uncheckedAddresses.map(isAddress).filter((a): a is string => a !== false)) : []

    const results = await getSingleContractMultipleData(
        multicallCon,
        'getEthBalance',
        addresses.map((address) => [address]),
    )

    return addresses.reduce<{ [address: string]: CurrencyAmount }>((memo, address, i) => {
        const value = results?.[i]?.result?.[0]
        if (value) memo[address] = CurrencyAmount.ether(JSBI.BigInt(value.toString()))
        return memo
    }, {})
}

export async function getTokenBalancesWithLoadingIndicator(
    address?: string,
    tokens?: (Token | undefined)[],
): Promise<[{ [tokenAddress: string]: TokenAmount | undefined }]> {
    const validatedTokens: Token[]  = tokens?.filter((t?: Token): t is Token => Boolean(t)) ?? []
    const validatedTokenAddresses = validatedTokens.map((vt) => vt.address)
    const ERC20_INTERFACE = new Interface(ERC20_ABI)
    const balances = await getMultipleContractSingleData(
        validatedTokenAddresses,
        ERC20_INTERFACE,
        'balanceOf',
        [address],
    )

   return [
       address && validatedTokens.length > 0
           ? validatedTokens.reduce<{ [tokenAddress: string]: TokenAmount | undefined }>((memo, token, i) => {
               const value = balances?.[i]?.result?.[0]
               const amount = value ? JSBI.BigInt(value.toString()) : undefined
               if (amount) {
                   memo[token.address] = new TokenAmount(token, amount)
               }
               return memo
           }, {})
           : {}
   ]
}
import {ChainId, Currency, Token, HEC, TokenAmount} from '@swap/sdk'
import { GELATO_NATIVE } from './config/constants/contracts'
import {erc20Contract} from "./swapconstract";
import {BigNumber} from "@ethersproject/bignumber";
import {getSingleCallResult} from "./multicall/multicall";
const { MAINNET } = ChainId

interface TokenList {
  [symbol: string]: Token
}

const defineTokens = <T extends TokenList>(t: T) => t

export const mainnetTokens = defineTokens({
  whec: new Token(
    MAINNET,
    '0xB7a8CB0293165eB3F06d99b17E9d7d8d9DeF8CbD',
    18,
    'WHEC',
    'Wrapped HEC',
    '',
  ),
  // hso here points to the whso contract. Wherever the currency HSO is required, conditional checks for the symbol 'HSO' can be used
  hec: new Token(MAINNET, '0xB7a8CB0293165eB3F06d99b17E9d7d8d9DeF8CbD', 18, 'HEC', 'HEC', ''),
  hbtc: new Token(
      MAINNET,
      '0xCA0c66F6BAcE642a274B28773bB5Ba57c919E245',
      18,
      'HBTC',
      'HBTC',
      'https://hec.org/',
  ),
  usdt: new Token(
      MAINNET,
      '0x30751d3e35B6e8922819d0ea641D72015C6eAE6F',
      18,
      'USDT',
      'Tether USD',
      'https://tether.to/',
  )
} as const)


export async function getToken(tokenAddress: string) : Promise<Token> {
    const tokens = Object.values(mainnetTokens).filter(token => token.address.toUpperCase() === tokenAddress.toUpperCase())
    if (tokens.length > 0) {
      return tokens[0]
    }
    const tokenContract = erc20Contract(tokenAddress)
    const decimals = await tokenContract.decimals()
    const name = await tokenContract.name()
    const symbol = await tokenContract.symbol()
    return new Token(627,tokenAddress,decimals,symbol,name)
}


export async function getCurrency(currencyId: string): Promise<Currency | Token> {
  if (currencyId?.toUpperCase() === 'HEC' || currencyId?.toLowerCase() === GELATO_NATIVE) {
      return HEC
  }
  return await getToken(currencyId)
}


// returns undefined if input token is undefined, or fails to get token contract,
// or contract total supply cannot be fetched
export async function getTotalSupply(token?: Token): Promise<TokenAmount | undefined> {
    const contract = erc20Contract(token?.address)
    const totalSupply: BigNumber = (await getSingleCallResult(contract, 'totalSupply'))?.result?.[0]

    return token && totalSupply ? new TokenAmount(token, totalSupply.toString()) : undefined
}

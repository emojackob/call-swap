import { ChainId, Token } from '../swapsdk/'

const { MAINNET, TESTNET } = ChainId

interface TokenList {
  [symbol: string]: Token
}

const defineTokens = <T extends TokenList>(t: T) => t

export const mainnetTokens = defineTokens({
  wbnb: new Token(
    MAINNET,
    '0xB7a8CB0293165eB3F06d99b17E9d7d8d9DeF8CbD',
    18,
    'WHEC',
    'Wrapped HEC',
    '',
  ),
  // hso here points to the whso contract. Wherever the currency HSO is required, conditional checks for the symbol 'HSO' can be used
  bnb: new Token(MAINNET, '0xB7a8CB0293165eB3F06d99b17E9d7d8d9DeF8CbD', 18, 'HEC', 'HEC', ''),
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

export const testnetTokens = defineTokens({
  wbnb: new Token(
    TESTNET,
    '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd',
    18,
    'WBNB',
    'Wrapped BNB',
    'https://www.binance.com/',
  ),
  cake: new Token(
    TESTNET,
    '0xa35062141Fa33BCA92Ce69FeD37D0E8908868AAe',
    18,
    'CAKE',
    'PancakeSwap Token',
    '',
  ),
  busd: new Token(
    TESTNET,
    '0xeD24FC36d5Ee211Ea25A80239Fb8C4Cfd80f12Ee',
    18,
    'BUSD',
    'Binance USD',
    'https://www.paxos.com/busd/',
  ),
  syrup: new Token(
    TESTNET,
    '0xfE1e507CeB712BDe086f3579d2c03248b2dB77f9',
    18,
    'SYRUP',
    'SyrupBar Token',
    '',
  ),
  bake: new Token(
    TESTNET,
    '0xE02dF9e3e622DeBdD69fb838bB799E3F168902c5',
    18,
    'BAKE',
    'Bakeryswap Token',
    'https://www.bakeryswap.org/',
  ),
} as const)
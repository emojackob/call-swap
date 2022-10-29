
//计算移除流动性所需要的参数
import {Currency, CurrencyAmount, JSBI, Pair, Percent, TokenAmount} from "@swap/sdk";
import {getPair} from "./Pairs";
import {getTokenBalances} from "./wallet";
import {wrappedCurrency} from "./utils/wrappedCurrency";
import {getTotalSupply} from "./tokens"
import tryParseAmount from "./utils/tryParseAmount";


export enum Field {
    LIQUIDITY_PERCENT = 'LIQUIDITY_PERCENT',
    LIQUIDITY = 'LIQUIDITY',
    CURRENCY_A = 'CURRENCY_A',
    CURRENCY_B = 'CURRENCY_B',
}

export async function derivedBurnInfo(
    currencyA: Currency | undefined,
    currencyB: Currency | undefined,
    parameterFiledValue: {independentField: string,typedValue: string},
    account?: string
):  Promise<{
    pair?: Pair | null
    parsedAmounts: {
        [Field.LIQUIDITY_PERCENT]: Percent
        [Field.LIQUIDITY]?: TokenAmount
        [Field.CURRENCY_A]?: CurrencyAmount
        [Field.CURRENCY_B]?: CurrencyAmount
    }
    error?: string
}> {
    const { independentField, typedValue } = parameterFiledValue
    const [, pair] = await getPair(currencyA,currencyB)
    //获取地址token余额
    const relevantTokenBalances = await getTokenBalances(account,[pair?.liquidityToken])
    const userLiquidity: undefined | TokenAmount = relevantTokenBalances?.[pair?.liquidityToken?.address ?? '']
    const [tokenA, tokenB] = [wrappedCurrency(currencyA, 627), wrappedCurrency(currencyB, 627)]
    const tokens = {
        [Field.CURRENCY_A]: tokenA,
        [Field.CURRENCY_B]: tokenB,
        [Field.LIQUIDITY]: pair?.liquidityToken,
    }

    // liquidity 总额
    const totalSupply = await getTotalSupply(pair?.liquidityToken)
    const liquidityValueA =
        pair &&
        totalSupply &&
        userLiquidity &&
        tokenA &&
        // this condition is a short-circuit in the case where useTokenBalance updates sooner than useTotalSupply
        JSBI.greaterThanOrEqual(totalSupply.raw, userLiquidity.raw)
            ? new TokenAmount(tokenA, pair.getLiquidityValue(tokenA, totalSupply, userLiquidity, false).raw)
            : undefined
    const liquidityValueB =
        pair &&
        totalSupply &&
        userLiquidity &&
        tokenB &&
        // this condition is a short-circuit in the case where useTokenBalance updates sooner than useTotalSupply
        JSBI.greaterThanOrEqual(totalSupply.raw, userLiquidity.raw)
            ? new TokenAmount(tokenB, pair.getLiquidityValue(tokenB, totalSupply, userLiquidity, false).raw)
            : undefined
    const liquidityValues: { [Field.CURRENCY_A]?: TokenAmount; [Field.CURRENCY_B]?: TokenAmount } = {
        [Field.CURRENCY_A]: liquidityValueA,
        [Field.CURRENCY_B]: liquidityValueB,
    }

    let percentToRemove: Percent = new Percent('0', '100')
    // user specified a %
    if (independentField === Field.LIQUIDITY_PERCENT) {
        percentToRemove = new Percent(typedValue, '100')
    }
    // user specified a specific amount of liquidity tokens
    else if (independentField === Field.LIQUIDITY) {
        if (pair?.liquidityToken) {
            const independentAmount = tryParseAmount(typedValue, pair.liquidityToken)
            if (independentAmount && userLiquidity && !independentAmount.greaterThan(userLiquidity)) {
                percentToRemove = new Percent(independentAmount.raw, userLiquidity.raw)
            }
        }
    }
    // user specified a specific amount of token a or b
    else if (tokens[independentField as keyof typeof tokens]) {
        const independentAmount = tryParseAmount(typedValue, tokens[independentField as keyof typeof tokens])
        const liquidityValue = liquidityValues[independentField as keyof typeof liquidityValues]
        if (independentAmount && liquidityValue && !independentAmount.greaterThan(liquidityValue)) {
            percentToRemove = new Percent(independentAmount.raw, liquidityValue.raw)
        }
    }

    const parsedAmounts: {
        [Field.LIQUIDITY_PERCENT]: Percent
        [Field.LIQUIDITY]?: TokenAmount
        [Field.CURRENCY_A]?: TokenAmount
        [Field.CURRENCY_B]?: TokenAmount
    } = {
        [Field.LIQUIDITY_PERCENT]: percentToRemove,
        [Field.LIQUIDITY]:
            userLiquidity && percentToRemove && percentToRemove.greaterThan('0')
                ? new TokenAmount(userLiquidity.token, percentToRemove.multiply(userLiquidity.raw).quotient)
                : undefined,
        [Field.CURRENCY_A]:
            tokenA && percentToRemove && percentToRemove.greaterThan('0') && liquidityValueA
                ? new TokenAmount(tokenA, percentToRemove.multiply(liquidityValueA.raw).quotient)
                : undefined,
        [Field.CURRENCY_B]:
            tokenB && percentToRemove && percentToRemove.greaterThan('0') && liquidityValueB
                ? new TokenAmount(tokenB, percentToRemove.multiply(liquidityValueB.raw).quotient)
                : undefined,
    }

    let error: string | undefined
    if (!account) {
        error = 'Connect Wallet'
    }

    if (!parsedAmounts[Field.LIQUIDITY] || !parsedAmounts[Field.CURRENCY_A] || !parsedAmounts[Field.CURRENCY_B]) {
        error = error ?? '输入的数量错误'
    }

    return { pair, parsedAmounts, error }
}
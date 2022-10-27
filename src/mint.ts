import {Currency, CurrencyAmount, HEC, JSBI, Pair, Percent, Price, TokenAmount} from "@swap/sdk";
import {getPair} from "./Pairs";
import {getTotalSupply} from "./tokens";
import {PairState} from "./Trades";
import {getCurrencyBalances} from "./wallet";
import tryParseAmount from "./utils/tryParseAmount";
import {wrappedCurrency, wrappedCurrencyAmount} from "./utils/wrappedCurrency";

const ZERO = JSBI.BigInt(0)

export enum Field {
    CURRENCY_A = 'CURRENCY_A',
    CURRENCY_B = 'CURRENCY_B',
}

//计算需要的参数
export async function derivedMintInfo(currencyA?: Currency, currencyB?: Currency,amountA?: string,amountB?: string, account?: string): Promise<{
    dependentField: Field
    currencies: { [field in Field]?: Currency }
    pair?: Pair | null
    pairState: PairState
    currencyBalances: { [field in Field]?: CurrencyAmount }
    parsedAmounts: { [field in Field]?: CurrencyAmount }
    price?: Price
    noLiquidity?: boolean
    liquidityMinted?: TokenAmount
    poolTokenPercentage?: Percent
    error?: string
}> {
    const currencies: { [field in Field]?: Currency } = {
        [Field.CURRENCY_A]: currencyA ?? undefined,
        [Field.CURRENCY_B]: currencyB ?? undefined,
    }
    const [pairState, pair] =  await getPair(currencies[Field.CURRENCY_A], currencies[Field.CURRENCY_B])
    const totalSupply = await getTotalSupply(pair?.liquidityToken)

    //判断是否有流动性
    const noLiquidity: boolean =
        pairState === PairState.NOT_EXISTS || Boolean(totalSupply && JSBI.equal(totalSupply.raw, ZERO))

    //获取地址token余额
    const balances = await getCurrencyBalances(account,[
        currencies[Field.CURRENCY_A],
        currencies[Field.CURRENCY_B],
    ])

    const currencyBalances: { [field in Field]?: CurrencyAmount } = {
        [Field.CURRENCY_A]: balances[0],
        [Field.CURRENCY_B]: balances[1],
    }

    const independentField = amountA ? Field.CURRENCY_A : Field.CURRENCY_B
    const dependentField = independentField === Field.CURRENCY_A ? Field.CURRENCY_B : Field.CURRENCY_A
    const [typedValue,otherTypedValue] =(() => {
        return amountA ? [amountA,amountB] : [amountB,amountA]
    })()
    // 计算供应对数量
    const independentAmount: CurrencyAmount | undefined = tryParseAmount(typedValue, currencies[independentField])
    const dependentAmount: CurrencyAmount | undefined = (() => {
        if (noLiquidity) {
            if (otherTypedValue && currencies[dependentField]) {
                return tryParseAmount(otherTypedValue, currencies[dependentField])
            }
            return undefined
        }
        if (independentAmount) {
            // we wrap the currencies just to get the price in terms of the other token
            const wrappedIndependentAmount = wrappedCurrencyAmount(independentAmount, 627)
            const [tokenA, tokenB] = [wrappedCurrency(currencyA, 627), wrappedCurrency(currencyB, 627)]
            if (tokenA && tokenB && wrappedIndependentAmount && pair) {
                const dependentCurrency = dependentField === Field.CURRENCY_B ? currencyB : currencyA
                const dependentTokenAmount =
                    dependentField === Field.CURRENCY_B
                        ? pair.priceOf(tokenA).quote(wrappedIndependentAmount)
                        : pair.priceOf(tokenB).quote(wrappedIndependentAmount)
                return dependentCurrency === HEC ? CurrencyAmount.ether(dependentTokenAmount.raw) : dependentTokenAmount
            }
            return undefined
        }
        return undefined
    })()

    const parsedAmounts: { [field in Field]: CurrencyAmount | undefined } = {
        [Field.CURRENCY_A]: independentField === Field.CURRENCY_A ? independentAmount : dependentAmount,
        [Field.CURRENCY_B]: independentField === Field.CURRENCY_A ? dependentAmount : independentAmount,
    }

    //没有流动性交易对，则根据用户输入呈现价格
    const price = (() => {
        if (noLiquidity) {
            const { [Field.CURRENCY_A]: currencyAAmount, [Field.CURRENCY_B]: currencyBAmount } = parsedAmounts
            if (currencyAAmount && currencyBAmount) {
                return new Price(currencyAAmount.currency, currencyBAmount.currency, currencyAAmount.raw, currencyBAmount.raw)
            }
            return undefined
        }
        const wrappedCurrencyA = wrappedCurrency(currencyA, 627)
        return pair && wrappedCurrencyA ? pair.priceOf(wrappedCurrencyA) : undefined
    })()

    // 本次添加流动性产生的LP token数量 / liquidity minted
    const liquidityMinted = (() => {
        const { [Field.CURRENCY_A]: currencyAAmount, [Field.CURRENCY_B]: currencyBAmount } = parsedAmounts
        const [tokenAmountA, tokenAmountB] = [
            wrappedCurrencyAmount(currencyAAmount, 627),
            wrappedCurrencyAmount(currencyBAmount, 627),
        ]
        if (pair && totalSupply && tokenAmountA && tokenAmountB) {
            try {
                return pair.getLiquidityMinted(totalSupply, tokenAmountA, tokenAmountB)
            } catch (error) {
                console.error(error)
                return undefined
            }
        }
        return undefined
    })()

    // 流动性池中的份额
    const poolTokenPercentage = (() => {
        if (liquidityMinted && totalSupply) {
            return new Percent(liquidityMinted.raw, totalSupply.add(liquidityMinted).raw)
        }
        return undefined
    })()

    let error: string | undefined
    if (!account) {
        error = ('地址为空')
    }

    if (pairState === PairState.INVALID) {
        error = error ?? ('交易对无效')
    }

    if (!parsedAmounts[Field.CURRENCY_A] || !parsedAmounts[Field.CURRENCY_B]) {
        error = error ?? ('未输入金额')
    }

    const { [Field.CURRENCY_A]: currencyAAmount, [Field.CURRENCY_B]: currencyBAmount } = parsedAmounts

    if (currencyAAmount && currencyBalances?.[Field.CURRENCY_A]?.lessThan(currencyAAmount)) {
        error = '币种余额不足'+currencies[Field.CURRENCY_A]?.symbol
    }

    if (currencyBAmount && currencyBalances?.[Field.CURRENCY_B]?.lessThan(currencyBAmount)) {
        error = '币种余额不足'+currencies[Field.CURRENCY_B]?.symbol
    }
    return {
        dependentField,
        currencies,
        pair,
        pairState,
        currencyBalances,
        parsedAmounts,
        price,
        noLiquidity,
        liquidityMinted,
        poolTokenPercentage,
        error,
    }
}
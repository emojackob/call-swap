
// 1 用户精确输入HEC 兑换一定数量USDT ,userInputHEC，滑点百分比 滑点计算获得目标最小USDT 数量
import {Wallet} from "@ethersproject/wallet"
import {
    Fraction,
    Percent,
    Token,
    TokenAmount,
    WHEC,
    ChainId,
    Fetcher,
    Trade,
    CurrencyAmount, HEC,
} from "@swap/sdk";
// import { Interface } from '@ethersproject/abi'
import {constants, utils} from "ethers";
import JSBI from "jsbi";
import {erc20Contract, factoryContract, pairContract, routerContract} from "../src/swapconstract";
import {getCurrency, mainnetTokens} from "../src/tokens";
import {calculateSlippageAmount, provider,calculateGasMargin} from "../src/utils";
import {computeTradePriceBreakdown} from "../src/utils/prices"
import {Erc20, IPancakePair, IPancakeRouter02, PancakeFactory} from "config/abi/types";
import {getAllCommonPairs} from "../src/Trades";
import {unwrappedToken, wrappedCurrency} from "../src/utils/wrappedCurrency";
import {derivedMintInfo, Field} from "../src/mint";
import {currentBlockTimestamp,getGasPrice} from "../src/chaininfo"
import {BigNumber} from "@ethersproject/bignumber";
import {TransactionResponse} from "@ethersproject/providers";
import {derivedBurnInfo,Field as FieldBurn} from "../src/burn";
import { splitSignature } from '@ethersproject/bytes'
import {ApprovalState, approveCall} from "../src/approveCall";
import addresses from "../src/config/constants/contracts";
import {getPair} from "../src/Pairs";


const now = () => {
    return Date.parse(new Date().toString())+600
}
const BIPS_BASE = JSBI.BigInt(10000)
const ONE = JSBI.BigInt(1)

function toHex(currencyAmount: CurrencyAmount) {
    return `0x${currencyAmount.raw.toString(16)}`
}

// const PAIR_INTERFACE = new Interface(IPancakePairABI)


// swapExactTokensForTokens 根据精确的token交换尽量多的token
// swapTokensForExactTokens 使用尽量少的token交换精确的token

// swapTokensForExactETH 使用尽量少的token交换精确的ETH
// swapExactTokensForETH 根据精确的token交换尽量多的ETH
// swapExactETHForTokens 根据精确的ETH交换尽量多的token
// swapETHForExactTokens 使用尽量少的ETH交换精确的token

// swapExactTokensForTokensSupportingFeeOnTransferTokens 支持收税的根据精确的token交换尽量多的token
// swapExactETHForTokensSupportingFeeOnTransferTokens 支持收税的根据精确的ETH交换尽量多的token
// swapExactTokensForETHSupportingFeeOnTransferTokens 支持收税的根据精确的token交换尽量多的ETH

const main = async () => {
    const account = new Wallet("145a8eb8b810875f997193a1f0fc03ec835c430d0662d66b88987f99a98303ef",provider)
    console.log("地址:",account.address)
    const usdtContract = erc20Contract(mainnetTokens.usdt.address,account)
    // const hbtc = erc20Contract(mainnetTokens.hbtc.address,account)
    const router = routerContract(account)
    const factory = factoryContract(account)

    const userExactInputTokenAmount = new TokenAmount(mainnetTokens.usdt,utils.parseEther("500").toString())
    // 根据精确的token交换尽量多的token
    await routerSwapExactTokensForTokens(
        userExactInputTokenAmount,
        mainnetTokens.hbtc,
        mainnetTokens.usdt,
        10,//用户输入的滑点百分比
        account,
        router,
        600,//超时时间
    )
    return

    //使用尽量少的token交换精确的token
    const userOutTokenAmount = new TokenAmount(mainnetTokens.usdt,utils.parseEther("500").toString())
    await routerSwapTokensForExactTokens(
        userOutTokenAmount,
        mainnetTokens.usdt,
        mainnetTokens.hbtc,
        10,
        account,
        router,600)
    return

    await routerAddLiquidityHEC(mainnetTokens.hbtc.address,//币种A
        mainnetTokens.usdt.address,//币种B
        "10000",//币种A对应数量
        "10000",//币种B对应数量
        account,//签名帐号
        router,//路由合约
        600,//10分钟
        5 //滑点
    )
    return

    await routerRemoveLiquidity(
        "HEC",
        mainnetTokens.hbtc.address,
        600,//10分钟超时
        {independentField: FieldBurn.LIQUIDITY_PERCENT,typedValue: "10"}, //按照百分比(10%)计算移除 按流动LPtoken LIQUIDITY,按币种数量 CURRENCY_A,CURRENCY_B
        account,
            10//滑点 10%
    )
    return



    //查询流动性
    await pairSelectLiquidity(account)
    return

    //使用尽量少的ETH交换精确的token
    const userInputOutTokenAmount = new TokenAmount(mainnetTokens.usdt,utils.parseEther("500").toString())

    //使用尽量少的ETH交换精确的token
    await routerSwapETHForExactTokens(
        userInputOutTokenAmount,
        mainnetTokens.usdt,
        mainnetTokens.hec,
        10,
        account,router,factory
    )
    return

    //使用尽量少的token交换精确的ETH
    const userInputOutHECAmount = new TokenAmount(mainnetTokens.hec,utils.parseEther("5").toString())
    await routerSwapTokensForExactETH(
        userInputOutHECAmount,
        mainnetTokens.hec,
        mainnetTokens.usdt,
        10,
        account, router, factory,usdtContract)
    return

    //根据精确的token交换尽量多的ETH
    const userInput = new TokenAmount(mainnetTokens.usdt,utils.parseEther("500").toString())
    await routerSwapExactTokensForETH(
        userInput,
        mainnetTokens.hec,
        mainnetTokens.usdt,
        10,
        account, router, factory,usdtContract)


    //根据精确的ETH交换尽量多的token
    await routerSwapExactETHForTokens(
        "1",
        usdtContract,
        mainnetTokens.usdt,
        10,
        account, router, factory)
};

// 添加流动性 主币
export async function routerAddLiquidityHEC(
    currencyIdA: string,
    currencyIdB: string,
    amountA?: string,
    amountB?: string,
    owner?: Wallet,//地址帐号带签名
    routerContract?: IPancakeRouter02, //路由合约接口
    ttl?: number,//用户输入交易截至时间
    userInputAllowedSlippage?: number //用户输入的滑点百分比
) {

    //todo: 判断token授权是否足够
    //todo: 授权token给路由

    if (!amountA && !amountB) {
        console.error("不能都为空")
        return
    }

    const currencyA = await getCurrency(currencyIdA)
    const currencyB = await getCurrency(currencyIdB)

    // const oneCurrencyIsWHEC = Boolean(
    //     ((currencyA && currencyEquals(currencyA, WHEC[627])) ||
    //         (currencyB && currencyEquals(currencyB, WHEC[627]))),
    // )

    const {
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
    } = await derivedMintInfo(currencyA,currencyB,amountA,amountB,owner?.address)

    if (!!error) {
        console.error(error)
        return
    }

    console.log(dependentField,pair?.liquidityToken.address,pairState.toFixed(2),
        currencyBalances,price?.toFixed(4),liquidityMinted?.toFixed(4),poolTokenPercentage?.toFixed(5))


    //交易函数--->提供流动性
    const onAdd = async () => {
        if (!owner) {
            console.log("帐号为空")
            return
        }
        if (!routerContract) {
            console.log("路由合约为空")
            return
        }
        const { [Field.CURRENCY_A]: parsedAmountA, [Field.CURRENCY_B]: parsedAmountB } = parsedAmounts
        const blockTimestamp = await currentBlockTimestamp()
        const deadline = (() => {
            if (blockTimestamp && ttl) return blockTimestamp.add(ttl)
            return undefined
        })()
        if (!parsedAmountA || !parsedAmountB || !currencyA || !currencyB || !deadline) {
            console.log("各种参数无效")
            return
        }
        const allowedSlippage = userInputAllowedSlippage ?? 5

        const amountsMin = {
            [Field.CURRENCY_A]: calculateSlippageAmount(parsedAmountA, noLiquidity ? 0 : allowedSlippage)[0],
            [Field.CURRENCY_B]: calculateSlippageAmount(parsedAmountB, noLiquidity ? 0 : allowedSlippage)[0],
        }

        const gasPrice = getGasPrice()

        let estimate: (...args: any[]) => Promise<any>
        let method: (...args: any[]) => Promise<TransactionResponse>
        let args: Array<string | string[] | number>
        let value: BigNumber | null
        if (currencyA === HEC || currencyB === HEC) {
            const tokenBIsBNB = currencyB === HEC
            estimate = routerContract.estimateGas.addLiquidityETH
            method = routerContract.addLiquidityETH
            args = [
                wrappedCurrency(tokenBIsBNB ? currencyA : currencyB, 627)?.address ?? '', // token
                (tokenBIsBNB ? parsedAmountA : parsedAmountB).raw.toString(), // token desired
                amountsMin[tokenBIsBNB ? Field.CURRENCY_A : Field.CURRENCY_B].toString(), // token min
                amountsMin[tokenBIsBNB ? Field.CURRENCY_B : Field.CURRENCY_A].toString(), // eth min
                owner.address,
                deadline.toHexString(),
            ]
            value = BigNumber.from((tokenBIsBNB ? parsedAmountB : parsedAmountA).raw.toString())
        } else {
            estimate = routerContract.estimateGas.addLiquidity
            method = routerContract.addLiquidity
            args = [
                wrappedCurrency(currencyA, 627)?.address ?? '',
                wrappedCurrency(currencyB, 627)?.address ?? '',
                parsedAmountA.raw.toString(),
                parsedAmountB.raw.toString(),
                amountsMin[Field.CURRENCY_A].toString(),
                amountsMin[Field.CURRENCY_B].toString(),
                owner.address,
                deadline.toHexString(),
            ]
            value = null
        }

        await estimate(...args, value ? { value } : {})
            .then((estimatedGasLimit) =>
                method(...args,{
                    ...(value ? { value } : {}),
                    gasLimit: calculateGasMargin(estimatedGasLimit),
                    gasPrice,
                }).then((response) => {
                    console.log("交易hash",response.hash)
                    console.log(`添加 ${parsedAmounts[Field.CURRENCY_A]?.toSignificant(3)} ${
                        currencies[Field.CURRENCY_A]?.symbol
                    } 添加 ${parsedAmounts[Field.CURRENCY_B]?.toSignificant(3)} ${currencies[Field.CURRENCY_B]?.symbol}`)
                }),
            )
            .catch((err) => {
                if (err && err.code !== 4001) {
                    console.error(`Add Liquidity failed`, err, args, value)
                }
            })
    }

    await onAdd()
}

// 查询地址在池中流动性
export async function pairSelectLiquidity(owner: Wallet){
    //查询所有交易对流动性
    const paris = await getAllCommonPairs()

    //查询地址 流动性余额，占比
    const percentage = paris.map(async pair => {
        console.log("pair address--->",pair.liquidityToken.address,pair.token0.symbol,pair.token1.symbol)
        const pairCon = pairContract(pair.liquidityToken.address)

        const totalSupplyLP = await pairCon.totalSupply()
        const totalPoolTokens = new TokenAmount(pair.liquidityToken,totalSupplyLP.toString())
        const balanceLP = await pairCon.balanceOf(owner.address)
        const userPoolBalance = new TokenAmount(pair.liquidityToken, balanceLP.toString())
        console.log("balanceLP-->",userPoolBalance.toFixed(2))

        const [token0Deposited, token1Deposited] =
            !!pair &&
            !!totalPoolTokens &&
            !!userPoolBalance &&
            // this condition is a short-circuit in the case where useTokenBalance updates sooner than useTotalSupply
            JSBI.greaterThanOrEqual(totalPoolTokens.raw, userPoolBalance.raw)
                ? [
                    pair.getLiquidityValue(pair.token0, totalPoolTokens, userPoolBalance, false),
                    pair.getLiquidityValue(pair.token1, totalPoolTokens, userPoolBalance, false),
                ]
                : [undefined, undefined]

        const currency0 =  unwrappedToken(pair.token0)
        const currency1 = unwrappedToken(pair.token1)

        console.log("用户流动性余额A:",token0Deposited?.toSignificant(6),currency0.symbol)
        console.log("用户流动性余额B:",token1Deposited?.toSignificant(6),currency1.symbol)

        const poolTokenPercentage = !!userPoolBalance && !!totalPoolTokens && JSBI.greaterThanOrEqual(totalPoolTokens.raw, userPoolBalance.raw)
            ? new Percent(userPoolBalance.raw, totalPoolTokens.raw)
            : undefined

        console.log("用户流动性占比: ",poolTokenPercentage?.toFixed(4),"%")

        return new Promise(resolve => resolve(poolTokenPercentage))
    })
    await Promise.all(percentage)
}


// 移除流动性
export async function routerRemoveLiquidity(
    currencyIdA: string, //币种地址或者主币 HEC
    currencyIdB: string,//币种地址或者主币 HEC
    ttl: number,//用户输入交易截至时间
    parameterFiledValue: {independentField: string,typedValue: string}, //计算移除流动性所需要的参数{
    // independentField:枚举: LIQUIDITY,CURRENCY_A,CURRENCY_B,LIQUIDITY_PERCENT}
    owner: Wallet,
    userInputAllowedSlippage?: number //用户输入的滑点百分比
) {
    const [currencyA, currencyB] = [await getCurrency(currencyIdA) ?? undefined, await getCurrency(currencyIdB) ?? undefined]
    const [tokenA,tokenB] = [wrappedCurrency(currencyA, 627), wrappedCurrency(currencyB, 627)]
    const gasPrice = getGasPrice()

    const { pair, parsedAmounts, error} = await derivedBurnInfo(currencyA ?? undefined,
        currencyB ?? undefined,parameterFiledValue,owner.address)
   if (!!error) {
       console.log("参数构造失败",error)
       return
   }

    const blockTimestamp = await currentBlockTimestamp()
    const deadline = (() => {
        if (blockTimestamp && ttl) return blockTimestamp.add(ttl)
        return undefined
    })()
    const allowedSlippage = userInputAllowedSlippage ?? 5
    if (!pair){
        return
    }

    const pairCon: IPancakePair | null = pairContract(pair.liquidityToken.address,owner)

    //检查并授权流动性token给路由
    const [approval, approve] = await approveCall(owner,parsedAmounts[FieldBurn.LIQUIDITY], addresses.router)
    await approve()
    async function onAttemptToApprove() {
        if (!pairCon || !pair || !owner || !deadline) throw new Error('missing dependencies')
        const liquidityAmount = parsedAmounts[FieldBurn.LIQUIDITY]
        if (!liquidityAmount) {
            throw new Error('没有流动性')
        }

        // try to gather a signature for permission
        const nonce = await pairCon.nonces(owner.address)
        console.log("nonce---->",nonce)
        const domain = {
            name: 'Pancake LPs',
            version: '1',
            chainId: 627,
            verifyingContract: pair.liquidityToken.address,
        }
        const Permit = [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
        ]
        const message = {
            owner: owner.address,
            spender: addresses.router,
            value: liquidityAmount.raw.toString(),
            nonce: nonce.toHexString(),
            deadline: deadline.toNumber(),
        }
        const sinHex = await owner._signTypedData(domain,{Permit},message)
        const signature = splitSignature(sinHex)

        return {v: signature.v,r: signature.r,s: signature.s,deadline: deadline.toNumber()}
    }
    const signatureData = await onAttemptToApprove()

    async function onRemove() {
        if (!owner || !deadline) throw new Error('missing dependencies')

        const { [Field.CURRENCY_A]: currencyAmountA, [Field.CURRENCY_B]: currencyAmountB } = parsedAmounts
        if (!currencyAmountA || !currencyAmountB) {
            throw new Error('missing currency amounts')
        }
        const routerCon = routerContract(owner)

        const amountsMin = {
            [Field.CURRENCY_A]: calculateSlippageAmount(currencyAmountA, allowedSlippage)[0],
            [Field.CURRENCY_B]: calculateSlippageAmount(currencyAmountB, allowedSlippage)[0],
        }

        if (!currencyA || !currencyB) {
            throw new Error('missing tokens')
        }

        const liquidityAmount = parsedAmounts[FieldBurn.LIQUIDITY]
        if (!liquidityAmount) {
            throw new Error('missing liquidity amount')
        }
        const currencyBIsHEC = currencyB === HEC
        const oneCurrencyIsHEC = currencyA === HEC || currencyBIsHEC
        if (!tokenA || !tokenB) {
            throw new Error('could not wrap')
        }


        let estimate: (...args: any[]) => Promise<any>
        let method: (...args: any[]) => Promise<TransactionResponse>

        let args: Array<string | string[] | number | boolean>

        //已经授权，正常移除流动性，少一步授权
        if (approval === ApprovalState.APPROVED) {
            // removeLiquidityETH
            if (currencyBIsHEC) {
                estimate = routerCon.estimateGas.removeLiquidityETH
                method = routerCon.removeLiquidityETH
                args = [
                    currencyBIsHEC ? tokenA.address : tokenB.address,
                    liquidityAmount.raw.toString(),
                    amountsMin[currencyBIsHEC ? Field.CURRENCY_A : Field.CURRENCY_B].toString(),
                    amountsMin[currencyBIsHEC ? Field.CURRENCY_B : Field.CURRENCY_A].toString(),
                    owner.address,
                    deadline.toHexString(),
                ]
            }
            // removeLiquidity
            else {
                estimate = routerCon.estimateGas.removeLiquidity
                method = routerCon.removeLiquidity
                args = [
                    tokenA.address,
                    tokenB.address,
                    liquidityAmount.raw.toString(),
                    amountsMin[Field.CURRENCY_A].toString(),
                    amountsMin[Field.CURRENCY_B].toString(),
                    owner.address,
                    deadline.toHexString(),
                ]
            }
        }
        //使用permit version 移除流动性
        else  {
            // removeLiquidityETHWithPermit
            if (oneCurrencyIsHEC) {
                estimate = routerCon.estimateGas.removeLiquidityETHWithPermit
                method = routerCon.removeLiquidityETHWithPermit
                args = [
                    currencyBIsHEC ? tokenA.address : tokenB.address,
                    liquidityAmount.raw.toString(),
                    amountsMin[currencyBIsHEC ? Field.CURRENCY_A : Field.CURRENCY_B].toString(),
                    amountsMin[currencyBIsHEC ? Field.CURRENCY_B : Field.CURRENCY_A].toString(),
                    owner.address,
                    signatureData.deadline,
                    false,
                    signatureData.v,
                    signatureData.r,
                    signatureData.s,
                ]
            }
            // removeLiquidityETHWithPermit
            else {
                estimate = routerCon.estimateGas.removeLiquidityWithPermit
                method = routerCon.removeLiquidityWithPermit
                args = [
                    tokenA.address,
                    tokenB.address,
                    liquidityAmount.raw.toString(),
                    amountsMin[Field.CURRENCY_A].toString(),
                    amountsMin[Field.CURRENCY_B].toString(),
                    owner.address,
                    signatureData.deadline,
                    false,
                    signatureData.v,
                    signatureData.r,
                    signatureData.s,
                ]
            }
        }
        await estimate(...args)
            .then((estimatedGasLimit) =>
                method(...args,{
                    gasLimit: calculateGasMargin(estimatedGasLimit),
                    gasPrice,
                }).then((response: TransactionResponse) => {
                    console.log("交易hash-->",response.hash,{
                        summary: `Remove ${parsedAmounts[Field.CURRENCY_A]?.toSignificant(3)} ${
                            currencyA?.symbol
                        } and ${parsedAmounts[Field.CURRENCY_B]?.toSignificant(3)} ${currencyB?.symbol}`,
                    })
                }).catch((err: any) => {
                        if (err && err.code !== 4001) {
                            console.error(`Remove Liquidity failed 4001`, err, args)
                        }
                        console.log("交易失败",err)
                    }).catch((e :any) => {
                        console.log("交易失败",e)
                }))
    }

    await onRemove()
}

// swapExactTokensForTokens 根据精确的token交换尽量多的token
export async function routerSwapExactTokensForTokens(
    userInputTokenAmount: CurrencyAmount,
    userOutputToken: Token,
    userInputToken: Token,
    userInputAllowedSlippage: number,//用户输入的滑点百分比
    owner: Wallet,//地址帐号带签名
    routerContract: IPancakeRouter02, //路由合约地址
    ttl: number,//用户输入交易截至时间
) {
    //查询交易对是否存在
    const [_,pair] = await getPair(userInputToken,userOutputToken)
    if (!pair) {
        console.log("交易对不存在")
    }

    const trade = Trade.bestTradeExactIn([pair!], userInputTokenAmount, userOutputToken, { maxHops: 1, maxNumResults: 1 })[0]
    const { priceImpactWithoutFee, realizedLPFee } =  computeTradePriceBreakdown(trade)
    const slippageTolerance = new Percent(JSBI.BigInt(userInputAllowedSlippage * 100), BIPS_BASE)
    const miniAmount = trade.minimumAmountOut(slippageTolerance)
    console.log("价格影响--->",priceImpactWithoutFee?.toFixed(2),"%")
    console.log("手续费--->",realizedLPFee?.toSignificant(4),trade.inputAmount.currency.symbol)
    console.log("最大输出数量--->",trade.outputAmount.toFixed(6),trade.outputAmount.currency.symbol)
    console.log("最小获取数量--->",miniAmount.toFixed(6),trade.outputAmount.currency.symbol)
    console.log("精确输入--->",trade.inputAmount.toFixed(6),trade.inputAmount.currency.symbol)

    const blockTimestamp = await currentBlockTimestamp()
    const deadline = (() => {
        if (blockTimestamp && ttl) return blockTimestamp.add(ttl)
        return undefined
    })()

    const result = await routerContract.swapExactTokensForTokens(
        utils.hexValue(toHex(trade.inputAmount)),
        utils.hexValue(toHex(trade.minimumAmountOut(slippageTolerance))),
        [userInputToken.address,userOutputToken.address],
        owner.address,deadline!.toHexString())

    console.log("交易hash--->",result.hash)

    await result.wait(1)

}

// swapTokensForExactTokens 使用尽量少的token交换精确的token
export async function routerSwapTokensForExactTokens(
    userOutTokenAmount: CurrencyAmount,
    userOutputToken: Token,
    userInputToken: Token,
    userInputAllowedSlippage: number,//用户输入的滑点百分比
    owner: Wallet,//地址帐号带签名
    routerContract: IPancakeRouter02, //路由合约地址
    ttl: number,//用户输入交易截至时间
) {
    //查询交易对是否存在
    const [_,pair] = await getPair(userOutputToken,userInputToken)
    if (!pair) {
        console.log("交易对不存在")
    }

    const trade =await Trade.bestTradeExactOut([pair!],userInputToken,userOutTokenAmount,{ maxHops: 1, maxNumResults: 1 })[0]
    const { priceImpactWithoutFee, realizedLPFee } =  computeTradePriceBreakdown(trade)
    const slippageTolerance = new Percent(JSBI.BigInt(userInputAllowedSlippage * 100), BIPS_BASE)
    const minAmountIn = trade.inputAmount
    const maxAmountIn = trade.maximumAmountIn(slippageTolerance)

    console.log("价格影响--->",priceImpactWithoutFee?.toFixed(2),"%")
    console.log("手续费--->",realizedLPFee?.toSignificant(4),trade.inputAmount.currency.symbol)
    console.log("最小输入--->",minAmountIn.toFixed(6),trade.inputAmount.currency.symbol)
    console.log("最大输入--->",maxAmountIn.toFixed(6),trade.inputAmount.currency.symbol)
    console.log("精确输出-->",userOutTokenAmount.toFixed(6),userOutputToken.symbol)

    const blockTimestamp = await currentBlockTimestamp()
    const deadline = (() => {
        if (blockTimestamp && ttl) return blockTimestamp.add(ttl)
        return undefined
    })()

    const result = await routerContract.swapTokensForExactTokens(
        toHex(trade.outputAmount),
        toHex(maxAmountIn),
        [userInputToken.address,userOutputToken.address],
        owner.address,deadline!.toHexString())
    console.log("交易hash---->",result.hash)
    await result.wait(1)
}

// swapETHForExactTokens 使用尽量少的ETH交换精确的token
export async function routerSwapETHForExactTokens(
    userOutTokenAmount: CurrencyAmount,
    userOutputToken: Token,
    userInputToken: Token,
    userInputAllowedSlippage: number,//用户输入的滑点百分比
    owner: Wallet,//地址帐号带签名
    routerContract: IPancakeRouter02, //路由合约地址
    factoryContract: PancakeFactory,//工厂合约地址
) {

    //查询交易对是否存在
    const pairAddress = await factoryContract.getPair(userOutputToken.address,userInputToken.address);
    if (pairAddress === constants.AddressZero) {
        console.error("交易对未创建")
        return
    }else {
        console.log("交易对地址: ",pairAddress)
    }
    const pair = await Fetcher.fetchPairData(userOutputToken,userInputToken,provider)
    console.log("pair--->",pair.liquidityToken.address)

    const trade =await Trade.bestTradeExactOut([pair],userInputToken,userOutTokenAmount,{ maxHops: 1, maxNumResults: 1 })[0]
    const { priceImpactWithoutFee, realizedLPFee } =  computeTradePriceBreakdown(trade)
    const slippageTolerance = new Percent(JSBI.BigInt(userInputAllowedSlippage * 100), BIPS_BASE)
    const minAmountIn = trade.inputAmount
    const maxAmountIn = trade.maximumAmountIn(slippageTolerance)

    console.log("价格影响--->",priceImpactWithoutFee?.toFixed(2),"%")
    console.log("手续费--->",realizedLPFee?.toSignificant(4),trade.inputAmount.currency.symbol)
    console.log("最小输入--->",minAmountIn.toFixed(6),trade.inputAmount.currency.symbol)
    console.log("最大输入--->",maxAmountIn.toFixed(6),trade.inputAmount.currency.symbol)
    console.log("精确输出-->",userOutTokenAmount.toFixed(6),userOutputToken.symbol)

    const result = await routerContract.swapETHForExactTokens(
        toHex(trade.outputAmount),
        [userInputToken.address,userOutputToken.address],
        owner.address,now(),
        {value:toHex(maxAmountIn)})
    console.log("交易hash---->",result.hash)
    await result.wait(1)

}


// swapTokensForExactETH 使用尽量少的token交换精确的ETH
export async function routerSwapTokensForExactETH(
    userOutTokenAmount: CurrencyAmount,
    userOutputToken: Token,
    userInputToken: Token,// usdtToken
    userInputAllowedSlippage: number,//用户输入的滑点百分比
    owner: Wallet,//地址帐号带签名
    routerContract: IPancakeRouter02, //路由合约地址
    factoryContract: PancakeFactory,//工厂合约地址
    erc20Contract: Erc20
) {
    //查询交易对是否存在
    const pairAddress = await factoryContract.getPair(userOutputToken.address,userInputToken.address);
    if (pairAddress === constants.AddressZero) {
        console.error("交易对未创建")
        return
    }else {
        console.log("交易对地址: ",pairAddress)
    }
    const pair = await Fetcher.fetchPairData(userOutputToken,userInputToken,provider)
    console.log("pair--->",pair.liquidityToken.address)

    const trade =await Trade.bestTradeExactOut([pair],userInputToken,userOutTokenAmount,{ maxHops: 1, maxNumResults: 1 })[0]
    const { priceImpactWithoutFee, realizedLPFee } =  computeTradePriceBreakdown(trade)
    const slippageTolerance = new Percent(JSBI.BigInt(userInputAllowedSlippage * 100), BIPS_BASE)
    const minAmountIn = trade.inputAmount
    const maxAmountIn = trade.maximumAmountIn(slippageTolerance)

    //判断token余额是否足够
    const balance = await erc20Contract.balanceOf(owner.address)
    if (maxAmountIn.greaterThan(balance.toString())) {
        console.error("token余额不足")
        return
    }
    //判断token授权是否足够
    const allowance = await erc20Contract.allowance(owner.address,routerContract.address)
    if (maxAmountIn.greaterThan(allowance.toString())) {
        console.error("token授权不足")
        return
    }

    console.log("价格影响--->",priceImpactWithoutFee?.toFixed(2),"%")
    console.log("手续费--->",realizedLPFee?.toSignificant(4),trade.inputAmount.currency.symbol)
    console.log("最小输入--->",minAmountIn.toFixed(6),trade.inputAmount.currency.symbol)
    console.log("最大输入--->",maxAmountIn.toFixed(6),trade.inputAmount.currency.symbol)
    console.log("精确输出-->",userOutTokenAmount.toFixed(6),userOutputToken.symbol)

    const result = await routerContract.swapTokensForExactETH(
        toHex(trade.outputAmount),
        toHex(maxAmountIn),
        [userInputToken.address,userOutputToken.address],
        owner.address,now())
    console.log("交易hash---->",result.hash)
    await result.wait(1)
}


// swapExactTokensForETH 根据精确的token交换尽量多的ETH
export async function routerSwapExactTokensForETH(
    userInputTokenAmount: CurrencyAmount,
    userOutputToken: Token,
    userInputToken: Token,// usdtToken
    userInputAllowedSlippage: number,//用户输入的滑点百分比
    owner: Wallet,//地址帐号带签名
    routerContract: IPancakeRouter02, //路由合约地址
    factoryContract: PancakeFactory,//工厂合约地址
    erc20Contract: Erc20
){

    //判断token余额是否足够
    const balance = await erc20Contract.balanceOf(owner.address)
    console.log("---->",userInputTokenAmount.toFixed(2))
    if (userInputTokenAmount.greaterThan(balance.toString())) {
        console.error("token余额不足")
        return
    }
    //判断token授权是否足够
    const allowance = await erc20Contract.allowance(owner.address,routerContract.address)
    if (userInputTokenAmount.greaterThan(allowance.toString())) {
        console.error("token授权不足")
        return
    }

    //查询交易对是否存在
    const pairAddress = await factoryContract.getPair(userOutputToken.address,userInputToken.address);
    if (pairAddress === constants.AddressZero) {
        console.error("交易对未创建")
        return
    }else {
        console.log("交易对地址: ",pairAddress)
    }
    const pair = await Fetcher.fetchPairData(userOutputToken,userInputToken,provider)
    console.log("pair--->",pair.liquidityToken.address)

    const trade = Trade.bestTradeExactIn([pair], userInputTokenAmount, userOutputToken, { maxHops: 1, maxNumResults: 1 })[0]
    const { priceImpactWithoutFee, realizedLPFee } =  computeTradePriceBreakdown(trade)
    const slippageTolerance = new Percent(JSBI.BigInt(userInputAllowedSlippage * 100), BIPS_BASE)
    const miniAmount = trade.minimumAmountOut(slippageTolerance)
    console.log("价格影响--->",priceImpactWithoutFee?.toFixed(2),"%")
    console.log("手续费--->",realizedLPFee?.toSignificant(4),trade.inputAmount.currency.symbol)
    console.log("最大输出数量--->",trade.outputAmount.toFixed(6),trade.outputAmount.currency.symbol)
    console.log("最小获取数量--->",miniAmount.toFixed(6),trade.outputAmount.currency.symbol)
    const result = await routerContract.swapExactTokensForETH(
        utils.hexValue(toHex(trade.inputAmount)),
        utils.hexValue(toHex(trade.minimumAmountOut(slippageTolerance))),
        [userInputToken.address,userOutputToken.address],
        owner.address,now())
    console.log("交易hash--->",result.hash)
    await result.wait(1);
}

// 精确输入主币HEC,浮动输出usdt
async function routerSwapExactETHForTokens(userInputHEC: string,//用户输入的hec数量
                                           usdtContract: Erc20,
                                           usdtToken: Token,// usdtToken
                                           userInputAllowedSlippage: number,//用户输入的滑点百分比
                                           owner: Wallet,//地址帐号带签名
                                           routerContract: IPancakeRouter02, //路由合约地址
                                           factoryContract: PancakeFactory,//工厂合约地址
) {
    const balance = await owner.getBalance()
    console.log("地址hec余额balance--->",utils.formatEther(balance),owner.address)

    //查询交易对是否存在
    const pairAddress = await factoryContract.getPair(WHEC[ChainId.MAINNET].address,usdtToken.address);
    if (pairAddress === constants.AddressZero) {
        console.error("交易对未创建")
        return
    }else {
        console.log("hec/usdt 交易对地址: ",pairAddress)
    }


    //判断HEC余额是否足够
    if (!utils.parseEther(userInputHEC).lte(balance)) {
        console.error("hec余额不足: ",utils.formatEther(balance))
        return
    }

    //给定HEC输入，获取最大usdt输出
    const outMaxAmounts = await routerContract.getAmountsOut(
        utils.parseEther(userInputHEC),[WHEC[ChainId.MAINNET].address,usdtContract.address])
    console.log("最大换取数量",utils.formatEther(outMaxAmounts[1]))


    const pair = await Fetcher.fetchPairData(WHEC[ChainId.MAINNET],usdtToken,provider)
    const currencyAmountIn = CurrencyAmount.ether(utils.parseEther("1").toString())

    const trade = Trade.bestTradeExactIn([pair], currencyAmountIn, usdtToken, { maxHops: 1, maxNumResults: 1 })[0]
    const { priceImpactWithoutFee, realizedLPFee } =  computeTradePriceBreakdown(trade)
    console.log("价格影响--->",priceImpactWithoutFee?.toFixed(2),"%")
    console.log("手续费--->",realizedLPFee?.toSignificant(4),trade.inputAmount.currency.symbol)
    return
    //计算显示最小输出token数量
    //滑点计算
    const slippageTolerance = new Percent(JSBI.BigInt(userInputAllowedSlippage * 100), BIPS_BASE)
    //滑点 最小输出token数量
    const slippageAdjustedAmountOut = new Fraction(ONE)
        .add(slippageTolerance)
        .invert()
        .multiply(outMaxAmounts[1].toString()).quotient
    const usdtAmount = new TokenAmount(usdtToken, slippageAdjustedAmountOut)
    console.log("用于给用户显示滑点后最小获得目标币数量---->",usdtAmount.toFixed(1,undefined,0))
    return
    //调用交易兑换接口
    const result = await routerContract.swapExactETHForTokens(
        usdtAmount.raw.toString(),//滑点后最小输出
        [WHEC[ChainId.MAINNET].address,usdtContract.address],//交易对地址
        owner.address,//输出接受地址
        now(), //交易截至时间
        {value:utils.parseEther(userInputHEC)} //调用附带主链币HEC
    )

    console.log("交易hash---->",result.hash)
    //等待区块确认
    await result.wait(1);
    console.log("usdt 余额: ",utils.formatEther(await usdtContract.balanceOf(owner.address)))
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

export {}
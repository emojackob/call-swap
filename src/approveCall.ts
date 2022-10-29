import {CurrencyAmount, HEC, TokenAmount} from "@swap/sdk";
import { MaxUint256 } from '@ethersproject/constants'
import {callWithGasPriceFunc} from "./callWithGasPriceFunc";
import tokenAllowance from "./tokenAllowance";
import {erc20Contract} from "../src/swapconstract";
import {calculateGasMargin} from "./utils";
import {TransactionResponse} from "@ethersproject/providers";
import {Wallet} from "@ethersproject/wallet";


export enum ApprovalState {
    UNKNOWN,
    NOT_APPROVED,
    PENDING,
    APPROVED,
}

//授权token
export async function approveCall (
    owner: Wallet,
    amountToApprove?: CurrencyAmount,
    spender?: string,
): Promise<[ApprovalState, () => Promise<void>]> {
    const  callWithGasPrice  = callWithGasPriceFunc()

    const token = amountToApprove instanceof TokenAmount ? amountToApprove.token : undefined
    const currentAllowance = await tokenAllowance(token,owner.address,spender)
    const tokenContract = erc20Contract(token?.address,owner)

    // 检查授权状态
    const approvalState: ApprovalState = (()=> {
        if (!amountToApprove || !spender) return ApprovalState.UNKNOWN
        if (amountToApprove.currency === HEC) return ApprovalState.APPROVED
        // 无法判断
        if (!currentAllowance) return ApprovalState.UNKNOWN
        // amountToApprove will be defined if currentAllowance is
        return currentAllowance.lessThan(amountToApprove)
                ? ApprovalState.NOT_APPROVED : ApprovalState.APPROVED
    })()

    const approve = (async () => {
        if (approvalState !== ApprovalState.NOT_APPROVED) {
            console.error('已经授权，无需调用')
            return
        }
        if (!token) {
            console.error('no token')
            return
        }

        if (!tokenContract) {
            console.error('tokenContract is null')
            return
        }

        if (!amountToApprove) {
            console.error('missing amount to approve')
            return
        }

        if (!spender) {
            console.error('no spender')
            return
        }
        let useExact = false

        const estimatedGas = await tokenContract.estimateGas.approve(spender, MaxUint256).catch(() => {
            // general fallback for tokens who restrict approval amounts
            useExact = true
            return tokenContract.estimateGas.approve(spender, amountToApprove.raw.toString())
        })
        // eslint-disable-next-line consistent-return
        return callWithGasPrice(
            tokenContract,
            'approve',
            [spender, useExact ? amountToApprove.raw.toString() : MaxUint256],
            {
                gasLimit: calculateGasMargin(estimatedGas),
            },
        )
            .then((response: TransactionResponse) => {
                console.error("授权交易hash",response.hash,{
                    summary: `Approve ${amountToApprove.currency.symbol}`,
                    approval: { tokenAddress: token.address, spender },
                })

                //等待确认
                response.wait(1)
            })
            .catch((error: any) => {
                console.error('Failed to approve token', error)
                throw error
            })

    })

    return [approvalState,approve]
}
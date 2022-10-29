import {Token, TokenAmount} from "@swap/sdk";
import {getSingleCallResult} from "./multicall/multicall";
import {erc20Contract} from "./swapconstract";

//查询token授权额度
async function tokenAllowance(token?: Token, owner?: string, spender?: string): Promise<TokenAmount | undefined> {
    const contract = erc20Contract(token?.address)

    const inputs = [owner, spender]
    const allowance = (await getSingleCallResult(contract, 'allowance', inputs)).result

    return token && allowance ? new TokenAmount(token, allowance.toString()) : undefined
}

export default tokenAllowance
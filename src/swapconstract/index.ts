import { Contract } from '@ethersproject/contracts'
import multiCallAbi from '../config/abi/Multicall.json'
import IPancakePairABI from '../config/abi/IPancakePair.json'
import erc20ABI from '../config/abi/erc20.json'
import factoryABI from '../config/abi/PancakeFactory.json'
import routerABI from '../config/abi/IPancakeRouter02.json'

import {Erc20,Multicall,IPancakePair,IPancakeRouter02,PancakeFactory} from "config/abi/types";

import {provider} from "../utils";
import addresses from "../config/constants/contracts";
import {Signer} from "@ethersproject/abstract-signer";

function getContract<T extends Contract = Contract>(
    address?: string,
    ABI?: any,
    signer?: Signer
): T | null {
    if (!address || !ABI) return null

    const sig = signer?signer:provider

    return new Contract(address, ABI,sig) as T
}

export const multiCallContract = () => {
   return  getContract(addresses.multiCall,multiCallAbi) as Multicall
}

export const pairContract = (pairAddress: string, signer?: Signer) => {
   return  getContract(pairAddress,IPancakePairABI,signer) as IPancakePair
}

export const routerContract = (signer?: Signer) =>{
    return getContract(addresses.router,routerABI,signer) as IPancakeRouter02
}

export const erc20Contract = (erc20address?: string, signer?: Signer) => {
    return getContract(erc20address,erc20ABI,signer) as Erc20
}

export const factoryContract = (signer?: Signer) => {
    return getContract(addresses.factory,factoryABI,signer) as PancakeFactory
}

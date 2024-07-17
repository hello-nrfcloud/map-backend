import type { SSMClient } from '@aws-sdk/client-ssm'
import { ScopeContexts } from './scope.js'
import { remove, get, put } from '@bifravst/aws-ssm-settings-helpers'

export type Settings = {
	privateKey: string
	publicKey: string
	keyId: string
}
export const getSettings = async ({
	ssm,
	stackName,
}: {
	ssm: SSMClient
	stackName: string
}): Promise<Settings> => {
	const r = await get(ssm)<{
		privateKey: string
		publicKey: string
		keyId: string
	}>({ stackName, ...ScopeContexts.STACK_JWT })()
	const { privateKey, publicKey, keyId } = r
	if (privateKey === undefined)
		throw new Error(`JWT privateKey is not configured.`)
	if (publicKey === undefined)
		throw new Error(`JWT publicKey is not configured.`)
	if (keyId === undefined) throw new Error(`JWT keyId is not configured.`)
	return {
		privateKey,
		publicKey,
		keyId,
	}
}

export const putSetting =
	({ ssm, stackName }: { ssm: SSMClient; stackName: string }) =>
	async (
		property: keyof Settings,
		value: string | URL,
		/**
		 * Useful when depending on the parameter having version 1, e.g. for use in CloudFormation
		 */
		deleteBeforeUpdate?: boolean,
	): Promise<{ name: string }> =>
		put(ssm)({ stackName, ...ScopeContexts.STACK_JWT })({
			property,
			value: value.toString(),
			deleteBeforeUpdate,
		})

export const deleteSetting =
	({ ssm, stackName }: { ssm: SSMClient; stackName: string }) =>
	async (property: keyof Settings): Promise<{ name: string }> =>
		remove(ssm)({
			stackName,
			...ScopeContexts.STACK_JWT,
		})({
			property,
		})

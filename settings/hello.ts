import type { SSMClient } from '@aws-sdk/client-ssm'
import { remove, get, put } from '@bifravst/aws-ssm-settings-helpers'
import { ScopeContexts } from './scope.js'

export type Settings = {
	apiEndpoint: URL
}

export const getSettings = async ({
	ssm,
	stackName,
}: {
	ssm: SSMClient
	stackName: string
}): Promise<Settings> => ({
	apiEndpoint: new URL(
		(
			await get(ssm)<{
				apiEndpoint: string
			}>({ stackName, ...ScopeContexts.HELLO_BACKEND })()
		).apiEndpoint,
	),
})

export const putSetting =
	({ ssm, stackName }: { ssm: SSMClient; stackName: string }) =>
	async (
		property: keyof Settings,
		value: URL,
		/**
		 * Useful when depending on the parameter having version 1, e.g. for use in CloudFormation
		 */
		deleteBeforeUpdate?: boolean,
	): Promise<{ name: string }> =>
		put(ssm)({ stackName, ...ScopeContexts.HELLO_BACKEND })({
			property,
			value: value.toString(),
			deleteBeforeUpdate,
		})

export const deleteSettings =
	({ ssm, stackName }: { ssm: SSMClient; stackName: string }) =>
	async (property: keyof Settings): Promise<{ name: string }> =>
		remove(ssm)({
			stackName,
			...ScopeContexts.HELLO_BACKEND,
		})({
			property,
		})

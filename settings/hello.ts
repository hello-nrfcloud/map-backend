import type { SSMClient } from '@aws-sdk/client-ssm'
import { remove, get, put } from '@bifravst/aws-ssm-settings-helpers'

export type Settings = {
	apiEndpoint: URL
}

const SCOPE = 'hello'
const CONTEXT = 'backend'

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
			}>({ stackName, scope: SCOPE, context: CONTEXT })()
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
		put(ssm)({ stackName, scope: SCOPE, context: CONTEXT })({
			property,
			value: value.toString(),
			deleteBeforeUpdate,
		})

export const deleteSettings =
	({ ssm, stackName }: { ssm: SSMClient; stackName: string }) =>
	async (property: keyof Settings): Promise<{ name: string }> =>
		remove(ssm)({
			stackName,
			scope: SCOPE,
			context: CONTEXT,
		})({
			property,
		})

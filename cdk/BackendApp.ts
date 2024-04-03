import { App } from 'aws-cdk-lib'
import { BackendStack } from './stacks/BackendStack.js'
import { MapBackendStack } from './stacks/BackendStack.js'

export class BackendApp extends App {
	public constructor({
		isTest,
		domain,
		version,
		map: mapArgs,
		...backendArgs
	}: ConstructorParameters<typeof BackendStack>[1] & {
		isTest: boolean
		domain: string
		version: string
		map: ConstructorParameters<typeof MapBackendStack>[1]
	}) {
		super({
			context: {
				isTest,
				domain,
				version,
			},
		})

		new MapBackendStack(this, mapArgs)
	}
}

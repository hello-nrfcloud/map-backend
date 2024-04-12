import { App } from 'aws-cdk-lib'
import { BackendStack } from './stacks/BackendStack.js'

export class BackendApp extends App {
	public constructor({
		isTest,
		version,
		domain,
		...backendArgs
	}: ConstructorParameters<typeof BackendStack>[1] & {
		isTest: boolean
		version: string
		domain: string
	}) {
		super({
			context: {
				isTest,
				version,
				domain,
			},
		})

		new BackendStack(this, backendArgs)
	}
}

export enum Scopes {
	STACK = 'stack',
	HELLO = 'hello',
}

export type ScopeContext = {
	scope: string
	context: string
}

export const ScopeContexts = {
	STACK_JWT: <ScopeContext>{
		scope: Scopes.STACK,
		context: 'jwt',
	},
	HELLO_BACKEND: <ScopeContext>{
		scope: Scopes.HELLO,
		context: 'backend',
	},
} as const

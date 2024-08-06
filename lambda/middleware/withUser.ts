import { aProblem } from '@hello.nrfcloud.com/lambda-helpers/aProblem'
import { HttpStatusCode } from '@hello.nrfcloud.com/proto/hello'
import type { MiddlewareObj } from '@middy/core'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyStructuredResultV2,
	Context,
} from 'aws-lambda'

export const withUser = ({
	verify,
}: {
	verify: (token: string) => WithUser | { error: Error }
}): MiddlewareObj<
	APIGatewayProxyEventV2,
	APIGatewayProxyStructuredResultV2,
	Error,
	Context & WithUser
> => ({
	before: async (req) => {
		const maybeValidJWT = verify(
			req.event.headers.Authorizer?.split(' ')[1] ?? '',
		)
		if ('error' in maybeValidJWT) {
			console.error(`[withUser:jwt]`, maybeValidJWT.error)
			return aProblem({
				title: `Failed to validate JWT!`,
				detail: maybeValidJWT.error.message,
				status: HttpStatusCode.BAD_REQUEST,
			})
		}
		req.context.user = maybeValidJWT.user
		return undefined
	},
})

export type WithUser = {
	user: { email: string }
}

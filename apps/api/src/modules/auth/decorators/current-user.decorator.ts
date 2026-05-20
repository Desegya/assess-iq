import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { AuthUser } from '@assessiq/types'

// Extract the authenticated user from the request object
// Usage: @CurrentUser() user: AuthUser
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>()
    return request.user
  },
)

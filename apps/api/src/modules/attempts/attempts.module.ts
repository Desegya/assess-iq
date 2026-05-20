import { Module } from '@nestjs/common'
import { UattemptsController } from './attempts.controller'
import { UattemptsService } from './attempts.service'

@Module({
  controllers: [UattemptsController],
  providers: [UattemptsService],
  exports: [UattemptsService],
})
export class UattemptsModule {}

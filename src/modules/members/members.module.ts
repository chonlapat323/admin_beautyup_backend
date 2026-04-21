import { Module } from "@nestjs/common";

import { FlowAccountModule } from "../flowaccount/flowaccount.module";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";

@Module({
  imports: [FlowAccountModule],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}

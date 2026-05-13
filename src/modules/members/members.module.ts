import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { FlowAccountModule } from "../flowaccount/flowaccount.module";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";

@Module({
  imports: [FlowAccountModule, AuditLogModule],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}

import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ShadeGroupsController } from "./shade-groups.controller";
import { ShadeGroupsService } from "./shade-groups.service";

@Module({
  imports: [PrismaModule],
  controllers: [ShadeGroupsController],
  providers: [ShadeGroupsService],
})
export class ShadeGroupsModule {}

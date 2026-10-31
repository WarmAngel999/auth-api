import {Module} from "@nestjs/common";
import {BullModule} from "@nestjs/bullmq";
import {MailProcessor} from "./mail.processor";

@Module({
  imports: [BullModule.registerQueue({name:'mail'})],
  providers: [MailProcessor],
  exports: [BullModule],
})
export class MailModule {}

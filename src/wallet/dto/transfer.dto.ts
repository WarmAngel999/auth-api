import { IsInt, Max, Min } from 'class-validator';

export class TransferDto {
  @IsInt()
  @Min(1)
  toUserId: number;

  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amount: number;
}

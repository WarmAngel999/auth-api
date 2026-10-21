import { IsInt, Max, Min } from 'class-validator';

export class DepositDto {
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amount: number;
}

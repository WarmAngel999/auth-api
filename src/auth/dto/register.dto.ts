import { Transform } from 'class-transformer';
import { IsByteLength, IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Пароль должен быть не короче 8 символов' })
  @IsByteLength(0, 72, {
    message:
      'Пароль не должен быть длиннее 72 байт (кириллица занимает 2 байта на символ)',
  })
  password: string;
}

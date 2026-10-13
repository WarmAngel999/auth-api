import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly usersRepo: Repository<User>,
    ) {}

    findByEmail(email: string) {
        return this.usersRepo.findOneBy({ email });
    }

    findById(id: number) {
        return this.usersRepo.findOneBy({ id });
    }
    findAll() {
        return this.usersRepo.find({
            select: { id: true, email: true, role: true },
        });
    }

    setRefreshTokenHash(id: number, hash: string | null) {
        return this.usersRepo.update(id, { refreshTokenHash: hash });
    }

    create(email: string, passwordHash: string) {
        const user = this.usersRepo.create({ email, passwordHash });
        return this.usersRepo.save(user);
    }
}
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { EntityManager } from 'typeorm';

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

  create(email: string, passwordHash: string, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(User) : this.usersRepo;
    const user = repo.create({ email, passwordHash });
    return repo.save(user);
  }
}

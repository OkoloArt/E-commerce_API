import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { UserDto } from '../libs/dto/create-user.dto';
import { PasswordUpdateDto, UpdateUserDto } from '../libs/dto/update-user.dto';
import { Repository } from 'typeorm';
import { User } from '../libs/typeorm/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { ProductService } from 'src/product/product.service';
import { Product } from 'src/libs/typeorm/product.entity';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { NotificationService } from 'src/notification/notification.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Inject(forwardRef(() => ProductService))
    private readonly productService: ProductService,
    private readonly scheduleRegistry: SchedulerRegistry,
    private readonly notificationService: NotificationService,
  ) {}

  async create(
    userDto: UserDto,
  ): Promise<{ status: number; message: string; user: User }> {
    const { email } = userDto;
    const userExists = await this.findUserByEmail(email);

    if (userExists) {
      throw new ConflictException('Email already exists');
    }

    const user = this.userRepo.create(userDto);
    const newUser = await this.userRepo.save(user);
    return {
      status: 200,
      message: 'User was created successfully',
      user: newUser,
    };
  }

  async findAll(): Promise<Omit<User, 'password'>[]> {
    const allUsers = await this.userRepo.find();

    const usersWithoutPasswords = allUsers.map(({ password, ...rest }) => rest);

    return usersWithoutPasswords;
  }

  async findOne(username: string): Promise<User> {
    const foundUser = await this.userRepo.findOneBy({ username });

    if (!foundUser)
      throw new NotFoundException(
        'Whoopsie! 🧙‍♂️ No magic user here! Stir up some registration potion and join the fun. See you in the enchanted user realm! ✨',
      );

    // const { password, ...rest } = foundUser;

    return foundUser;
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(
        'Whoopsie! 🧙‍♂️ No magic user here! Stir up some registration potion and join the fun. See you in the enchanted user realm! ✨',
      );
    }
    return user;
  }

  async getCurrentUser(username: string): Promise<Omit<User, 'password'>> {
    const foundUser = await this.userRepo.findOneBy({ username });

    if (!foundUser)
      throw new NotFoundException(
        'Whoopsie! 🧙‍♂️ No magic user here! Stir up some registration potion and join the fun. See you in the enchanted user realm! ✨',
      );

    const { password, ...rest } = foundUser;

    return rest;
  }

  async update(
    username: string,
    updateUserDto: UpdateUserDto | PasswordUpdateDto,
  ): Promise<{ message: string; user: Omit<User, 'password'> }> {
    const user = await this.findOne(username);

    if ('password' in updateUserDto) {
      // Handle password update logic
      user.password = updateUserDto.password;
    } else {
      // Handle non-password update logic
      Object.assign(user, updateUserDto);
    }

    const updatedUser = await this.userRepo.save(user);
    const { password, ...rest } = updatedUser;

    return {
      message: 'User was updated successfully',
      user: rest,
    };
  }

  async remove(
    username: string,
  ): Promise<{ status: boolean; message: string }> {
    const userToDelete = await this.findOne(username);

    await this.userRepo.remove(userToDelete);
    return {
      status: true,
      message: 'User was deleted successfully',
    };
  }

  async findUserByEmail(email: string) {
    return this.userRepo.findOneBy({ email });
  }

  async addToCart(userId: string, productId: string) {
    const user = await this.getUserById(userId);

    user.userCart = user.userCart || [];
    user.userCart.push(productId);

    await this.userRepo.save(user);

    return {
      message: 'Added successfully',
    };
  }

  async getProductsInCart(
    userId: string,
  ): Promise<Product[] | { message: string }> {
    const user = await this.getUserById(userId);
    const product: Product[] = [];

    if (user.userCart === null) {
      return {
        message:
          "Oopsie! Your cart feels a bit lonely. Toss in a product and let's get this shopping party started",
      };
    }

    if (user.userCart.length === 0) {
      return {
        message:
          "Oopsie! Your cart feels a bit lonely. Toss in a product and let's get this shopping party started",
      };
    }

    for (const productId of user.userCart) {
      product.push(await this.productService.getProduct(productId));
    }

    return product;
  }

  async notifyUser(userId: string, shouldNotify: boolean) {
    const user = await this.getUserById(userId);
    const jobName = `${user.username}-notify`;

    if (user.userCart === null) {
      return {
        message:
          "Oopsie! Your cart feels a bit lonely. Toss in a product and let's get this shopping party started",
      };
    }

    if (user.userCart.length === 0) {
      return {
        message:
          "Oopsie! Your cart feels a bit lonely. Toss in a product and let's get this shopping party started",
      };
    }

    if (shouldNotify) {
      const job = new CronJob(`0 0 11 * * *`, async () => {
        console.log(`Sending notification to user: ${userId}`);
        this.notificationService.createNotification(
          "Items are still in your cart! Ready to buy? Head to checkout whenever you're set. Happy shopping! 🎉",
        );
      });
      this.scheduleRegistry.addCronJob(jobName, job as any);
      job.start();

      return {
        message:
          "User will be notified when there's an outstanding product(s) in cart",
      };
    } else {
      const job = this.scheduleRegistry.getCronJob(jobName);
      if (job) {
        job.stop();
        this.scheduleRegistry.deleteCronJob(jobName);
      } else {
        console.log(`No cron job found with the name: ${jobName}`);
        // Handle this case as per your requirements
      }
      return { message: 'User notification stopped' }; // Return a message here
    }
  }
}

import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { UserModule } from 'src/user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from 'src/libs/typeorm/product.entity';
import { User } from 'src/libs/typeorm/user.entity';
import { FileUploadModule } from 'src/file-upload/file-upload.module';

@Module({
  imports: [
    UserModule,
    FileUploadModule,
    TypeOrmModule.forFeature([Product, User]),
  ],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule {}

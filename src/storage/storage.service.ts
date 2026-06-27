import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type UploadFileInput = {
  key: string;
  buffer: Buffer;
  contentType: string;
};

@Injectable()
export class StorageService {
  private client: SupabaseClient | null = null;

  constructor(private readonly configService: ConfigService) {}

  async upload(input: UploadFileInput) {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .upload(input.key, input.buffer, {
        cacheControl: '3600',
        contentType: input.contentType,
        upsert: false,
      });

    if (error) {
      throw new InternalServerErrorException(
        `Could not upload file to storage: ${error.message}`,
      );
    }

    return { key: data.path };
  }

  async remove(key: string) {
    const { error } = await this.supabase.storage.from(this.bucket).remove([key]);

    if (error) {
      throw new InternalServerErrorException(
        `Could not remove file from storage: ${error.message}`,
      );
    }
  }

  async createSignedUrl(key: string, expiresInSeconds = 3600) {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(key, expiresInSeconds);

    if (error) {
      throw new InternalServerErrorException(
        `Could not create signed URL: ${error.message}`,
      );
    }

    return data.signedUrl;
  }

  private get supabase() {
    if (!this.client) {
      const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
      const serviceRoleKey = this.configService.get<string>(
        'SUPABASE_SERVICE_ROLE_KEY',
      );

      if (!supabaseUrl || !serviceRoleKey) {
        throw new ServiceUnavailableException(
          'Supabase Storage is not configured',
        );
      }

      this.client = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }

    return this.client;
  }

  private get bucket() {
    const bucket = this.configService.get<string>('SUPABASE_STORAGE_BUCKET');

    if (!bucket) {
      throw new ServiceUnavailableException('Supabase Storage bucket is missing');
    }

    return bucket;
  }
}
